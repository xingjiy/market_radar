/**
 * 指标计算引擎（纯函数）
 * 口径与《A股市场雷达 Radar OS 产品设计文档》第 7 章一致。
 * 设计原则：任一子指标缺失时自动按可用权重重新归一化，缺失因子计入置信度。
 */

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

/** min-max 归一化到 0-100 */
export function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 50
  if (max <= min) return 50
  return clamp(((value - min) / (max - min)) * 100, 0, 100)
}

/** 带权合成：缺失项（null）自动剔除并按剩余权重归一 */
function weighted(items: Array<[number | null | undefined, number]>): number {
  let sum = 0
  let weightSum = 0
  for (const [value, weight] of items) {
    if (value === null || value === undefined || !Number.isFinite(value)) continue
    sum += value * weight
    weightSum += weight
  }
  if (weightSum === 0) return 50
  return Math.round((sum / weightSum) * 10) / 10
}

export interface SectorScoreInput {
  change?: number // 涨跌幅 %
  amountYi?: number // 成交额（亿）
  flowYi?: number // 主力净流入（亿）
  limitUpCount?: number // 涨停家数
}

export interface ScoreContext {
  maxChange: number
  maxAmount: number
  maxFlow: number
  maxLimitUp: number
}

/**
 * 板块强度评分：涨幅30% + 成交额20% + 资金流30% + 涨停数20%
 * 各分项先做板块间 min-max 归一化到 0-100。
 */
export function computeSectorScore(input: SectorScoreInput, ctx: ScoreContext): number {
  const changeScore = input.change === undefined ? null : normalize(input.change, -ctx.maxChange, ctx.maxChange)
  const amountScore = input.amountYi === undefined ? null : normalize(input.amountYi, 0, ctx.maxAmount)
  const flowScore = input.flowYi === undefined ? null : normalize(input.flowYi, -ctx.maxFlow, ctx.maxFlow)
  const limitUpScore = input.limitUpCount === undefined ? null : normalize(input.limitUpCount, 0, ctx.maxLimitUp)
  return weighted([
    [changeScore, 0.3],
    [amountScore, 0.2],
    [flowScore, 0.3],
    [limitUpScore, 0.2]
  ])
}

export interface EtfScoreInput {
  trendScore?: number // 价格趋势 0-100（30%）
  flowScore?: number // 资金流 0-100（30%）
  activityScore?: number // 成交活跃 0-100（20%）
  sectorScore?: number // 所属板块强度 0-100（20%）
}

/** ETF 综合评分：价格趋势30% + 资金流30% + 成交活跃20% + 板块强度20% */
export function computeEtfScore(input: EtfScoreInput): number {
  return weighted([
    [input.trendScore, 0.3],
    [input.flowScore, 0.3],
    [input.activityScore, 0.2],
    [input.sectorScore, 0.2]
  ])
}

/** ETF 雷达信号（与已实现 signal 规则一致，见设计文档 7.6） */
export function inferEtfSignal(change: number, flowYi?: number | null): string {
  const hasFlow = flowYi !== null && flowYi !== undefined
  if (hasFlow && flowYi > 0 && change >= 3) return '强势放量'
  if (hasFlow && flowYi > 0 && change > 0) return '资金抢筹'
  if (change >= 3) return '强势放量'
  if (change > 0) return '趋势增强'
  if (hasFlow && flowYi < 0) return '资金流出'
  return '宽幅震荡'
}

export type PulseTone = 'freeze' | 'weak' | 'range' | 'strong' | 'hot'

/** 市场脉冲指数五档分级（PRD） */
export function pulseLevel(score: number): { label: string; tone: PulseTone } {
  if (score <= 25) return { label: '冰点', tone: 'freeze' }
  if (score <= 50) return { label: '偏弱', tone: 'weak' }
  if (score <= 70) return { label: '震荡', tone: 'range' }
  if (score <= 90) return { label: '强势', tone: 'strong' }
  return { label: '高热度', tone: 'hot' }
}

/** 情绪评分标签映射 */
export function emotionLabel(score: number): string {
  if (score < 30) return '恐慌'
  if (score < 50) return '偏弱'
  if (score < 70) return '中性'
  return '偏强'
}

/** 置信度：缺失因子每个扣 15 分，下限 40 */
export function computeConfidence(available: number, total: number): number {
  const missing = Math.max(0, total - available)
  return Math.max(40, 100 - missing * 15)
}

/**
 * 市场情绪雷达六因子（设计文档 7.3）
 * 基于快照可得字段计算；字段缺失时使用默认值并标记 has=false。
 */
export interface EmotionFactors {
  names: string[]
  values: number[]
  available: number
  total: number
}

export interface EmotionInput {
  breadthUp: number
  breadthDown: number
  limitUp?: number
  limitDown?: number
  brokenBoard?: number
  turnoverYi?: number
  avgTurnoverYi?: number
}

export function computeEmotionFactors(input: EmotionInput): EmotionFactors {
  const total = input.breadthUp + input.breadthDown
  const breadthRatio = total > 0 ? input.breadthUp / total : 0.5

  const factors: Array<{ name: string; value: number; has: boolean }> = []

  // 赚钱效应：上涨占比
  factors.push({ name: '赚钱效应', value: Math.round(breadthRatio * 100), has: total > 0 })

  // 资金活跃：成交额相对近 5 日均额
  const turnoverYi = input.turnoverYi
  const hasTurnover = turnoverYi !== undefined && turnoverYi > 0
  const activity = hasTurnover && input.avgTurnoverYi && turnoverYi !== undefined
    ? normalize(turnoverYi, input.avgTurnoverYi * 0.7, input.avgTurnoverYi * 1.4)
    : 50
  factors.push({ name: '资金活跃', value: Math.round(activity), has: hasTurnover })

  // 热点强度：涨停家数
  const hasLimitUp = input.limitUp !== undefined && input.limitUp > 0
  factors.push({
    name: '热点强度',
    value: hasLimitUp ? Math.round(clamp(30 + (input.limitUp ?? 0) * 1.2, 0, 100)) : 50,
    has: hasLimitUp
  })

  // 连板高度：暂无独立数据源，默认 48
  factors.push({ name: '连板高度', value: 48, has: false })

  // 市场宽度：上涨占比
  factors.push({ name: '市场宽度', value: Math.round(breadthRatio * 100), has: total > 0 })

  // 风险偏好：炸板率与跌停反向映射
  const hasRisk = input.brokenBoard !== undefined && input.limitDown !== undefined
  const riskScore = hasRisk
    ? Math.round(clamp(100 - (input.brokenBoard ?? 0) * 1.5 - (input.limitDown ?? 0) * 1.2, 0, 100))
    : 50
  factors.push({ name: '风险偏好', value: riskScore, has: hasRisk })

  return {
    names: factors.map((f) => f.name),
    values: factors.map((f) => f.value),
    available: factors.filter((f) => f.has).length,
    total: factors.length
  }
}

export interface PulseInput {
  breadthScore: number // 涨跌比例
  limitUpScore: number // 涨停数量
  flowScore: number // 主力资金
  turnoverScore: number // 成交量
  heatScore: number // 热点强度
  volatilityScore: number // 市场波动（反向）
}

/** 市场脉冲指数：权重 25/20/20/15/10/10（PRD） */
export function computePulse(input: PulseInput): number {
  const score =
    input.breadthScore * 0.25 +
    input.limitUpScore * 0.2 +
    input.flowScore * 0.2 +
    input.turnoverScore * 0.15 +
    input.heatScore * 0.1 +
    input.volatilityScore * 0.1
  return Math.round(score * 10) / 10
}

/** 解析 '160.6亿' / '1.18万亿' 形式的展示字符串为数值（亿） */
export function parseYi(text: string | undefined | null): number | undefined {
  if (text === undefined || text === null) return undefined
  const trimmed = String(text).replace(/[+\s]/g, '')
  const match = /^(-?[\d.]+)(万亿|亿)?$/.exec(trimmed)
  if (!match) return undefined
  const value = Number(match[1])
  if (!Number.isFinite(value)) return undefined
  return match[2] === '万亿' ? value * 10000 : value
}

