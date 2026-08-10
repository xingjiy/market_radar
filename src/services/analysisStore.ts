import type { TrendInfo } from './stockAnalysis'

/** 最近一次个股诊断记录（AI 或规则） */
export interface RecentAnalysis {
  code: string
  name: string
  price: number
  /** 分析对应的交易日 */
  date: string
  trendLabel: string
  trendScore: number
  direction: TrendInfo['direction']
  /** 大模型诊断文本（配置 LLM 后存在） */
  aiText?: string
  /** 规则化摘要（兜底展示） */
  summary: string
  analyzedAt: string
}

const STORAGE_KEY = 'radar.analysis.v1'
const MAX_ITEMS = 8

/** 读取本地个股诊断记录 */
export function loadRecentAnalyses(): RecentAnalysis[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentAnalysis[]
    if (Array.isArray(parsed)) return parsed.slice(0, MAX_ITEMS)
  } catch {
    /* 存储损坏时忽略 */
  }
  return []
}

/** 持久化个股诊断记录 */
export function saveRecentAnalyses(items: RecentAnalysis[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    /* 隐私模式等场景下静默失败 */
  }
}