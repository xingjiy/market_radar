<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowDown, ArrowUp, DataAnalysis } from '@element-plus/icons-vue'
import SectionHeader from './SectionHeader.vue'
import { fetchAiBrief } from '../services/brief'
import type { AiBrief } from '../data/mock'
import { useMarketStore } from '../stores/market'
import { useAnalysisStore } from '../stores/analysis'

const market = useMarketStore()
const analysisStore = useAnalysisStore()
const brief = ref<AiBrief | null>(null)
const showBrief = ref(false)

const confidence = computed(() => {
  if (!brief.value) return market.emotion.confidence
  return Math.round((brief.value.confidence + market.emotion.confidence) / 2)
})

/** 最近个股诊断（最多 5 条） */
const shownAnalyses = computed(() => analysisStore.recent.slice(0, 5))
const aggregateText = computed(() => {
  const n = analysisStore.recent.length
  if (!n) return '暂无诊断记录'
  return `已诊断 ${n} 只 · 偏强 ${analysisStore.strongCount} · 偏弱 ${analysisStore.weakCount}`
})

function trendClass(direction: 'up' | 'down' | 'range'): string {
  if (direction === 'up') return 'trend-up'
  if (direction === 'down') return 'trend-down'
  return 'trend-range'
}
function timeText(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

onMounted(async () => {
  brief.value = await fetchAiBrief()
})
</script>

<template>
  <article id="brief" class="panel-card ai-card">
    <SectionHeader eyebrow="AI MARKET BRIEF · 09" title="AI 市场简报" caption="基于数据交叉验证生成" />
    <div class="ai-status">
      <span class="ai-orb"><DataAnalysis /></span>
      <div><b>{{ brief?.status ?? '生成中…' }}</b><small>生成于 {{ brief?.generatedAt ?? '--' }}</small></div>
      <span class="confidence">置信度 {{ confidence }}%</span>
    </div>
    <p class="ai-summary">{{ brief?.summary ?? '简报生成中，请稍候…' }}</p>
    <div class="ai-actions">
      <div v-for="(action, index) in brief?.actions ?? []" v-show="showBrief || index === 0" :key="action"><span>0{{ index + 1 }}</span>{{ action }}</div>
    </div>
    <div v-if="brief?.riskTips?.length" class="ai-risks">
      <div v-for="tip in brief.riskTips" :key="tip"><span>!</span>{{ tip }}</div>
    </div>
    <div class="ai-stocks">
      <div class="ai-stocks-head">
        <b>个股 AI 诊断汇总</b>
        <span>{{ aggregateText }}</span>
      </div>
      <div v-if="shownAnalyses.length" class="ai-stock-list">
        <div v-for="item in shownAnalyses" :key="item.code" class="ai-stock-row">
          <span class="ai-stock-trend" :class="trendClass(item.direction)">{{ item.trendLabel }}</span>
          <div class="ai-stock-main">
            <b>{{ item.name }} <small>{{ item.code }} · {{ item.trendScore }}分 · {{ timeText(item.analyzedAt) }}</small></b>
            <p>{{ item.aiText || item.summary }}</p>
          </div>
        </div>
      </div>
      <p v-else class="ai-stocks-empty">暂无个股诊断 · 前往个股追踪页查看支撑压力/走势分析后自动汇总</p>
    </div>
    <button class="text-link" @click="showBrief = !showBrief">
      {{ showBrief ? '收起简报' : '展开完整简报' }} <ArrowDown v-if="!showBrief" /><ArrowUp v-else />
    </button>
  </article>
</template>
