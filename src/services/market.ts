import type { ETF, Sector } from '../data/mock'

export interface MarketSnapshot {
  source: 'eastmoney' | 'mock'
  fetchedAt: string
  market: {
    breadth: { up: number; down: number; flat: number }
    indices: Array<{ code: string; name: string; price: number; change: number }>
  }
  sectors: Sector[]
  etfs: Array<ETF & { flow: string | null }>
  warnings?: string[]
}

export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const response = await fetch('/api/market-snapshot', { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`market API ${response.status}`)
  return response.json() as Promise<MarketSnapshot>
}
