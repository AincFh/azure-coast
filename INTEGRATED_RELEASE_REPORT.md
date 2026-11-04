# AZURE COAST — 集中迭代报告

## 已实现
- 游戏内可调节 0–23 点时间与晴朗/多云/雨天，实时更新天空、太阳光、环境光、雾与曝光。
- 环境设置独立保存于 `azure-coast-environment-v1`，与旧任务/会话存档兼容。
- 上下车时先检查候选位置是否被建筑占据，无法安全下车时拒绝切换。
- 环境和安全下车逻辑独立成纯函数，新增 5 项单元测试。

## 真实测试
- `npm test`：42/42 PASS。
- `npm run check`：PASS。
- `node --check public/environment.mjs`：PASS。
- 本地服务端口 8097：官网、游戏页、脚本、样式与健康接口 HTTP 200。
- Chromium 无头截图：超时，BLOCKED；不得视为视觉验收通过。

## 尚未完成
- 浏览器真实渲染、四分辨率 CSS 视觉验收。
- 雨滴粒子与路面湿润 PBR（当前雨天仅改变光照与雾）。
- 真实车辆刚体物理、多人、原创 GB 级资产。

## 启动
`npm start`，浏览器打开 `http://localhost:8080/play.html`。若 8080 被占用，可设置 `PORT=8097`。
