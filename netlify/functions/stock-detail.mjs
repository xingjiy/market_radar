/**
 * 个股详情 —— 腾讯财经（主）
 *   - 全量行情：qt.gtimg.cn（GBK，~ 分隔 88 字段）
 *   - 今日分时：web.ifzq.gtimg.cn/appstock/app/minute/query（HHMM price cumVol cumAmount）
 * 返回：quote（今开/昨收/最高/最低/量额/换手/量比/振幅/PE/PB/市值/涨跌停等）+ minute（分时走势/分时量/均价线）
 */
const TENCENT = 'https://qt.gtimg.cn'
const MINUTE = 'https://web.ifzq.gtimg.cn/appstock/app/minute/query'

const json = (body, statusCode = 200) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=20, s-maxage=20',
    'access-control-allow-origin': '*'
  },
  body: JSON.stringify(body)
})

const number = (value, fallback = null) => (Number.isFinite(Number(value)) ? Number(value) : fallback)

async function fetchTencentText(url, timeoutMs = 8000) {
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

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`tencent ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

/** 由 6 位代码推断市场前缀：6/5/9 -> sh，0/1/2/3 -> sz，4/8 -> bj */
function inferMarket(code) {
  if (/^(5|6|9)\d{5}$/.test(code)) return 'sh'
  if (/^(0|1|2|3)\d{5}$/.test(code)) return 'sz'
  if (/^(4|8)\d{5}$/.test(code)) return 'bj'
  return 'sh'
}

/** 解析腾讯全量行情（~ 分隔，88 字段） */
function parseQuote(f) {
  return {
    name: f[1],
    code: f[2],
    price: number(f[3]),
    prevClose: number(f[4]),
    open: number(f[5]),
    high: number(f[33]),
    low: number(f[34]),
    change: number(f[31]),
    changePct: number(f[32]),
    volumeHand: number(f[36]),
    amountWan: number(f[37]),
    turnoverRate: number(f[38]),
    pe: number(f[39]),
    peTTM: number(f[52]),
    pb: number(f[46]),
    amplitude: number(f[43]),
    floatMcYi: number(f[44]),
    totalMcYi: number(f[45]),
    limitUp: number(f[47]),
    limitDown: number(f[48]),
    volumeRatio: number(f[49]),
    avgPrice: number(f[51]),
    outer: number(f[7]),
    inner: number(f[8]),
    time: f[30] || '',
  }
}

/** 解析分时数据：HHMM price cumVol cumAmount -> 分钟序列（含每分钟量/额与均价线） */
function parseMinute(rows) {
  const points = []
  let prevVol = 0
  let prevAmount = 0
  for (const row of rows) {
    const parts = String(row).split(/\s+/)
    if (parts.length < 4) continue
    const rawTime = parts[0]
    const price = number(parts[1])
    const cumVol = number(parts[2], 0) // 手（累计）
    const cumAmount = number(parts[3], 0) // 元（累计）
    if (price === null || cumVol === null) continue
    const timeText = rawTime.length === 4 ? `${rawTime.slice(0, 2)}:${rawTime.slice(2)}` : rawTime
    points.push({
      time: timeText,
      price,
      volume: Math.max(0, cumVol - prevVol), // 每分钟成交量（手），首分钟含集合竞价
      amount: Math.round(Math.max(0, cumAmount - prevAmount)), // 每分钟成交额（元）
      cumVol,
      cumAmount: Math.round(cumAmount),
      avg: cumVol > 0 ? Math.round((cumAmount / (cumVol * 100)) * 100) / 100 : price // 均价线
    })
    prevVol = cumVol
    prevAmount = cumAmount
  }
  return points
}

async function handler(event) {
  const code = String(event?.queryStringParameters?.code ?? '').trim()
  if (!/^\d{6}$/.test(code)) return json({ error: 'invalid code' }, 400)
  let market = String(event?.queryStringParameters?.market ?? '').trim().toLowerCase()
  if (!['sh', 'sz', 'bj'].includes(market)) market = inferMarket(code)
  const symbol = `${market}${code}`

  try {
    // 1) 全量行情
    const text = await fetchTencentText(`${TENCENT}/q=${symbol}`)
    let f = null
    for (const line of text.split('\n')) {
      const match = /^v_(\w+)="(.*)";?$/.exec(line.trim())
      if (!match) continue
      if (/pv_none_match/.test(match[1])) continue
      const parts = match[2].split('~')
      if (parts.length < 40) continue
      f = parts
      break
    }
    if (!f) return json({ error: `symbol ${symbol} not found` }, 404)

    const quote = parseQuote(f)
    const date = String(quote.time).slice(0, 8)

    // 2) 今日分时
    let minute = { date, rows: [], trading: false }
    try {
      const payload = await fetchJson(`${MINUTE}?code=${symbol}`)
      const raw = payload?.data?.[symbol]?.data?.data ?? []
      const rows = parseMinute(raw)
      minute = { date, rows, trading: rows.length > 0 }
    } catch {
      // 分时失败不影响行情展示
    }

    return json({ source: 'tencent', code, market, symbol, quote, minute, fetchedAt: new Date().toISOString() })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'unavailable' }, 502)
  }
}

export { handler }
export default handler