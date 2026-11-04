# GitHub 参考与第二阶段变更

## 已参考的项目（未复制其源码或素材）
- StarKnightt/ocean-drive：海滨都市、步行驾驶结合。
- shubhransh-gupta/courier-city：多种载具与开放世界交互。
- AndyGura/gg-web-engine：角色控制、物理车辆、场景序列化。
- wangjialiang678/3d-game-kit：Three.js + Rapier + ECS。
- manuelhintermayr/three-js-car-example：车辆悬挂、固定时间步与车灯。

## 本轮实际落地
- public/simulation.mjs：渲染无关的车辆步进、五站任务、经济奖励、碰撞损伤、进度校验。
- public/game.mjs：接入路线光柱、奖励、撞车损伤、维修、持久化。
- public/play.html：增加余额、车辆状态和维修按钮。
- tests/simulation.test.mjs：5 项可重复测试。

## 未完成且不能冒称已完成
- 真实 Rapier 物理、车轮悬挂、角色步行与上下车、行人 AI、城市流式加载、独立 3D 美术资产、完整音频、多人联网、浏览器逐屏视觉验收。
- 当前代码没有引入上述 GitHub 仓库的源码，避免未核查许可证与依赖版本就直接拼接。

## 运行
Node.js >=20，npm start；浏览器 http://localhost:8080/play.html；npm test。Three.js 仍需联网加载。
