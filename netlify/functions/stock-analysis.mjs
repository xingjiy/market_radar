/**
 * 个股支撑位/压力位 + 走势分析（可选接入免费大模型 API）
 *  - 日 K：腾讯 web.ifzq.gtimg.cn fqkline（qfq 前复权，120 日）
 *  - 支撑/压力：MA20/MA60、枢轴位 P/R1/R2/S1/S2、20/60 日高低点；按触及次数给强度
 *  - 走势：MA 排列 + 动量 → 方向/评分/要点/摘要
 *  - AI：若配置 LLM_API_KEY（默认智谱 GLM-4-Flash，OpenAI 兼容），调用大模型生成诊断；失败/未配置回退规则分析
 */
const KLINE = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'

const json = (body, statusCode = 200) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=60, s-maxage=60',
    'access-control-allow-origin': '*'
  },
  body: JSON.stringify(body)
})

const number = (value, fallback = null) => (Number.isFinite(Number(value)) ? Number(value) : fallback)
const round2 = (value) => (value === null || value === undefined ? null : Math.round(value * 100) / 100)

async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json', ...(options.headers ?? {}) }, ...(options.body ? { method: 'POST', body: options.body } : {}) })
    if (!response.ok) throw new Error(`upstream ${response.status}`)
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

/** 拉取日 K（优先前复权，退回不复权） */
async function fetchKline(symbol, days = 120) {
  const payload = await fetchJson(`${KLINE}?param=${symbol},day,,,${days},qfq`)
  const node = Object.values(payload?.data ?? {}).find((n) => n && (n.qfqday || n.day))
  const raw = node?.qfqday ?? node?.day ?? []
  return raw
    .map((row) => {
      const c = number(row[2])
      const h = number(row[3])
      const l = number(row[4])
      if (c === null || h === null || l === null) return null
      return { date: String(row[0]), open: number(row[1]), close: c, high: h, low: l, volume: number(row[5], 0) }
    })
    .filter(Boolean)
}

function ma(closes, n) {
  if (closes.length < n) return null
  return round2(closes.slice(-n).reduce((a, b) => a + b, 0) / n)
}

/** 强度：近 60 日该价位被触及（日内区间覆盖）次数 */
function strengthOf(level, kl) {
  const win = kl.slice(-60)
  let touches = 0
  for (const k of win) {
    if (k.low <= level * 1.005 && k.high >= level * 0.995) touches += 1
  }
  return touches >= 4 ? '强' : touches >= 2 ? '中' : '弱'
}

const TYPE_PRIORITY = { pivot: 3, ma: 2, low: 1, high: 1 }

/** 去重合并：价格相近（<0.5%）的候选保留优先级更高者 */
function dedupeLevels(list) {
  const sorted = [...list].sort((a, b) => a.price - b.price)
  const out = []
  for (const item of sorted) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.price - item.price) / item.price < 0.005) {
      if (TYPE_PRIORITY[item.type] > TYPE_PRIORITY[last.type]) out[out.length - 1] = item
    } else {
      out.push(item)
    }
  }
  return out
}

/** 计算支撑位/压力位列表（各最多 3 个，距现价排序） */
function buildLevels(kl, price) {
  const closes = kl.map((k) => k.close)
  const highs = kl.map((k) => k.high)
  const lows = kl.map((k) => k.low)
  const ma20 = ma(closes, 20)
  const ma60 = ma(closes, 60)
  const last = kl[kl.length - 1]
  const P = (last.high + last.low + last.close) / 3
  const R1 = 2 * P - last.low
  const S1 = 2 * P - last.high
  const R2 = P + (R1 - S1)
  const S2 = P - (R1 - S1)
  const low20 = Math.min(...lows.slice(-20))
  const high20 = Math.max(...highs.slice(-20))
  const low60 = Math.min(...lows.slice(-60))
  const high60 = Math.max(...highs.slice(-60))

  const supportCands = dedupeLevels([
    { price: round2(S1), label: '枢轴 S1', type: 'pivot' },
    { price: round2(S2), label: '枢轴 S2', type: 'pivot' },
    { price: ma20, label: 'MA20', type: 'ma' },
    { price: ma60, label: 'MA60', type: 'ma' },
    { price: round2(low20), label: '20日低点', type: 'low' },
    { price: round2(low60), label: '60日低点', type: 'low' }
  ]).filter((l) => l.price !== null && l.price < price)

  const resistanceCands = dedupeLevels([
    { price: round2(R1), label: '枢轴 R1', type: 'pivot' },
    { price: round2(R2), label: '枢轴 R2', type: 'pivot' },
    { price: ma20, label: 'MA20', type: 'ma' },
    { price: ma60, label: 'MA60', type: 'ma' },
    { price: round2(high20), label: '20日高点', type: 'high' },
    { price: round2(high60), label: '60日高点', type: 'high' }
  ]).filter((l) => l.price !== null && l.price > price)

  const mapLevel = (l) => ({
    price: l.price,
    label: l.label,
    strength: strengthOf(l.price, kl),
    distancePct: round2(((l.price - price) / price) * 100)
  })

  return {
    support: supportCands.sort((a, b) => b.price - a.price).slice(0, 3).map(mapLevel),
    resistance: resistanceCands.sort((a, b) => a.price - b.price).slice(0, 3).map(mapLevel)
  }
}

/** 走势方向/评分/要点 */
function buildTrend(kl, price) {
  const closes = kl.map((k) => k.close)
  const ma5 = ma(closes, 5)
  const ma10 = ma(closes, 10)
  const ma20 = ma(closes, 20)
  const ma60 = ma(closes, 60)
  const first5 = closes[closes.length - 5]
  const first20 = closes[closes.length - 20]
  const mom5 = first5 ? ((price - first5) / first5) * 100 : 0
  const mom20 = first20 ? ((price - first20) / first20) * 100 : 0
  const above20 = ma20 !== null ? price >= ma20 : null
  const above60 = ma60 !== null ? price >= ma60 : null
  const bullAlign = ma5 !== null && ma10 !== null && ma20 !== null && ma5 >= ma10 && ma10 >= ma20
  const bearAlign = ma5 !== null && ma10 !== null && ma20 !== null && ma5 <= ma10 && ma10 <= ma20

  let score = 50
  if (above20 === true) score += 10
  else if (above20 === false) score -= 10
  if (above60 === true) score += 10
  else if (above60 === false) score -= 10
  if (bullAlign) score += 15
  if (bearAlign) score -= 15
  score += Math.max(-10, Math.min(10, mom5))
  score += Math.max(-5, Math.min(5, mom20 / 4))
  score = Math.max(0, Math.min(100, Math.round(score)))

  let label
  let direction
  if (score >= 75) { label = '强势上涨'; direction = 'up' }
  else if (score >= 60) { label = '震荡偏强'; direction = 'up' }
  else if (score >= 40) { label = '震荡'; direction = 'range' }
  else if (score >= 25) { label = '震荡偏弱'; direction = 'down' }
  else { label = '弱势下跌'; direction = 'down' }

  const notes = []
  if (ma20 !== null) notes.push(price >= ma20 ? `股价站上 MA20（${ma20.toFixed(2)}）` : `股价跌破 MA20（${ma20.toFixed(2)}）`)
  if (ma60 !== null) notes.push(price >= ma60 ? `运行于 MA60（${ma60.toFixed(2)}）上方` : `承压于 MA60（${ma60.toFixed(2)}）下方`)
  if (bullAlign) notes.push('均线呈多头排列（MA5 > MA10 > MA20）')
  else if (bearAlign) notes.push('均线呈空头排列（MA5 < MA10 < MA20）')
  notes.push(`近 5 日${mom5 >= 0 ? '累计上涨' : '累计下跌'} ${Math.abs(mom5).toFixed(1)}%`)
  const highs = kl.map((k) => k.high)
  const high20 = Math.max(...highs.slice(-20))
  if (price < high20) notes.push(`距 20 日高点（${high20.toFixed(2)}）约 ${(((high20 - price) / price) * 100).toFixed(1)}%`)

  return {
    direction,
    label,
    score,
    ma: { ma5: round2(ma5), ma10: round2(ma10), ma20: round2(ma20), ma60: round2(ma60) },
    notes
  }
}

/** 规则化摘要（无 LLM 时的默认分析文本） */
function buildSummary(name, code, price, trend, levels) {
  const res = levels.resistance[0]
  const sup = levels.support[0]
  const resText = res ? `上方压力 ${res.price.toFixed(2)}（${res.label}，距现价 ${res.distancePct >= 0 ? '+' : ''}${res.distancePct.toFixed(1)}%）` : '上方暂无明显压力'
  const supText = sup ? `下方支撑 ${sup.price.toFixed(2)}（${sup.label}，距现价 ${sup.distancePct.toFixed(1)}%）` : '下方暂无明显支撑'
  return `${name}（${code}）现价 ${price.toFixed(2)}，走势${trend.label}（评分 ${trend.score}/100）。${resText}；${supText}。建议结合成交量与板块环境综合判断，谨慎操作。`
}

/** 可选：调用免费大模型生成诊断（OpenAI 兼容；默认智谱 GLM-4-Flash） */
async function callLlm(context) {
  const key = process.env.LLM_API_KEY
  if (!key) return null
  const base = String(process.env.LLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/+$/, '')
  const model = process.env.LLM_MODEL || 'glm-4-flash'
  const system = '你是一名严谨的 A 股技术分析助手。只依据给定数据做客观判断，不预测具体收益，提示风险，输出不超过 150 字。'
  const user = `请对以下个股做简洁的走势诊断（趋势判断、关键支撑压力、风险提示）：${JSON.stringify(context)}`
  const payload = await fetchJson(
    `${base}/chat/completions`,
    {
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.3, max_tokens: 400 })
    },
    10000
  )
  const text = payload?.choices?.[0]?.message?.content
  if (!text) throw new Error('empty llm response')
  return { provider: 'free-llm', model, text: String(text).trim() }
}

async function handler(event) {
  const code = String(event?.queryStringParameters?.code ?? '').trim()
  if (!/^\d{6}$/.test(code)) return json({ error: 'invalid code' }, 400)
  let market = String(event?.queryStringParameters?.market ?? '').trim().toLowerCase()
  if (!['sh', 'sz', 'bj'].includes(market)) market = inferMarket(code)
  const symbol = `${market}${code}`

  try {
    const kl = await fetchKline(symbol, 120)
    if (kl.length < 20) return json({ error: `insufficient kline for ${symbol}` }, 404)
    const last = kl[kl.length - 1]
    const price = last.close
    const levels = buildLevels(kl, price)
    const trend = buildTrend(kl, price)

    const name = String(event?.queryStringParameters?.name ?? '').trim() || code
    const summary = buildSummary(name, code, price, trend, levels)
    // 名称：优先用最后一行后的数据没有名称，退化为 code
    const result = {
      source: 'rule',
      code,
      market,
      symbol,
      price: round2(price),
      date: last.date,
      levels,
      trend,
      summary,
      ai: null,
      warnings: []
    }

    // 可选 AI 诊断
    if (process.env.LLM_API_KEY) {
      try {
        const context = {
          name,
          code,
          market,
          price: round2(price),
          date: last.date,
          trend: { label: trend.label, score: trend.score, ma: trend.ma },
          levels,
          recentCloses: kl.slice(-15).map((k) => ({ date: k.date, close: k.close }))
        }
        const ai = await callLlm(context)
        if (ai) {
          result.ai = { ...ai, generatedAt: new Date().toISOString() }
          result.source = 'ai'
        }
      } catch (error) {
        result.warnings.push(`llm: ${error instanceof Error ? error.message : 'unavailable'}`)
      }
    }

    return json(result)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'unavailable' }, 502)
  }
}

export { handler }
export default handler