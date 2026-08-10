/**
 * 市场综合快照 —— 数据源优先级：腾讯财经（主）→ 东方财富（备）→ Mock（前端兜底）
 *
 * 腾讯财经（主数据源）：
 *   - 指数 / ETF / 个股报价：qt.gtimg.cn（GBK，~ 分隔）
 *   - 沪深两市涨跌家数：qt.gtimg.cn/q=bkqtRank_A_sh,bkqtRank_A_sz
 *   - 行业板块排行（涨跌幅 / 成交额 / 主力净流入 / 领涨股）：proxy.finance.qq.com getRank
 * 东方财富（备用 / 补齐）：
 *   - 涨停 / 跌停 / 炸板池计数：push2ex.eastmoney.com（腾讯免费接口无对应数据）
 *   - 指数涨跌家数、板块、ETF 在腾讯失败时降级
 */
const TENCENT = 'https://qt.gtimg.cn'
const TENCENT_RANK = 'https://proxy.finance.qq.com/cgi/cgi-bin/rank/pt/getRank'
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

async function fetchJson(url, timeoutMs = 8000, extraHeaders = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json', ...extraHeaders } })
    if (!response.ok) throw new Error(`upstream ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

/** 腾讯行情为 GBK 文本，返回解码后的文本 */
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

// ---------- 腾讯财经（主数据源） ----------

const INDEX_QUOTES = ['sh000001', 'sz399001', 'sz399006', 'sh000300']
const ETF_QUOTES = [
  'sh510300', 'sh510050', 'sh510500', 'sh512100', 'sh510880', 'sz159915', 'sh588000',
  'sz159995', 'sh512480', 'sh512760', 'sz159819', 'sh512690', 'sz159928', 'sh512170',
  'sh512010', 'sh515030', 'sh516160', 'sh512800', 'sh512880', 'sh512000', 'sh512660',
  'sz159949', 'sh588080', 'sh513180', 'sh513050', 'sh513100', 'sh513500', 'sh518880',
  'sh512400', 'sh515220', 'sh515790', 'sh512980', 'sh515050', 'sh562500', 'sh588200',
  'sz159516', 'sz159901', 'sh510330', 'sh510310', 'sz159869', 'sh515070'
]
const ETF_NAME_SUFFIX = /(华夏|易方达|华泰柏瑞|国联安|南方|嘉实|富国|广发|博时|天弘|鹏华|银华|工银瑞信|建信|招商|景顺长城|汇添富|华安|国泰|华宝|华夏)$/

/**
 * 腾讯批量报价（qt.gtimg.cn，GBK）
 * 字段（~ 分隔）：1名称 2代码 3最新价 30时间 31涨跌 32涨跌幅% 36成交量(手) 37成交额(万元)
 */
async function fetchTencentQuotes(codes) {
  const text = await fetchTencentText(`${TENCENT}/q=${codes.join(',')}`)
  const rows = []
  for (const line of text.split('\n')) {
    const match = /^v_(\w+)="(.*)";?$/.exec(line.trim())
    if (!match) continue
    const f = match[2].split('~')
    if (f.length < 38) continue
    rows.push({
      code: f[2],
      name: f[1],
      price: number(f[3]),
      change: number(f[31]),
      changePct: number(f[32]),
      amountYi: Math.round((number(f[37]) / 10000) * 10) / 10 // 万元 -> 亿
    })
  }
  return rows
}

/** 沪深两市涨跌家数（腾讯 bkqtRank_A_sh / bkqtRank_A_sz） */
async function fetchTencentBreadth() {
  const text = await fetchTencentText(`${TENCENT}/q=bkqtRank_A_sh,bkqtRank_A_sz`)
  const acc = { up: 0, flat: 0, down: 0 }
  for (const line of text.split('\n')) {
    const match = /^v_bkqtRank_A_(?:sh|sz)="([^"]*)";?$/.exec(line.trim())
    if (!match) continue
    const f = match[1].split('~')
    if (f.length < 6) continue
    acc.up += number(f[2])
    acc.flat += number(f[3])
    acc.down += number(f[4])
  }
  if (acc.up + acc.flat + acc.down === 0) throw new Error('empty breadth')
  return acc
}

/** 行业板块排行（腾讯 getRank，按涨跌幅降序） */
async function fetchTencentSectors() {
  const url = `${TENCENT_RANK}?board_type=hy&sort_type=priceRatio&direct=down&offset=0&count=8`
  const payload = await fetchJson(url)
  const rows = payload?.data?.rank_list ?? []
  return rows.map((row) => {
    const change = number(row.zdf)
    const amountYi = Math.round((number(row.turnover) / 10000) * 10) / 10 // 万元 -> 亿
    const flowYi = Math.round((number(row.zljlr) / 10000) * 10) / 10 // 主力净流入 万元 -> 亿
    return {
      name: row.name,
      change,
      amount: `${amountYi.toFixed(1)}亿`,
      amountYi,
      flowYi,
      leader: row.lzg?.name ?? row.lzg?.code ?? '',
      heat: Math.max(45, Math.min(98, Math.round(50 + Math.abs(change) * 10))),
      trend: change >= 0 ? 'up' : 'down'
    }
  })
}

// ---------- 东方财富（备用 / 腾讯无等价数据） ----------

async function fetchEastmoneyIndicesBreadth() {
  const indexUrl = `${EASTMONEY}/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f12,f14,f104,f105,f106&secids=1.000001,0.399001,0.399006,1.000300`
  const payload = await fetchJson(indexUrl)
  const rows = payload?.data?.diff ?? []
  const indices = rows.map((row) => ({ code: row.f12, name: row.f14, price: number(row.f2), change: number(row.f3) }))
  const breadthRow = rows.find((row) => row.f12 === '000001') ?? rows[0]
  const breadth = { up: number(breadthRow?.f104), down: number(breadthRow?.f105), flat: number(breadthRow?.f106) }
  return { indices, breadth }
}

async function fetchEastmoneySectors() {
  const sectorUrl = `${EASTMONEY}/clist/get?pn=1&pz=8&po=1&np=1&fid=f3&fs=m:90+t:2&fields=f2,f3,f4,f6,f12,f14,f62`
  const payload = await fetchJson(sectorUrl)
  return (payload?.data?.diff ?? []).map((row) => {
    const change = Number(number(row.f3).toFixed(2))
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
}

async function fetchEastmoneyEtfs() {
  const etfUrl = `${EASTMONEY}/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f5,f6,f12,f14&secids=1.588000,0.159995,0.159819,1.512480,1.510300`
  const payload = await fetchJson(etfUrl)
  return (payload?.data?.diff ?? []).map((row) => {
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
}

const POOL_ENDPOINTS = {
  zt: { path: 'getTopicZTPool', sort: 'fbt%3Aasc' },
  dt: { path: 'getTopicDTPool', sort: 'fund%3Aasc' },
  zb: { path: 'getTopicZBPool', sort: 'fbt%3Aasc' }
}

/** 涨停/跌停/炸板池数量（仅东财提供，腾讯无等价免费接口；dpt 均为 wz.ztzt） */
async function fetchPoolCount(type, date) {
  const { path, sort } = POOL_ENDPOINTS[type]
  const url = `${PUSH2EX}/${path}?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=200&sort=${sort}&date=${date}`
  // 东财 WAF 对云端 IP 偶发拦截：带浏览器头并重试 1 次
  const headers = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', referer: 'https://quote.eastmoney.com/' }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const payload = await fetchJson(url, 6000, headers)
      const pool = payload?.data?.pool
      if (Array.isArray(pool)) return pool.length
    } catch {
      // 重试一次
    }
  }
  return null
}

// ---------- 主处理 ----------

async function handler() {
  const warnings = []
  const domains = {}
  const result = {
    source: 'tencent',
    fetchedAt: new Date().toISOString(),
    market: { breadth: { up: 0, down: 0, flat: 0 }, indices: [] },
    sectors: [],
    etfs: [],
    domains,
    warnings
  }

  // 1) 指数：腾讯主
  try {
    const quotes = await fetchTencentQuotes(INDEX_QUOTES)
    if (quotes.length) {
      result.market.indices = quotes.map((q) => ({ code: q.code, name: q.name, price: q.price, change: q.changePct }))
      domains.indices = 'tencent'
      const sh = quotes.find((q) => q.code === '000001')
      const sz = quotes.find((q) => q.code === '399001')
      if (sh && sz) {
        result.market.turnoverYi = Math.round((sh.amountYi + sz.amountYi) * 10) / 10
        result.market.shTurnoverYi = Math.round(sh.amountYi * 10) / 10
        result.market.szTurnoverYi = Math.round(sz.amountYi * 10) / 10
      }
    }
  } catch (error) {
    warnings.push(`indices-tencent: ${error instanceof Error ? error.message : 'unavailable'}`)
  }

  // 2) 涨跌家数：腾讯主，失败降级东财
  try {
    result.market.breadth = await fetchTencentBreadth()
    domains.breadth = 'tencent'
  } catch (error) {
    warnings.push(`breadth-tencent: ${error instanceof Error ? error.message : 'unavailable'}`)
    try {
      const em = await fetchEastmoneyIndicesBreadth()
      result.market.breadth = em.breadth
      domains.breadth = 'eastmoney'
      if (!result.market.indices.length && em.indices.length) {
        result.market.indices = em.indices
        domains.indices = 'eastmoney'
      }
    } catch (error2) {
      warnings.push(`breadth: ${error2 instanceof Error ? error2.message : 'unavailable'}`)
    }
  }

  // 3) ETF：腾讯主，失败降级东财
  try {
    const quotes = await fetchTencentQuotes(ETF_QUOTES)
    if (quotes.length) {
      result.etfs = quotes.map((q) => ({
        code: q.code,
        name: q.name.replace(ETF_NAME_SUFFIX, ''),
        price: q.price.toFixed(3),
        change: Number(q.changePct.toFixed(2)),
        amount: `${q.amountYi.toFixed(1)}亿`,
        amountYi: q.amountYi,
        flow: null,
        flowYi: null,
        signal: q.changePct >= 3 ? '强势放量' : q.changePct > 0 ? '趋势增强' : '宽幅震荡'
      }))
      domains.etfs = 'tencent'
    }
  } catch (error) {
    warnings.push(`etfs-tencent: ${error instanceof Error ? error.message : 'unavailable'}`)
  }
  if (!result.etfs.length) {
    try {
      result.etfs = await fetchEastmoneyEtfs()
      domains.etfs = 'eastmoney'
    } catch (error) {
      warnings.push(`etfs: ${error instanceof Error ? error.message : 'unavailable'}`)
    }
  }

  // 4) 板块：腾讯主，失败降级东财
  try {
    const sectors = await fetchTencentSectors()
    if (sectors.length) {
      result.sectors = sectors
      domains.sectors = 'tencent'
    }
  } catch (error) {
    warnings.push(`sectors-tencent: ${error instanceof Error ? error.message : 'unavailable'}`)
  }
  if (!result.sectors.length) {
    try {
      result.sectors = await fetchEastmoneySectors()
      domains.sectors = 'eastmoney'
    } catch (error) {
      warnings.push(`sectors: ${error instanceof Error ? error.message : 'unavailable'}`)
    }
  }

  // 5) 涨停/跌停/炸板：东财（腾讯无等价免费接口）
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
    } else {
      domains.pools = 'eastmoney'
    }
  } catch (error) {
    warnings.push(`limit-pools: ${error instanceof Error ? error.message : 'unavailable'}`)
  }

  result.source = Object.values(domains).includes('tencent') ? 'tencent' : 'eastmoney'
  const hasData = result.market.indices.length > 0 || result.sectors.length > 0 || result.etfs.length > 0
  return json(result, hasData ? 200 : 502)
}

export { handler }
export default handler