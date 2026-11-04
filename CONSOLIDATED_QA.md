# 集中整改记录（2026-11-05）

## 本轮代码变更
- 新增 `public/design-system.css`，在旧样式之后加载，统一 box-sizing、布局边界、图片溢出、响应式网格、导航折叠、标题缩放、触摸目标、键盘焦点和减少动画支持。
- 新增 `public/navigation.mjs`，统一移动导航的 aria-expanded、ESC 关闭、路由切换关闭和大屏自动收起。
- 修改 `public/index.html` 接入新样式与交互模块。
- 新增 `tests/design-system.test.mjs`，回归检查 CSS 加载顺序、响应式规则和无障碍行为的代码约束。

## 验证证据
- `npm test`：24/24 PASS（包括原有服务、模拟、世界与探索测试）。
- 尝试使用 Python Playwright + 系统 Chromium 打开 `http://127.0.0.1:8080/` 进行 375/768/1440 三档浏览器截图：浏览器返回 `net::ERR_BLOCKED_BY_ADMINISTRATOR`。**没有获得可用于判断 CSS 是否修复的截图**。
- 因此本轮仅能认定已修复一批可定位的样式结构风险，**不能宣称所有 CSS 视觉缺陷已解决**。

## 尚未完成
- 浏览器真实逐页视觉回归、游戏 3D 渲染和帧率测试。
- 实际 AAA 级美术资产、开放世界 NPC/物理/大型地图与数 GB 资源管线。
- 旧版压缩 CSS 的逐组件拆分；当前统一层属于过渡性兼容方案。

## 运行
`npm start` → `http://localhost:8080/`；`npm test` 运行自动化测试。
