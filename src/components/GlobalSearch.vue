<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { searchStocks } from '../services/stockSearch'
import { useWatchlistStore } from '../stores/watchlist'

interface SearchSuggestion {
  value: string
  code: string
  name: string
  type: string
  price: number | null
  change: number | null
}

const router = useRouter()
const watchlistStore = useWatchlistStore()
const keyword = ref('')
const inputRef = ref<InstanceType<typeof HTMLInputElement>>()

function typeLabel(type: string): string {
  if (type === 'AStock') return '股票'
  if (type === 'Fund') return 'ETF/基金'
  if (type === 'Index') return '指数'
  return type
}

function typeClass(type: string): string {
  if (type === 'AStock') return 'tag-stock'
  if (type === 'Fund') return 'tag-etf'
  if (type === 'Index') return 'tag-index'
  return ''
}

async function querySearch(queryString: string, cb: (results: SearchSuggestion[]) => void): Promise<void> {
  const query = queryString.trim()
  if (!query) {
    cb([])
    return
  }
  let results: SearchSuggestion[] = []
  try {
    const data = await searchStocks(query)
    results = data.map((item) => ({
      value: `${item.name} ${item.code}`,
      code: item.code,
      name: item.name,
      type: item.type,
      price: item.price,
      change: item.change
    }))
  } catch {
    // 上游不可用时回退观察池过滤
    results = watchlistStore.items
      .filter((item) => item.name.includes(query) || item.code.includes(query))
      .slice(0, 8)
      .map((item) => ({
        value: `${item.name} ${item.code}`,
        code: item.code,
        name: item.name,
        type: item.type === 'ETF' ? 'Fund' : 'AStock',
        price: Number(item.price) || null,
        change: item.change
      }))
  }
  cb(results.slice(0, 8))
}

function handleSelect(item: SearchSuggestion): void {
  void router.push({ path: `/stock/${item.code}` })
}

function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    inputRef.value?.focus()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <el-autocomplete
    v-model="keyword"
    ref="inputRef"
    class="search-input"
    :fetch-suggestions="querySearch"
    :trigger-on-focus="false"
    clearable
    placeholder="输入代码或名称，例如 000021 / 深科技"
    @select="handleSelect"
  >
    <template #prefix><el-icon><Search /></el-icon></template>
    <template #default="{ item }">
      <div class="search-item">
        <span class="search-item-name">{{ (item as SearchSuggestion).name }}</span>
        <span class="search-item-code">{{ (item as SearchSuggestion).code }}</span>
        <span class="search-item-tag" :class="typeClass((item as SearchSuggestion).type)">{{ typeLabel((item as SearchSuggestion).type) }}</span>
        <span v-if="(item as SearchSuggestion).price != null" class="search-item-quote" :class="((item as SearchSuggestion).change ?? 0) >= 0 ? 'up-text' : 'down-text'">
          {{ (item as SearchSuggestion).price }} {{ ((item as SearchSuggestion).change ?? 0) > 0 ? '+' : '' }}{{ (item as SearchSuggestion).change }}%
        </span>
      </div>
    </template>
  </el-autocomplete>
</template>
