# BOOTSTRAP.md — Agents x Company 一句话自举部署协议

> **适用对象**：当人类用户把本仓库链接（或路径）发给任意宿主 Agent（OpenClaw / DSH / Pi / OpenCode / Hermes / Claude Code）并说出 **「部署这个仓库的方案并进行测试」** 时，宿主 Agent 必须自动完成仓库拉取（若尚未在本地）、环境探测、模型绑定、服务启动与端到端冒烟测试。

## Step 1：宿主环境与可用模型池自动探测（Harness Probe）
1. 检测当前运行宿主类型（检查环境变量与本地端口/CLI）：
   - **OpenClaw**：检查 `OPENCLAW_STATE_DIR` 或本机 Gateway RPC；
   - **DeepSeek Harness (DSH)**：检查 `DSH_HOME` 或 DSH Session 接口；
   - **OpenCode**：检查 `opencode` CLI 与本地会话存储；
   - **Pi (`pi-coding-agent`) / Hermes**：检查对应 CLI 与本地模型配置。
2. 扫描宿主已配置的可用模型与账号池（**严禁要求用户重新手填已有的 API Key**），自动生成本地绑定文件 `.agentsxco/harness-binding.json`，将 `company.example.json` 中的角色模型槽位（如 `tier:chief-secretary`、`tier:critic`、`tier:designer`、`tier:engineer`）映射至宿主最优可用模型。

## Step 2：初始化虚拟公司组织架构与单事务 SQLite 微内核
1. 初始化本地状态库 `.agentsxco/company-state.sqlite`（含 `rooms`、`seats`、`events`、`tasks_mandates`、`effects` 五张核心表）；
2. 导入默认虚拟公司组织架构 `company.example.json`（含「总秘书」、项目群「设计原型 / Issue分诊台」及专职员工「交互设计 / 视觉设计 / 原型工程 / 设计质疑 / 意见收集员」）。

## Step 3：执行三项自动化端到端冒烟自测（Self-Test Gate）
1. **Gate A（分步闸门扣留测试）**：模拟向「总秘书」下达两阶段任务，验证秘书仅将 Step 1 拆解派发至项目群，Step 2 状态为 `held_by_secretary`；
2. **Gate B（群内专职质疑与权限矩阵测试）**：验证 `意见收集员` 写文件请求被拦截（`read_only_observer`），验证 `设计质疑` 对同僚产物签发 `CONDITIONAL` 并触发版本升级；
3. **Gate C（KV Cache 尾部信封与退单接力测试）**：验证连续两轮唤醒同一员工时 System Prompt 字节序 100% 恒定，且调用 `handback` 后施工证（`Mandate`）原子过户给替补员工。

## Step 4：向用户汇报部署结果与 Studio 入口
全部自测通过后，向用户输出本地 **Agents x Company Studio** 工作台访问地址与三项自测通过回执。
