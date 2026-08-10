import { httpGet } from './http'

/** 腾讯全量行情 */
export interface StockQuote {
  name: string
  code: string
  price: number | null
  prevClose: number | null
  open: number | null
  high: number | null
  low: number | null
  change: number | null
  changePct: number | null
  volumeHand: number | null // 成交量（手）
  amountWan: number | null // 成交额（万元）
  turnoverRate: number | null // 换手率 %
  pe: number | null // 市盈率（动）
  peTTM: number | null
  pb: number | null
  amplitude: number | null // 振幅 %
  floatMcYi: number | null // 流通市值（亿）
  totalMcYi: number | null // 总市值（亿）
  limitUp: number | null
  limitDown: number | null
  volumeRatio: number | null // 量比
  avgPrice: number | null // 均价
  outer: number | null // 外盘（手）
  inner: number | null // 内盘（手）
  time: string // YYYYMMDDHHMMSS
}

/** 分时单点 */
export interface MinutePoint {
  time: string
  price: number
  volume: number // 每分钟成交量（手）
  amount: number // 每分钟成交额（元）
  cumVol: number
  cumAmount: number
  avg: number // 均价线
}

export interface StockDetail {
  source: 'tencent' | 'eastmoney'
  code: string
  market: string
  symbol: string
  quote: StockQuote
  minute: { date: string; rows: MinutePoint[]; trading: boolean }
  fetchedAt: string
}

/** 拉取个股详情：全量行情 + 今日分时走势 */
export async function fetchStockDetail(code: string, market?: string): Promise<StockDetail> {
  const params = new URLSearchParams({ code })
  if (market) params.set('market', market)
  return httpGet<StockDetail>(`/api/stock-detail?${params.toString()}`)
}

/** 格式化成交量/成交额等大数字 */
export function formatWanToYi(valueWan: number | null | undefined): string {
  if (valueWan === null || valueWan === undefined) return '--'
  const yi = valueWan / 10000
  return yi >= 10000 ? `${(yi / 10000).toFixed(2)} 万亿` : `${yi.toFixed(2)} 亿`
}