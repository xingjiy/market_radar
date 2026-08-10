import { aiBrief, type AiBrief } from '../data/mock'

/**
 * 获取 AI 市场简报
 * MVP1c：返回 Mock；MVP2 切换为 GET /api/v1/brief?date=YYYY-MM-DD
 */
export async function fetchAiBrief(_date?: string): Promise<AiBrief> {
  return { ...aiBrief }
}
