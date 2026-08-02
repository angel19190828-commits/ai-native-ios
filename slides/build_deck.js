const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5 in

// ---------- Palette ----------
const NAVY = "14213D";
const NAVY_DEEP = "0D1730";
const ICE = "A8C7FA";
const ICE_SOFT = "E8F0FE";
const AMBER = "FF9F1C";
const AMBER_SOFT = "FFF1DC";
const WHITE = "FFFFFF";
const BG_LIGHT = "F5F6FA";
const TEXT_DARK = "1C1C1E";
const TEXT_MUTED = "6E6E73";
const GREEN = "1FA964";
const RED = "FF3B30";

const FONT_HEAD = "Cambria";
const FONT_BODY = "Calibri";

const PAGE_W = 13.333;
const PAGE_H = 7.5;
const MARGIN = 0.6;

// ---------- helpers ----------
function newSlide(bg) {
  const s = pres.addSlide();
  s.background = { color: bg || WHITE };
  return s;
}

function pageNum(s, n, dark) {
  s.addText(String(n).padStart(2, "0"), {
    x: PAGE_W - 0.9, y: PAGE_H - 0.5, w: 0.5, h: 0.3,
    fontFace: FONT_BODY, fontSize: 10, color: dark ? "8A93B8" : "B7BBC7", align: "right", margin: 0
  });
}

function eyebrow(s, text, x, y, color) {
  s.addText(text.toUpperCase(), {
    x, y, w: 8, h: 0.35, fontFace: FONT_BODY, fontSize: 12, bold: true,
    color: color || AMBER, charSpacing: 2, margin: 0
  });
}

function iconCircle(s, emoji, x, y, d, circleColor, textColor) {
  s.addShape("ellipse", { x, y, w: d, h: d, fill: { color: circleColor }, line: { type: "none" } });
  s.addText(emoji, {
    x, y, w: d, h: d, fontSize: d * 26, align: "center", valign: "middle", margin: 0, color: textColor || WHITE, fontFace: "Segoe UI Emoji"
  });
}

function card(s, x, y, w, h, opts) {
  opts = opts || {};
  s.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.1,
    fill: { color: opts.fill || WHITE },
    line: opts.line || { type: "none" },
    shadow: opts.shadow === false ? undefined : { type: "outer", color: "1C1C1E", opacity: 0.12, blur: 8, offset: 3, angle: 90 }
  });
}

// ============================================================
// SLIDE 1 · Title
// ============================================================
{
  const s = newSlide(NAVY);
  // decorative phone mockup on the right
  const px = 9.9, py = 1.15, pw = 2.55, ph = 5.2;
  s.addShape("roundRect", { x: px, y: py, w: pw, h: ph, rectRadius: 0.28, fill: { color: NAVY_DEEP }, line: { color: ICE, width: 1.25 } });
  s.addShape("roundRect", { x: px + 0.14, y: py + 0.32, w: pw - 0.28, h: ph - 0.64, rectRadius: 0.14, fill: { color: WHITE }, line: { type: "none" } });
  // notch
  s.addShape("roundRect", { x: px + pw / 2 - 0.35, y: py + 0.14, w: 0.7, h: 0.14, rectRadius: 0.07, fill: { color: NAVY_DEEP }, line: { type: "none" } });
  // content blocks inside screen
  const sx = px + 0.32, sy = py + 0.62, sw = pw - 0.64;
  s.addShape("roundRect", { x: sx, y: sy, w: sw, h: 0.5, rectRadius: 0.06, fill: { color: ICE_SOFT }, line: { type: "none" } });
  s.addText("Alex Chen · 面试邀请", { x: sx + 0.08, y: sy + 0.06, w: sw - 0.16, h: 0.38, fontSize: 7, fontFace: FONT_BODY, color: NAVY, bold: true, valign: "middle", margin: 0 });
  s.addShape("roundRect", { x: sx, y: sy + 0.66, w: sw, h: 0.85, rectRadius: 0.06, fill: { color: BG_LIGHT }, line: { type: "none" } });
  s.addText("下周二 10:30\n555 Burrard Street", { x: sx + 0.08, y: sy + 0.72, w: sw - 0.16, h: 0.7, fontSize: 6.5, fontFace: FONT_BODY, color: TEXT_MUTED, valign: "top", margin: 0 });
  s.addShape("roundRect", { x: sx, y: sy + 1.64, w: sw, h: 0.42, rectRadius: 0.21, fill: { color: AMBER }, line: { type: "none" } });
  s.addText("✨ 创建任务计划", { x: sx, y: sy + 1.64, w: sw, h: 0.42, fontSize: 7.5, bold: true, color: NAVY_DEEP, align: "center", valign: "middle", margin: 0 });
  for (let i = 0; i < 3; i++) {
    s.addShape("roundRect", { x: sx, y: sy + 2.24 + i * 0.5, w: sw, h: 0.4, rectRadius: 0.06, fill: { color: WHITE }, line: { color: "E5E5EA", width: 0.75 } });
    s.addShape("ellipse", { x: sx + 0.1, y: sy + 2.24 + i * 0.5 + 0.13, w: 0.14, h: 0.14, fill: { color: [GREEN, AMBER, ICE][i] }, line: { type: "none" } });
  }

  eyebrow(s, "AI 原生 iOS 概念设计 · 案例研究", MARGIN, 1.5, AMBER);
  s.addText("目标任务空间", {
    x: MARGIN, y: 2.0, w: 8.8, h: 1.5, fontFace: FONT_HEAD, fontSize: 54, bold: true, color: WHITE, margin: 0
  });
  s.addText("让 iOS 把你看到的信息和表达的目标,变成可查看、可修改、\n可执行、可追踪的跨应用任务计划", {
    x: MARGIN, y: 3.35, w: 8.6, h: 1.0, fontFace: FONT_BODY, fontSize: 17, color: ICE, margin: 0, lineSpacingMultiple: 1.3
  });

  const metaY = 5.15;
  const metas = [["场景", "线下面试邀请邮件"], ["交付", "研究 · 线框图 · 高保真 · 可交互原型"], ["数据", "本地模拟,不连接真实 API"]];
  metas.forEach((m, i) => {
    const mx = MARGIN + i * 3.0;
    s.addText(m[0].toUpperCase(), { x: mx, y: metaY, w: 2.8, h: 0.3, fontSize: 10, bold: true, color: "8A93B8", fontFace: FONT_BODY, charSpacing: 1.5, margin: 0 });
    s.addText(m[1], { x: mx, y: metaY + 0.3, w: 2.8, h: 0.5, fontSize: 12.5, color: WHITE, fontFace: FONT_BODY, margin: 0 });
  });
  pageNum(s, 1, true);
}

// ============================================================
// SLIDE 2 · 背景 & 初始问题
// ============================================================
{
  const s = newSlide(WHITE);
  eyebrow(s, "02 · 背景与初始问题", MARGIN, 0.55);
  s.addText("iOS 已经不是“打开 App”这一种入口了", {
    x: MARGIN, y: 0.95, w: 11.8, h: 0.7, fontFace: FONT_HEAD, fontSize: 30, bold: true, color: TEXT_DARK, margin: 0
  });
  s.addText("Siri、系统搜索、通知、桌面小组件、实时活动、快捷指令 —— 用户已经可以从多个位置查找信息、表达需求、执行操作。", {
    x: MARGIN, y: 1.65, w: 11.6, h: 0.5, fontFace: FONT_BODY, fontSize: 13.5, color: TEXT_MUTED, margin: 0
  });

  // quote card
  card(s, MARGIN, 2.4, 11.8, 1.7, { fill: NAVY });
  s.addText("“", { x: MARGIN + 0.25, y: 2.35, w: 1, h: 1, fontSize: 60, color: ICE, fontFace: FONT_HEAD, margin: 0 });
  s.addText("如何以 AI 原生的方式重新思考 iOS,使 AI 成为系统体验的一部分,\n而不是附加在现有应用和功能上的独立工具?", {
    x: MARGIN + 0.9, y: 2.7, w: 10.4, h: 1.1, fontFace: FONT_HEAD, fontSize: 19, italic: true, color: WHITE, valign: "middle", margin: 0, lineSpacingMultiple: 1.3
  });

  s.addText("这个项目不做什么", { x: MARGIN, y: 4.4, w: 6, h: 0.35, fontSize: 13, bold: true, color: TEXT_DARK, fontFace: FONT_BODY, margin: 0 });
  const excludes = ["给现有 iOS 加一个聊天机器人", "重新设计 Siri", "单独做一个 AI 邮件 / 日历 App", "重新设计整个 iOS", "假设 AI 可不经同意控制所有 App"];
  const colW = 3.75;
  excludes.forEach((t, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = MARGIN + col * (colW + 0.15), y = 4.85 + row * 0.55;
    s.addShape("ellipse", { x, y: y + 0.06, w: 0.14, h: 0.14, fill: { color: RED }, line: { type: "none" } });
    s.addText(t, { x: x + 0.26, y: y - 0.06, w: colW - 0.26, h: 0.4, fontSize: 12, color: TEXT_DARK, fontFace: FONT_BODY, valign: "middle", margin: 0 });
  });

  pageNum(s, 2);
}

// ============================================================
// SLIDE 3 · 研究方法
// ============================================================
{
  const s = newSlide(BG_LIGHT);
  eyebrow(s, "03 · 研究方法", MARGIN, 0.55);
  s.addText("研究先于结论 —— 不预支答案", {
    x: MARGIN, y: 0.95, w: 11, h: 0.6, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: TEXT_DARK, margin: 0
  });
  s.addText("研究逻辑严格按顺序推进,后一步不预设下一步的结论。", {
    x: MARGIN, y: 1.55, w: 10, h: 0.4, fontFace: FONT_BODY, fontSize: 13, color: TEXT_MUTED, margin: 0
  });

  const stages = ["背景", "开放式\n问题", "系统功能\n审查", "典型任务\n分析", "研究\n发现", "机会方向\n比较", "最终\n范围", "设计\n概念 → 原型"];
  const n = stages.length;
  const totalW = 11.8, gap = 0.18;
  const boxW = (totalW - gap * (n - 1)) / n;
  const y = 3.1, boxH = 1.35;
  stages.forEach((t, i) => {
    const x = MARGIN + i * (boxW + gap);
    const isLast = i === n - 1;
    card(s, x, y, boxW, boxH, { fill: isLast ? AMBER : WHITE, shadow: false, line: { color: isLast ? AMBER : "E1E4EE", width: 1 } });
    s.addText(t, { x, y, w: boxW, h: boxH, fontSize: 11.5, bold: true, color: isLast ? NAVY_DEEP : TEXT_DARK, align: "center", valign: "middle", fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.05 });
    if (!isLast) {
      s.addText("›", { x: x + boxW, y: y, w: gap, h: boxH, fontSize: 16, bold: true, color: "B7BBC7", align: "center", valign: "middle", margin: 0 });
    }
  });

  card(s, MARGIN, 4.85, 11.8, 1.7, { fill: WHITE, shadow: false, line: { color: "E1E4EE", width: 1 } });
  s.addText("三类证据,全文标注", { x: MARGIN + 0.35, y: 5.05, w: 6, h: 0.35, fontSize: 13, bold: true, color: TEXT_DARK, fontFace: FONT_BODY, margin: 0 });
  const evid = [
    [NAVY, "苹果官方事实", "指向 Apple Developer / Support / Newsroom"],
    ["6B4FBB", "本项目分析", "自行审查、拆解得出的数据,非官方统计"],
    [AMBER, "设计推论", "尚未经用户测试验证的判断"]
  ];
  evid.forEach((e, i) => {
    const x = MARGIN + 0.35 + i * 3.85;
    s.addShape("roundRect", { x, y: 5.5, w: 1.5, h: 0.32, rectRadius: 0.16, fill: { color: e[0] }, line: { type: "none" } });
    s.addText(e[1], { x, y: 5.5, w: 1.5, h: 0.32, fontSize: 10, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, fontFace: FONT_BODY });
    s.addText(e[2], { x, y: 5.9, w: 3.6, h: 0.5, fontSize: 10.5, color: TEXT_MUTED, fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.15 });
  });

  pageNum(s, 3);
}

// ============================================================
// SLIDE 4 · iOS 系统功能审查
// ============================================================
{
  const s = newSlide(WHITE);
  eyebrow(s, "04 · iOS 系统功能审查", MARGIN, 0.55);
  s.addText("七类常见任务入口", { x: MARGIN, y: 0.95, w: 8, h: 0.6, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: TEXT_DARK, margin: 0 });
  s.addText("基于本项目的功能审查分类,非苹果官方入口数量声明 [1]", { x: MARGIN, y: 1.55, w: 10, h: 0.35, fontFace: FONT_BODY, fontSize: 12, italic: true, color: TEXT_MUTED, margin: 0 });

  const entries = [
    ["🎙️", "Siri", "多步骤任务需分次表达"],
    ["🔍", "系统搜索", "执行依赖 App 是否暴露 Intent"],
    ["🔔", "通知", "不维护跨通知的任务状态"],
    ["🧩", "桌面小组件", "只读为主,不追踪多步骤任务"],
    ["📡", "实时活动", "面向单一事件,非任务规划工具"],
    ["⚡", "快捷指令", "需提前定义动作/顺序/触发条件"],
    ["📱", "单个 App", "数据独立,上下文靠用户手动搬运"]
  ];
  const cols = 4, gapX = 0.2, gapY = 0.22;
  const cardW = (11.8 - gapX * (cols - 1)) / cols;
  const cardH = 1.5;
  entries.forEach((e, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gapX), y = 2.15 + row * (cardH + gapY);
    card(s, x, y, cardW, cardH, { fill: BG_LIGHT, shadow: false });
    iconCircle(s, e[0], x + 0.18, y + 0.18, 0.5, WHITE, TEXT_DARK);
    s.addText(e[1], { x: x + 0.18, y: y + 0.78, w: cardW - 0.36, h: 0.3, fontSize: 13, bold: true, color: TEXT_DARK, fontFace: FONT_BODY, margin: 0 });
    s.addText(e[2], { x: x + 0.18, y: y + 1.08, w: cardW - 0.36, h: 0.42, fontSize: 9.5, color: TEXT_MUTED, fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.1 });
  });
  // 8th cell: key insight
  const col = 3, row = 1;
  const x = MARGIN + col * (cardW + gapX), y = 2.15 + row * (cardH + gapY);
  card(s, x, y, cardW, cardH, { fill: NAVY, shadow: false });
  s.addText("这些入口共享同一套系统机制:App Intents", { x: x + 0.16, y: y + 0.14, w: cardW - 0.32, h: cardH - 0.28, fontSize: 10.5, bold: true, color: WHITE, fontFace: FONT_BODY, valign: "middle", margin: 0, lineSpacingMultiple: 1.2 });

  pageNum(s, 4);
}

// ============================================================
// SLIDE 5 · 研究发现
// ============================================================
{
  const s = newSlide(BG_LIGHT);
  eyebrow(s, "05 · 研究发现", MARGIN, 0.55);
  s.addText("四条研究发现", { x: MARGIN, y: 0.95, w: 8, h: 0.6, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: TEXT_DARK, margin: 0 });

  const findings = [
    ["01", "用户可以从多个位置开始操作", "通过 7 类入口查找信息、表达需求或执行操作", "基于本项目的 iOS 功能审查"],
    ["02", "常见系统功能主要协助局部步骤", "17 步任务中仅 4 步获系统直接/部分辅助", "本项目任务流程审查结果"],
    ["03", "快捷指令支持多步骤自动化,但需提前建立", "更适合已定义好的流程,而非临时目标", "Apple Support · Shortcuts 官方说明"],
    ["04", "完整目标仍需用户自己组织", "7 次 App 切换,且无统一任务状态", "本项目任务流程审查结果"]
  ];
  const cols = 2, gapX = 0.3, gapY = 0.3;
  const cardW = (11.8 - gapX) / cols;
  const cardH = 2.05;
  findings.forEach((f, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gapX), y = 1.75 + row * (cardH + gapY);
    card(s, x, y, cardW, cardH, { fill: WHITE });
    s.addText(f[0], { x: x + 0.28, y: y + 0.22, w: 1.2, h: 0.6, fontSize: 26, bold: true, color: ICE, fontFace: FONT_HEAD, margin: 0 });
    s.addText(f[1], { x: x + 0.28, y: y + 0.72, w: cardW - 0.56, h: 0.55, fontSize: 14.5, bold: true, color: TEXT_DARK, fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.15 });
    s.addText(f[2], { x: x + 0.28, y: y + 1.28, w: cardW - 0.56, h: 0.45, fontSize: 11, color: TEXT_MUTED, fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.2 });
    s.addText(f[3], { x: x + 0.28, y: y + cardH - 0.4, w: cardW - 0.56, h: 0.3, fontSize: 9, italic: true, color: AMBER, fontFace: FONT_BODY, margin: 0 });
  });

  pageNum(s, 5);
}

// ============================================================
// SLIDE 6 · 量化任务审查
// ============================================================
{
  const s = newSlide(NAVY);
  eyebrow(s, "06 · 典型任务场景与量化审查", MARGIN, 0.55, ICE);
  s.addText("一封面试邀请邮件,17 个步骤,6 个 App", { x: MARGIN, y: 0.95, w: 11, h: 0.6, fontFace: FONT_HEAD, fontSize: 27, bold: true, color: WHITE, margin: 0 });
  s.addText("本项目任务流程审查结果 —— 基于当前 iOS 实际操作路径的拆解与计数,不代表苹果官方统计", {
    x: MARGIN, y: 1.55, w: 11, h: 0.4, fontFace: FONT_BODY, fontSize: 11.5, italic: true, color: "8A93B8", margin: 0
  });

  const stats = [["17", "总步骤数"], ["6", "涉及 App 数"], ["7", "App 切换次数"], ["4", "系统可辅助步骤"], ["8", "仍需用户判断"], ["0", "统一任务状态"]];
  const gap = 0.2;
  const w = (11.8 - gap * 5) / 6;
  stats.forEach((st, i) => {
    const x = MARGIN + i * (w + gap);
    card(s, x, 2.3, w, 1.7, { fill: NAVY_DEEP, shadow: false, line: { color: "2A3660", width: 1 } });
    s.addText(st[0], { x, y: 2.45, w, h: 0.85, fontSize: 34, bold: true, color: AMBER, align: "center", fontFace: FONT_HEAD, margin: 0 });
    s.addText(st[1], { x: x + 0.08, y: 3.25, w: w - 0.16, h: 0.65, fontSize: 10, color: ICE, align: "center", fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.15 });
  });

  s.addText("单一目标、单一信息来源 —— 用户却要在 6 个 App 间自行搬运上下文,\n没有统一状态,也没有清晰的失败恢复路径。", {
    x: MARGIN, y: 4.35, w: 11.6, h: 0.9, fontFace: FONT_BODY, fontSize: 15, color: WHITE, margin: 0, lineSpacingMultiple: 1.4
  });

  const chips = ["邮件", "日历", "地图", "提醒事项", "文件", "信息"];
  chips.forEach((c, i) => {
    const x = MARGIN + i * 1.65;
    s.addShape("roundRect", { x, y: 5.55, w: 1.5, h: 0.42, rectRadius: 0.21, fill: { color: "1E2A54" }, line: { color: ICE, width: 0.75 } });
    s.addText(c, { x, y: 5.55, w: 1.5, h: 0.42, fontSize: 11.5, color: WHITE, align: "center", valign: "middle", fontFace: FONT_BODY, margin: 0 });
    if (i < chips.length - 1) s.addText("→", { x: x + 1.5, y: 5.55, w: 0.15, h: 0.42, fontSize: 12, color: "8A93B8", align: "center", valign: "middle", margin: 0 });
  });

  pageNum(s, 6, true);
}

// ============================================================
// SLIDE 7 · 机会方向比较
// ============================================================
{
  const s = newSlide(WHITE);
  eyebrow(s, "07 · 机会方向比较", MARGIN, 0.55);
  s.addText("五个方向,一个胜出", { x: MARGIN, y: 0.95, w: 8, h: 0.6, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: TEXT_DARK, margin: 0 });
  s.addText("评分基于本项目对研究发现的相关性判断(设计推论),不是用户调研得分。八个维度综合评估。", {
    x: MARGIN, y: 1.55, w: 11, h: 0.4, fontFace: FONT_BODY, fontSize: 12, color: TEXT_MUTED, margin: 0
  });

  const cats = ["更自然入口", "系统长期记忆", "决策支持", "跨应用任务组织", "高度自主执行"];
  const vals = [26, 19, 23, 32, 20];
  const colors = ["B7C4E8", "B7C4E8", "B7C4E8", AMBER, "B7C4E8"];

  s.addChart(pres.ChartType.bar, [{ name: "合计得分", labels: cats, values: vals }], {
    x: MARGIN, y: 2.1, w: 7.3, h: 4.6,
    barDir: "bar",
    chartColors: colors,
    showTitle: false,
    showValue: true,
    dataLabelPosition: "outEnd",
    dataLabelColor: TEXT_DARK,
    dataLabelFontSize: 12,
    catAxisLabelColor: TEXT_DARK,
    catAxisLabelFontSize: 12,
    valAxisHidden: true,
    valGridLine: { style: "none" },
    catGridLine: { style: "none" },
    showLegend: false,
    barGapWidthPct: 40,
    plotArea: { fill: { color: WHITE } }
  });

  card(s, 8.3, 2.1, 3.3, 4.6, { fill: NAVY });
  s.addText("跨应用任务组织", { x: 8.55, y: 2.35, w: 2.8, h: 0.5, fontSize: 16, bold: true, color: AMBER, fontFace: FONT_HEAD, margin: 0 });
  s.addText("唯一同时对应研究发现 02(局部辅助)与发现 04(用户自行组织),并能把其他方向收纳为“计划中一步”的方向。", {
    x: 8.55, y: 2.9, w: 2.8, h: 1.6, fontSize: 11.5, color: WHITE, fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.35
  });
  s.addText("32", { x: 8.55, y: 4.7, w: 2.8, h: 0.9, fontSize: 46, bold: true, color: WHITE, fontFace: FONT_HEAD, margin: 0 });
  s.addText("合计得分 / 满分 40", { x: 8.55, y: 5.55, w: 2.8, h: 0.4, fontSize: 10.5, color: ICE, fontFace: FONT_BODY, margin: 0 });

  pageNum(s, 7);
}

// ============================================================
// SLIDE 8 · 最终设计范围
// ============================================================
{
  const s = newSlide(BG_LIGHT);
  eyebrow(s, "08 · 最终设计范围", MARGIN, 0.55);
  s.addText("从开放式问题到最终设计问题", { x: MARGIN, y: 0.95, w: 11, h: 0.55, fontFace: FONT_HEAD, fontSize: 26, bold: true, color: TEXT_DARK, margin: 0 });

  card(s, MARGIN, 1.65, 11.8, 1.35, { fill: NAVY, shadow: false });
  s.addText("如何利用 AI 原生能力,让 iOS 将用户目标转化为清晰、可执行、可追踪的跨应用任务,同时确保信息来源透明、重要操作可确认、结果可修改并且操作可撤销?", {
    x: MARGIN + 0.35, y: 1.65, w: 11.1, h: 1.35, fontSize: 14.5, italic: true, bold: true, color: WHITE, valign: "middle", fontFace: FONT_HEAD, margin: 0, lineSpacingMultiple: 1.3
  });

  const colW = 5.8;
  card(s, MARGIN, 3.25, colW, 3.35, { fill: WHITE });
  s.addShape("ellipse", { x: MARGIN + 0.3, y: 3.55, w: 0.4, h: 0.4, fill: { color: GREEN }, line: { type: "none" } });
  s.addText("✓", { x: MARGIN + 0.3, y: 3.55, w: 0.4, h: 0.4, fontSize: 16, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
  s.addText("范围内", { x: MARGIN + 0.85, y: 3.5, w: 4, h: 0.5, fontSize: 15, bold: true, color: TEXT_DARK, fontFace: FONT_BODY, margin: 0 });
  const inScope = ["从一封事件类邮件开始,识别时间、地点、联系人和准备要求", "检查日历冲突,生成任务计划", "让用户查看和修改计划", "确认后创建日历、提醒和路线", "显示整体进度,支持暂停、重试和撤销"];
  s.addText(inScope.map(t => ({ text: t, options: { bullet: { code: "2022", indent: 12 }, breakLine: true, paraSpaceAfter: 10 } })), {
    x: MARGIN + 0.3, y: 4.15, w: colW - 0.6, h: 2.3, fontSize: 12, color: TEXT_DARK, fontFace: FONT_BODY, valign: "top", margin: 0
  });

  const x2 = MARGIN + colW + 0.2;
  card(s, x2, 3.25, colW, 3.35, { fill: WHITE });
  s.addShape("ellipse", { x: x2 + 0.3, y: 3.55, w: 0.4, h: 0.4, fill: { color: RED }, line: { type: "none" } });
  s.addText("✕", { x: x2 + 0.3, y: 3.55, w: 0.4, h: 0.4, fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
  s.addText("范围外", { x: x2 + 0.85, y: 3.5, w: 4, h: 0.5, fontSize: 15, bold: true, color: TEXT_DARK, fontFace: FONT_BODY, margin: 0 });
  const outScope = ["所有类型的跨应用任务(仅面试邀请这一场景)", "完全自主且无需确认的后台代理", "自动付款 / 购买 / 取消预约", "自动代表用户发送敏感信息", "为所有第三方 App 制作真实集成"];
  s.addText(outScope.map(t => ({ text: t, options: { bullet: { code: "2022", indent: 12 }, breakLine: true, paraSpaceAfter: 10 } })), {
    x: x2 + 0.3, y: 4.15, w: colW - 0.6, h: 2.3, fontSize: 12, color: TEXT_DARK, fontFace: FONT_BODY, valign: "top", margin: 0
  });

  pageNum(s, 8);
}

// ============================================================
// SLIDE 9 · 设计原则
// ============================================================
{
  const s = newSlide(WHITE);
  eyebrow(s, "09 · 设计原则", MARGIN, 0.55);
  s.addText("七条设计原则", { x: MARGIN, y: 0.95, w: 8, h: 0.6, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: TEXT_DARK, margin: 0 });

  const principles = [
    ["🎯", "目标优先", "先显示用户想完成什么,再显示需要调用哪些 App"],
    ["👁️", "理解必须可见", "用户能看到系统提取了哪些时间、地点、要求"],
    ["🔗", "来源必须透明", "每条关键信息可查看来源"],
    ["✎", "计划必须可编辑", "用户可删除、修改和重新排序步骤"],
    ["⚖️", "风险分级确认", "低风险自动 · 中风险批量 · 高风险单独确认"],
    ["📶", "状态持续可见", "待处理/进行中/等待确认/完成/失败/取消"],
    ["↺", "可撤销可恢复", "每个动作都可撤销、重试、查看失败原因"]
  ];
  const cols = 4, gapX = 0.2, gapY = 0.25;
  const cardW = (11.8 - gapX * (cols - 1)) / cols;
  const cardH = 1.85;
  principles.forEach((p, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gapX), y = 1.75 + row * (cardH + gapY);
    card(s, x, y, cardW, cardH, { fill: row === 1 && col === 2 ? NAVY : BG_LIGHT, shadow: false });
    const isDark = row === 1 && col === 2;
    iconCircle(s, p[0], x + 0.18, y + 0.18, 0.45, isDark ? AMBER : WHITE, isDark ? NAVY_DEEP : TEXT_DARK);
    s.addText(p[1], { x: x + 0.18, y: y + 0.72, w: cardW - 0.36, h: 0.32, fontSize: 12.5, bold: true, color: isDark ? WHITE : TEXT_DARK, fontFace: FONT_BODY, margin: 0 });
    s.addText(p[2], { x: x + 0.18, y: y + 1.05, w: cardW - 0.36, h: 0.72, fontSize: 9.5, color: isDark ? ICE : TEXT_MUTED, fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.2 });
  });

  pageNum(s, 9);
}

// ============================================================
// SLIDE 10 · 信息架构
// ============================================================
{
  const s = newSlide(BG_LIGHT);
  eyebrow(s, "10 · 信息架构", MARGIN, 0.55);
  s.addText("“目标任务空间”不是新 App", { x: MARGIN, y: 0.95, w: 11, h: 0.6, fontFace: FONT_HEAD, fontSize: 27, bold: true, color: TEXT_DARK, margin: 0 });
  s.addText("而是系统在识别到可执行目标时生成的系统级任务界面,以任务状态为主轴,而非页面导航。", {
    x: MARGIN, y: 1.6, w: 11.4, h: 0.4, fontFace: FONT_BODY, fontSize: 12.5, color: TEXT_MUTED, margin: 0
  });

  // trigger
  card(s, MARGIN, 2.35, 2.6, 0.9, { fill: WHITE });
  s.addText("邮件 App\n(触发点)", { x: MARGIN, y: 2.35, w: 2.6, h: 0.9, fontSize: 12, bold: true, color: TEXT_DARK, align: "center", valign: "middle", fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.15 });
  s.addText("→", { x: MARGIN + 2.6, y: 2.35, w: 0.5, h: 0.9, fontSize: 18, color: "B7BBC7", align: "center", valign: "middle", margin: 0 });

  // core
  card(s, MARGIN + 3.2, 2.0, 4.6, 1.6, { fill: NAVY });
  s.addText("目标任务空间", { x: MARGIN + 3.5, y: 2.15, w: 4, h: 0.45, fontSize: 16, bold: true, color: AMBER, fontFace: FONT_HEAD, margin: 0 });
  s.addText("提取信息 → 计划 → 确认 → 执行 → 完成\n(核心界面,系统级,非独立 App)", { x: MARGIN + 3.5, y: 2.62, w: 4, h: 0.85, fontSize: 10.5, color: WHITE, fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.3 });

  s.addText("↓ 持续投影到", { x: MARGIN + 3.2, y: 3.7, w: 4.6, h: 0.35, fontSize: 10.5, color: TEXT_MUTED, align: "center", fontFace: FONT_BODY, margin: 0 });

  const surfaces = ["锁屏 / 实时活动", "主屏幕小组件", "通知", "Siri / 系统搜索"];
  const sw = 2.85, sgap = 0.15;
  surfaces.forEach((sf, i) => {
    const x = MARGIN + i * (sw + sgap);
    card(s, x, 4.2, sw, 1.0, { fill: WHITE, shadow: false, line: { color: ICE, width: 1 } });
    s.addText(sf, { x, y: 4.2, w: sw, h: 1.0, fontSize: 11.5, bold: true, color: NAVY, align: "center", valign: "middle", fontFace: FONT_BODY, margin: 0 });
  });

  card(s, MARGIN, 5.55, 11.8, 1.1, { fill: AMBER_SOFT, shadow: false });
  s.addText("关键区别:四处均读取同一个任务状态对象,而不是四套独立界面。这也是与快捷指令的本质区别 —— 用户先表达目标,系统识别步骤并生成可解释的计划,而非用户提前编排流程。", {
    x: MARGIN + 0.3, y: 5.55, w: 11.2, h: 1.1, fontSize: 12, color: "995200", valign: "middle", fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.35
  });

  pageNum(s, 10);
}

// ============================================================
// SLIDE 11 · 用户流程 A-E
// ============================================================
{
  const s = newSlide(WHITE);
  eyebrow(s, "11 · 用户流程", MARGIN, 0.55);
  s.addText("流程 A 是主干,B–E 是它的分支", { x: MARGIN, y: 0.95, w: 11, h: 0.6, fontFace: FONT_HEAD, fontSize: 27, bold: true, color: TEXT_DARK, margin: 0 });

  const flows = [
    ["A", "从邮件开始", "识别目标 → 提取信息 → 生成计划 → 批量确认 → 执行 → 完成", NAVY],
    ["B", "发现冲突", "不自动覆盖已有日程,联系 Alex 需二次确认后才真正发送", "6B4FBB"],
    ["C", "信息不确定", "“下周二”需用户确认具体日期,系统展示自己的解释", AMBER],
    ["D", "执行失败", "作品集查找失败≠整体失败,提供 4 种恢复选项", RED],
    ["E", "撤销", "已完成操作仍可单独撤销,附影响说明与二次确认", GREEN]
  ];
  const w = 2.32, gap = 0.15;
  flows.forEach((f, i) => {
    const x = MARGIN + i * (w + gap);
    card(s, x, 1.85, w, 4.3, { fill: BG_LIGHT, shadow: false });
    s.addShape("roundRect", { x: x + 0.18, y: 2.05, w: 0.55, h: 0.55, rectRadius: 0.1, fill: { color: f[3] }, line: { type: "none" } });
    s.addText(f[0], { x: x + 0.18, y: 2.05, w: 0.55, h: 0.55, fontSize: 20, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: FONT_HEAD, margin: 0 });
    s.addText(f[1], { x: x + 0.18, y: 2.75, w: w - 0.36, h: 0.55, fontSize: 13.5, bold: true, color: TEXT_DARK, fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.1 });
    s.addText(f[2], { x: x + 0.18, y: 3.35, w: w - 0.36, h: 2.6, fontSize: 10, color: TEXT_MUTED, fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.3 });
  });

  s.addText("流程 B、C、D 均为流程 A 主干在特定条件下的分支,共享同一状态机,而非三套独立系统。", {
    x: MARGIN, y: 6.35, w: 11.6, h: 0.4, fontSize: 11.5, italic: true, color: TEXT_MUTED, fontFace: FONT_BODY, margin: 0
  });

  pageNum(s, 11);
}

// ============================================================
// SLIDE 12 · 风险分级与确认机制
// ============================================================
{
  const s = newSlide(NAVY);
  eyebrow(s, "12 · 风险分级与确认机制", MARGIN, 0.55, ICE);
  s.addText("不同风险,不同确认方式", { x: MARGIN, y: 0.95, w: 11, h: 0.6, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: WHITE, margin: 0 });

  const tiers = [
    ["低风险", GREEN, "查看信息 · 查找文件 · 计算路线", "自动准备结果,无需确认", "检查冲突 · 查看路线 · 查找作品集"],
    ["中风险", AMBER, "创建日历 · 创建提醒 · 修改日程", "批量确认,可逐项取消", "创建面试事件 · 设置出发/准备提醒"],
    ["高风险", RED, "发送消息 · 取消预约 · 支付 · 分享敏感文件", "必须单独确认,不进入批量列表", "向 Alex 发送改期消息"]
  ];
  const w = 3.7, gap = 0.35;
  tiers.forEach((t, i) => {
    const x = MARGIN + i * (w + gap);
    card(s, x, 1.85, w, 4.9, { fill: NAVY_DEEP, shadow: false, line: { color: t[1], width: 1.5 } });
    s.addShape("roundRect", { x: x + 0.3, y: 2.15, w: 1.5, h: 0.42, rectRadius: 0.21, fill: { color: t[1] }, line: { type: "none" } });
    s.addText(t[0], { x: x + 0.3, y: 2.15, w: 1.5, h: 0.42, fontSize: 13, bold: true, color: NAVY_DEEP, align: "center", valign: "middle", fontFace: FONT_BODY, margin: 0 });

    s.addText("包含", { x: x + 0.3, y: 2.85, w: w - 0.6, h: 0.3, fontSize: 10, bold: true, color: "8A93B8", fontFace: FONT_BODY, margin: 0, charSpacing: 1 });
    s.addText(t[2], { x: x + 0.3, y: 3.15, w: w - 0.6, h: 0.9, fontSize: 11.5, color: WHITE, fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.3 });

    s.addText("确认方式", { x: x + 0.3, y: 4.1, w: w - 0.6, h: 0.3, fontSize: 10, bold: true, color: "8A93B8", fontFace: FONT_BODY, margin: 0, charSpacing: 1 });
    s.addText(t[3], { x: x + 0.3, y: 4.4, w: w - 0.6, h: 0.65, fontSize: 12.5, bold: true, color: t[1], fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.25 });

    s.addText("本场景中", { x: x + 0.3, y: 5.15, w: w - 0.6, h: 0.3, fontSize: 10, bold: true, color: "8A93B8", fontFace: FONT_BODY, margin: 0, charSpacing: 1 });
    s.addText(t[4], { x: x + 0.3, y: 5.45, w: w - 0.6, h: 1.1, fontSize: 10.5, color: "C7CDE8", fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.3 });
  });

  pageNum(s, 12, true);
}

// ============================================================
// SLIDE 13 · 低保真线框图
// ============================================================
{
  const s = newSlide(WHITE);
  s.addText("13 · 低保真线框图", { x: MARGIN, y: 0.4, w: 8, h: 0.3, fontFace: "Courier New", fontSize: 11, color: "000000", margin: 0 });
  s.addText("12 屏,先覆盖流程,不做视觉", { x: MARGIN, y: 0.72, w: 11, h: 0.5, fontFace: FONT_BODY, fontSize: 22, bold: true, color: "000000", margin: 0 });
  s.addText("方框仅表示结构与层级,不代表最终视觉样式。", {
    x: MARGIN, y: 1.24, w: 11, h: 0.3, fontFace: FONT_BODY, fontSize: 11, color: "000000", margin: 0
  });

  const screens = [
    "01 邮件阅读界面", "02 AI 识别浮层", "03 信息确认页", "04 任务计划生成页",
    "05 批量确认页", "06 冲突处理页", "07 消息草稿确认页", "08 任务执行进度页",
    "09 文件查找页", "10 失败恢复页", "11 任务完成页", "12 系统级持续状态"
  ];
  const cols = 6, gapX = 0.14, gapY = 0.5;
  const cardW = (12.1 - gapX * (cols - 1)) / cols;
  const cardH = 1.55;
  const BLACK = "000000";
  screens.forEach((t, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gapX), y = 1.75 + row * (cardH + gapY);
    // outer screen frame — plain black rule, no fill, no shadow, no radius
    s.addShape("rect", { x, y, w: cardW, h: cardH, fill: { color: WHITE }, line: { color: BLACK, width: 1 } });
    // nav bar block
    s.addShape("rect", { x: x + 0.06, y: y + 0.06, w: cardW - 0.12, h: 0.16, fill: { type: "none" }, line: { color: BLACK, width: 0.5 } });
    // 2-3 stacked content blocks, varied to avoid a repeated stamp
    const blockCount = 2 + (i % 2);
    const top = y + 0.3, bottom = y + cardH - 0.06;
    const blockH = (bottom - top - 0.06 * (blockCount - 1)) / blockCount;
    for (let b = 0; b < blockCount; b++) {
      const by = top + b * (blockH + 0.06);
      s.addShape("rect", { x: x + 0.06, y: by, w: cardW - 0.12, h: blockH, fill: { type: "none" }, line: { color: BLACK, width: 0.5, dashType: b === blockCount - 1 ? "dash" : "solid" } });
    }
    s.addText(t, { x, y: y + cardH + 0.06, w: cardW, h: 0.4, fontFace: "Courier New", fontSize: 8.5, color: BLACK, align: "center", margin: 0, lineSpacingMultiple: 1.1 });
  });

  s.addText(String(13).padStart(2, "0"), {
    x: PAGE_W - 0.9, y: PAGE_H - 0.5, w: 0.5, h: 0.3,
    fontFace: "Courier New", fontSize: 10, color: "000000", align: "right", margin: 0
  });
}

// ============================================================
// SLIDE 14 · 原型预览(手绘 mockup)
// ============================================================
{
  const s = newSlide(BG_LIGHT);
  eyebrow(s, "14 · 高保真界面与可交互原型", MARGIN, 0.55);
  s.addText("从邮件到完成 —— 三个关键屏幕", { x: MARGIN, y: 0.95, w: 11, h: 0.6, fontFace: FONT_HEAD, fontSize: 27, bold: true, color: TEXT_DARK, margin: 0 });

  function miniPhone(x, label, kind) {
    const pw = 2.7, ph = 4.55, py = 1.85;
    s.addShape("roundRect", { x, y: py, w: pw, h: ph, rectRadius: 0.26, fill: { color: NAVY_DEEP }, line: { type: "none" } });
    const sx = x + 0.12, sy = py + 0.28, sw = pw - 0.24, sh = ph - 0.56;
    s.addShape("roundRict" === "x" ? "roundRect" : "roundRect", { x: sx, y: sy, w: sw, h: sh, rectRadius: 0.12, fill: { color: WHITE }, line: { type: "none" } });
    s.addShape("roundRect", { x: x + pw / 2 - 0.32, y: py + 0.12, w: 0.64, h: 0.13, rectRadius: 0.065, fill: { color: NAVY_DEEP }, line: { type: "none" } });

    const ix = sx + 0.18, iw = sw - 0.36;
    let iy = sy + 0.3;
    if (kind === "mail") {
      s.addShape("roundRect", { x: ix, y: iy, w: iw, h: 0.4, rectRadius: 0.06, fill: { color: BG_LIGHT }, line: { type: "none" } });
      s.addText("Alex Chen · 面试邀请", { x: ix + 0.08, y: iy, w: iw - 0.16, h: 0.4, fontSize: 7, bold: true, color: TEXT_DARK, valign: "middle", margin: 0, fontFace: FONT_BODY });
      iy += 0.55;
      s.addShape("roundRect", { x: ix, y: iy, w: iw, h: 0.9, rectRadius: 0.06, fill: { color: "F7F7F9" }, line: { type: "none" } });
      s.addText("next Tuesday 10:30 a.m.\n555 Burrard Street\nbring your portfolio", { x: ix + 0.08, y: iy + 0.06, w: iw - 0.16, h: 0.8, fontSize: 6, color: TEXT_MUTED, margin: 0, fontFace: FONT_BODY, lineSpacingMultiple: 1.3 });
      iy += 1.05;
      s.addShape("roundRect", { x: ix, y: iy, w: iw, h: 0.55, rectRadius: 0.08, fill: { color: ICE_SOFT }, line: { type: "none" } });
      s.addText("✨ 这封邮件包含一个需要\n准备的面试事件", { x: ix + 0.08, y: iy, w: iw - 0.16, h: 0.55, fontSize: 6.2, bold: true, color: NAVY, valign: "middle", margin: 0, fontFace: FONT_BODY, lineSpacingMultiple: 1.2 });
    } else if (kind === "plan") {
      const steps = [["检查日历冲突", GREEN, "低风险"], ["创建面试日历事件", AMBER, "中风险"], ["查看路线", GREEN, "低风险"], ["设置出发提醒", AMBER, "中风险"], ["查找作品集", GREEN, "低风险"]];
      steps.forEach((st, i) => {
        const yy = iy + i * 0.5;
        s.addShape("roundRect", { x: ix, y: yy, w: iw, h: 0.42, rectRadius: 0.06, fill: { color: "F7F7F9" }, line: { type: "none" } });
        s.addShape("ellipse", { x: ix + 0.08, y: yy + 0.16, w: 0.1, h: 0.1, fill: { color: st[1] }, line: { type: "none" } });
        s.addText(st[0], { x: ix + 0.25, y: yy, w: iw - 0.9, h: 0.42, fontSize: 6.3, bold: true, color: TEXT_DARK, valign: "middle", margin: 0, fontFace: FONT_BODY });
        s.addText(st[2], { x: ix + iw - 0.62, y: yy, w: 0.58, h: 0.42, fontSize: 5.3, color: st[1], valign: "middle", margin: 0, fontFace: FONT_BODY, bold: true });
      });
    } else if (kind === "complete") {
      s.addShape("roundRect", { x: ix, y: iy, w: iw, h: 0.55, rectRadius: 0.08, fill: { color: "E4F7EC" }, line: { type: "none" } });
      s.addText("✅ 面试准备任务已处理完毕", { x: ix + 0.08, y: iy, w: iw - 0.16, h: 0.55, fontSize: 6.4, bold: true, color: GREEN, valign: "middle", margin: 0, fontFace: FONT_BODY });
      iy += 0.7;
      s.addShape("roundRect", { x: ix, y: iy, w: iw, h: 1.3, rectRadius: 0.08, fill: { color: "F7F7F9" }, line: { type: "none" } });
      s.addText("日期时间\n2026年8月4日 上午10:30\n\n地点\n555 Burrard Street\n\n作品集\nPortfolio_2026_Final_v3.pdf", { x: ix + 0.1, y: iy + 0.06, w: iw - 0.2, h: 1.2, fontSize: 5.6, color: TEXT_DARK, margin: 0, fontFace: FONT_BODY, lineSpacingMultiple: 1.25 });
      iy += 1.45;
      ["打开日历", "查看路线", "查看文件"].forEach((b, i) => {
        const bw = (iw - 0.16) / 3;
        s.addShape("roundRect", { x: ix + i * (bw + 0.08), y: iy, w: bw, h: 0.35, rectRadius: 0.06, fill: { color: "EDEDF2" }, line: { type: "none" } });
        s.addText(b, { x: ix + i * (bw + 0.08), y: iy, w: bw, h: 0.35, fontSize: 5.2, color: TEXT_DARK, align: "center", valign: "middle", margin: 0, fontFace: FONT_BODY });
      });
    }
    s.addText(label, { x, y: py + ph + 0.12, w: pw, h: 0.35, fontSize: 11.5, bold: true, color: TEXT_DARK, align: "center", fontFace: FONT_BODY, margin: 0 });
  }

  miniPhone(MARGIN + 0.3, "邮件 + AI 建议", "mail");
  miniPhone(MARGIN + 3.65, "任务计划(风险分级)", "plan");
  miniPhone(MARGIN + 7.0, "完成态(可撤销)", "complete");

  card(s, 10.1, 1.85, 2.4, 4.55, { fill: WHITE });
  s.addText("纯 HTML/CSS/JS\n无构建、无依赖\n本地模拟数据", { x: 10.35, y: 2.15, w: 1.9, h: 0.9, fontSize: 10.5, bold: true, color: TEXT_DARK, fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.4 });
  s.addText("覆盖流程 A–E\n全部分支状态\n可点击、可回退\n支持重置演示", { x: 10.35, y: 3.3, w: 1.9, h: 1.2, fontSize: 10, color: TEXT_MUTED, fontFace: FONT_BODY, margin: 0, lineSpacingMultiple: 1.5 });

  pageNum(s, 14);
}

// ============================================================
// SLIDE 14 · 风险限制 & 下一步验证
// ============================================================
{
  const s = newSlide(WHITE);
  eyebrow(s, "15 · 风险与限制 · 下一步验证", MARGIN, 0.55);
  s.addText("诚实标注假设,而不是掩盖问题", { x: MARGIN, y: 0.95, w: 11, h: 0.6, fontFace: FONT_HEAD, fontSize: 26, bold: true, color: TEXT_DARK, margin: 0 });

  const colW = 5.8;
  card(s, MARGIN, 1.75, colW, 4.9, { fill: AMBER_SOFT, shadow: false });
  s.addText("⚠ 已知限制", { x: MARGIN + 0.3, y: 1.95, w: colW - 0.6, h: 0.4, fontSize: 15, bold: true, color: "995200", fontFace: FONT_BODY, margin: 0 });
  const limits = [
    "全部数据为虚构模拟数据,不连接真实 Apple API",
    "仅覆盖面试邀请这一个场景,不代表所有跨应用任务",
    "执行进度为确定性脚本演示,非真实异步调用",
    "尚未进行真实用户测试,判断均为设计推论"
  ];
  s.addText(limits.map(t => ({ text: t, options: { bullet: { code: "2022", indent: 12 }, breakLine: true, paraSpaceAfter: 14 } })), {
    x: MARGIN + 0.3, y: 2.5, w: colW - 0.6, h: 3.9, fontSize: 12.5, color: "6B4A1E", fontFace: FONT_BODY, valign: "top", margin: 0
  });

  const x2 = MARGIN + colW + 0.2;
  card(s, x2, 1.75, colW, 4.9, { fill: ICE_SOFT, shadow: false });
  s.addText("🔍 下一步验证", { x: x2 + 0.3, y: 1.95, w: colW - 0.6, h: 0.4, fontSize: 15, bold: true, color: NAVY, fontFace: FONT_BODY, margin: 0 });
  const next = [
    "用户是否理解系统生成的任务计划",
    "用户能否发现 AI 提取错误,能否处理冲突与失败恢复",
    "用户是否信任批量确认,能否成功撤销操作",
    "用户是否认为该系统比手动切换 App 更简单"
  ];
  s.addText(next.map(t => ({ text: t, options: { bullet: { code: "2022", indent: 12 }, breakLine: true, paraSpaceAfter: 14 } })), {
    x: x2 + 0.3, y: 2.5, w: colW - 0.6, h: 3.9, fontSize: 12.5, color: NAVY, fontFace: FONT_BODY, valign: "top", margin: 0
  });

  pageNum(s, 15);
}

// ============================================================
// SLIDE 16 · 结语
// ============================================================
{
  const s = newSlide(NAVY);
  s.addText("目标任务空间", { x: MARGIN, y: 2.5, w: 10, h: 1.0, fontFace: FONT_HEAD, fontSize: 42, bold: true, color: WHITE, margin: 0 });
  s.addText("iOS 已经提供入口、局部辅助和预设自动化 —— 缺的是根据用户当前目标和上下文,\n动态组织并持续管理完整任务的统一体验。这正是本项目给出的答案。", {
    x: MARGIN, y: 3.5, w: 10.8, h: 1.1, fontFace: FONT_BODY, fontSize: 15, color: ICE, margin: 0, lineSpacingMultiple: 1.45
  });

  const links = [["案例研究页", "prototype/case-study.html"], ["可交互原型", "prototype/app.html"], ["低保真线框图", "prototype/wireframes.html"]];
  links.forEach((l, i) => {
    const y = 4.95 + i * 0.5;
    s.addShape("ellipse", { x: MARGIN, y: y + 0.03, w: 0.12, h: 0.12, fill: { color: AMBER }, line: { type: "none" } });
    s.addText(l[0] + "　", { x: MARGIN + 0.3, y: y - 0.12, w: 2.3, h: 0.4, fontSize: 13, bold: true, color: WHITE, fontFace: FONT_BODY, margin: 0 });
    s.addText(l[1], { x: MARGIN + 2.4, y: y - 0.12, w: 5, h: 0.4, fontSize: 12, color: "8A93B8", fontFace: FONT_BODY, margin: 0 });
  });

  pageNum(s, 16, true);
}

pres.writeFile({ fileName: "C:/Users/angel/ai-native-ios/slides/目标任务空间-案例研究-v2.pptx" }).then(() => {
  console.log("done");
});
