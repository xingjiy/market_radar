import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { Emotion, ETF, MarketIndex, Metric, MetricDetail, MetricKey, RotationItem, Sector, SentimentFactor } from '../data/mock'
import {
  breadth,
  emotion as mockEmotion,
  etfs as mockEtfs,
  marketExtras,
  marketIndices as mockIndices,
  pulseSeries,
  rotationData,
  sectors as mockSectors,
  sentimentRadar,
  timeLabels
} from '../data/mock'
import { fetchMarketSnapshot, type MarketSnapshot } from '../services/market'
import {
  computeConfidence,
  computeEmotionFactors,
  computeEtfScore,
  computeSectorScore,
  emotionLabel,
  inferEtfSignal,
  parseYi,
  type ScoreContext
} from '../utils/indicators'
import { buildMetricDetails } from '../utils/metricDetails'

export type PulseRange = '今日' | '本周' | '本月'

const AUTO_REFRESH_MS = 60_000
const MAX_CONSECUTIVE_FAILURES = 3

/** 交易时段判定（Asia/Shanghai）：工作日 09:15-15:00 */
function isTradingTime(date: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekday = get('weekday')
  if (weekday === 'Sat' || weekday === 'Sun') return false
  const minutes = Number(get('hour')) * 60 + Number(get('minute'))
  return minutes >= 9 * 60 + 15 && minutes < 15 * 60
}

let refreshTimer: number | undefined
let consecutiveFailures = 0
let lastFetchAt = 0

export const useMarketStore = defineStore('market', () => {
  const snapshot = ref<MarketSnapshot | null>(null)
  const dataSource = ref<'eastmoney' | 'tencent' | 'mock'>('mock')
  const loading = ref(false)
  const lastUpdated = ref('--:--:--')
  const warnings = ref<string[]>([])
  const pulseRange = ref<PulseRange>('今日')
  const autoRefreshOn = ref(false)

  // ---------- getters ----------
  /** 指数分组代码 */
  const MAIN_INDEX_CODES = new Set(['000001', '399001', '399006', '000300'])
  const BROAD_INDEX_CODES = new Set(['000016', '000688', '000905'])

  const sourceIndices = computed<MarketIndex[]>(() =>
    snapshot.value?.market.indices?.length ? snapshot.value.market.indices : mockIndices
  )

  /** 主要指数：上证/深证/创业板/沪深300 */
  const mainIndices = computed<MarketIndex[]>(() => sourceIndices.value.filter((i) => MAIN_INDEX_CODES.has(i.code)))

  /** 宽基指数：上证50/科创50/中证500 */
  const broadIndices = computed<MarketIndex[]>(() => sourceIndices.value.filter((i) => BROAD_INDEX_CODES.has(i.code)))
  const currentBreadth = computed(() => {
  const b = snapshot.value?.market.breadth
  if (b && b.up + b.down > 0) return b
  return breadth
})

  const displaySectors = computed<Sector[]>(() => {
    const list = snapshot.value?.sectors?.length ? snapshot.value.sectors : mockSectors
    const ctx: ScoreContext = {
      maxChange: Math.max(...list.map((s) => Math.abs(s.change)), 1),
      maxAmount: Math.max(...list.map((s) => s.amountYi ?? 0), 1),
      maxFlow: Math.max(...list.map((s) => Math.abs(s.flowYi ?? 0)), 1),
      maxLimitUp: Math.max(...list.map((s) => s.limitUpCount ?? 0), 1)
    }
    return list.map((s) => ({
      ...s,
      score:
        s.score ??
        computeSectorScore(
          { change: s.change, amountYi: s.amountYi, flowYi: s.flowYi, limitUpCount: s.limitUpCount },
          ctx
        )
    }))
  })

  const displayEtfs = computed<ETF[]>(() => {
    const list = snapshot.value?.etfs?.length ? snapshot.value.etfs : mockEtfs
    return list.map((e) => {
      const flowYi = e.flowYi ?? parseYi(e.flow)
      const trendScore = e.trendScore ?? Math.round(50 + e.change * 8)
      const activityScore = e.activityScore ?? Math.round(50 + Math.abs(e.change) * 5)
      const flowScore = flowYi === undefined ? undefined : flowYi > 0 ? Math.min(100, 60 + flowYi * 3) : Math.max(0, 40 + flowYi * 3)
      const sectorScore = displaySectors.value[0]?.score ?? 50
      return {
        ...e,
        flow: flowYi !== undefined ? `${flowYi > 0 ? '+' : ''}${flowYi.toFixed(2)}亿` : '--',
        signal: inferEtfSignal(e.change, flowYi),
        score:
          e.score ??
          computeEtfScore({ trendScore, flowScore, activityScore, sectorScore })
      }
    })
  })

  const rotationItems = computed<RotationItem[]>(() => {
    if (!snapshot.value?.sectors?.length) return rotationData
    return displaySectors.value.map((s) => ({
      name: s.name,
      value: Math.max(4, Math.round((s.score ?? 50) / 2)),
      change: s.change
    }))
  })

  const focusedSector = computed(() => displaySectors.value[0]?.name ?? '半导体')

  const emotion = computed<Emotion>(() => {
    const snap = snapshot.value
    if (!snap) return mockEmotion
    const b = currentBreadth.value
    const factors = computeEmotionFactors({
      breadthUp: b.up,
      breadthDown: b.down,
      limitUp: snap.market.limitUp,
      limitDown: snap.market.limitDown,
      brokenBoard: snap.market.brokenBoard,
      turnoverYi: snap.market.turnoverYi,
      avgTurnoverYi: marketExtras.avgTurnoverYi
    })
    const score = Math.round((factors.values.reduce((a, b) => a + b, 0) / factors.values.length) * 10) / 10
    const total = b.up + b.down
    const width = total > 0 ? Math.round((b.up / total) * 100) : 50
    return {
      score,
      label: emotionLabel(score),
      change: '+0.0',
      tags: displaySectors.value.slice(0, 3).map((s) => s.name),
      note: `上涨 ${snap.market.breadth.up.toLocaleString()} 家 / 下跌 ${snap.market.breadth.down.toLocaleString()} 家，市场宽度 ${width}%。`,
      confidence: computeConfidence(factors.available, factors.total)
    }
  })

  const sentimentRadarData = computed<SentimentFactor[]>(() => {
    if (!snapshot.value) return sentimentRadar
    const factors = computeEmotionFactors({
      breadthUp: snapshot.value.market.breadth.up,
      breadthDown: snapshot.value.market.breadth.down,
      limitUp: snapshot.value.market.limitUp,
      limitDown: snapshot.value.market.limitDown,
      brokenBoard: snapshot.value.market.brokenBoard,
      turnoverYi: snapshot.value.market.turnoverYi,
      avgTurnoverYi: marketExtras.avgTurnoverYi
    })
    return factors.names.map((name, index) => ({ name, value: factors.values[index] }))
  })

  const pulseData = computed<number[]>(() => pulseSeries[pulseRange.value])
  const pulseLabels = computed<string[]>(() => timeLabels[pulseRange.value])
  const pulseCurrent = computed<number>(() => {
    const data = pulseData.value
    return data.length ? data[data.length - 1] : 0
  })

  const metricCards = computed<Metric[]>(() => {
    const snap = snapshot.value
    const b = currentBreadth.value
    const up = b.up
    const down = b.down
    const breadthDiff = up - down
    const limitUp = snap?.market.limitUp ?? marketExtras.limitUp
    const limitDown = snap?.market.limitDown ?? marketExtras.limitDown
    const brokenBoard = snap?.market.brokenBoard ?? marketExtras.brokenBoard
    const turnoverYi = snap?.market.turnoverYi ?? marketExtras.turnoverYi
    const turnoverDelta = turnoverYi && marketExtras.avgTurnoverYi
      ? ((turnoverYi - marketExtras.avgTurnoverYi) / marketExtras.avgTurnoverYi) * 100
      : null
    const brokenRate = limitUp + brokenBoard > 0 ? (brokenBoard / (limitUp + brokenBoard)) * 100 : 0
    const topFlow = displaySectors.value.reduce((acc, s) => acc + (s.flowYi ?? 0), 0)
    const concentration = hotspotConcentration.value
    return [
      { key: 'breadth', label: '上涨 / 下跌', value: `${up.toLocaleString()} / ${down.toLocaleString()}`, delta: `${breadthDiff > 0 ? '+' : ''}${breadthDiff}`, tone: breadthDiff >= 0 ? 'up' : 'down', icon: 'TrendCharts' },
      { key: 'limit', label: '涨停 / 跌停', value: `${limitUp} / ${limitDown}`, delta: '实时', tone: limitUp >= limitDown ? 'up' : 'down', icon: 'Lightning' },
      { key: 'turnover', label: '两市成交额', value: turnoverYi ? `${(turnoverYi / 10000).toFixed(2)} 万亿` : '--', delta: turnoverDelta !== null ? `${turnoverDelta > 0 ? '+' : ''}${turnoverDelta.toFixed(1)}%` : '--', tone: turnoverDelta !== null && turnoverDelta >= 0 ? 'up' : 'down', icon: 'DataLine' },
      { key: 'broken', label: '炸板率', value: `${brokenRate.toFixed(1)}%`, delta: '实时', tone: brokenRate >= 30 ? 'down' : 'up', icon: 'Warning' },
      { key: 'heat', label: '热点集中度', value: concentration.toFixed(1), delta: 'TOP3 资金占比', tone: concentration >= 50 ? 'up' : 'flat', icon: 'Aim' },
      { key: 'flow', label: '主力净流入', value: `${topFlow > 0 ? '+' : ''}${topFlow.toFixed(1)} 亿`, delta: '板块合计', tone: topFlow >= 0 ? 'up' : 'down', icon: 'Coin' }
    ]
  })

  /** 热点集中度：TOP3 板块主力净流入占全部正流入板块的比重（无正流入时按成交额口径，仍无数据回退 Mock） */
  const hotspotConcentration = computed<number>(() => {
    const sectors = displaySectors.value
    const pos = sectors.map((s) => s.flowYi ?? 0).filter((v) => v > 0)
    const posSum = pos.reduce((a, b) => a + b, 0)
    if (posSum > 0) {
      const top3 = [...pos].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0)
      return Math.round((top3 / posSum) * 1000) / 10
    }
    const amounts = sectors.map((s) => s.amountYi ?? 0).filter((v) => v > 0)
    const amountSum = amounts.reduce((a, b) => a + b, 0)
    if (amountSum > 0) {
      const top3 = [...amounts].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0)
      return Math.round((top3 / amountSum) * 1000) / 10
    }
    return 72.4
  })

  /** 六指标卡 L2 详情面板（层级内容展示），组件层只做渲染 */
  const metricDetails = computed<Record<MetricKey, MetricDetail>>(() => {
    const snap = snapshot.value
    const b = currentBreadth.value
    return buildMetricDetails({
      breadth: b,
      limitUp: snap?.market.limitUp ?? marketExtras.limitUp,
      limitDown: snap?.market.limitDown ?? marketExtras.limitDown,
      brokenBoard: snap?.market.brokenBoard ?? marketExtras.brokenBoard,
      turnoverYi: snap?.market.turnoverYi ?? marketExtras.turnoverYi,
      shTurnoverYi: snap?.market.shTurnoverYi ?? marketExtras.shTurnoverYi,
      szTurnoverYi: snap?.market.szTurnoverYi ?? marketExtras.szTurnoverYi,
      avgTurnoverYi: marketExtras.avgTurnoverYi,
      concentration: hotspotConcentration.value,
      sectors: displaySectors.value,
      totalFlowYi: displaySectors.value.reduce((acc, s) => acc + (s.flowYi ?? 0), 0)
    })
  })

  // ---------- actions ----------
  async function refresh(showMessage = true): Promise<boolean> {
    loading.value = true
    lastUpdated.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    try {
      const data = await fetchMarketSnapshot()
      snapshot.value = data
      dataSource.value = data.source
      warnings.value = data.warnings ?? []
      consecutiveFailures = 0
      lastFetchAt = Date.now()
      if (showMessage) {
        const label = data.source === 'tencent' ? '腾讯财经' : data.source === 'eastmoney' ? '东方财富' : '行情'
        ElMessage.success(label + '行情已刷新')
      }
      return true
    } catch {
      snapshot.value = null
      dataSource.value = 'mock'
      warnings.value = ['实时行情暂不可用，已切换 Mock 数据']
      if (showMessage) ElMessage.warning('实时行情暂不可用，已切换 Mock 数据')
      return false
    } finally {
      loading.value = false
    }
  }

  function stopAutoRefresh(): void {
    if (refreshTimer !== undefined) {
      window.clearInterval(refreshTimer)
      refreshTimer = undefined
    }
    autoRefreshOn.value = false
  }

  function startAutoRefresh(): void {
    stopAutoRefresh()
    autoRefreshOn.value = true
    refreshTimer = window.setInterval(() => {
      if (document.hidden || !isTradingTime(new Date())) return
      void refresh(false).then((ok) => {
        if (!ok) {
          consecutiveFailures += 1
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            stopAutoRefresh()
            ElMessage.warning('连续刷新失败，自动刷新已暂停，可点击刷新重试')
          }
        }
      })
    }, AUTO_REFRESH_MS)
  }

  return {
    snapshot,
    dataSource,
    loading,
    lastUpdated,
    warnings,
    pulseRange,
    autoRefreshOn,
    currentBreadth,
    mainIndices,
    broadIndices,
    displaySectors,
    displayEtfs,
    rotationItems,
    focusedSector,
    emotion,
    sentimentRadarData,
    pulseData,
    pulseLabels,
    pulseCurrent,
    metricCards,
    hotspotConcentration,
    metricDetails,
    refresh,
    startAutoRefresh,
    stopAutoRefresh
  }
})
