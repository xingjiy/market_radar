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

## 后续 API 接入建议

保持 `mock.ts` 中的类型契约不变，将数据读取移动到 `src/services/`，按 `market / sectors / etfs / watchlist / brief` 拆分接口；图表组件无需改动。
