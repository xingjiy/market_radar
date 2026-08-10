import { aiBrief, type AiBrief } from '../data/mock'
import { httpGet } from './http'

/**
 * 获取 AI 市场简报
 * 优先请求 /api/market-brief（规则或 LLM 生成六段式详细简报），失败回退 Mock。
 */
export async function fetchAiBrief(_date?: string): Promise<AiBrief> {
  try {
    return await httpGet<AiBrief>('/api/market-brief')
  } catch {
    return { ...aiBrief, source: 'mock' }
  }
}
