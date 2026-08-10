/**
 * 个股 / ETF / 指数搜索 —— 数据源优先级：腾讯财经（主）→ 东方财富（备）
 *   - 腾讯：smartbox.gtimg.cn 联想 + qt.gtimg.cn 批量报价补充价格/涨跌幅/成交额
 *   - 东财：searchapi.eastmoney.com 联想 + push2 ulist.np 报价（备）
 */
const SMARTBOX = 'https://smartbox.gtimg.cn/s3/'
const TENCENT = 'https://qt.gtimg.cn'
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

/** 腾讯联想 / 报价为 GBK 文本，返回解码后的文本 */
async function fetchTencentText(url, timeoutMs = 6000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: '*/*' } })
    if (!response.ok) throw new Error(`tencent ${response.status}`)
    const buffer = new Uint8Array(await response.arrayBuffer())
    return new TextDecoder('gbk').decode(buffer)
  } finally {
    clearTimeout(timeout)
  }
}

/** smartbox 的 v_hint 值使用 JSON 字符串转义（如 \u4e2d\u5929...），解码为真实文本 */
function decodeUnicode(raw) {
  return raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/** smartbox 类型 -> 内部类型：GP-A* A股 / ETF / ZS 指数 */
function tencentType(raw) {
  if (typeof raw === 'string' && raw.startsWith('GP-A')) return 'AStock'
  if (raw === 'ETF') return 'Fund'
  if (raw === 'ZS') return 'Index'
  return null
}

/** 腾讯联想搜索（smartbox.gtimg.cn，v_hint="sh~600519~贵州茅台~gzmt~GP-A^..."） */
async function searchTencent(query) {
  const text = await fetchTencentText(`${SMARTBOX}?v=2&q=${encodeURIComponent(query)}&t=all`)
  const match = /^v_hint="([^"]*)";?$/.exec(text.trim())
  const entries = match ? decodeUnicode(match[1]).split('^') : []
  const candidates = []
  for (const entry of entries) {
    const parts = entry.split('~')
    if (parts.length < 5) continue
    const type = tencentType(parts[4])
    if (!type) continue
    candidates.push({ market: parts[0], code: parts[1], name: parts[2], type })
  }
  // 同代码多标的时优先 A 股 > ETF > 指数（如 000021：指数 180治理 与 股票 深科技 并存）
  const typePriority = { AStock: 0, Fund: 1, Index: 2 }
  candidates.sort((a, b) => {
    if (a.code === b.code) return (typePriority[a.type] ?? 3) - (typePriority[b.type] ?? 3)
    return 0
  })
  return candidates.slice(0, 8)
}

/** 腾讯批量报价补充 price / change / amount */
async function enrichTencent(candidates) {
  if (!candidates.length) return []
  const codes = candidates.map((c) => `${c.market}${c.code}`)
  const text = await fetchTencentText(`${TENCENT}/q=${codes.join(',')}`)
  const quoteMap = new Map()
  for (const line of text.split('\n')) {
    const match = /^v_(\w+)="(.*)";?$/.exec(line.trim())
    if (!match) continue
    const f = match[2].split('~')
    if (f.length < 38) continue
    quoteMap.set(match[1], f) // 用 sh000021 / sz000021 等带前缀代码作 key
  }
  return candidates.map((c) => {
    const f = quoteMap.get(c.market + c.code)
    return {
      code: c.code,
      name: c.name,
      type: c.type,
      quoteId: `${c.market}${c.code}`,
      price: f ? number(f[3]) : null,
      change: f ? number(f[32]) : null,
      amount: f ? Math.round(number(f[37]) * 10000) : null, // 万元 -> 元
      market: c.market.toUpperCase()
    }
  })
}

/** 东财搜索（备用） */
async function searchEastmoney(query) {
  const suggestUrl = `${SEARCH_URL}?input=${encodeURIComponent(query)}&type=14&count=8`
  const suggestResponse = await fetch(suggestUrl, { headers: { accept: 'application/json' } })
  if (!suggestResponse.ok) throw new Error(`eastmoney search ${suggestResponse.status}`)
  const suggestPayload = await suggestResponse.json()
  const candidates = (suggestPayload?.QuotationCodeTable?.Data ?? [])
    .filter((item) => ['AStock', 'Fund', 'Index'].includes(item.Classify))
    .slice(0, 8)
  if (!candidates.length) return []

  let quotePayload = { data: { diff: [] } }
  try {
    const quoteIds = candidates.map((item) => item.QuoteID).filter(Boolean).join(',')
    const quoteUrl = `${QUOTE_URL}?fltt=2&invt=2&fields=f2,f3,f4,f5,f6,f12,f14&secids=${encodeURIComponent(quoteIds)}`
    const quoteResponse = await fetch(quoteUrl, { headers: { accept: 'application/json' } })
    if (quoteResponse.ok) quotePayload = await quoteResponse.json()
  } catch {
    // 报价明细失败时只返回代码/名称候选
  }
  const quoteMap = new Map((quotePayload?.data?.diff ?? []).map((row) => [row.f12, row]))
  return candidates.map((item) => {
    const quote = quoteMap.get(item.Code)
    return {
      code: item.Code,
      name: item.Name,
      type: item.Classify,
      quoteId: item.QuoteID,
      price: number(quote?.f2),
      change: number(quote?.f3),
      amount: number(quote?.f6),
      market: String(item.MktNum ?? '')
    }
  })
}

async function handler(event) {
  const query = String(event?.queryStringParameters?.q ?? '').trim()
  if (!query) return response({ results: [] })

  // 1) 腾讯主源
  try {
    const tencentResults = await enrichTencent(await searchTencent(query))
    if (tencentResults.length) return response({ source: 'tencent', query, results: tencentResults })
  } catch (error) {
    // 腾讯失败时降级东财
  }

  // 2) 东财备用
  try {
    const results = await searchEastmoney(query)
    return response({ source: 'eastmoney', query, results })
  } catch (error) {
    return response({ error: `search upstream failed: ${error instanceof Error ? error.message : 'unavailable'}`, results: [] }, 502)
  }
}

export { handler }
export default handler