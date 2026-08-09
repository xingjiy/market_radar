# Radar OS · A股市场雷达

基于 Vue 3 + TypeScript + Vite + Element Plus + ECharts 的专业金融科技 Dashboard UI。当前版本使用本地 Mock 数据，重点还原 PRD 中的市场全景首页与交互闭环。

## 快速开始

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## Netlify 部署

项目已包含 `netlify.toml`，Netlify 连接仓库后会自动执行 `npm run build`，并发布 `dist` 目录。也可以使用 Netlify CLI：

```bash
npm install -g netlify-cli
netlify deploy --prod
```

## 目录说明

- `src/data/mock.ts`：Mock 数据与类型定义，后续替换为 API 适配器即可。
- `src/components/ChartPanel.vue`：ECharts 生命周期与响应式尺寸封装。
- `src/App.vue`：Dashboard 页面组合、搜索、刷新、时间范围、关注池与简报交互。
- `src/styles.css`：响应式金融科技视觉系统。
- `netlify/functions/market-snapshot.mjs`：东方财富行情代理，聚合指数、市场宽度、板块和 ETF 快照。
- `src/services/market.ts`：前端行情服务，实时接口失败时自动回退 Mock。

## 数据源接入

当前已接入东方财富公开行情接口（指数、市场涨跌家数、行业板块、ETF 快照），通过 Netlify Function 统一代理到 `/api/market-snapshot`，避免浏览器跨域限制。页面右上角会显示当前数据源：

- `东方财富`：实时接口返回成功。
- `Mock`：接口超时、限流或本地开发未启动 Functions 时的兜底状态。

本项目没有把任何账号密钥写入前端。东方财富公开行情接口可能存在频率限制，生产环境建议在 Function 中增加缓存、重试和数据源切换策略。

## 后续 API 接入建议

保持 `mock.ts` 中的类型契约不变，将数据读取移动到 `src/services/`，按 `market / sectors / etfs / watchlist / brief` 拆分接口；图表组件无需改动。
