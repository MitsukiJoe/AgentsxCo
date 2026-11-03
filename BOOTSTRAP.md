# BOOTSTRAP.md — Agents x Company 一句话自举部署协议 v1.1

> **交付边界**：本仓库当前交付架构规范、示例配置与交互 Demo；下述宿主适配、记忆驱动、调度与 SQLite 执行链属于待实现并验证的协议，不代表已上线后端。静态页面测试不能替代真实宿主端到端验收。

> **适用对象**：当人类用户把本仓库链接（或路径）发给任意宿主 Agent（OpenClaw / DSH / Pi / OpenCode / Hermes / Claude Code）并说出 **「部署这个仓库的方案并进行测试」** 时，宿主 Agent 必须自动完成仓库拉取（若尚未在本地）、环境探测、模型与记忆驱动绑定、SQLite 微内核初始化与端到端冒烟测试。

## Step 1：宿主环境、可用模型池与可插拔记忆驱动自动探测（Harness & Memory Probe）
1. 检测当前运行宿主类型（检查环境变量与本地端口/CLI）：
   - **OpenClaw**：检查 `OPENCLAW_STATE_DIR` 或本机 Gateway RPC；
   - **DeepSeek Harness (DSH)**：检查 `DSH_HOME` 或 DSH Session 接口；
   - **OpenCode**：检查 `opencode` CLI 与本地会话存储；
   - **Pi (`pi-coding-agent`) / Hermes**：检查对应 CLI 与本地模型配置。
2. 扫描宿主已配置的可用模型与账号池（**严禁要求用户重新手填已有的 API Key**），自动生成本地绑定文件 `.agentsxco/harness-binding.json`，将 `company.example.json` 中的角色模型槽位（如 `tier:chief-secretary`、`tier:critic`、`tier:designer`、`tier:engineer`、`tier:fast-scout`）映射至宿主最优可用模型。
3. 探测本地记忆插件可用性（`memoryAdapter`）：优先绑定宿主的 `memory-lancedb-pro`（OpenClaw）或 `reme` / `memsearch`（DSH）；若均未安装，则自动回退至零依赖内置的 `sqlite-fts5` 驱动。

## Step 2：初始化虚拟公司组织架构与单文件 SQLite 微内核
1. 初始化本地状态库 `.agentsxco/company-state.sqlite`，创建核心表结构（`rooms`、`seats`、`events`、`tasks_mandates` [含 `governance_mode`、`interface_contract_json`、`checkpoint_step`、`git_snapshot_ref`]、`memory_fts`）；
2. 导入默认虚拟公司组织架构 `company.example.json`（v1.1.0，含三档项目制度门禁、具备直接执行权的总秘书、3 套快慢双路行业哨兵预设「研发反馈哨 / 自媒体热点捕手 / 竞品与舆情盯盘哨」及各项目群专职角色）。

## Step 3：执行四项自动化端到端冒烟自测（Self-Test Gate）
1. **Gate A（项目三档门禁 + 唤起者三态路由测试）**：
   - 验证 `strict_pipeline` 模式下跳过复杂度评估、强制签发施工证走全流程；
   - 验证 `adaptive` 模式下总秘书对单文件小修改直接执行 `direct_exec` 秒改闭环，对多阶段任务下发 `Step 1 实施细则 + 全局只读接口契约（Read-Only Interface Contract）` 并严密扣留 Step 2（`held_by_secretary`）。
2. **Gate B（快慢双路行业哨兵 + 双层记忆去重测试）**：
   - 验证 `自媒体热点捕手` 与 `研发反馈哨` 的 Fast Path 零 Token 过滤规则生效、`read_only_observer` 越权写文件被拦截，且重复反馈经记忆底座 `dedup_check` 自动合并。
3. **Gate C（明面 `@` 玻璃房 + 游标捎带唤醒 + Git 快照接力测试）**：
   - 验证同群未被 `@` 成员仅记录待消费事件，不推进 `lastReadEventSeq` 已读游标（0 Token 消耗），被显式 `@` 时通过 `Turn Delta Envelope` 注入且 System Prompt 字节序 100% 恒定；
   - 验证调用 `handback` 时施工证连同 `git_snapshot_ref` 与 `checkpoint_step` 原子过户给替补员工。
4. **Gate D（Studio 工作台 E2E 校验）**：
   - 运行 `node scripts/e2e-studio.mjs`，确认官网与 Studio 工作台全量断言通过。

## Step 4：向用户汇报部署结果与 Studio 入口
全部自测通过后，向用户输出本地 **Agents x Company Studio** 工作台访问地址与四项自测通过回执。
