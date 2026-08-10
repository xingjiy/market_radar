/**
 * Mock 数据与类型契约（与《产品设计文档》第 6 章一致）
 * 类型契约保持稳定：后续接入真实 API 时仅替换 services 层，组件无需改动。
 */

export type Trend = 'up' | 'down' | 'flat'

/** 市场全景六指标卡标识（用于 L2 详情映射） */
export type MetricKey = 'breadth' | 'limit' | 'turnover' | 'broken' | 'heat' | 'flow'

/** 指标 L2 详情：单个分项统计 */
export interface MetricStat {
  label: string
  value: string
  tone?: Trend
  hint?: string
}

/** 占比条分段 */
export interface MetricRatioSegment {
  label: string
  pct: number
  tone: Trend
}

/** 排行行 */
export interface MetricRankRow {
  label: string
  value: string
  tone?: Trend
  pct?: number
}

/** 排行列表（支持双列） */
export interface MetricRanking {
  title: string
  rows: MetricRankRow[]
}

/** 指标卡 L2 详情面板数据（层级内容展示） */
export interface MetricDetail {
  key: MetricKey
  title: string
  caption: string
  main: { label: string; value: string; tone: Trend }
  verdict: { text: string; tone: Trend }
  stats: MetricStat[]
  ratio?: { segments: MetricRatioSegment[] }
  ranking?: MetricRanking[]
  note: string
}

export interface Metric {
  key: MetricKey
  label: string
  value: string
  delta: string
  tone: Trend
  icon: string
}

export interface MarketBreadth {
  up: number
  down: number
  flat: number
}

/** 市场温度扩展字段（涨停/跌停/炸板/成交额），实时接口缺失时回退此默认值 */
export interface MarketExtras {
  limitUp: number
  limitDown: number
  brokenBoard: number
  turnoverYi: number
  avgTurnoverYi: number
  /** 沪市成交额（亿） */
  shTurnoverYi: number
  /** 深市成交额（亿） */
  szTurnoverYi: number
}

export const marketExtras: MarketExtras = {
  limitUp: 68,
  limitDown: 14,
  brokenBoard: 32,
  turnoverYi: 11800,
  avgTurnoverYi: 11000,
  shTurnoverYi: 5200,
  szTurnoverYi: 6600
}

export const marketMetrics: Metric[] = [
  { key: 'breadth', label: '上涨 / 下跌', value: '2,517 / 2,566', delta: '-49', tone: 'down', icon: 'TrendCharts' },
  { key: 'limit', label: '涨停 / 跌停', value: '68 / 14', delta: '+8 / -3', tone: 'up', icon: 'Lightning' },
  { key: 'turnover', label: '两市成交额', value: '1.18 万亿', delta: '+6.4%', tone: 'up', icon: 'DataLine' },
  { key: 'broken', label: '炸板率', value: '28.6%', delta: '+4.2%', tone: 'down', icon: 'Warning' },
  { key: 'heat', label: '热点集中度', value: '72.4', delta: '+11.8', tone: 'up', icon: 'Aim' },
  { key: 'flow', label: '主力净流入', value: '+42.6 亿', delta: '净流入', tone: 'up', icon: 'Coin' }
]

export const breadth: MarketBreadth = { up: 2517, down: 2566, flat: 398 }

export interface Emotion {
  score: number
  label: string
  change: string
  tags: string[]
  note: string
  confidence: number
}

export const emotion: Emotion = {
  score: 54.5,
  label: '中性偏强',
  change: '+3.8',
  tags: ['半导体', '元件', '光学光电'],
  note: '半导体板块资金净流入 160.6 亿元，核心方向为半导体行业及其细分分支。',
  confidence: 78
}

export const pulseSeries: Record<string, number[]> = {
  '今日': [42, 46, 44, 51, 55, 53, 58, 57, 61, 63, 59, 65],
  '本周': [36, 41, 39, 45, 43, 49, 52, 48, 55, 57, 61, 64],
  '本月': [48, 44, 46, 42, 49, 53, 51, 55, 57, 54, 59, 64]
}

export const timeLabels: Record<string, string[]> = {
  '今日': ['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:20', '14:40', '14:50', '15:00'],
  '本周': ['周一', '周一', '周二', '周二', '周三', '周三', '周四', '周四', '周五', '周五', '收盘前', '收盘'],
  '本月': ['06/01', '06/03', '06/05', '06/10', '06/12', '06/16', '06/18', '06/23', '06/25', '06/27', '06/30', '07/01']
}

export interface SentimentFactor {
  name: string
  value: number
}

export const sentimentRadar: SentimentFactor[] = [
  { name: '赚钱效应', value: 62 },
  { name: '资金活跃', value: 70 },
  { name: '热点强度', value: 76 },
  { name: '连板高度', value: 48 },
  { name: '市场宽度', value: 44 },
  { name: '风险偏好', value: 52 }
]

export interface Sector {
  name: string
  change: number // 涨跌幅 %
  amount: string // 成交额/净流入（展示字符串）
  leader: string // 领涨股 / 板块代码
  heat: number // 热度 0-100
  trend: Trend
  score?: number // 板块强度评分（计算字段）
  amountYi?: number // 成交额（亿）
  flowYi?: number // 主力净流入（亿）
  limitUpCount?: number // 涨停家数
}

export const sectors: Sector[] = [
  { name: '半导体', change: 4.68, amount: '160.6亿', leader: '寒武纪', heat: 96, trend: 'up', score: 92, amountYi: 160.6, flowYi: 35.2, limitUpCount: 12 },
  { name: '光学光电', change: 3.92, amount: '86.4亿', leader: '水晶光电', heat: 90, trend: 'up', score: 86, amountYi: 86.4, flowYi: 18.6, limitUpCount: 8 },
  { name: '消费电子', change: 3.16, amount: '72.8亿', leader: '立讯精密', heat: 84, trend: 'up', score: 80, amountYi: 72.8, flowYi: 15.2, limitUpCount: 6 },
  { name: 'AI算力', change: 2.74, amount: '64.2亿', leader: '工业富联', heat: 82, trend: 'up', score: 76, amountYi: 64.2, flowYi: 11.4, limitUpCount: 5 },
  { name: '机器人', change: 1.86, amount: '42.1亿', leader: '拓斯达', heat: 76, trend: 'up', score: 68, amountYi: 42.1, flowYi: 6.8, limitUpCount: 3 },
  { name: '新能源车', change: -0.46, amount: '-18.2亿', leader: '比亚迪', heat: 48, trend: 'down', score: 42, amountYi: 41.8, flowYi: -3.2, limitUpCount: 0 }
]

export interface RotationItem {
  name: string
  value: number
  change: number
}

export const rotationData: RotationItem[] = [
  { name: '半导体', value: 38, change: 4.68 },
  { name: '光学光电', value: 28, change: 3.92 },
  { name: '消费电子', value: 24, change: 3.16 },
  { name: 'AI算力', value: 22, change: 2.74 },
  { name: '机器人', value: 18, change: 1.86 },
  { name: '军工', value: 14, change: 1.12 },
  { name: '医药', value: 12, change: -0.64 },
  { name: '新能源', value: 10, change: -1.12 },
  { name: '银行', value: 8, change: -0.38 }
]

export interface ETF {
  code: string
  name: string
  price: string
  change: number
  amount: string
  flow: string
  signal: string
  score?: number // ETF 综合评分（计算字段）
  amountYi?: number // 成交额（亿）
  flowYi?: number // 资金净流入（亿）
  trendScore?: number // 价格趋势分（内部）
  activityScore?: number // 成交活跃分（内部）
}

export const etfs: ETF[] = [
  { code: '588000', name: '科创50ETF', price: '1.046', change: 3.18, amount: '42.7亿', flow: '+8.62亿', signal: '强势放量', score: 88, amountYi: 42.7, flowYi: 8.62, trendScore: 82, activityScore: 74 },
  { code: '159995', name: '芯片ETF', price: '1.182', change: 4.52, amount: '36.1亿', flow: '+6.24亿', signal: '资金抢筹', score: 92, amountYi: 36.1, flowYi: 6.24, trendScore: 90, activityScore: 70 },
  { code: '159819', name: '人工智能ETF', price: '1.031', change: 2.76, amount: '18.4亿', flow: '+2.18亿', signal: '趋势增强', score: 76, amountYi: 18.4, flowYi: 2.18, trendScore: 72, activityScore: 60 },
  { code: '512480', name: '半导体ETF', price: '1.245', change: 4.12, amount: '15.8亿', flow: '+3.06亿', signal: '高位换手', score: 84, amountYi: 15.8, flowYi: 3.06, trendScore: 78, activityScore: 66 },
  { code: '510300', name: '沪深300ETF', price: '4.012', change: -0.18, amount: '24.8亿', flow: '-1.32亿', signal: '宽幅震荡', score: 52, amountYi: 24.8, flowYi: -1.32, trendScore: 45, activityScore: 58 }
]

export interface WatchItem {
  code: string
  name: string
  type: '股票' | 'ETF'
  price: string
  change: number
  flow: string
  status: string
  starred: boolean
}

export const watchlist: WatchItem[] = [
  { code: '688256', name: '寒武纪-U', type: '股票', price: '682.60', change: 8.12, flow: '+2.64亿', status: '主升浪', starred: true },
  { code: '002371', name: '北方华创', type: '股票', price: '401.20', change: 5.42, flow: '+1.86亿', status: '趋势向上', starred: true },
  { code: '300782', name: '卓胜微', type: '股票', price: '95.68', change: -1.24, flow: '-0.42亿', status: '观察', starred: false },
  { code: '588000', name: '科创50ETF', type: 'ETF', price: '1.046', change: 3.18, flow: '+8.62亿', status: '资金共振', starred: true },
  { code: '159995', name: '芯片ETF', type: 'ETF', price: '1.182', change: 4.52, flow: '+6.24亿', status: '加速', starred: false }
]

export interface AiBrief {
  status: string
  summary: string
  actions: string[]
  riskTips: string[]
  confidence: number
  generatedAt: string
  metrics: { pulse: number; emotion: number; breadthScore: number }
}

export const aiBrief: AiBrief = {
  status: '震荡轮动 · 等待聚焦',
  summary: '资金从大盘权重向科技成长切换，半导体与光学光电形成共振。市场宽度尚未同步放大，短线情绪偏强但不宜追高。',
  actions: ['关注半导体 ETF 的量价延续', '观察科创 50 能否站稳 1050', '警惕高位连板股炸板率回升'],
  riskTips: ['高位连板股炸板率回升', '市场宽度尚未同步放大'],
  confidence: 78,
  generatedAt: '今日 15:08',
  metrics: { pulse: 56.3, emotion: 54.5, breadthScore: 49 }
}
