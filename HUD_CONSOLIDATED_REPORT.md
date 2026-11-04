# AZURE COAST — HUD 整合与安全下车修复

## 本次变更
- `public/hud-layout.mjs`：独立的 HUD 面板折叠控制，支持 aria-expanded / aria-controls，850px 以下默认收起。
- `public/hud-bootstrap.mjs`：无 3D 引擎依赖的初始化入口。
- `public/hud-panels.css`：窄屏和低高度布局规则，减少账户/天气面板对任务区遮挡。
- `public/play.html`：接入上述资源。
- `public/game.mjs`：修复未找到安全下车点时过早设置 onFoot 的状态一致性缺陷。
- `tests/hud-panels.test.mjs`：新增 3 项结构与回归测试。

## 实测
- `npm test`：45/45 PASS。
- `node --check public/game.mjs`、`node --check public/hud-layout.mjs`：通过。
- Chromium 375px 截图：BLOCKED（18 秒超时，未生成截图）。

## 已知不足
- CSS 视觉验收未完成，不能保证所有视口无遮挡。
- 当前折叠面板在打开时仍可能覆盖部分 HUD，后续需要视觉验收调整。
- 游戏仍使用简化碰撞与程序化模型，非 3A 资产。
