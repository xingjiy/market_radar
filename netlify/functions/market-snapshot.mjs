const EASTMONEY = 'https://push2.eastmoney.com/api/qt'

const json = (body, statusCode = 200) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=30, s-maxage=30',
    'access-control-allow-origin': '*'
  },
  body: JSON.stringify(body)
})

async function fetchJson(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`upstream ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const amount = (value) => {
  const valueInYi = number(value) / 100000000
  return `${valueInYi >= 0 ? '+' : ''}${valueInYi.toFixed(1)}亿`
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
    result.market.indices = rows.map(row => ({ code: row.f12, name: row.f14, price: number(row.f2), change: number(row.f3) }))
    const breadthRow = rows.find(row => row.f12 === '000001') ?? rows[0]
    result.market.breadth = { up: number(breadthRow?.f104), down: number(breadthRow?.f105), flat: number(breadthRow?.f106) }
  } catch (error) {
    warnings.push(`indices: ${error instanceof Error ? error.message : 'unavailable'}`)
  }

  try {
    const sectorUrl = `${EASTMONEY}/clist/get?pn=1&pz=8&po=1&np=1&fid=f3&fs=m:90+t:2&fields=f2,f3,f4,f12,f14,f62`
    const payload = await fetchJson(sectorUrl)
    result.sectors = (payload?.data?.diff ?? []).map(row => ({
      name: row.f14,
      change: Number((number(row.f3) / 100).toFixed(2)),
      amount: amount(row.f62),
      leader: row.f12,
      heat: Math.max(45, Math.min(98, Math.round(60 + number(row.f3) / 2))),
      trend: number(row.f3) >= 0 ? 'up' : 'down'
    }))
  } catch (error) {
    warnings.push(`sectors: ${error instanceof Error ? error.message : 'unavailable'}`)
  }

  try {
    const etfUrl = `${EASTMONEY}/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f5,f6,f12,f14&secids=1.588000,0.159995,0.159819,1.512480,1.510300`
    const payload = await fetchJson(etfUrl)
    result.etfs = (payload?.data?.diff ?? []).map(row => ({
      code: row.f12,
      name: String(row.f14 ?? '').replace(/(华夏|易方达|基金)$/g, ''),
      price: number(row.f2).toFixed(3),
      change: Number(number(row.f3).toFixed(2)),
      amount: `${(number(row.f6) / 100000000).toFixed(1)}亿`,
      flow: null,
      signal: number(row.f3) >= 3 ? '强势放量' : number(row.f3) > 0 ? '趋势增强' : '宽幅震荡'
    }))
  } catch (error) {
    warnings.push(`etfs: ${error instanceof Error ? error.message : 'unavailable'}`)
  }

  const hasData = result.market.indices.length > 0 || result.sectors.length > 0 || result.etfs.length > 0
  return json(result, hasData ? 200 : 502)
}

export { handler }
export default handler
