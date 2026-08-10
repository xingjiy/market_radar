import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { watchlist as seedWatchlist, type WatchItem } from '../data/mock'
import { loadWatchlist, saveWatchlist } from '../services/watchlist'

export const useWatchlistStore = defineStore('watchlist', () => {
  const items = ref<WatchItem[]>(loadWatchlist(seedWatchlist))

  const starred = computed(() => items.value.filter((item) => item.starred))

  function persist(): void {
    saveWatchlist(items.value)
  }

  function toggleStar(code: string): void {
    const target = items.value.find((item) => item.code === code)
    if (target) {
      target.starred = !target.starred
      persist()
    }
  }

  function add(item: Omit<WatchItem, 'starred'> & { starred?: boolean }): boolean {
    if (items.value.some((i) => i.code === item.code)) return false
    items.value.push({ ...item, starred: item.starred ?? true })
    persist()
    return true
  }

  function remove(code: string): void {
    items.value = items.value.filter((item) => item.code !== code)
    persist()
  }

  function reset(): void {
    items.value = seedWatchlist.map((item) => ({ ...item }))
    persist()
  }

  return { items, starred, toggleStar, add, remove, reset }
})
