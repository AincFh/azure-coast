# Phase 5 — 交互式城市探索控制台

## 本轮实装
- `public/explore.html`：独立交互城市控制台（搜索街区、Canvas 地图、路线规划、时间、天气、载具选择、JSON 导出）。
- `public/explore.css`：独立响应式设计系统，桌面三栏、平板双栏、手机单栏，键盘焦点与减少动态效果支持。
- `public/explore.mjs`：Canvas 绘制、地图标记点击、路线渲染、模拟雨天/夜间视觉、localStorage 行程持久化。
- `public/explore-core.mjs`：可测试的街区、车辆、距离与输入清洗逻辑。
- `tests/explore.test.mjs`：5 项新增单元测试。
- 官网导航已添加城市探索控制台入口。

## 实测
- `npm test`：19/19 PASS。
- 新增四项静态资源通过本地 Node HTTP 服务返回 200，JS 模块 MIME 为 text/javascript。
- Chromium 截图运行超时；没有完成真实浏览器视觉和点击验收，不能声称 CSS 已全平台无问题。

## 边界
- 城市坐标与里程为模拟数据；不与 3D 驾驶世界实时同步。
- Canvas 绘图不是 3D 游戏截图；3D 游戏仍在 `/play.html`。
- 未引入无用填充文件，项目尚非数 GB 商业 3A 游戏。

## 运行
`npm start`，打开 `http://localhost:8080/explore.html`。如 8080 端口占用，PowerShell 运行 `$env:PORT=8099; npm start`。
