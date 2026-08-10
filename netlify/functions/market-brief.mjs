/**
 * 市场简报 —— 基于全市场快照生成结构化详细简报
 *  - 数据：复用 market-snapshot 聚合（指数/广度/涨停池/板块/ETF/成交额）
 *  - 模式：
 *    rule：规则引擎生成六段式详细简报（大盘概况/市场情绪/热点板块/资金动向/风险提示/关注方向）
 *    ai：配置 LLM_API_KEY 后调用大模型生成更详细的诊断式简报（默认智谱 glm-4-flash，LLM_PROVIDER=siliconflow 切硅基流动）
 */
import { handler as snapshotHandler } from './market-snapshot.mjs'

const json = (body, statusCode = 200) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=60, s-maxage=60',
    'access-control-allow-origin': '*'
  },
  body: JSON.stringify(body)
})

async function fetchJson(url, options = {}, timeoutMs = 10000) {
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

/** 免费大模型服务商预置（OpenAI 兼容 chat/completions） */
const LLM_PRESETS = {
  zhipu: { base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', name: '智谱 AI' },
  siliconflow: { base: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct', name: '硅基流动' }
}

const fmt = (v, digits = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '--' : v.toFixed(digits))
const signed = (v, digits = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '--' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}`)

/** 从市场快照提取简报上下文 */
function buildContext(snap) {
  const m = snap.market
  const total = (m.breadth?.up ?? 0) + (m.breadth?.down ?? 0) + (m.breadth?.flat ?? 0)
  const upRatio = total > 0 ? Math.round(((m.breadth.up / total) * 100) * 10) / 10 : null
  const pool = (m.limitUp ?? 0) + (m.brokenBoard ?? 0)
  const brokenRate = pool > 0 ? Math.round(((m.brokenBoard / pool) * 100) * 10) / 10 : null
  const sectors = (snap.sectors ?? []).map((s) => ({ name: s.name, change: s.change, amountYi: s.amountYi, flowYi: s.flowYi }))
  const etfs = (snap.etfs ?? []).slice(0, 6).map((e) => ({ name: e.name, change: e.change, flow: e.flow ?? null }))
  return {
    indices: (m.indices ?? []).map((i) => ({ name: i.name, price: i.price, changePct: i.change })),
    breadth: { up: m.breadth?.up ?? 0, down: m.breadth?.down ?? 0, flat: m.breadth?.flat ?? 0 },
    upRatio,
    limitUp: m.limitUp ?? null,
    limitDown: m.limitDown ?? null,
    brokenBoard: m.brokenBoard ?? null,
    brokenRate,
    turnoverYi: m.turnoverYi ?? null,
    sectors,
    etfs
  }
}

/** 规则模式：六段式详细简报 */
function buildRuleBrief(ctx) {
  const sh = ctx.indices.find((i) => i.name.includes('上证'))
  const sz = ctx.indices.find((i) => i.name.includes('深证'))
  const cyb = ctx.indices.find((i) => i.name.includes('创业板'))
  const indexText = (i) => (i ? `${i.name} ${fmt(i.price)}（${signed(i.changePct)}%）` : null)
  const parts = [indexText(sh), indexText(sz), indexText(cyb)].filter(Boolean)

  const breadthText = ctx.upRatio !== null
    ? `上涨 ${ctx.breadth.up.toLocaleString()} 家 / 下跌 ${ctx.breadth.down.toLocaleString()} 家 / 平盘 ${ctx.breadth.flat.toLocaleString()} 家，上涨占比 ${fmt(ctx.upRatio, 1)}%`
    : '涨跌家数暂不可用'
  const poolText = `涨停 ${ctx.limitUp ?? '--'} 家 / 跌停 ${ctx.limitDown ?? '--'} 家 / 炸板 ${ctx.brokenBoard ?? '--'} 家`
  const brokenRisk = ctx.brokenRate === null ? '' : ctx.brokenRate >= 35 ? '，炸板率偏高，短线接力需谨慎' : ctx.brokenRate >= 20 ? '，炸板率中性，注意高位分歧' : '，炸板率较低，打板情绪相对健康'
  const turnoverText = ctx.turnoverYi ? `${(ctx.turnoverYi / 10000).toFixed(2)} 万亿` : '--'

  const topGain = [...ctx.sectors].sort((a, b) => b.change - a.change).slice(0, 3)
  const topFlow = [...ctx.sectors].sort((a, b) => (b.flowYi ?? 0) - (a.flowYi ?? 0)).slice(0, 3)
  const topEtf = [...ctx.etfs].sort((a, b) => b.change - a.change)[0]

  const sections = [
    { title: '大盘概况', content: `三大指数：${parts.join('；')}。两市成交额 ${turnoverText}，${breadthText}。` },
    { title: '市场情绪', content: `${poolText}${brokenRisk}。涨停家数较跌停占优时短线风险偏好回升，反之需降低仓位预期。` },
    { title: '热点板块', content: `涨幅居前：${topGain.map((s) => `${s.name} ${signed(s.change)}%`).join('、') || '--'}；领涨板块多为主线资金的集中方向，注意连板高度与板块内分化。` },
    { title: '资金动向', content: `主力净流入居前：${topFlow.map((s) => `${s.name} ${s.flowYi >= 0 ? '+' : ''}${fmt(s.flowYi, 1)}亿`).join('、') || '--'}${topEtf ? `；ETF 方面 ${topEtf.name} ${signed(topEtf.change)}% 表现居前。` : ''}` },
    { title: '风险提示', content: `关注炸板率与跌停家数变化${ctx.brokenRate !== null && ctx.brokenRate >= 35 ? '（当前炸板率偏高）' : ''}；指数上涨但上涨占比不足 50% 时存在权重护盘、个股分化风险；高位连板股警惕分歧兑现。` },
    { title: '关注方向', content: `优先跟踪资金持续净流入且板块强度居前的方向（${topFlow.slice(0, 2).map((s) => s.name).join('、') || '待观察'}），并结合两市量能是否同步放大决定仓位。` }
  ]

  const actions = [
    `关注 ${topGain[0]?.name ?? '领涨板块'} 的量价延续性`,
    `观察两市成交额能否站稳 ${turnoverText}`,
    '警惕高位连板股与炸板率回升带来的情绪退潮'
  ]
  const riskTips = [
    `炸板率 ${ctx.brokenRate !== null ? fmt(ctx.brokenRate, 1) + '%' : '--'}，短线接力注意分歧`,
    ctx.upRatio !== null && ctx.upRatio < 50 ? '上涨占比不足 50%，个股分化明显' : '指数与个股宽度需同步验证'
  ]
  return { sections, actions, riskTips, confidence: 72 }
}

/** 可选：大模型生成更详细诊断式简报（返回 JSON 结构） */
async function callLlm(ctx) {
  const key = process.env.LLM_API_KEY
  if (!key) return null
  const provider = LLM_PRESETS[process.env.LLM_PROVIDER] ? process.env.LLM_PROVIDER : 'zhipu'
  const preset = LLM_PRESETS[provider]
  const base = String(process.env.LLM_BASE_URL || preset.base).replace(/\/+$/, '')
  const model = process.env.LLM_MODEL || preset.model
  const system = '你是一名严谨的 A 股市场分析助手。基于给定的全市场快照数据，输出 JSON（不要 markdown 代码块）：{"summary":"80字以内总览","sections":[{"title":"大盘概况|市场情绪|热点板块|资金动向|风险提示|关注方向","content":"每段80-120字"}],"actions":["3条行动建议"],"riskTips":["2-3条风险提示"],"confidence":60-95}。'
  const payload = await fetchJson(
    `${base}/chat/completions`,
    {
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `市场快照：${JSON.stringify(ctx)}` }
        ],
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' }
      })
    },
    15000
  )
  const raw = payload?.choices?.[0]?.message?.content
  if (!raw) throw new Error('empty llm response')
  const cleaned = String(raw).replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed.sections) || !parsed.summary) throw new Error('bad llm json')
  return { provider, providerName: preset.name, model, parsed }
}

async function handler() {
  let snap
  try {
    const res = await snapshotHandler()
    if (res.statusCode !== 200) throw new Error(`snapshot ${res.statusCode}`)
    snap = JSON.parse(res.body)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'snapshot unavailable' }, 502)
  }
  const ctx = buildContext(snap)
  const rule = buildRuleBrief(ctx)
  const base = {
    source: 'rule',
    status: '结构化市场简报 · 规则生成',
    summary: `${ctx.indices[0]?.name ?? '上证指数'} ${ctx.indices[0] ? `${fmt(ctx.indices[0].price)}（${signed(ctx.indices[0].changePct)}%）` : '--'}，两市成交 ${ctx.turnoverYi ? (ctx.turnoverYi / 10000).toFixed(2) + ' 万亿' : '--'}，上涨占比 ${ctx.upRatio !== null ? fmt(ctx.upRatio, 1) + '%' : '--'}。${rule.sections[0].content}`,
    sections: rule.sections,
    actions: rule.actions,
    riskTips: rule.riskTips,
    confidence: rule.confidence,
    metrics: {
      pulse: Math.round(50 + (ctx.upRatio ?? 50) - 50 + ((ctx.limitUp ?? 0) * 0.05)),
      emotion: Math.round(50 + (ctx.upRatio ?? 50) - 50 + ((ctx.limitUp ?? 0) - (ctx.limitDown ?? 0)) * 0.1),
      breadthScore: ctx.upRatio !== null ? Math.round(ctx.upRatio) : 50
    }
  }

  // 配置 LLM 后尝试生成更详细版本
  if (process.env.LLM_API_KEY) {
    try {
      const ai = await callLlm(ctx)
      if (ai) {
        const p = ai.parsed
        return json({
          ...base,
          source: 'ai',
          status: `AI 市场简报 · ${ai.providerName}`,
          summary: p.summary,
          sections: Array.isArray(p.sections) ? p.sections : base.sections,
          actions: Array.isArray(p.actions) ? p.actions : base.actions,
          riskTips: Array.isArray(p.riskTips) ? p.riskTips : base.riskTips,
          confidence: Number.isFinite(Number(p.confidence)) ? Math.max(40, Math.min(95, Math.round(Number(p.confidence)))) : base.confidence,
          generatedAt: new Date().toISOString(),
          llm: { provider: ai.provider, providerName: ai.providerName, model: ai.model }
        })
      }
    } catch {
      // LLM 失败回退规则简报
    }
  }
  return json({ ...base, generatedAt: new Date().toISOString() })
}

export { handler }
export default handler