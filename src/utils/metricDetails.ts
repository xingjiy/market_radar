/**
 * 市场全景指标卡 L2 详情（层级内容展示）
 * 纯函数：由快照派生数据生成六板块详情面板数据，组件层只做渲染。
 * 口径与《A股市场雷达 Radar OS 产品设计文档》第 7.2 / 8.3 节一致。
 */
import type { MetricDetail, MetricKey, Sector } from '../data/mock'

export interface MetricDetailInput {
  breadth: { up: number; down: number; flat: number }
  limitUp: number
  limitDown: number
  brokenBoard: number
  turnoverYi: number
  shTurnoverYi: number
  szTurnoverYi: number
  avgTurnoverYi: number
  concentration: number
  sectors: Sector[]
  totalFlowYi: number
}

const pctText = (value: number, digits = 1): string => `${value.toFixed(digits)}%`
const signedText = (value: number, digits = 1): string => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`
const flowText = (value: number): string => `${value > 0 ? '+' : ''}${value.toFixed(1)}亿`
const clamp100 = (value: number): number => Math.min(100, Math.max(0, value))

interface FlowRow {
  label: string
  flowYi: number
}

/** 排行行构造：按 |资金| 占比给出横向条宽度 */
function toRank(rows: FlowRow[], count: number, base: number) {
  return rows.slice(0, count).map((r) => ({
    label: r.label,
    value: flowText(r.flowYi),
    tone: r.flowYi >= 0 ? ('up' as const) : ('down' as const),
    pct: clamp100((Math.abs(r.flowYi) / base) * 100)
  }))
}

export function buildMetricDetails(input: MetricDetailInput): Record<MetricKey, MetricDetail> {
  const {
    breadth: b,
    limitUp,
    limitDown,
    brokenBoard,
    turnoverYi,
    shTurnoverYi,
    szTurnoverYi,
    avgTurnoverYi,
    concentration,
    sectors,
    totalFlowYi
  } = input

  const total = b.up + b.down + b.flat
  const upPct = total > 0 ? (b.up / total) * 100 : 50
  const downPct = total > 0 ? (b.down / total) * 100 : 0
  const flatPct = total > 0 ? (b.flat / total) * 100 : 0
  const breadthDiff = b.up - b.down

  const pool = limitUp + brokenBoard
  const sealRate = pool > 0 ? (limitUp / pool) * 100 : 0
  const brokenRate = pool > 0 ? (brokenBoard / pool) * 100 : 0

  const turnoverDelta = turnoverYi && avgTurnoverYi ? ((turnoverYi - avgTurnoverYi) / avgTurnoverYi) * 100 : 0
  const shPct = turnoverYi > 0 ? (shTurnoverYi / turnoverYi) * 100 : 50
  const szPct = turnoverYi > 0 ? (szTurnoverYi / turnoverYi) * 100 : 50

  // 板块主力净流入排行
  const flowRows: FlowRow[] = sectors
    .map((s) => ({ label: s.name, flowYi: s.flowYi ?? 0 }))
    .sort((a, b) => b.flowYi - a.flowYi)
  const inflow = flowRows.filter((r) => r.flowYi > 0)
  const outflowDesc = flowRows.filter((r) => r.flowYi < 0).reverse()
  const posSum = inflow.reduce((acc, r) => acc + r.flowYi, 0)
  const absSum = Math.max(flowRows.reduce((acc, r) => acc + Math.abs(r.flowYi), 0), 1)

  const heatTop = inflow.slice(0, 3).map((r) => ({
    label: r.label,
    value: flowText(r.flowYi),
    tone: 'up' as const,
    pct: posSum > 0 ? clamp100((r.flowYi / posSum) * 100) : 0
  }))

  const totalText = turnoverYi ? `${(turnoverYi / 10000).toFixed(2)} 万亿` : '--'

  return {
    breadth: {
      key: 'breadth',
      title: '上涨 / 下跌',
      caption: '全 A 当日涨跌平家数（沪 + 深），反映市场广度',
      main: { label: '上涨家数', value: b.up.toLocaleString(), tone: breadthDiff >= 0 ? 'up' : 'down' },
      verdict:
        upPct >= 55 ? { text: '普涨格局', tone: 'up' } : upPct >= 45 ? { text: '涨跌分化', tone: 'flat' } : { text: '普跌格局', tone: 'down' },
      stats: [
        { label: '下跌家数', value: b.down.toLocaleString(), tone: 'down' },
        { label: '平盘家数', value: b.flat.toLocaleString(), tone: 'flat' },
        { label: '涨跌差', value: `${breadthDiff > 0 ? '+' : ''}${breadthDiff.toLocaleString()}`, tone: breadthDiff >= 0 ? 'up' : 'down' },
        { label: '上涨占比', value: pctText(upPct), tone: upPct >= 50 ? 'up' : 'down' }
      ],
      ratio: {
        segments: [
          { label: '上涨', pct: upPct, tone: 'up' },
          { label: '下跌', pct: downPct, tone: 'down' },
          { label: '平盘', pct: flatPct, tone: 'flat' }
        ]
      },
      note: '上涨占比 = 上涨家数 /（上涨 + 下跌 + 平盘）；涨跌差 = 上涨 - 下跌'
    },
    limit: {
      key: 'limit',
      title: '涨停 / 跌停',
      caption: '涨停/跌停/炸板来自东财涨停池，衡量短线打板情绪',
      main: { label: '涨停家数', value: String(limitUp), tone: 'up' },
      verdict:
        sealRate >= 70 ? { text: '封板强劲', tone: 'up' } : sealRate >= 50 ? { text: '封板一般', tone: 'flat' } : { text: '封板偏弱', tone: 'down' },
      stats: [
        { label: '跌停家数', value: String(limitDown), tone: 'down' },
        { label: '炸板家数', value: String(brokenBoard), tone: 'down' },
        { label: '封板率', value: pctText(sealRate), tone: sealRate >= 60 ? 'up' : 'down' },
        { label: '涨停-跌停', value: signedText(limitUp - limitDown, 0), tone: limitUp >= limitDown ? 'up' : 'down' }
      ],
      ratio: {
        segments: [
          { label: '封板', pct: sealRate, tone: 'up' },
          { label: '炸板', pct: brokenRate, tone: 'down' }
        ]
      },
      note: '封板率 = 涨停 /（涨停 + 炸板）；炸板率 = 炸板 /（涨停 + 炸板）。涨停池个股明细为 V2 规划'
    },
    turnover: {
      key: 'turnover',
      title: '两市成交额',
      caption: '沪市 + 深市指数成交额合计，衡量市场活跃度',
      main: { label: '两市合计', value: totalText, tone: turnoverDelta >= 0 ? 'up' : 'down' },
      verdict:
        turnoverDelta >= 5 ? { text: '明显放量', tone: 'up' } : turnoverDelta <= -5 ? { text: '明显缩量', tone: 'down' } : { text: '量能平稳', tone: 'flat' },
      stats: [
        { label: '沪市成交额', value: `${Math.round(shTurnoverYi).toLocaleString()} 亿`, tone: 'flat' },
        { label: '深市成交额', value: `${Math.round(szTurnoverYi).toLocaleString()} 亿`, tone: 'flat' },
        { label: '沪市占比', value: pctText(shPct), tone: 'flat' },
        { label: '较基准', value: `${signedText(turnoverDelta)}%`, tone: turnoverDelta >= 0 ? 'up' : 'down', hint: '近 5 日均额（Mock）' }
      ],
      ratio: {
        segments: [
          { label: '沪市', pct: shPct, tone: 'up' },
          { label: '深市', pct: szPct, tone: 'down' }
        ]
      },
      note: '较 5 日均值以近 5 日平均成交额（Mock 基准）估算；盘中为实时估算'
    },
    broken: {
      key: 'broken',
      title: '炸板率',
      caption: '曾涨停后开板家数占比，衡量打板情绪风险',
      main: { label: '炸板率', value: pctText(brokenRate), tone: brokenRate >= 35 ? 'down' : brokenRate >= 20 ? 'flat' : 'up' },
      verdict:
        brokenRate < 20 ? { text: '情绪健康', tone: 'up' } : brokenRate < 35 ? { text: '情绪偏热', tone: 'flat' } : { text: '炸板风险高', tone: 'down' },
      stats: [
        { label: '炸板家数', value: String(brokenBoard), tone: 'down' },
        { label: '封板家数', value: String(limitUp), tone: 'up' },
        { label: '封板率', value: pctText(sealRate), tone: sealRate >= 60 ? 'up' : 'down' },
        { label: '涨停池规模', value: String(pool), tone: 'flat' }
      ],
      ratio: {
        segments: [
          { label: '封板', pct: sealRate, tone: 'up' },
          { label: '炸板', pct: brokenRate, tone: 'down' }
        ]
      },
      note: '炸板率 = 炸板 /（涨停 + 炸板）。炸板率越高，短线接力情绪越弱'
    },
    heat: {
      key: 'heat',
      title: '热点集中度',
      caption: 'TOP3 板块主力净流入占正流入板块合计的比重，衡量主线集中度',
      main: { label: '集中度', value: concentration.toFixed(1), tone: concentration >= 70 ? 'up' : 'flat' },
      verdict:
        concentration >= 70 ? { text: '主线高度集中', tone: 'up' } : concentration >= 50 ? { text: '主线相对集中', tone: 'flat' } : { text: '热点多点分散', tone: 'down' },
      stats: [
        { label: 'TOP1 板块', value: inflow[0] ? `${inflow[0].label} ${flowText(inflow[0].flowYi)}` : '--', tone: 'up' },
        { label: 'TOP2 板块', value: inflow[1] ? `${inflow[1].label} ${flowText(inflow[1].flowYi)}` : '--', tone: 'up' },
        { label: 'TOP3 板块', value: inflow[2] ? `${inflow[2].label} ${flowText(inflow[2].flowYi)}` : '--', tone: 'up' },
        { label: '正流入板块', value: `${inflow.length} 个`, tone: 'flat' }
      ],
      ranking: [{ title: '板块资金占比 TOP', rows: heatTop }],
      note: '集中度 = TOP3 正流入板块主力净流入 / 全部正流入板块合计；资金缺失时按成交额口径，仍无数据回退 Mock'
    },
    flow: {
      key: 'flow',
      title: '主力净流入',
      caption: '上榜行业板块主力净流入（主力 = 大单 + 特大单）',
      main: { label: '板块合计', value: flowText(totalFlowYi), tone: totalFlowYi >= 0 ? 'up' : 'down' },
      verdict: totalFlowYi >= 0 ? { text: '主力净流入', tone: 'up' } : { text: '主力净流出', tone: 'down' },
      stats: [
        { label: '净流入板块', value: `${inflow.length} 个`, tone: 'up' },
        { label: '净流出板块', value: `${outflowDesc.length} 个`, tone: 'down' },
        { label: '流入最大', value: inflow[0] ? `${inflow[0].label} ${flowText(inflow[0].flowYi)}` : '--', tone: 'up' },
        { label: '流出最大', value: outflowDesc[0] ? `${outflowDesc[0].label} ${flowText(outflowDesc[0].flowYi)}` : '--', tone: 'down' }
      ],
      ranking: [
        { title: '净流入 TOP', rows: toRank(inflow, 5, absSum) },
        { title: '净流出 TOP', rows: toRank(outflowDesc, 5, absSum) }
      ],
      note: '仅统计快照上榜行业板块（约 8 个），非全市场口径；净流出榜按流出绝对值降序'
    }
  }
}