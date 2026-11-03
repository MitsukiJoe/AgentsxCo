# Agents x Company — 跨宿主多角色团队协作通用架构蓝图 v1.1

> **交付边界**：本仓库当前交付架构规范、示例配置与交互 Demo；下述宿主适配、记忆驱动、调度与 SQLite 执行链属于待实现并验证的协议，不代表已上线后端。静态页面测试不能替代真实宿主端到端验收。

> **项目全称**：Agents x Company (`agentsxco.com`)
> **支持宿主（Universal Harnesses）**：OpenClaw、DeepSeek Harness (DSH)、Pi (`pi-coding-agent`)、OpenCode、Hermes、Claude Code 等任意支持多供应商/多会话的 Agent 运行时。
> **一句话自举部署口令**：用户只需对宿主 Agent 说一句 **「部署这个仓库的方案并进行测试」**，即可自动识别宿主环境、绑定已有模型池、拉起本地微内核与独立 Web 工作台并完成端到端自测。

---

## 1. 核心产品理念：对上极简 1v1 秘书制，对下全透明部门项目群

1. **总秘书（Chief Secretary）+ 项目组长（Group Leads）双层交界（管理与执行兼备）**：
   - 人类老板日常只需与顶部的 **「总秘书（助手）」** 1v1 对话下达粗粒度目标，或直接对接某几个独立项目组的组长。
   - **主角色既能统筹管理，也能直接执行（委派是优化手段而非死板教条）**：总秘书与项目组长默认具备受控的直接执行权（`direct_scoped_write`）与异步后台单兵派生权（`spawn_async_subagent`）。遇到改个错别字、微调几行配置等顺手能改完的小事，总秘书当场直接改完交差；遇到多模块耦合或高风险重构，才拉起项目群流水线。
   - **分步闸门扣留 + 接口契约透传（Stage-Gated Holding with Read-Only Interface Contract）**：当老板一次交代两步或多步计划（例如“先做第一份 PulseChat 风格双端界面设计，做完后再做第二份 2D 游戏设计”），总秘书会将任务拆为两份——向项目群下发 **`Step 1 实施细则` + `全局只读接口契约（Read-Only Interface Contract，如要求预留 #game-overlay-root 挂载点但严禁提前编写 Step 2 代码）`**，同时在秘书层严密扣留第二阶段实现任务；既彻底杜绝群内员工分心串味，又从根源上消除跨阶段返工。
2. **全透明玻璃房与「明面 `@` 协议 + 底层游标捎带唤醒」**：
   - 左侧边栏清晰陈列所有 **「项目群（如：设计原型、自媒体热点捕手、Issue分诊台、部署审查、产品调研、Godot项目）」** 与按部门归类的 **「独立员工」**。
   - 老板随时可点进任意项目群回审群内讨论，或点开任意员工进行 1v1 私聊抽查与单独指派。
   - **明面 `@` 玻璃房（Explicit `@` Glass-Box）**：UI 与群聊界面坚持显式 `@目标角色`，所有跨角色对齐、指路（`看 §10 / §11`）和打回（`① ② ③ ④`）一目了然，拒绝不可读的后台黑盒事件流。
   - **底层按需捎带唤醒（Lazy Cursor Piggybacking）**：同群未被 `@` 的成员在收到群消息时，内核仅记录待消费事件上界，保留已读游标（`lastReadEventSeq`）不变，**零 Token 消耗、绝不立即触发推理**；直到该成员被显式 `@` 点名或轮到其施工证步骤时，才将积压的群内增量上下文一次性打包进 `Turn Delta Envelope` 捎带注入。
3. **双层质检闭环（群内专职挑刺员 + 总秘书收口终审）**：
   - 每个核心项目群配备专职 **「质疑/质检员（如：设计质疑 / QA Critic）」**，专门用放大镜挑出交互、视觉或代码的 P1/P2 漏洞（如对比度不足、移动端路径缺失、状态图标冲突），判为 `CONDITIONAL` 并驱动同僚在群内自发迭代升级（`v1.0 -> v1.1`）；
   - 群内达成一致并实测通过后，在群里 `@助手` 并私聊发送「需要收口」，由总秘书完成最终把关后再呈交老板验收。

---

## 2. 八大核心进阶机制（v1.1 架构进化全景）

### 2.1 项目级三档制度门禁（Project Governance Mode）+ 唤起者三态路由（Invoker Tri-Routing）
任务进入系统时的**第一道门不是复杂度评估，而是「项目制度约束（Project Governance Mode）」**：
1. **强制全流程档（`strict_pipeline`）**：适用于正规公司仓库、多人合规工程或用户显式锁死的项目。**零 Token 跳过自由复杂度评估**，哪怕只是改一行配置或修一个文案，也强制按预设工作流走完「派单 ➔ 专职质疑挑刺 ➔ 总秘书终审收口」，留存 100% 完整的审计轨迹。
2. **个人极速档（`solo_fast`）**：适用于个人实验脚本或日常小工具。**零 Token 跳过评估**，直接由被唤起角色读写并跑完基础测试后秒级交付。
3. **智能动态评估档（`adaptive`，默认）**：未锁死固定制度时，无需额外拆出独立的 `Evaluator` 模块浪费一次推理开销，直接由**当前被人类唤起的那个人**（找总秘书就是总秘书顺手评估，找项目组长就是组长顺手评估）在同一次思考里决定走哪条路：
   - **① 亲自秒做（`direct_exec`）**：任务简单、低风险且在明确授权范围内，由总秘书/组长亲自改完闭环；
   - **② 后台单兵（`async_subagent`）**：耗时较长或日志量大、但边界单一的任务，派生隔离后台子代理异步执行并返回句柄，前台对话零阻塞；
   - **③ 拉群走工作流（`room_pipeline`）**：跨专业耦合或高风险架构变更，签发施工证（`Mandate`）推入项目群走双层质检闭环。

### 2.2 角色配置解耦：人格（Persona）× 模型（Model）× 规则继承开关 × 任务级模型指定
每个员工拥有一份独立的标准角色档案（`RoleProfile`）：
- **人格与职责（Persona & Soul）**：独立于模型之外的岗位性格、专业标准与沟通规范；
- **默认模型与专属 Fallback 链**：例如为 `视觉设计` 配置默认模型 `anthropic/claude-opus-5-5` 及专属 fallback `deepseek/deepseek-v4-flash`；
- **全局规则继承开关（`inheritGlobalAgentsMd: boolean`）**：可单独开关该角色是否加载宿主的全局 `AGENTS.md`，同时挂载角色专属的 `ROLE_RULES.md`；
- **上级动态指定模型（`taskModelOverride`）与 KV 缓存保护**：默认使用角色自身的默认模型；当总秘书或组长派发攻坚任务时，可在施工证（`Mandate`）中显式指定本次任务使用的模型，并在单次任务期内锁定同一模型以提高提示词缓存复用机会（命中率需按宿主实测）（严禁每轮按价格动态切模型打碎缓存）。

### 2.3 快慢双路哨兵底座（Fast/Slow Path Sentries）与多行业场景预设
为了打破“只能用来写代码查 Bug”的局限，情报哨兵采用 **「Fast Path（零 Token 规则/正则/时间窗粗筛）+ Slow Path（高性价比模型深度提炼）+ 两级记忆去重漏斗」** 通用底座，并原生内置 3 套跨行业预设：
1. **📱 自媒体热点捕手（`media-trend-catcher`）**：监听小红书、X/Twitter、YouTube、抖音/B站热榜与竞品爆款 ➔ Fast Path 零 Token 过滤带货软文与 >24h 旧闻 ➔ Slow Path 提炼核心冲突视角、受众情绪痛点与前 3 秒黄金钩子（Hook）➔ 私聊报送总秘书/主编生成 **1/2/3 可点击选题大纲方案**；
2. **🛠️ 研发反馈哨（`dev-issue-triage`）**：监听 GitHub Issues、PR 讨论与用户群吐槽 ➔ 借助收集员层与总秘书层双级记忆自动合并同类反馈（10 条重复报错自动归并为“受影响人数 +9”，减少跨渠道重复立项；正式立项仍需事务内检查任务指纹）➔ 报送总秘书生成 1/2/3 修复方案；
3. **📈 竞品与情报盯盘哨（`competitor-radar`）**：监听竞品 Changelog、定价页异动与社媒舆情 ➔ 0 Token 排除常规排版微调 ➔ 捕捉核心功能发布与价格变动 ➔ 报送总秘书生成应对策略。

### 2.4 可插拔四驱动记忆底座（Pluggable Memory Adapter）
记忆系统通过极简三原语接口（`recall(query, scope)` / `memorize(entry, scope)` / `dedup_check(fingerprint)`）与核心编排层解耦，支持在 `company.json` 中一行配置切换 4 类驱动：
1. **OpenClaw 生态首选（`memory-lancedb-pro`）**：原生对接 [`CortexReach/memory-lancedb-pro`](https://github.com/CortexReach/memory-lancedb-pro)（混合向量 + 全文检索）；
2. **DSH / AgentScope 生态（`reme` / `memsearch`）**：原生对接 [`agentscope-ai/ReMe`](https://github.com/agentscope-ai/ReMe)（结构化经验记忆）与 Zilliz [`memsearch`](https://github.com/zilliztech/memsearch)（Markdown-first 语义记忆）；
3. **零依赖内置默认档（`sqlite-fts5`）**：基于本地 SQLite FTS5 全文检索，开箱即用免装额外服务；
4. **新一代自定义记忆插槽（`custom-next`）**：预留标准扩展接口，无缝接入自研下一代分层记忆引擎。

### 2.5 分级派活矩阵（Hierarchical Dispatch Matrix）
内核按角色层级强制校验 `dispatchScope`：
- **总秘书（Chief Secretary）**：`scope = "company_all"` —— 可向全公司所有项目组长与任意员工派活、签发施工证，亦可在授权范围内直接执行（`direct_scoped_write`）或派生异步单兵（`spawn_async_subagent`）；
- **项目组长（Group Lead）**：`scope = "group_internal"` —— 仅可向本项目群内的成员拆包派活、组内直改或收口；
- **专职质疑/质检（Critic / QA）**：`scope = "group_review"` —— 对本群创作成员定点打回迭代或签发通过结论，只读检索并运行真实测试探针；
- **组内平级专员（交互/视觉/前后端）**：`scope = "peer_assist"` —— 仅限同群平级搭档之间互 `@` 互助，持施工证（`Mandate`）期间解锁对应写权限；
- **纯只读哨兵（Collector / Scout）**：`scope = "report_to_secretary_only"` —— 仅允许私聊总秘书上报情报，严禁在研发群越界派活。

### 2.6 随单伴生巡检（Ephemeral Task Watchdog）与常驻 Cron 同源合一
定时巡检（Watchdog）与定时任务（Cron）共享同一套轻量调度内核，仅按生命周期区分：
- **常驻 Cron（`resident_cron`）**：如自媒体热点捕手每 2 小时扫描一次热榜；
- **随单伴生巡检（`ephemeral_task_watchdog`）**：总秘书亲自秒改小事时**绝不启动 Watchdog**；仅当任务推入项目群流水线或后台单兵时，才随施工证动态挂载一个绑定该 `taskId` 的伴生定时器。前序巡检采用**零 Token 纯代码规则**（检查 `updatedAt` 是否停滞、同一报错签名是否连撞 3 次、同群互 `@` 是否超上限），仅在命中异常阈值时才唤醒总秘书介入 `steer` 或 `handback` 换人，任务收口即自动销毁。

### 2.7 原生 Git 快照游标 + SQLite 单行 Checkpoint（替代笨重 Effects Queue）
摒弃云端重型分布式副作用队列（Effects Queue），采用最契合代码与内容协作的轻量容灾机制：
- 在签发或过户施工证（`Mandate`）时，自动记录当前工作区的 **`git rev-parse HEAD`** 与未提交改动的 **`git stash create` 游标**；
- 在 SQLite 的 `tasks_mandates` 表中维护单行 `checkpoint_step` 与 `git_snapshot_ref`；
- 一旦某个 Agent 异常中断，替补 Agent 接过施工证时直接比对 Git 快照与 `checkpoint_step` 即可无缝续写或一键回滚。

### 2.8 「虚拟公司」脱敏导出/导入契约（Sanitized Export/Import Contract）与 Studio UI
- **脱敏导出契约（`exportContract`）**：一键导出 `company.json` 时强制执行脱敏流水线，自动剥离所有私密 API Key、宿主本机绝对路径与运行时临时会话句柄（标记 `sanitized: true`）；
- **跨宿主槽位映射导入（`importContract`）**：任何使用 OpenClaw / DSH / Pi / OpenCode / Hermes 的用户拿到 `company.json` 后，其 Agent 会自动扫描本地可用模型池并映射 `tier:*` 槽位，若本地未安装外部向量库则自动平滑回退至内置 `sqlite-fts5` 驱动。
