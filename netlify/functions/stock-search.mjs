const SEARCH_URL = 'https://searchapi.eastmoney.com/api/suggest/get'
const QUOTE_URL = 'https://push2.eastmoney.com/api/qt/ulist.np/get'

const response = (body, statusCode = 200) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=20, s-maxage=20',
    'access-control-allow-origin': '*'
  },
  body: JSON.stringify(body)
})

const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : null)

async function handler(event) {
  const query = String(event?.queryStringParameters?.q ?? '').trim()
  if (!query) return response({ results: [] })

  let suggestPayload
  try {
    const suggestUrl = `${SEARCH_URL}?input=${encodeURIComponent(query)}&type=14&count=8`
    const suggestResponse = await fetch(suggestUrl, { headers: { accept: 'application/json' } })
    if (!suggestResponse.ok) return response({ error: `search upstream ${suggestResponse.status}`, results: [] }, 502)
    suggestPayload = await suggestResponse.json()
  } catch (error) {
    return response({ error: `search upstream failed: ${error instanceof Error ? error.message : 'unavailable'}`, results: [] }, 502)
  }

  const candidates = (suggestPayload?.QuotationCodeTable?.Data ?? [])
    .filter((item) => ['AStock', 'Fund', 'Index'].includes(item.Classify))
    .slice(0, 8)

  if (!candidates.length) return response({ results: [] })

  let quotePayload = { data: { diff: [] } }
  try {
    const quoteIds = candidates.map((item) => item.QuoteID).filter(Boolean).join(',')
    const quoteUrl = `${QUOTE_URL}?fltt=2&invt=2&fields=f2,f3,f4,f5,f6,f12,f14&secids=${encodeURIComponent(quoteIds)}`
    const quoteResponse = await fetch(quoteUrl, { headers: { accept: 'application/json' } })
    if (quoteResponse.ok) quotePayload = await quoteResponse.json()
  } catch {
    // 报价明细失败时仍返回代码/名称候选
  }
  const quoteMap = new Map((quotePayload?.data?.diff ?? []).map((row) => [row.f12, row]))

  const results = candidates.map((item) => {
    const quote = quoteMap.get(item.Code)
    return {
      code: item.Code,
      name: item.Name,
      type: item.Classify,
      quoteId: item.QuoteID,
      price: number(quote?.f2),
      change: number(quote?.f3),
      amount: number(quote?.f6),
      market: item.MktNum
    }
  })

  return response({ source: 'eastmoney', query, results })
}

export { handler }
export default handler
