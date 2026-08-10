<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, Close } from '@element-plus/icons-vue'
import SectionHeader from './SectionHeader.vue'
import type { MarketIndex, Trend } from '../data/mock'
import { useMarketStore } from '../stores/market'

const market = useMarketStore()

type IndexTab = 'main' | 'broad'
const tab = ref<IndexTab>('main')
const tabs: Array<{ value: IndexTab; label: string }> = [
  { value: 'main', label: '主要指数' },
  { value: 'broad', label: '宽基指数' }
]

const activeCode = ref<string | null>(null)
const group = computed<MarketIndex[]>(() => (tab.value === 'main' ? market.mainIndices : market.broadIndices))
const activeIndex = computed<MarketIndex | null>(() => group.value.find((i) => i.code === activeCode.value) ?? null)

function toggle(code: string): void {
  activeCode.value = activeCode.value === code ? null : code
}

function tone(change: number): Trend {
  return change >= 0 ? 'up' : 'down'
}
function signed(value: number | undefined, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) return '--'
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`
}
function fmtPrice(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '--'
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtYi(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '--'
  return `${Math.round(value).toLocaleString()} 亿`
}
function fmtPct(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '--'
  return `${value.toFixed(2)}%`
}

/** L2 详情派生：开高低收 + 成分涨跌分布 + 趋势评级 */
const detail = computed(() => {
  const idx = activeIndex.value
  if (!idx) return null
  const up = idx.up ?? 0
  const down = idx.down ?? 0
  const flat = idx.flat ?? 0
  const total = up + down + flat
  const upPct = total > 0 ? (up / total) * 100 : 0
  const downPct = total > 0 ? (down / total) * 100 : 0
  const flatPct = total > 0 ? (flat / total) * 100 : 0
  const breadthDiff = up - down
  const upRatio = total > 0 ? (up / total) * 100 : 50
  let verdict: { text: string; tone: Trend }
  if (idx.change >= 0 && upRatio >= 60) verdict = { text: '指数走强 · 普涨', tone: 'up' }
  else if (idx.change >= 0) verdict = { text: '指数走强', tone: 'up' }
  else if (upRatio <= 40) verdict = { text: '指数走弱 · 普跌', tone: 'down' }
  else verdict = { text: '指数走弱', tone: 'down' }
  return { idx, up, down, flat, total, upPct, downPct, flatPct, breadthDiff, upRatio, verdict }
})
</script>

<template>
  <section id="indices" class="panel-card top-gap">
    <SectionHeader eyebrow="INDEX QUOTES · 02" title="A股指数" caption="主要与宽基指数实时行情">
      <div class="segmented index-tabs">
        <button
          v-for="item in tabs"
          :key="item.value"
          :class="{ active: tab === item.value }"
          type="button"
          @click="tab = item.value"
        >{{ item.label }}</button>
      </div>
    </SectionHeader>

    <div class="index-grid">
      <article
        v-for="item in group"
        :key="item.code"
        class="index-card"
        :class="{ active: activeCode === item.code }"
        role="button"
        tabindex="0"
        :aria-expanded="activeCode === item.code"
        @click="toggle(item.code)"
        @keydown.enter="toggle(item.code)"
        @keydown.space.prevent="toggle(item.code)"
      >
        <div class="index-head">
          <span class="index-name"><b>{{ item.name }}</b><small>{{ item.code }}</small></span>
          <span class="metric-expand" :class="{ open: activeCode === item.code }">
            <component :is="activeCode === item.code ? ArrowUp : ArrowDown" />
          </span>
        </div>
        <strong class="index-price" :class="tone(item.change) === 'up' ? 'up-text' : 'down-text'">{{ fmtPrice(item.price) }}</strong>
        <div class="index-chg">
          <em :class="tone(item.change) === 'up' ? 'up-text' : 'down-text'">{{ signed(item.changeAmount) }}</em>
          <span :class="tone(item.change) === 'up' ? 'up-text' : 'down-text'">{{ signed(item.change) }}%</span>
        </div>
        <div class="index-meta">
          <span>成交 {{ fmtYi(item.amountYi) }}</span>
          <span>振幅 {{ fmtPct(item.amplitude) }}</span>
        </div>
      </article>
    </div>

    <Transition name="metric-fade" mode="out-in">
      <div v-if="detail" class="metric-detail index-detail panel-card">
        <header class="metric-detail-head">
          <div>
            <div class="eyebrow">INDEX DETAIL · L2</div>
            <h3>{{ detail.idx.name }}（{{ detail.idx.code }}）</h3>
            <p>指数实时行情与成分股涨跌分布</p>
          </div>
          <button type="button" class="detail-close" aria-label="收起详情" @click="activeCode = null">
            <Close />
          </button>
        </header>

        <div class="detail-main-row">
          <div class="detail-main">
            <span>最新点位</span>
            <strong :class="tone(detail.idx.change) === 'up' ? 'up-text' : 'down-text'">{{ fmtPrice(detail.idx.price) }}</strong>
          </div>
          <span
            class="detail-verdict"
            :class="detail.verdict.tone === 'up' ? 'up-text' : detail.verdict.tone === 'down' ? 'down-text' : 'flat-text'"
          >{{ detail.verdict.text }}</span>
        </div>

        <div class="detail-stats">
          <div class="detail-stat">
            <span>涨跌额</span>
            <strong :class="tone(detail.idx.change) === 'up' ? 'up-text' : 'down-text'">{{ signed(detail.idx.changeAmount) }}</strong>
          </div>
          <div class="detail-stat">
            <span>涨跌幅</span>
            <strong :class="tone(detail.idx.change) === 'up' ? 'up-text' : 'down-text'">{{ signed(detail.idx.change) }}%</strong>
          </div>
          <div class="detail-stat"><span>成交额</span><strong>{{ fmtYi(detail.idx.amountYi) }}</strong></div>
          <div class="detail-stat"><span>振幅</span><strong>{{ fmtPct(detail.idx.amplitude) }}</strong></div>
          <div class="detail-stat"><span>今开</span><strong>{{ fmtPrice(detail.idx.open) }}</strong></div>
          <div class="detail-stat"><span>昨收</span><strong>{{ fmtPrice(detail.idx.prevClose) }}</strong></div>
          <div class="detail-stat"><span>最高</span><strong class="up-text">{{ fmtPrice(detail.idx.high) }}</strong></div>
          <div class="detail-stat"><span>最低</span><strong class="down-text">{{ fmtPrice(detail.idx.low) }}</strong></div>
        </div>

        <div v-if="detail.total > 0" class="detail-ratio">
          <div class="ratio-bar">
            <i class="ratio-up" :style="{ width: `${detail.upPct}%` }" />
            <i class="ratio-down" :style="{ width: `${detail.downPct}%` }" />
            <i v-if="detail.flatPct > 0" class="ratio-flat" :style="{ width: `${detail.flatPct}%` }" />
          </div>
          <div class="ratio-legend">
            <span><i class="dot-up" />上涨 {{ detail.up }}</span>
            <span><i class="dot-down" />下跌 {{ detail.down }}</span>
            <span v-if="detail.flatPct > 0"><i class="dot-flat" />平盘 {{ detail.flat }}</span>
            <span class="ratio-note">成分涨跌差 {{ detail.breadthDiff >= 0 ? '+' : '' }}{{ detail.breadthDiff }}</span>
          </div>
        </div>
        <div v-else class="index-breadth-empty">成分涨跌家数暂不可用</div>

        <footer class="detail-note">数据源：腾讯财经指数报价 + 东方财富成分涨跌家数；非交易时段为最近收盘快照。</footer>
      </div>
    </Transition>
  </section>
</template>