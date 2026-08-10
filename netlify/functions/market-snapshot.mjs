const EASTMONEY = 'https://push2.eastmoney.com/api/qt'
const PUSH2EX = 'https://push2ex.eastmoney.com'

const json = (body, statusCode = 200) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=30, s-maxage=30',
    'access-control-allow-origin': '*'
  },
  body: JSON.stringify(body)
})

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`upstream ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback)
const yi = (value) => Math.round((number(value) / 100000000) * 10) / 10
const amountText = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}亿`

/** 交易日期（Asia/Shanghai）YYYYMMDD */
function tradeDateString() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const get = (type) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}${get('month')}${get('day')}`
}

const POOL_ENDPOINTS = {
  zt: { path: 'getTopicZTPool', dpt: 'wz.ztzt', sort: 'fbt%3Aasc' },
  dt: { path: 'getTopicDTPool', dpt: 'wz.dtzt', sort: 'fbt%3Aasc' },
  zb: { path: 'getTopicZBPool', dpt: 'wz.zb', sort: 'fbt%3Aasc' }
}

/** 获取涨停/跌停/炸板池数量；接口不可用返回 null（由前端回退默认值） */
async function fetchPoolCount(type, date) {
  const { path, dpt, sort } = POOL_ENDPOINTS[type]
  const url = `${PUSH2EX}/${path}?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=${dpt}&Pageindex=0&pagesize=200&sort=${sort}&date=${date}`
  const payload = await fetchJson(url, 6000)
  const pool = payload?.data?.pool
  return Array.isArray(pool) ? pool.length : null
}

async function handler() {
  const warnings = []
  const result = {
    source: 'eastmoney',
    fetchedAt: new Date().toISOString(),
    market: { breadth: { up: 0, down: 0, flat: 0 }, indices: [] },
    sectors: [],
    etfs: [],
    warnings
  }

  try {
    const indexUrl = `${EASTMONEY}/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f12,f14,f104,f105,f106&secids=1.000001,0.399001,0.399006,1.000300`
    const payload = await fetchJson(indexUrl)
    const rows = payload?.data?.diff ?? []
    result.market.indices = rows.map((row) => ({ code: row.f12, name: row.f14, price: number(row.f2), change: number(row.f3) }))
    const breadthRow = rows.find((row) => row.f12 === '000001') ?? rows[0]
    result.market.breadth = { up: number(breadthRow?.f104), down: number(breadthRow?.f105), flat: number(breadthRow?.f106) }
  } catch (error) {
    warnings.push(`indices: ${error instanceof Error ? error.message : 'unavailable'}`)
  }

  // 市场温度：涨停/跌停/炸板（各自独立降级）
  try {
    const date = tradeDateString()
    const [zt, dt, zb] = await Promise.allSettled([
      fetchPoolCount('zt', date),
      fetchPoolCount('dt', date),
      fetchPoolCount('zb', date)
    ])
    if (zt.status === 'fulfilled' && zt.value != null) result.market.limitUp = zt.value
    if (dt.status === 'fulfilled' && dt.value != null) result.market.limitDown = dt.value
    if (zb.status === 'fulfilled' && zb.value != null) result.market.brokenBoard = zb.value
    if (result.market.limitUp === undefined && result.market.limitDown === undefined && result.market.brokenBoard === undefined) {
      warnings.push('limit-pools: unavailable')
    }
  } catch (error) {
    warnings.push(`limit-pools: ${error instanceof Error ? error.message : 'unavailable'}`)
  }

  try {
    const sectorUrl = `${EASTMONEY}/clist/get?pn=1&pz=8&po=1&np=1&fid=f3&fs=m:90+t:2&fields=f2,f3,f4,f6,f12,f14,f62`
    const payload = await fetchJson(sectorUrl)
    result.sectors = (payload?.data?.diff ?? []).map((row) => {
      const change = Number((number(row.f3) / 100).toFixed(2))
      const amount = yi(row.f6)
      const flow = yi(row.f62)
      return {
        name: row.f14,
        change,
        amount: `${amount.toFixed(1)}亿`,
        amountYi: amount,
        flowYi: flow,
        leader: row.f12,
        heat: Math.max(45, Math.min(98, Math.round(60 + number(row.f3) / 2))),
        trend: change >= 0 ? 'up' : 'down'
      }
    })
  } catch (error) {
    warnings.push(`sectors: ${error instanceof Error ? error.message : 'unavailable'}`)
  }

  try {
    const etfUrl = `${EASTMONEY}/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f5,f6,f12,f14&secids=1.588000,0.159995,0.159819,1.512480,1.510300`
    const payload = await fetchJson(etfUrl)
    result.etfs = (payload?.data?.diff ?? []).map((row) => {
      const change = Number(number(row.f3).toFixed(2))
      const amount = yi(row.f6)
      return {
        code: row.f12,
        name: String(row.f14 ?? '').replace(/(华夏|易方达基金)$/g, ''),
        price: number(row.f2).toFixed(3),
        change,
        amount: `${amount.toFixed(1)}亿`,
        amountYi: amount,
        flow: null,
        flowYi: null,
        signal: change >= 3 ? '强势放量' : change > 0 ? '趋势增强' : '宽幅震荡'
      }
    })
  } catch (error) {
    warnings.push(`etfs: ${error instanceof Error ? error.message : 'unavailable'}`)
  }

  const hasData = result.market.indices.length > 0 || result.sectors.length > 0 || result.etfs.length > 0
  return json(result, hasData ? 200 : 502)
}

export { handler }
export default handler
