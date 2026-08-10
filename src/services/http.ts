/** 轻量 fetch 封装：超时、错误归一 */
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export async function httpGet<T>(url: string, options: { timeout?: number } = {}): Promise<T> {
  const timeout = options.timeout ?? 8000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal })
    if (!response.ok) throw new HttpError(response.status, `HTTP ${response.status}`)
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(0, error instanceof Error ? error.message : 'network error')
  } finally {
    clearTimeout(timer)
  }
}
