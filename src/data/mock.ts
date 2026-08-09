export type Trend = 'up' | 'down' | 'flat'

export interface Metric {
  label: string
  value: string
  delta: string
  tone: Trend
  icon: string
}

export const marketMetrics: Metric[] = [
  { label: '上涨 / 下跌', value: '2,517 / 2,566', delta: '-49', tone: 'down', icon: 'TrendCharts' },
  { label: '涨停 / 跌停', value: '68 / 14', delta: '+8 / -3', tone: 'up', icon: 'Lightning' },
  { label: '两市成交额', value: '1.18 万亿', delta: '+6.4%', tone: 'up', icon: 'DataLine' },
  { label: '炸板率', value: '28.6%', delta: '+4.2%', tone: 'down', icon: 'Warning' },
  { label: '热点集中度', value: '72.4', delta: '+11.8', tone: 'up', icon: 'Aim' },
  { label: '北向资金', value: '+42.6 亿', delta: '净流入', tone: 'up', icon: 'Coin' }
]

export const breadth = { up: 2517, down: 2566, flat: 398 }

export const emotion = {
  score: 54.5,
  label: '中性偏强',
  change: '+3.8',
  tags: ['半导体', '元件', '光学光电'],
  note: '半导体板块资金净流入 160.6 亿元，核心方向为半导体行业及其细分分支。'
}

export const pulseSeries: Record<string, number[]> = {
  '今日': [42, 46, 44, 51, 55, 53, 58, 57, 61, 63, 59, 65],
  '本周': [36, 41, 39, 45, 43, 49, 52, 48, 55, 57, 61, 64],
  '本月': [48, 44, 46, 42, 49, 53, 51, 55, 57, 54, 59, 64]
}

export const timeLabels: Record<string, string[]> = {
  '今日': ['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:20', '14:40', '14:50', '15:00'],
  '本周': ['周一', '周一', '周二', '周二', '周三', '周三', '周四', '周四', '周五', '周五', '收盘前', '收盘'],
  '本月': ['06/01', '06/03', '06/05', '06/10', '06/12', '06/16', '06/18', '06/23', '06/25', '06/27', '06/30', '07/01']
}

export const sentimentRadar = [
  { name: '赚钱效应', value: 62 },
  { name: '资金活跃', value: 70 },
  { name: '热点强度', value: 76 },
  { name: '连板高度', value: 48 },
  { name: '市场宽度', value: 44 },
  { name: '风险偏好', value: 52 }
]

export interface Sector {
  name: string
  change: number
  amount: string
  leader: string
  heat: number
  trend: Trend
}

export const sectors: Sector[] = [
  { name: '半导体', change: 4.68, amount: '160.6亿', leader: '寒武纪', heat: 96, trend: 'up' },
  { name: '光学光电', change: 3.92, amount: '86.4亿', leader: '水晶光电', heat: 90, trend: 'up' },
  { name: '消费电子', change: 3.16, amount: '72.8亿', leader: '立讯精密', heat: 84, trend: 'up' },
  { name: 'AI算力', change: 2.74, amount: '64.2亿', leader: '工业富联', heat: 82, trend: 'up' },
  { name: '机器人', change: 1.86, amount: '42.1亿', leader: '拓斯达', heat: 76, trend: 'up' },
  { name: '新能源车', change: -0.46, amount: '-18.2亿', leader: '比亚迪', heat: 48, trend: 'down' }
]

export const rotationData = [
  { name: '半导体', value: 38, change: 4.68 },
  { name: '光学光电', value: 28, change: 3.92 },
  { name: '消费电子', value: 24, change: 3.16 },
  { name: 'AI算力', value: 22, change: 2.74 },
  { name: '机器人', value: 18, change: 1.86 },
  { name: '军工', value: 14, change: 1.12 },
  { name: '医药', value: 12, change: -0.64 },
  { name: '新能源', value: 10, change: -1.12 },
  { name: '银行', value: 8, change: -0.38 }
]

export interface ETF {
  code: string
  name: string
  price: string
  change: number
  amount: string
  flow: string
  signal: string
}

export const etfs: ETF[] = [
  { code: '588000', name: '科创50ETF', price: '1.046', change: 3.18, amount: '42.7亿', flow: '+8.62亿', signal: '强势放量' },
  { code: '159995', name: '芯片ETF', price: '1.182', change: 4.52, amount: '36.1亿', flow: '+6.24亿', signal: '资金抢筹' },
  { code: '159819', name: '人工智能ETF', price: '1.031', change: 2.76, amount: '18.4亿', flow: '+2.18亿', signal: '趋势增强' },
  { code: '512480', name: '半导体ETF', price: '1.245', change: 4.12, amount: '15.8亿', flow: '+3.06亿', signal: '高位换手' },
  { code: '510300', name: '沪深300ETF', price: '4.012', change: -0.18, amount: '24.8亿', flow: '-1.32亿', signal: '宽幅震荡' }
]

export interface WatchItem {
  code: string
  name: string
  type: '股票' | 'ETF'
  price: string
  change: number
  flow: string
  status: string
  starred: boolean
}

export const watchlist: WatchItem[] = [
  { code: '688256', name: '寒武纪-U', type: '股票', price: '682.60', change: 8.12, flow: '+2.64亿', status: '主升浪', starred: true },
  { code: '002371', name: '北方华创', type: '股票', price: '401.20', change: 5.42, flow: '+1.86亿', status: '趋势向上', starred: true },
  { code: '300782', name: '卓胜微', type: '股票', price: '95.68', change: -1.24, flow: '-0.42亿', status: '观察', starred: false },
  { code: '588000', name: '科创50ETF', type: 'ETF', price: '1.046', change: 3.18, flow: '+8.62亿', status: '资金共振', starred: true },
  { code: '159995', name: '芯片ETF', type: 'ETF', price: '1.182', change: 4.52, flow: '+6.24亿', status: '加速', starred: false }
]

export const aiBrief = {
  status: '震荡轮动 · 等待聚焦',
  summary: '资金从大盘权重向科技成长切换，半导体与光学光电形成共振。市场宽度尚未同步放大，短线情绪偏强但不宜追高。',
  actions: ['关注半导体 ETF 的量价延续', '观察科创 50 能否站稳 1050', '警惕高位连板股炸板率回升'],
  generatedAt: '今日 15:08'
}
