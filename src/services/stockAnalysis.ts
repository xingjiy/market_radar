import { httpGet } from './http'

/** 支撑/压力位 */
export interface PriceLevel {
  price: number
  label: string
  strength: '强' | '中' | '弱'
  /** 距现价 %（支撑为负，压力为正） */
  distancePct: number
}

export interface LevelGroup {
  support: PriceLevel[]
  resistance: PriceLevel[]
}

export interface TrendInfo {
  direction: 'up' | 'down' | 'range'
  label: string
  /** 0-100 */
  score: number
  ma: { ma5: number | null; ma10: number | null; ma20: number | null; ma60: number | null }
  notes: string[]
}

export interface StockAnalysis {
  source: 'rule' | 'ai'
  code: string
  market: string
  symbol: string
  price: number
  date: string
  levels: LevelGroup
  trend: TrendInfo
  /** 规则化摘要 */
  summary: string
  /** 可选：大模型诊断（配置 LLM_API_KEY 后返回） */
  ai: { provider: string; providerName?: string; model: string; text: string; generatedAt: string } | null
  warnings?: string[]
}

/** 拉取个股支撑/压力位 + 走势分析 */
export async function fetchStockAnalysis(code: string, options: { market?: string; name?: string } = {}): Promise<StockAnalysis> {
  const params = new URLSearchParams({ code })
  if (options.market) params.set('market', options.market)
  if (options.name) params.set('name', options.name)
  return httpGet<StockAnalysis>(`/api/stock-analysis?${params.toString()}`)
}