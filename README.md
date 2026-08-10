# Radar OS · A股市场雷达

基于 Vue 3 + TypeScript + Vite + Element Plus + ECharts 的专业金融科技 Dashboard。
数据源：东方财富公开行情接口（Netlify Functions 代理），失败自动降级 Mock。
产品设计文档见 [`docs/A股市场雷达_Radar_OS_产品设计文档.md`](docs/A股市场雷达_Radar_OS_产品设计文档.md)。

## 快速开始

```bash
npm install
npm run dev      # 本地开发（5173）
npm run build    # 生产构建（dist/）
npm run preview  # 预览构建产物
npm run typecheck  # vue-tsc 类型检查
```

> 本地开发时未启动 Netlify Functions 时，`/api/*` 请求会失败并自动回退 Mock 数据（右上角显示数据源）。

## 功能模块

| 编号 | 模块 | 组件 |
| --- | --- | --- |
| 01 | 市场脉冲（Hero） | `PulseGauge.vue` |
| — | 核心指标网格 | `MetricGrid.vue` |
| 02 | 市场脉冲走势（今日/本周/本月） | `PulseTrend.vue` |
| 03 | 市场情绪雷达 | `EmotionRadar.vue` |
| 04 | 热点板块排行 | `SectorBar.vue` |
| 05 | 板块轮动地图 | `RotationMap.vue` |
| 06 | ETF 资金雷达 | `EtfTable.vue` |
| 07 | 核心观察列表 | `WatchList.vue` |
| 08 | AI 市场简报 | `AiBriefCard.vue` |
| — | 全局搜索 / 个股追踪 | `GlobalSearch.vue` + `views/StockDetail.vue` |

## 目录结构

```text
src/
├── main.ts / App.vue / styles.css
├── router/index.ts          # / 市场全景 · /stock/:code 个股追踪
├── stores/                  # Pinia：market（快照/自动刷新）、watchlist（观察池）
├── services/                # http / market / stockSearch / watchlist / brief
├── utils/indicators.ts      # 指标引擎：脉冲/情绪/板块强度/ETF评分（纯函数）
├── data/mock.ts             # 类型契约 + Mock 数据（类型即接口契约）
├── components/              # 图表与业务组件（ChartPanel 封装 ECharts 生命周期）
└── views/                   # MarketOverview（首页聚合）、StockDetail
netlify/functions/           # market-snapshot（聚合快照+涨停/跌停/炸板）、stock-search
docs/                        # 产品设计文档
```

## 数据源与降级
- **腾讯财经（主）**：指数 / ETF / 个股报价（`qt.gtimg.cn`）、沪深涨跌家数（`bkqtRank_A_sh/sz`）、行业板块排行与主力资金流（`proxy.finance.qq.com getRank`）、个股 / ETF / 指数搜索（`smartbox.gtimg.cn`）。
- **东方财富（备用 / 补齐）**：指数涨跌家数、板块、ETF 备用；涨停 / 跌停 / 炸板池（`push2ex`，腾讯无等价免费接口）；搜索备用（`searchapi`）。
- **降级链**：腾讯财经 → 东方财富 → Mock。
- 数据域按需独立降级：单个域失败不影响其他域（`domains` 标注各域来源，`warnings[]` 上抛前端）。

- 自动刷新：盘中 60s 轮询，页面隐藏暂停，连续 3 次失败自动停止。

## 指标口径（详见设计文档第 7 章）

- 市场脉冲指数：涨跌比例25% + 涨停20% + 主力资金20% + 成交量15% + 热点10% + 波动10%；
- 板块强度：涨幅30% + 成交额20% + 资金流30% + 涨停数20%；
- ETF 评分：价格趋势30% + 资金流30% + 成交活跃20% + 板块强度20%；
- 情绪雷达六维：赚钱效应 / 资金活跃 / 热点强度 / 连板高度 / 市场宽度 / 风险偏好。

## 说明

- A 股颜色约定：红涨绿跌；
- 页面仅供研究参考，不构成投资建议。
