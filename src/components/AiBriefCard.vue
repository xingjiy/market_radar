<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowDown, ArrowUp, DataAnalysis } from '@element-plus/icons-vue'
import SectionHeader from './SectionHeader.vue'
import { fetchAiBrief } from '../services/brief'
import type { AiBrief } from '../data/mock'
import { useMarketStore } from '../stores/market'

const market = useMarketStore()
const brief = ref<AiBrief | null>(null)
const showBrief = ref(false)

const confidence = computed(() => {
  if (!brief.value) return market.emotion.confidence
  return Math.round((brief.value.confidence + market.emotion.confidence) / 2)
})

onMounted(async () => {
  brief.value = await fetchAiBrief()
})
</script>

<template>
  <article id="brief" class="panel-card ai-card">
    <SectionHeader eyebrow="AI MARKET BRIEF · 08" title="AI 市场简报" caption="基于数据交叉验证生成" />
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
    <button class="text-link" @click="showBrief = !showBrief">
      {{ showBrief ? '收起简报' : '展开完整简报' }} <ArrowDown v-if="!showBrief" /><ArrowUp v-else />
    </button>
  </article>
</template>
