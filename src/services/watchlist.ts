import type { WatchItem } from '../data/mock'

const STORAGE_KEY = 'radar.watch.v1'

/** 读取本地观察池；无存储时以默认池为种子 */
export function loadWatchlist(seed: WatchItem[]): WatchItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seed.map((item) => ({ ...item }))
    const parsed = JSON.parse(raw) as WatchItem[]
    if (Array.isArray(parsed)) return parsed
  } catch {
    /* 存储损坏时回退默认池 */
  }
  return seed.map((item) => ({ ...item }))
}

/** 持久化观察池 */
export function saveWatchlist(items: WatchItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* 隐私模式等场景下静默失败 */
  }
}
