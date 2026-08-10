<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'
import type { MetricDetail, Trend } from '../data/mock'

defineProps<{ detail: MetricDetail }>()
defineEmits<{ (e: 'close'): void }>()

function toneClass(tone?: Trend): string {
  if (tone === 'up') return 'up-text'
  if (tone === 'down') return 'down-text'
  return 'flat-text'
}
</script>

<template>
  <div class="metric-detail panel-card">
    <header class="metric-detail-head">
      <div>
        <div class="eyebrow">MARKET DETAIL · L2</div>
        <h3>{{ detail.title }}</h3>
        <p>{{ detail.caption }}</p>
      </div>
      <button type="button" class="detail-close" aria-label="收起详情" @click="$emit('close')">
        <Close />
      </button>
    </header>

    <div class="detail-main-row">
      <div class="detail-main">
        <span>{{ detail.main.label }}</span>
        <strong :class="toneClass(detail.main.tone)">{{ detail.main.value }}</strong>
      </div>
      <span class="detail-verdict" :class="toneClass(detail.verdict.tone)">{{ detail.verdict.text }}</span>
    </div>

    <div v-if="detail.stats.length" class="detail-stats">
      <div v-for="stat in detail.stats" :key="stat.label" class="detail-stat">
        <span>{{ stat.label }}</span>
        <strong :class="toneClass(stat.tone)">{{ stat.value }}</strong>
        <em v-if="stat.hint">{{ stat.hint }}</em>
      </div>
    </div>

    <div v-if="detail.ratio" class="detail-ratio">
      <div class="ratio-bar">
        <i
          v-for="seg in detail.ratio.segments"
          :key="seg.label"
          :class="`ratio-${seg.tone}`"
          :style="{ width: `${seg.pct}%` }"
        />
      </div>
      <div class="ratio-legend">
        <span v-for="seg in detail.ratio.segments" :key="seg.label">
          <i :class="`dot-${seg.tone}`" />{{ seg.label }} {{ seg.pct.toFixed(1) }}%
        </span>
      </div>
    </div>

    <div v-if="detail.ranking?.length" class="detail-ranking">
      <div v-for="list in detail.ranking" :key="list.title" class="detail-rank-col">
        <h4>{{ list.title }}</h4>
        <div v-if="!list.rows.length" class="rank-empty">暂无数据</div>
        <template v-else>
        <div v-for="(row, index) in list.rows" :key="row.label" class="rank-row">
          <span class="rank-no">{{ index + 1 }}</span>
          <span class="rank-label">{{ row.label }}</span>
          <span v-if="row.pct !== undefined" class="rank-pct"><i :style="{ width: `${Math.min(row.pct, 100)}%` }" /></span>
          <strong :class="toneClass(row.tone)">{{ row.value }}</strong>
        </div>
        </template>
      </div>
    </div>

    <footer class="detail-note">{{ detail.note }}</footer>
  </div>
</template>