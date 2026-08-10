<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { searchStocks, type StockSearchResult } from '../services/stockSearch'
import { useWatchlistStore } from '../stores/watchlist'

const route = useRoute()
const router = useRouter()
const watchlistStore = useWatchlistStore()

const code = computed(() => String(route.params.code ?? '').toUpperCase())
const quote = ref<StockSearchResult | null>(null)
const loading = ref(false)
const notFound = ref(false)

async function loadQuote(): Promise<void> {
  loading.value = true
  notFound.value = false
  try {
    const results = await searchStocks(code.value)
    quote.value = results.find((r) => r.code.toUpperCase() === code.value) ?? results[0] ?? null
    notFound.value = !quote.value
  } catch {
    // 上游不可用时回退观察池
    const watch = watchlistStore.items.find((item) => item.code.toUpperCase() === code.value)
    if (watch) {
      quote.value = {
        code: watch.code,
        name: watch.name,
        type: watch.type === 'ETF' ? 'Fund' : 'AStock',
        quoteId: watch.code,
        price: Number(watch.price) || null,
        change: watch.change,
        amount: null,
        market: ''
      }
    } else {
      notFound.value = true
    }
  } finally {
    loading.value = false
  }
}

function addToWatch(): void {
  if (!quote.value) return
  const type = quote.value.type === 'Fund' ? 'ETF' : '股票'
  const ok = watchlistStore.add({
    code: quote.value.code,
    name: quote.value.name,
    type,
    price: quote.value.price != null ? quote.value.price.toFixed(2) : '--',
    change: quote.value.change ?? 0,
    flow: '--',
    status: '观察'
  })
  ElMessage.success(ok ? '已加入观察池' : '已在观察池中')
}

onMounted(() => {
  void loadQuote()
})
</script>

<template>
  <main class="detail-main">
    <button class="back-link" @click="router.back()"><ArrowLeft /> 返回市场全景</button>
    <section class="panel-card detail-card">
      <div class="detail-head">
        <div>
          <div class="eyebrow">STOCK TRACKING · 个股追踪</div>
          <h2 class="detail-title">{{ quote?.name ?? code }} <span class="detail-code">{{ code }}</span></h2>
          <p class="detail-hint">分时 / K线 / 主力资金 / AI 诊断将在 V2 开放</p>
        </div>
        <div v-if="quote" class="detail-quote">
          <b :class="(quote.change ?? 0) >= 0 ? 'up-text' : 'down-text'">{{ quote.price ?? '--' }}</b>
          <span :class="(quote.change ?? 0) >= 0 ? 'up-text' : 'down-text'">{{ (quote.change ?? 0) > 0 ? '+' : '' }}{{ quote.change ?? '--' }}%</span>
          <el-button type="primary" size="small" @click="addToWatch">加入观察池</el-button>
        </div>
      </div>
      <el-empty v-if="notFound" description="未找到该标的，请确认代码" :image-size="70" />
      <div v-else class="detail-body">
        <el-skeleton :loading="loading" animated :rows="6" />
        <div v-if="!loading && quote" class="detail-tags">
          <span class="status-tag">{{ quote.type === 'Fund' ? 'ETF/基金' : quote.type === 'Index' ? '指数' : 'A股' }}</span>
          <span class="status-tag">来源：{{ quote.market ? '东方财富' : '观察池' }}</span>
        </div>
      </div>
    </section>
  </main>
</template>
