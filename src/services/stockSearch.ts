export interface StockSearchResult {
  code: string
  name: string
  type: string
  quoteId: string
  price: number | null
  change: number | null
  amount: number | null
  market: string
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  const response = await fetch(`/api/stock-search?q=${encodeURIComponent(query)}`, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`search API ${response.status}`)
  const payload = await response.json() as { results?: StockSearchResult[] }
  return payload.results ?? []
}
