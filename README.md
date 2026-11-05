# AZURE COAST

**现代海滨都市网页游戏与交互官网 · 开发中 / Not released**

> 此仓库公开开发过程，不代表游戏已经完成或正式发布。目前提供的是可运行的原型工程；请勿将 `main` 分支视为稳定版本。

## 本地运行

需要 **Node.js 20+**。3D 引擎固定使用 **Three.js 0.170.0（MIT）**，运行时从本地静态目录加载。首次运行先安装锁定版本的 npm 依赖；`npm start` 会自动将浏览器模块及 MIT 许可复制到 `public/vendor/three/`。

```bash
npm install --no-audit --no-fund
npm start
```

- 官网：<http://localhost:8080/>
- 3D 游戏：<http://localhost:8080/play.html>
- 城市探索台：<http://localhost:8080/explore.html>

3D 游戏现从本机的 `/vendor/three/three.module.js` 加载 Three.js，支持网络隔离环境运行；开发和 CI 仍需在依赖安装阶段访问 npm 包源。不会在没有安装依赖时宣称脱离网络可直接启动。

## 当前可运行的内容

- **官网**：世界、载具、住宅与活动内容浏览；收藏、档案、JSON 导入/导出及响应式页面。
- **3D 场景**：程序生成的海滨城市、分区加载、第三人称步行、驾驶及上下车、基础碰撞、镜头与小地图。
- **玩法逻辑**：目标与任务进度、资金与维修、浏览器本地存档、出生点与异常存档校验。
- **环境**：时间、天气预设与光照控制。
- **探索台**：城市地图、路线选择、环境和载具参数调整。

这些功能属于**原型级实现**，不是商业级开放世界、完整剧情或高精度 3D 城市。

## 当前未完成的交付条件

- 可核验授权来源的高质量角色、车辆和城市 3D 资产，以及角色动画。
- 完整且一致的核心玩法、任务、交互与经济系统。
- 真实浏览器端到端验收，375 / 768 / 1024 / 1440px 响应式截图验证。
- 目标设备帧率、加载、交互可访问性及稳定性验收。
- 资产来源和许可证清单；正式发布前需要解决外部依赖及资源合规问题。

`main` 是**开发集成分支**，不是正式发布分支。详细门槛见 [开发规范](docs/DEVELOPMENT_POLICY.md) 和 [交付门槛](INTERNAL_RELEASE_GATE.json)。在所有门槛完成之前，不创建宣称完成的 Release。

## 检查与测试

```bash
npm run check
npm test
node scripts/release-gate.mjs
```

`npm test` 是代码级回归检查，**不代替实际浏览器体验或视觉验收**。`release-gate.mjs` 在必需证据缺失时会明确返回失败，这属于预期行为。

## 工程目录

| 目录 / 文件 | 用途 |
| --- | --- |
| `public/` | 官网、3D 游戏、探索台、交互和样式 |
| `public/assets/` | 本地生成的 SVG 概念插画，不是实际游戏截图或 3D 美术资源 |
| `src/` | 服务端内容模型 |
| `server.mjs` | 原生 Node.js 静态服务及基础 API |
| `tests/` | Node.js 自动化测试 |
| `.github/workflows/` | CI 与手动发布门槛检查 |
| `MASTER_DEVELOPMENT_BRIEF.md` | 产品目标和最终验收要求 |

## 公开仓库与授权

此仓库公开供阅读和跟踪开发进度。**公开可见不等于自动授予开源许可证**；在明确选择并添加 `LICENSE` 前，除适用法律允许的情况外，第三方不得假定拥有复制、修改或再分发本项目代码及美术资产的许可。

---

**Project status: IN DEVELOPMENT · Release gate: BLOCKED**
