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
const newPage = async (viewport) => {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (e) => errors.push(`${page.url()} :: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${page.url()} :: console ${m.text()}`); });
  return page;
};

const studioUrl = pathToFileURL(path.join(root, "docs/studio/index.html")).href;
const page = await newPage({ width: 1520, height: 940 });
await page.addInitScript(() => localStorage.setItem("axc-theme", "dark"));
await page.goto(studioUrl);
await page.waitForSelector(".pinned");

// Sidebar
check("置顶总秘书席位含金色星标", await page.locator(".pinned .star").count() === 1 && (await page.textContent(".pinned")).includes("助手 · 总秘书"));
const groupRows = await page.locator('.sb-row[data-room^="group:"]').allTextContents();
const expectGroups = [["设计原型", "+3"], ["Issue分诊台", "+4"], ["部署审查", "+4"], ["产品调研", "+4"], ["Godot项目", "+3"]];
check("五个项目群及堆叠头像计数", expectGroups.every(([n, c]) => groupRows.some((t) => t.includes(n) && t.includes(c))), groupRows.length + " rows");
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
if (shots) await page.screenshot({ path: path.join(shotDir, "studio-a-dark.png") });
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
await page.hover('#orgTree [data-seat="feedback-collector"]');
check("场景 C：悬停透视派活范围", (await page.textContent("#probeLine")).includes("可触达 1 个席位"));
if (shots) { await page.mouse.move(5, 5); await page.screenshot({ path: path.join(shotDir, "studio-c-dark.png") }); }
await page.click('[data-act="json-preview"]');
const preview = await page.textContent("#modal pre");
const parsed = JSON.parse(preview);
check("场景 C：company.json 预览可解析", parsed.chiefSecretary.dispatchScope === "company_all" && parsed.employees.length >= 15);
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
  await site.addInitScript(() => localStorage.setItem("axc-site-theme", "dark"));
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
  const siteM = await newPage({ width: 390, height: 844 });
  await siteM.goto(siteUrl);
  const ov2 = await siteM.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("官网：手机端无横向溢出", ov2 <= 0, "overflow=" + ov2);
  const docsStudio = path.join(root, "docs/studio/index.html");
  check("官网：docs/studio/index.html 单一入口完整有效", fs.existsSync(docsStudio) && fs.readFileSync(docsStudio, "utf8") === fs.readFileSync(path.join(root, "docs/studio/index.html"), "utf8"));
}

check("运行时零 JS 报错", errors.length === 0, errors.slice(0, 5).join(" | "));
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync(path.join(root, "scripts", "e2e-report.json"), JSON.stringify({ at: new Date().toISOString(), passed: results.length - failed.length, total: results.length, results, errors }, null, 2));
process.exit(failed.length ? 1 : 0);
