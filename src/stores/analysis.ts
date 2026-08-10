import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { loadRecentAnalyses, saveRecentAnalyses, type RecentAnalysis } from '../services/analysisStore'

/** 个股诊断记录：个股页分析成功后自动写入，供 AI 市场简报汇总展示 */
export const useAnalysisStore = defineStore('analysis', () => {
  const recent = ref<RecentAnalysis[]>(loadRecentAnalyses())

  /** 趋势偏强数量（上涨且评分 ≥ 60） */
  const strongCount = computed(() => recent.value.filter((r) => r.direction === 'up' && r.trendScore >= 60).length)
  /** 趋势偏弱数量（下跌且评分 ≤ 40） */
  const weakCount = computed(() => recent.value.filter((r) => r.direction === 'down' && r.trendScore <= 40).length)

  function record(item: RecentAnalysis): void {
    const list = recent.value.filter((r) => r.code !== item.code)
    list.unshift(item)
    recent.value = list
    saveRecentAnalyses(recent.value)
  }

  function clear(): void {
    recent.value = []
    saveRecentAnalyses([])
  }

  return { recent, strongCount, weakCount, record, clear }
})