#!/usr/bin/env node
// End-to-end smoke test for docs/studio/index.html and docs/index.html.
// Usage: PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/e2e-studio.mjs [--shots]
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const shots = process.argv.includes("--shots");
const shotDir = path.join(root, ".local", "shots");
if (shots) fs.mkdirSync(shotDir, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const browser = await chromium.launch();
const errors = [];
const newPage = async (viewport, opts = {}) => {
  const page = await browser.newPage({ viewport, ...opts });
  page.on("pageerror", (e) => errors.push(`${page.url()} :: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${page.url()} :: console ${m.text()}`); });
  return page;
};

const studioUrl = pathToFileURL(path.join(root, "docs/studio/index.html")).href;
const page = await newPage({ width: 1520, height: 940 });
await page.addInitScript(() => localStorage.setItem("axc-theme-user", "dark"));
await page.goto(studioUrl);
await page.waitForSelector(".pinned");

// Sidebar
check("置顶总秘书席位含金色星标", await page.locator(".pinned .star").count() === 1 && (await page.textContent(".pinned")).includes("助手 · 总秘书"));
const groupRows = await page.locator('.sb-row[data-room^="group:"]').allTextContents();
const expectGroups = [["设计原型", "+3"], ["自媒体热点捕手", "+3"], ["Issue分诊台", "+4"], ["部署审查", "+4"], ["产品调研", "+4"], ["Godot项目", "+3"]];
check("六个项目群（含热点捕手）及堆叠头像计数", expectGroups.every(([n, c]) => groupRows.some((t) => t.includes(n) && t.includes(c))), groupRows.length + " rows");
check("项目群未读蓝点", await page.locator('.sb-row[data-room="group:design-prototype"] .unread').count() === 1);
const sbText = await page.textContent("#sbList");
check("部门与专职员工分组", ["原型设计师", "原型工程", "视觉设计", "设计质疑", "交互设计", "情报哨所", "意见收集员"].every((t) => sbText.includes(t)));

// Scene A
const a = await page.textContent("#streamInner");
check("场景 A：两步任务原话", a.includes("仿 PulseChat") && a.includes("2D 小游戏"));
check("场景 A：清理旧 3D 选项卡已选 A", await page.locator('.opt.sel[data-act="choice"][data-k="A"]').count() === 1 && a.includes("已选 A 全删"));
check("场景 A：分步闸门扣留状态条", a.includes("Stage-Gated Holding") && a.includes("秘书扣留中"));
check("场景 A：收集员 → 秘书二审卡", a.includes("意见收集员 → 秘书二审过滤") && a.includes("源意见出处") && a.includes("秘书完善建议") && await page.locator('.opt[data-act="report"]').count() === 3);
await page.click('[data-act="held"]');
check("场景 A：查看扣留原文", (await page.textContent("#streamInner")).includes("组员可见性 0 / 5"));
const aGate = await page.textContent("#streamInner");
check("场景 A：闸门透传只读接口契约", aGate.includes("Read-Only Interface Contract") && aGate.includes("#game-overlay-root") && aGate.includes("严禁提前编写 Step 2 代码"));
check("场景 A：总秘书直接执行卡", aGate.includes("© 2026") && aGate.includes("direct_scoped_write") && aGate.includes("spawn_async_subagent") && aGate.includes("bg-7f3a"));
check("场景 A：哨兵情报卡 3 套预设", (await page.locator(".rd-tab").count()) === 3 && aGate.includes("自媒体热点捕手") && aGate.includes("report_to_secretary_only"));
await page.click('.rd-tab[data-i="1"]');
const aR1 = await page.textContent("#streamInner");
await page.click('.rd-tab[data-i="0"]');
check("场景 A：切换哨兵预设", aR1.includes("研发反馈哨") && (await page.getAttribute('.rd-tab[data-i="0"]', "aria-pressed")) === "true");
if (shots) await page.screenshot({ path: path.join(shotDir, "studio-a-dark.png") });
await page.click('.opt[data-act="topic"][data-k="1"]');
const aT = await page.textContent("#streamInner");
check("场景 A：点选选题派单进热点捕手群", aT.includes("派进「自媒体热点捕手」群") && aT.includes("solo_fast") && (await page.locator('.sb-row[data-room="group:viral-radar"] .unread').count()) === 1);
await page.click('.opt[data-act="report"][data-k="1"]');
await page.waitForFunction(() => document.querySelector("#streamInner").textContent.includes("M13"), null, { timeout: 4000 });
check("场景 A：点选方案 1 后秘书转化为任务", true);
await page.click('[data-act="accept"]');
const a2 = await page.textContent("#streamInner");
check("场景 A：验收后 Step 2 解锁派发", a2.includes("已派发 →「Godot项目」群") && a2.includes("MD-0418"));

// Composer
await page.fill("#input", "现在进度怎么样？");
await page.keyboard.press("Enter");
await page.waitForFunction(() => document.querySelector("#streamInner").textContent.includes("当前进度"), null, { timeout: 5000 });
check("输入框发送 + 状态勾 + 秘书回复", await page.locator(".row.me .tick.read").count() > 0);

// Scene B
await page.click('.sb-row[data-room="group:design-prototype"]');
await page.waitForTimeout(300);
const b = await page.textContent("#streamInner");
check("场景 B：任务卡 @四位组员", b.includes("《第一份：2D 产品界面设计》") && ["@交互设计", "@视觉设计", "@原型工程", "@设计质疑"].every((t) => b.includes(t)));
check("场景 B：交付 IA_STATE_MAP.md", b.includes("IA_STATE_MAP.md"));
check("场景 B：设计质疑 CONDITIONAL ①–④", b.includes("CONDITIONAL") && ["①", "②", "③", "④"].every((n) => b.includes(n)) && b.includes("3.63:1") && b.includes("状态图标先别定稿"));
check("场景 B：v1.1 修复 + @助手 需要收口", b.includes("v1.0 → v1.1") && b.includes("@助手 需要收口"));
check("场景 B：任务卡未泄露 Step 2", !b.includes("2D 游戏设计"));
const pillText = await page.textContent("#newPill");
check("场景 B：悬浮新消息胶囊", (await page.locator("#newPill.show").count()) === 1 && pillText.includes("11 条新消息") && pillText.includes("×"));
if (shots) await page.screenshot({ path: path.join(shotDir, "studio-b-dark.png") });
await page.click('[data-act="pill-jump"]');
await page.waitForTimeout(500);
check("场景 B：点击胶囊跳转并收起", (await page.locator("#newPill.show").count()) === 0);
await page.click('.file[data-file="IA_STATE_MAP.md"]');
check("文件卡片预览弹窗", (await page.textContent("#modal")).includes("§10 消息状态机"));
await page.keyboard.press("Escape");
check("场景 B：任务卡随 Step 1 透传接口契约", b.includes("#game-overlay-root") && b.includes("随 Step 1 透传"));
check("场景 B：群制度门禁卡 + 事件序号", (await page.locator(".room-rules").count()) === 1 && (await page.locator(".seq-tag").count()) >= 9 && (await page.textContent("#mHead")).includes("adaptive"));
await page.click('.room-rules [data-act="gov"][data-mode="strict_pipeline"]');
const bStrict = (await page.textContent("#mHead")).includes("strict_pipeline") && (await page.textContent(".room-rules")).includes("总秘书终审");
await page.click('.room-rules [data-act="gov"][data-mode="adaptive"]');
check("场景 B：三档门禁切换", bStrict && (await page.textContent("#mHead")).includes("adaptive"));
const pigBefore = await page.textContent(".room-rules");
await page.click('[data-act="pig-at"][data-seat="visual-designer"]');
const pigMid = await page.textContent(".room-rules");
await page.waitForTimeout(1100);
const pigAfter = await page.textContent(".room-rules");
check("场景 B：未被 @ 不推进游标", pigBefore.includes("lastReadEventSeq #49") && pigBefore.includes("待消费 +3"));
check("场景 B：点名后消费 Turn Delta Envelope 再提交游标", pigMid.includes("游标未提交") && pigMid.includes("lastReadEventSeq #49") && pigAfter.includes("#49 → #52") && pigAfter.includes("lastReadEventSeq #52"));
if (shots) await page.locator(".room-rules").screenshot({ path: path.join(shotDir, "studio-b-rules-dark.png") });

// Viral radar room
await page.click('.sb-row[data-room="group:viral-radar"]');
await page.waitForTimeout(200);
const vr = await page.textContent("#streamInner");
check("热点捕手群：solo_fast + Fast Path 粗筛流", vr.includes("solo_fast") && (await page.locator(".rd-feed .fi.drop").count()) > 0 && (await page.locator(".rd-feed .fi.keep").count()) > 0 && vr.includes("派单"));
await page.click('.rd-tab[data-i="2"]');
check("热点捕手群：切到竞品盯盘哨", (await page.textContent("#streamInner")).includes("竞品盯盘哨"));
await page.click('.rd-tab[data-i="0"]');
if (shots) await page.screenshot({ path: path.join(shotDir, "studio-radar-dark.png") });

// Chief secretary inspector
await page.click('.pinned[data-room="dm:chief-secretary"]');
await page.waitForTimeout(200);
const insSec = await page.textContent("#inspector");
check("抽屉：总秘书直接执行权", insSec.includes("Direct Execution") && insSec.includes("direct_scoped_write") && insSec.includes("spawn_async_subagent"));
await page.selectOption('select[data-act="mem-sel"]', "reme");
check("抽屉：记忆底座切换 + 脱敏导出", (await page.inputValue('select[data-act="mem-sel"]')) === "reme" && (await page.textContent("#memSec")).includes("sanitized: true"));

// Inspector on an employee
await page.click('.sb-row[data-room="dm:design-critic"]');
await page.waitForTimeout(200);
const ins = await page.textContent("#inspector");
check("员工 1v1 私聊 + 抽屉", (await page.textContent("#mHead")).includes("设计质疑") && ins.includes("角色配置与透视"));
check("抽屉：人格 × 模型解耦面板", ins.includes("Persona") && ins.includes("解耦") && ins.includes("Model") && ins.includes("施工证"));
const inheritBefore = await page.getAttribute('[data-act="t-inherit"]', "aria-checked");
await page.click('[data-act="t-inherit"]');
check("抽屉：继承全局 AGENTS.md 开关", (await page.getAttribute('[data-act="t-inherit"]', "aria-checked")) !== inheritBefore);
const ovBefore = await page.getAttribute('[data-act="t-override"]', "aria-checked");
await page.click('[data-act="t-override"]');
check("抽屉：任务级模型覆盖开关", (await page.getAttribute('[data-act="t-override"]', "aria-checked")) !== ovBefore);
await page.selectOption('select[data-act="model"]', "openai/gpt-6.1-sol");
check("抽屉：默认模型选择器", (await page.inputValue('select[data-act="model"]')) === "openai/gpt-6.1-sol");
await page.selectOption('select[data-act="fb-add"]', "xai/grok-4.7");
check("抽屉：Fallback 链追加", (await page.textContent(".fb-list")).includes("xai/grok-4.7"));
await page.click('[data-act="scope"][data-scope="peer_assist"]');
check("抽屉：dispatchScope 分段切换", (await page.getAttribute('[data-act="scope"][data-scope="peer_assist"]', "aria-checked")) === "true");
const kv = await page.textContent("#kvVal");
check("抽屉：KV Cache 仪表", /\d+\.\d%/.test(kv), kv);
await page.click('.sb-row[data-room="dm:feedback-collector"]');
check("只读收集员权限锁定", (await page.locator('[data-act="scope"][disabled]').count()) === 3);

// Scene C
await page.click('.sb-row[data-room="org"]');
await page.waitForTimeout(200);
const c = await page.textContent("#streamInner");
check("场景 C：组织架构 + 权限矩阵", c.includes("汇报与派活链路") && c.includes("分级派活权限矩阵") && c.includes("company_all"));
check("场景 C：五大宿主绑定", ["OpenClaw", "DSH", "Pi", "OpenCode", "Hermes"].every((h) => c.includes(h)));
check("场景 C：项目级三档门禁", (await page.locator("#govBlk .gov-item").count()) === 6 && c.includes("strict_pipeline") && c.includes("solo_fast"));
check("场景 C：记忆底座 5 驱动（抽屉选择同步）", (await page.locator("#memBlk .prov").count()) === 5 && (await page.textContent("#memBlk .prov.on")).includes("ReMe"));
await page.click('#memBlk .prov[data-id="memsearch"]');
check("场景 C：切换记忆驱动", (await page.textContent("#memBlk .prov.on")).includes("memsearch") && (await page.inputValue('select[data-act="mem-sel"]')) === "memsearch");
check("场景 C：脱敏导出契约", (await page.textContent("#sanBlk")).includes("sanitized: true") && (await page.textContent("#sanBlk")).includes("${WORKSPACE}"));
check("场景 C：Demo 演示标注", c.includes("架构 Demo 演示"));
await page.hover('#orgTree [data-seat="feedback-collector"]');
check("场景 C：悬停透视派活范围", (await page.textContent("#probeLine")).includes("可触达 1 个席位"));
if (shots) { await page.mouse.move(5, 5); await page.screenshot({ path: path.join(shotDir, "studio-c-dark.png") }); }
await page.click('[data-act="json-preview"]');
const preview = await page.textContent("#modal pre");
const parsed = JSON.parse(preview);
check("场景 C：company.json 预览可解析", parsed.chiefSecretary.dispatchScope === "company_all" && parsed.employees.length >= 15);
check("场景 C：company.json v1.1 字段", parsed.sanitized === true && parsed.memoryAdapter.activeProvider === "memsearch" && parsed.chiefSecretary.permissions.includes("direct_scoped_write") && parsed.governance.projectOverrides["group:viral-radar"] === "solo_fast" && parsed.stageGatePolicy.readOnlyContract.mountPoint === "#game-overlay-root" && parsed.sentinelPresets.length === 3);
await page.click('#modal [data-act="modal-close"]');
await page.click('[data-act="probe"]');
await page.waitForTimeout(2600);
check("场景 C：重新探测后全部绑定", (await page.locator(".host .h-st.bound").count()) === 5);
await page.click('[data-act="json-import"]');
await page.click('[data-act="import-sample"]');
await page.click('[data-act="import-run"]');
await page.waitForTimeout(200);
check("场景 C：导入 company.json 合并席位", (await page.textContent("#sbList")).includes("文案策划") && (await page.textContent("#streamInner")).includes("Imported Studio"));
const [dl] = await Promise.all([page.waitForEvent("download"), page.click('[data-act="json-export"]')]);
check("场景 C：导出 company.json", dl.suggestedFilename() === "company.json");

// Theme
await page.click('#themeBtn');
check("深浅主题切换", (await page.getAttribute("html", "data-theme")) === "light");
if (shots) {
  await page.click('.sb-row[data-room="group:design-prototype"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shotDir, "studio-b-light.png") });
  await page.locator(".room-rules").screenshot({ path: path.join(shotDir, "studio-b-rules-light.png") });
  await page.click('.pinned[data-room="dm:chief-secretary"]');
  await page.waitForTimeout(300);
  await page.locator(".rd-tabs").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shotDir, "studio-a-light.png") });
  await page.click('.sb-row[data-room="group:viral-radar"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shotDir, "studio-radar-light.png") });
  await page.click('.sb-row[data-room="org"]');
  await page.waitForTimeout(300);
  await page.locator("#govBlk").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shotDir, "studio-c-light.png") });
}

// Mobile
const mobile = await newPage({ width: 390, height: 844 });
await mobile.goto(studioUrl + "#b");
await mobile.waitForSelector(".m-head");
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("手机端 390px 无横向溢出", overflow <= 0, "overflow=" + overflow);
await mobile.click('.menu-btn');
await mobile.waitForTimeout(450);
check("手机端侧栏滑出", await mobile.evaluate(() => document.querySelector(".sidebar").getBoundingClientRect().left >= 0));

// Official site
const siteUrl = pathToFileURL(path.join(root, "docs/index.html")).href;
if (fs.existsSync(path.join(root, "docs/index.html"))) {
  const site = await newPage({ width: 1440, height: 900 });
  await site.addInitScript(() => localStorage.setItem("axc-site-theme-user", "dark"));
  await site.goto(siteUrl);
  await site.waitForTimeout(400);
  const s1 = await site.textContent("body");
  check("官网：Hero + 部署口令", s1.includes("部署这个仓库的方案并进行测试"));
  check("官网：五大宿主徽章", ["OpenClaw", "DSH", "Pi", "OpenCode", "Hermes"].every((h) => s1.includes(h)));
  check("官网：Studio Demo 链接", (await site.locator('a[href*="studio/"]').count()) > 0);
  await site.click('[data-act="lang"]');
  check("官网：中英切换", (await site.getAttribute("html", "lang")) === "en" && (await site.textContent("h1")).match(/[A-Za-z]/));
  await site.click('[data-act="theme"]');
  check("官网：深浅主题切换", (await site.getAttribute("html", "data-theme")) === "light");
  await site.click('[data-act="lang"]');
  await site.click('[data-act="theme"]');
  await site.click('[data-flow="intel"]');
  check("官网：交互式架构图切换链路", (await site.locator('#arch .on-path').count()) > 0);
  await site.click('#arch [data-node="collector"]');
  check("官网：架构节点详情", (await site.textContent("#archDetail")).includes("意见收集员"));
  await site.click('[data-act="replay"]');
  await site.waitForTimeout(5200);
  check("官网：终端演示播放完成", (await site.textContent("#term")).includes("Studio"));
  if (shots) await site.screenshot({ path: path.join(shotDir, "site-hero-dark.png") });

  await site.click('#snTabs [data-act="sn"][data-i="1"]');
  const snSwitched = (await site.getAttribute('#snTabs [data-act="sn"][data-i="1"]', "aria-pressed")) === "true";
  await site.click('#snTabs [data-act="sn"][data-i="0"]');
  await site.waitForTimeout(2400);
  check("官网：哨兵预设切换 + Fast/Slow 管线", snSwitched && (await site.textContent("#snPipe")).length > 40);
  await site.click('#snOut [data-act="sn-pick"][data-k="1"]');
  check("官网：选题点选派单", (await site.textContent("#snOut")).includes("已派单"));
  await site.click('#govCard [data-act="gov"][data-mode="strict_pipeline"]');
  const govStrict = (await site.textContent("#execCard")).includes("MD-0421");
  await site.click('#govCard [data-act="gov"][data-mode="adaptive"]');
  let sawAsync = false;
  for (const i of [0, 1, 2]) {
    const btn = site.locator(`#govCard [data-act="gov-ask"][data-i="${i}"]`);
    if (await btn.count()) { await btn.click(); if ((await site.textContent("#execCard")).includes("bg-7f3a")) sawAsync = true; }
  }
  check("官网：三档门禁与三态路由", govStrict && sawAsync);
  const pigB = await site.textContent("#pigCard");
  await site.click('#pigCard [data-act="pig-at"][data-m="eng"]');
  await site.waitForTimeout(1100);
  const pigA = await site.textContent("#pigCard");
  check("官网：捷带唤醒消费后提交游标", pigB.includes("#41") && pigA.includes("toSeq: 46") && (await site.locator("#pigCard .cur.woke").count()) === 1);
  check("官网：闸门契约 + 记忆底座 + 脱敏", (await site.textContent("#gateCard")).includes("#game-overlay-root") && (await site.locator('#memCard [data-act="mem"]').count()) === 5 && (await site.textContent("#sanCard")).includes("sanitized"));
  check("官网：Demo 演示标注", (await site.textContent("footer")).includes("架构 Demo 演示"));
  if (shots) {
    for (const id of ["sentry", "runtime"]) await site.locator("#" + id).screenshot({ path: path.join(shotDir, `site-${id}-dark.png`) });
  }
  await site.click('[data-act="lang"]');
  check("官网：新 section 英文文案", /Beyond code/.test(await site.textContent("#sentry h2")) && /[A-Za-z]/.test(await site.textContent("#pigCard h3")));
  await site.click('[data-act="theme"]');
  if (shots) {
    for (const id of ["sentry", "runtime"]) await site.locator("#" + id).screenshot({ path: path.join(shotDir, `site-${id}-light-en.png`) });
  }
  await site.click('[data-act="lang"]');
  await site.click('[data-act="theme"]');
  const siteM = await newPage({ width: 390, height: 844 });
  await siteM.goto(siteUrl);
  const ov2 = await siteM.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("官网：手机端无横向溢出", ov2 <= 0, "overflow=" + ov2);
  const docsStudio = path.join(root, "docs/studio/index.html");
  check("官网：docs/studio/index.html 单一入口完整有效", fs.existsSync(docsStudio) && fs.readFileSync(docsStudio, "utf8") === fs.readFileSync(path.join(root, "docs/studio/index.html"), "utf8"));
}

// System color-scheme follow (no manual pin, legacy keys polluted with "dark")
const themeTargets = [["Studio", studioUrl, "axc-theme-user", "axc-theme"]];
if (fs.existsSync(path.join(root, "docs/index.html"))) themeTargets.push(["官网", siteUrl, "axc-site-theme-user", "axc-site-theme"]);
for (const [label, url, userKey, legacyKey] of themeTargets) {
  const tp = await newPage({ width: 1280, height: 800 }, { colorScheme: "light" });
  await tp.addInitScript((k) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, "dark"); sessionStorage.setItem("seeded", "1"); } }, legacyKey);
  await tp.goto(url);
  await tp.waitForTimeout(200);
  const first = await tp.evaluate(([u, l]) => ({ theme: document.documentElement.getAttribute("data-theme"), user: localStorage.getItem(u), legacy: localStorage.getItem(l) }), [userKey, legacyKey]);
  check(`${label}：系统浅色首开跟随 + 清理旧缓存 + 启动不写入`, first.theme === "light" && first.user === null && first.legacy === null, JSON.stringify(first));
  const themeIs = (t) => tp.waitForFunction((v) => document.documentElement.getAttribute("data-theme") === v, t, { timeout: 2000 }).then(() => true, () => false);
  await tp.emulateMedia({ colorScheme: "dark" });
  const toDark = await themeIs("dark");
  const iconDark = await tp.evaluate(() => document.querySelector("#themeBtn").innerHTML.includes("circle"));
  check(`${label}：系统切到深色实时跟随`, toDark && iconDark);
  await tp.emulateMedia({ colorScheme: "light" });
  check(`${label}：系统切回浅色实时跟随`, await themeIs("light"));
  await tp.click("#themeBtn");
  const pinned = (await tp.getAttribute("html", "data-theme")) === "dark" && (await tp.evaluate((u) => localStorage.getItem(u), userKey)) === "dark";
  await tp.reload();
  const kept = (await tp.getAttribute("html", "data-theme")) === "dark";
  await tp.click("#themeBtn");
  const unpinned = (await tp.getAttribute("html", "data-theme")) === "light" && (await tp.evaluate((u) => localStorage.getItem(u), userKey)) === null;
  check(`${label}：手动锁定刷新保留，切回系统主题即解除锁定`, pinned && kept && unpinned);
  await tp.close();
}

check("运行时零 JS 报错", errors.length === 0, errors.slice(0, 5).join(" | "));
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync(path.join(root, "scripts", "e2e-report.json"), JSON.stringify({ at: new Date().toISOString(), passed: results.length - failed.length, total: results.length, results, errors }, null, 2));
process.exit(failed.length ? 1 : 0);
