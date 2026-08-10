import type { ETF, Sector } from '../data/mock'
import { pulseSeries, timeLabels } from '../data/mock'
import { httpGet } from './http'

export interface MarketSnapshot {
  source: 'eastmoney' | 'tencent' | 'mock'
  fetchedAt: string
  market: {
    breadth: { up: number; down: number; flat: number }
    indices: Array<{ code: string; name: string; price: number; change: number }>
    limitUp?: number
    limitDown?: number
    brokenBoard?: number
    turnoverYi?: number
  }
  sectors: Sector[]
  etfs: Array<ETF & { flow: string | null }>
  warnings?: string[]
}

/** 市场聚合快照：代理层失败时由 store 层回退 Mock */
export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  return httpGet<MarketSnapshot>('/api/market-snapshot')
}

export interface PulsePoint {
  t: string
  score: number
}

/**
 * 脉冲时序（规划：MVP2 由后端 /api/v1/market/pulse 提供）
 * 当前返回 Mock 静态序列，保持调用契约不变。
 */
export async function fetchPulse(_range: '今日' | '本周' | '本月'): Promise<PulsePoint[]> {
  const scores = pulseSeries[_range]
  const labels = timeLabels[_range]
  return scores.map((score, index) => ({ t: labels[index] ?? String(index), score }))
}
