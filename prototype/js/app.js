// 交互原型逻辑。单一状态对象驱动全部屏幕(参照 design/state-model.md)。
// 不连接任何真实网络请求或 Apple API,全部为本地模拟数据(data.js)。

const state = {
  screen: "mail",
  history: [],
  overlay: null,       // null | 'suggestion' | 'confirmSend' | 'undo' | 'appPreview'
  overlayParam: null,
  editingFieldId: null,
  nudgeDate: false,
  task: buildInitialTask()
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findStep(id) {
  return state.task.steps.find(s => s.id === id);
}
function activeSteps() {
  return state.task.steps.filter(s => !state.task.removedStepIds.includes(s.id));
}
function findField(id) {
  return state.task.extractedInfo.find(f => f.id === id);
}

/* ===================== 导航 ===================== */
function goTo(screen, opts = {}) {
  if (!opts.replace) state.history.push(state.screen);
  state.screen = screen;
  state.overlay = null;
  state.overlayParam = null;
  render();
}
function goBack() {
  const prev = state.history.pop();
  if (prev) {
    state.screen = prev;
    state.overlay = null;
    render();
  }
}
function openOverlay(name, param) {
  state.overlay = name;
  state.overlayParam = param || null;
  render();
}
function closeOverlay() {
  state.overlay = null;
  state.overlayParam = null;
  render();
}
function resetDemo() {
  state.screen = "mail";
  state.history = [];
  state.overlay = null;
  state.overlayParam = null;
  state.editingFieldId = null;
  state.nudgeDate = false;
  state.task = buildInitialTask();
  render();
}

/* ===================== 邮件 / 建议 ===================== */
function showSuggestion() { openOverlay("suggestion"); }
function dismissSuggestion() { closeOverlay(); }
function quickAddOnly() {
  const step = findStep("create_event");
  step.status = "done";
  step.resultText = "已快速添加到日历(未生成完整任务计划)";
  state.task.quickAddOnly = true;
  closeOverlay();
  goTo("complete");
}
function startTaskPlan() {
  closeOverlay();
  goTo("extracting");
  window.setTimeout(() => {
    if (state.screen === "extracting") goTo("info_confirm", { replace: true });
  }, 850);
}

/* ===================== 信息确认(含流程 C) ===================== */
function editField(id) {
  state.editingFieldId = id;
  render();
  window.setTimeout(() => {
    const el = document.getElementById("field-input-" + id);
    if (el) { el.focus(); el.select && el.select(); }
  }, 0);
}
function updateFieldDraft(id, val) {
  findField(id).value = val;
}
function commitField(id) {
  const f = findField(id);
  f.confidence = "certain";
  state.editingFieldId = null;
  render();
}
function chooseDateOption(iso) {
  const f = findField("date");
  const opt = f.options.find(o => o.iso === iso);
  f.value = opt.label;
  f.confidence = "certain";
  state.task.dateResolved = true;
  state.nudgeDate = false;
  render();
}
function tryGenerate() {
  const dateField = findField("date");
  if (dateField.confidence !== "certain") {
    state.nudgeDate = true;
    render();
    const el = document.getElementById("date-field-card");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  goTo("plan");
}

/* ===================== 任务计划 ===================== */
function deleteStep(id) {
  if (!state.task.removedStepIds.includes(id)) state.task.removedStepIds.push(id);
  render();
}
function restoreStep(id) {
  state.task.removedStepIds = state.task.removedStepIds.filter(x => x !== id);
  render();
}
function moveStep(id, dir) {
  const steps = state.task.steps;
  const i = steps.findIndex(s => s.id === id);
  const j = i + dir;
  if (j < 0 || j >= steps.length) return;
  [steps[i], steps[j]] = [steps[j], steps[i]];
  render();
}
function toggleSource(id) {
  state.openSourceId = state.openSourceId === id ? null : id;
  render();
}

/* ===================== 批量确认 ===================== */
function toggleStepChecked(id) {
  const s = findStep(id);
  s.checked = s.checked === false ? true : false;
  render();
}
function confirmBatch() {
  activeSteps().forEach(s => {
    if (s.risk === "medium" && s.checked === false) {
      s.status = "skipped";
      s.resultText = "用户在批量确认时取消该步骤";
    }
  });
  goTo("executing");
}

/* ===================== 执行 ===================== */
function advanceExecution() {
  const next = activeSteps().find(s => s.status === "pending" || s.status === undefined);
  if (!next) return;
  next.status = "preparing";
  const dateVal = findField("date").value;
  const timeVal = findField("time").value;
  const addrVal = findField("address").value;

  switch (next.id) {
    case "check_conflict":
      state.task.conflict = EXISTING_EVENT;
      next.status = "waiting_confirmation";
      next.resultText = `与「${EXISTING_EVENT.title}」时间冲突`;
      render();
      goTo("conflict");
      return;
    case "create_event":
      next.status = "done";
      next.resultText = `已创建:${dateVal} ${timeVal} · ${addrVal}`;
      break;
    case "check_route":
      next.status = "done";
      next.resultText = "距离约 6.2 公里 · 预计车程 22 分钟(含步行)";
      break;
    case "set_departure_reminder":
      next.status = "done";
      next.resultText = "已设置:面试当天 09:53 出发提醒";
      break;
    case "find_portfolio":
      next.status = "failed";
      next.resultText = "找到 3 个候选文件,系统无法自动判定最新版本";
      render();
      goTo("failure_recovery");
      return;
    case "set_prep_reminder":
      next.status = "done";
      next.resultText = "已设置:前一晚 20:00 打包作品集提醒";
      break;
  }
  render();
}

/* ===================== 冲突(流程 B) ===================== */
function resolveConflict(option) {
  const step = findStep("check_conflict");
  if (option === "keep") {
    step.status = "done";
    step.resultText = "已选择保留两个日程(时间冲突已知悉)";
    goTo("executing");
  } else if (option === "adjust") {
    step.status = "done";
    step.resultText = `已调整「${EXISTING_EVENT.title}」的时间`;
    goTo("executing");
  } else if (option === "contact") {
    state.task.messageDraft = MESSAGE_DRAFT_TEMPLATE;
    goTo("message_draft");
  }
}
function updateDraft(val) {
  state.task.messageDraft = val;
}
function requestSendConfirm() {
  openOverlay("confirmSend");
}
function confirmSendMessage() {
  const step = findStep("check_conflict");
  step.status = "done";
  step.resultText = "已发送改期消息给 Alex Chen";
  closeOverlay();
  goTo("executing");
}

/* ===================== 失败恢复(流程 D) ===================== */
function reSearchPortfolio() {
  state.task._reSearchMsg = "已重新搜索,结果与之前相同(3 个候选文件)";
  render();
}
function deferPortfolio() {
  const s = findStep("find_portfolio");
  s.status = "skipped";
  s.resultText = "已设置稍后提醒,可稍后重试";
  goTo("executing");
}
function skipPortfolio() {
  const s = findStep("find_portfolio");
  s.status = "skipped";
  s.resultText = "已跳过,不影响其他步骤";
  goTo("executing");
}
function selectPortfolioFile(id) {
  const file = PORTFOLIO_CANDIDATES.find(f => f.id === id);
  state.task.selectedPortfolio = file;
  const s = findStep("find_portfolio");
  s.status = "done";
  s.resultText = `已选择:${file.name}`;
  goTo("executing");
}

/* ===================== 撤销(流程 E) ===================== */
function askUndo(stepId) { openOverlay("undo", stepId); }
function confirmUndo() {
  const s = findStep(state.overlayParam);
  s.status = "cancelled";
  s.resultText = (s.resultText || "") + "(已撤销)";
  closeOverlay();
  render();
}
function retryStep(stepId) {
  const s = findStep(stepId);
  s.status = "pending";
  s.resultText = "";
  goTo("executing");
}

/* ===================== App 预览(完成页快捷入口) ===================== */
function openAppPreview(type) { openOverlay("appPreview", type); }

/* ===================== 演示跳转脚本(左侧控制面板用) ===================== */
function jumpMail() { resetDemo(); }
function jumpInfoConfirm() {
  resetDemo();
  state.screen = "info_confirm";
  state.history = ["mail"];
  render();
}
function jumpPlan() {
  resetDemo();
  findField("date").confidence = "certain";
  state.task.dateResolved = true;
  state.screen = "plan";
  state.history = ["mail", "info_confirm"];
  render();
}
function jumpBatchConfirm() {
  jumpPlan();
  state.screen = "batch_confirm";
  state.history = ["mail", "info_confirm", "plan"];
  render();
}
function jumpConflict() {
  jumpBatchConfirm();
  confirmBatch();
  advanceExecution(); // 触发冲突
  state.history = ["mail", "info_confirm", "plan", "batch_confirm", "executing"];
  render();
}
function jumpFailure() {
  jumpBatchConfirm();
  confirmBatch();
  advanceExecution();              // check_conflict → 冲突
  resolveConflict("keep");         // 直接保留两个日程,继续往下
  advanceExecution();              // create_event
  advanceExecution();              // check_route
  advanceExecution();              // set_departure_reminder
  advanceExecution();              // find_portfolio → 失败
  state.history = ["mail", "info_confirm", "plan", "batch_confirm", "executing"];
  render();
}
function jumpComplete() {
  jumpFailure();
  selectPortfolioFile("f1");       // 手动选择推荐文件
  advanceExecution();              // set_prep_reminder
  state.screen = "complete";
  state.history = ["mail", "info_confirm", "plan", "batch_confirm", "executing"];
  render();
}
function jumpSystemSurfaces() {
  state.history.push(state.screen);
  state.screen = "system_surfaces";
  state.overlay = null;
  render();
}

/* ===================== 渲染:通用片段 ===================== */
function navBar(title, opts = {}) {
  const back = opts.noBack
    ? `<span class="nav-spacer"></span>`
    : `<button class="nav-back" onclick="goBack()">‹ 返回</button>`;
  const action = opts.action ? `<button class="nav-action" onclick="${opts.actionFn}">${opts.action}</button>` : `<span class="nav-spacer"></span>`;
  return `<div class="nav-bar">${back}<div class="nav-title">${title}</div>${action}</div>`;
}
function riskPill(risk) {
  const map = { low: ["低风险", "pill-low"], medium: ["中风险", "pill-medium"], high: ["高风险", "pill-high"] };
  const [t, c] = map[risk];
  return `<span class="pill ${c}">${t}</span>`;
}
function statusRow(step) {
  return `<span class="status-dot ${step.status}"></span><span class="status-label ${step.status}">${STATUS_TEXT[step.status] || "待处理"}</span>`;
}

/* ===================== 渲染:各屏幕 ===================== */
function renderMail() {
  let body = EMAIL.bodyLines.map(l => `<p>${escapeHtml(l)}</p>`).join("");
  body = body
    .replace("next Tuesday", "<mark>next Tuesday</mark>")
    .replace("10:30 a.m.", "<mark>10:30 a.m.</mark>")
    .replace("555 Burrard Street", "<mark>555 Burrard Street</mark>")
    .replace("15 minutes early", "<mark>15 minutes early</mark>")
    .replace("portfolio", "<mark>portfolio</mark>")
    .replace("contact Alex", "contact <mark>Alex</mark>");

  return `
    ${navBar("邮件", { noBack: true })}
    <div class="email-header">
      <div class="email-from-row">
        <div class="email-avatar">AC</div>
        <div>
          <div class="email-from-name">${EMAIL.from}</div>
          <div class="email-from-sub">${EMAIL.fromSub} · ${EMAIL.receivedAt}</div>
        </div>
      </div>
      <div class="email-subject">${EMAIL.subject}</div>
    </div>
    <div class="email-body">${body}</div>
    <div class="suggestion-chip" onclick="showSuggestion()" role="button">
      <div class="suggestion-icon">✨</div>
      <div>
        <div class="suggestion-title">这封邮件包含一个需要准备的面试事件</div>
        <div class="suggestion-sub">系统识别到时间、地点与准备要求 · 来自 Apple Intelligence 的系统级建议</div>
        <span class="link-inline">查看系统建议 →</span>
      </div>
    </div>
    <div class="empty-note">这是本项目的模拟邮件内容,用于演示系统级 AI 建议的触发方式。</div>
  `;
}

function renderOverlaySuggestion() {
  return `
    <div class="overlay-backdrop" onclick="if(event.target===this) dismissSuggestion()">
      <div class="overlay-sheet">
        <div class="grabber"></div>
        <div class="sheet-title">这封邮件包含一个需要准备的面试事件</div>
        <div class="sheet-body">系统从邮件中识别到:下周二上午 10:30 · 555 Burrard Street · 建议提前 15 分钟 · 需携带作品集。</div>
        <div class="chip-row">
          <span class="chip active">面试日期待确认</span>
          <span class="chip">地点已识别</span>
          <span class="chip">需携带作品集</span>
        </div>
        <div class="btn-block-group">
          <button class="btn btn-primary" onclick="startTaskPlan()">创建任务计划</button>
          <button class="btn btn-secondary" onclick="quickAddOnly()">仅添加到日历</button>
          <button class="btn btn-ghost" onclick="dismissSuggestion()">暂不处理</button>
        </div>
      </div>
    </div>
  `;
}

function renderExtracting() {
  return `
    ${navBar("正在分析", { noBack: true })}
    <div class="screen-pad" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:120px;">
      <div style="width:46px;height:46px;border-radius:50%;border:3px solid var(--bg-sunken);border-top-color:var(--color-blue);animation:spin 0.9s linear infinite;"></div>
      <p style="margin-top:20px;color:var(--text-secondary);font-size:14px;">系统正在分析邮件内容…</p>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;
}

function renderInfoConfirm() {
  const rows = state.task.extractedInfo.map(f => {
    const sourceOpen = state.openSourceId === f.id;
    const editing = state.editingFieldId === f.id;
    const ambiguous = f.confidence === "ambiguous";
    let valueBlock;
    if (editing) {
      valueBlock = `
        <input id="field-input-${f.id}" class="field-value" style="width:100%;border:1px solid var(--border-strong);border-radius:8px;padding:6px 8px;font:inherit;"
          value="${escapeHtml(f.value)}" oninput="updateFieldDraft('${f.id}', this.value)" onkeydown="if(event.key==='Enter') commitField('${f.id}')" />
        <button class="btn btn-primary btn-sm" style="margin-top:6px;" onclick="commitField('${f.id}')">完成</button>
      `;
    } else {
      valueBlock = `<div class="field-value">${escapeHtml(f.value)}</div>`;
    }
    return `
      <div class="card" id="${f.id === 'date' ? 'date-field-card' : ''}">
        <div class="card-row">
          <div style="flex:1;">
            <div class="field-label">${f.label}</div>
            ${valueBlock}
            ${ambiguous ? `
              <div class="ambiguous-flag">⚠ 系统无法完全确定,请确认</div>
              <div class="chip-row">
                ${f.options.map(o => `<span class="chip ${f.value === o.label ? 'active' : ''}" onclick="chooseDateOption('${o.iso}')">${o.label}</span>`).join("")}
              </div>
            ` : ""}
            <div>
              <button class="source-toggle" onclick="toggleSource('${f.id}')">${sourceOpen ? "隐藏来源" : "查看来源"}</button>
            </div>
            ${sourceOpen ? `<div class="source-tag">${f.source}</div>` : ""}
          </div>
          ${f.editable ? `<button class="icon-btn" onclick="editField('${f.id}')">✎</button>` : ""}
        </div>
      </div>
    `;
  }).join("");

  return `
    ${navBar("信息确认")}
    <div class="screen-pad">
      <div class="banner banner-info"><span class="icon">ℹ️</span><span>以下信息由系统从邮件中提取,你可以查看每条信息的来源并进行修改。</span></div>
      <div class="section-title">提取结果</div>
      ${rows}
      ${state.nudgeDate ? `<div class="banner banner-warning" style="margin-top:12px;"><span class="icon">⚠️</span><span>面试日期尚未确认,请先在上方选择正确的日期。</span></div>` : ""}
      <div class="btn-block-group">
        <button class="btn btn-primary" onclick="tryGenerate()">生成任务计划</button>
      </div>
    </div>
  `;
}

function renderPlan() {
  const removed = state.task.steps.filter(s => state.task.removedStepIds.includes(s.id));
  const rows = activeSteps().map((s, idx, arr) => {
    const sourceOpen = state.openSourceId === s.id;
    return `
      <div class="step-item">
        <span class="status-dot pending" style="margin-top:6px;"></span>
        <div class="step-main">
          <div class="step-title">${s.title}</div>
          <div class="step-meta">
            <span class="pill pill-neutral">${s.app}</span>
            ${riskPill(s.risk)}
            ${s.needsConfirmation ? `<span class="pill pill-neutral">需确认</span>` : `<span class="pill pill-neutral">可自动准备</span>`}
          </div>
          <button class="source-toggle" onclick="toggleSource('${s.id}')">${sourceOpen ? "隐藏来源" : "查看来源"}</button>
          ${sourceOpen ? `<div class="source-tag">${s.source}</div>` : ""}
        </div>
        <div class="step-actions">
          <button class="icon-btn" onclick="moveStep('${s.id}', -1)" ${idx === 0 ? "disabled style='opacity:.3'" : ""}>↑</button>
          <button class="icon-btn" onclick="moveStep('${s.id}', 1)" ${idx === arr.length - 1 ? "disabled style='opacity:.3'" : ""}>↓</button>
          <button class="icon-btn" onclick="deleteStep('${s.id}')">✕</button>
        </div>
      </div>
    `;
  }).join("");

  const removedBar = removed.length ? `
    <div class="banner banner-warning" style="margin-top:12px;">
      <span class="icon">🗑</span>
      <span>已删除 ${removed.length} 项 ·
        ${removed.map(s => `<button class="link-inline" onclick="restoreStep('${s.id}')">恢复「${s.title}」</button>`).join(" ")}
      </span>
    </div>` : "";

  return `
    ${navBar("任务计划")}
    <div class="screen-pad">
      <div class="banner banner-info"><span class="icon">🗂</span><span>系统根据提取的信息生成了以下步骤,你可以删除或调整顺序。</span></div>
      <div class="card" style="margin-top:12px;">${rows}</div>
      ${removedBar}
      <div class="btn-block-group">
        <button class="btn btn-primary" onclick="goTo('batch_confirm')">继续确认</button>
      </div>
    </div>
  `;
}

function renderBatchConfirm() {
  const steps = activeSteps();
  steps.forEach(s => { if (s.risk === "medium" && s.checked === undefined) s.checked = true; });
  const low = steps.filter(s => s.risk === "low");
  const medium = steps.filter(s => s.risk === "medium");

  const lowRows = low.map(s => `
    <div class="card-row">
      <span class="status-dot pending" style="margin-top:5px;"></span>
      <div style="flex:1;">
        <div class="step-title">${s.title}</div>
        <div class="step-meta"><span class="pill pill-neutral">${s.app}</span>${riskPill(s.risk)}</div>
      </div>
    </div>`).join("");

  const mediumRows = medium.map(s => `
    <div class="card-row">
      <label style="display:flex;gap:10px;align-items:flex-start;width:100%;cursor:pointer;">
        <input type="checkbox" ${s.checked !== false ? "checked" : ""} onchange="toggleStepChecked('${s.id}')" style="margin-top:4px;width:18px;height:18px;" />
        <div style="flex:1;">
          <div class="step-title">${s.title}</div>
          <div class="step-meta"><span class="pill pill-neutral">${s.app}</span>${riskPill(s.risk)}</div>
        </div>
      </label>
    </div>`).join("");

  return `
    ${navBar("批量确认")}
    <div class="screen-pad">
      <div class="section-title">可以直接准备的操作</div>
      <div class="card">${lowRows}</div>
      <div class="section-title">需要确认的操作</div>
      <div class="card">${mediumRows}</div>
      <div class="banner banner-warning" style="margin-top:12px;">
        <span class="icon">🔒</span>
        <span>发送消息等高风险操作不会出现在批量确认中,系统会在需要时单独请求你的确认。</span>
      </div>
      <div class="btn-block-group">
        <button class="btn btn-primary" onclick="confirmBatch()">确认并开始执行</button>
      </div>
    </div>
  `;
}

function renderExecuting() {
  const steps = activeSteps();
  const total = steps.length;
  const resolved = steps.filter(s => ["done", "cancelled", "skipped"].includes(s.status)).length;
  const failed = steps.some(s => s.status === "failed");
  const waiting = steps.some(s => s.status === "waiting_confirmation");
  const pct = Math.round((resolved / total) * 100);
  const allResolved = resolved === total;

  const rows = steps.map(s => `
    <div class="card-row">
      ${statusRow(s)}
      <div style="flex:1;">
        <div class="step-title">${s.title}</div>
        <div class="step-meta"><span class="pill pill-neutral">${s.app}</span>${riskPill(s.risk)}</div>
        ${s.resultText ? `<div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px;">${s.resultText}</div>` : ""}
        ${s.status === "failed" ? `<button class="link-inline" style="margin-top:4px;" onclick="goTo('failure_recovery')">查看详情</button>` : ""}
      </div>
    </div>`).join("");

  let cta = "";
  if (allResolved) {
    cta = `<button class="btn btn-primary" onclick="goTo('complete')">查看完成状态</button>`;
  } else if (failed) {
    cta = `<button class="btn btn-secondary" onclick="goTo('failure_recovery')">处理失败步骤</button>`;
  } else if (waiting) {
    cta = `<button class="btn btn-secondary" onclick="goTo('conflict')">处理待确认事项</button>`;
  } else {
    cta = `<button class="btn btn-primary" onclick="advanceExecution()">推进下一步</button>`;
  }

  return `
    ${navBar("任务执行进度")}
    <div class="screen-pad">
      <div class="section-title">整体进度</div>
      <div class="progress-track"><div class="progress-fill ${failed ? 'failed-color' : allResolved ? 'done-color' : ''}" style="width:${pct}%"></div></div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:6px;">${computeOverallStatus(state.task)} · ${resolved}/${total} 步骤已处理</div>
      <div class="card">${rows}</div>
      <div class="btn-block-group">${cta}</div>
    </div>
  `;
}

function renderConflict() {
  const c = state.task.conflict || EXISTING_EVENT;
  const dateVal = findField("date").value;
  const timeVal = findField("time").value;
  return `
    ${navBar("日程冲突")}
    <div class="screen-pad">
      <div class="banner banner-warning"><span class="icon">⚠️</span><span>新的面试事件与你现有的日程时间重叠,系统未自动创建,等待你的选择。</span></div>
      <div class="section-title">现有日程</div>
      <div class="card"><div class="card-row"><div><div class="step-title">${c.title}</div><div class="step-meta">${c.time} · ${c.calendar}</div></div></div></div>
      <div class="section-title">新面试事件</div>
      <div class="card"><div class="card-row"><div><div class="step-title">Product Designer 面试</div><div class="step-meta">${dateVal} ${timeVal} · 555 Burrard Street</div></div></div></div>
      <div class="section-title">选择处理方式</div>
      <div class="btn-block-group">
        <button class="btn btn-secondary" onclick="resolveConflict('keep')">保留两个事件</button>
        <button class="btn btn-secondary" onclick="resolveConflict('adjust')">调整现有日程</button>
        <button class="btn btn-primary" onclick="resolveConflict('contact')">联系 Alex 改期</button>
      </div>
    </div>
  `;
}

function renderMessageDraft() {
  const draft = state.task.messageDraft || MESSAGE_DRAFT_TEMPLATE;
  return `
    ${navBar("改期消息")}
    <div class="screen-pad">
      <div class="banner banner-danger"><span class="icon">🔒</span><span>发送消息是高风险操作,需要你单独确认后才会真正发送。</span></div>
      <div class="section-title">收件人</div>
      <div class="card"><div class="card-row"><div class="email-avatar">AC</div><div><div class="step-title">Alex Chen</div><div class="step-meta">${EMAIL.fromSub}</div></div></div></div>
      <div class="section-title">系统生成的消息草稿(可编辑)</div>
      <textarea style="width:100%;min-height:120px;border:1px solid var(--border-hairline);border-radius:12px;padding:12px;font:inherit;font-size:14px;line-height:1.6;background:var(--bg-elevated);"
        oninput="updateDraft(this.value)">${escapeHtml(draft)}</textarea>
      <div class="btn-block-group">
        <button class="btn btn-primary" onclick="requestSendConfirm()">发送</button>
        <button class="btn btn-secondary" onclick="goBack()">取消</button>
      </div>
    </div>
  `;
}

function renderOverlayConfirmSend() {
  return `
    <div class="overlay-backdrop">
      <div class="overlay-sheet">
        <div class="grabber"></div>
        <div class="sheet-title">确认发送这条消息?</div>
        <div class="sheet-body">收件人:Alex Chen(${EMAIL.fromSub})<br/>系统不会代替你发送任何消息,除非你在这里明确确认。</div>
        <div class="btn-block-group">
          <button class="btn btn-danger" onclick="confirmSendMessage()">确认发送</button>
          <button class="btn btn-secondary" onclick="closeOverlay()">取消</button>
        </div>
      </div>
    </div>
  `;
}

function renderFileFinder() {
  const rows = PORTFOLIO_CANDIDATES.map(f => `
    <div class="card-row" style="cursor:pointer;" onclick="selectPortfolioFile('${f.id}')">
      <div class="file-thumb">📄</div>
      <div style="flex:1;">
        <div class="file-name">${f.name} ${f.recommended ? `<span class="pill pill-low">推荐</span>` : ""}</div>
        <div class="file-meta">${f.location}</div>
        <div class="file-meta">最近修改:${f.modified}</div>
      </div>
      <span class="link-inline">选择</span>
    </div>`).join("");

  return `
    ${navBar("选择作品集文件")}
    <div class="screen-pad">
      <div class="banner banner-info"><span class="icon">🔎</span><span>系统在「文件」App 中找到以下候选,请确认要使用的版本。</span></div>
      <div class="card" style="margin-top:12px;">${rows}</div>
    </div>
  `;
}

function renderFailureRecovery() {
  const s = findStep("find_portfolio");
  return `
    ${navBar("步骤失败")}
    <div class="screen-pad">
      <div class="banner banner-danger"><span class="icon">✕</span><span><b>${s.title}</b> 未能自动完成:${s.resultText}</span></div>
      ${state.task._reSearchMsg ? `<div class="banner banner-info" style="margin-top:10px;"><span class="icon">ℹ️</span><span>${state.task._reSearchMsg}</span></div>` : ""}
      <div class="section-title">你可以</div>
      <div class="btn-block-group">
        <button class="btn btn-secondary" onclick="reSearchPortfolio()">重新搜索</button>
        <button class="btn btn-primary" onclick="goTo('file_finder')">手动选择文件</button>
        <button class="btn btn-secondary" onclick="deferPortfolio()">稍后提醒</button>
        <button class="btn btn-ghost" onclick="skipPortfolio()">跳过</button>
      </div>
    </div>
  `;
}

function renderComplete() {
  const dateVal = findField("date").value;
  const timeVal = findField("time").value;
  const addrVal = findField("address").value;
  const cancelledCount = state.task.steps.filter(s => s.status === "cancelled").length;

  const rows = activeSteps().map(s => `
    <div class="card-row">
      ${statusRow(s)}
      <div style="flex:1;">
        <div class="step-title">${s.title}</div>
        ${s.resultText ? `<div style="font-size:12.5px;color:var(--text-secondary);margin-top:2px;">${s.resultText}</div>` : ""}
      </div>
      ${s.status === "done" ? `<button class="source-toggle" onclick="askUndo('${s.id}')">撤销</button>` : ""}
      ${s.status === "skipped" ? `<button class="source-toggle" onclick="retryStep('${s.id}')">重试</button>` : ""}
    </div>`).join("");

  return `
    ${navBar("任务完成", { noBack: true })}
    <div class="screen-pad">
      <div class="banner banner-success"><span class="icon">✅</span><span>面试准备任务已处理完毕${cancelledCount ? `(${cancelledCount} 项操作已撤销)` : ""}。</span></div>
      <div class="section-title">面试信息</div>
      <div class="card">
        <div class="card-row"><div><div class="field-label">日期时间</div><div class="field-value">${dateVal} ${timeVal}</div></div></div>
        <div class="card-row"><div><div class="field-label">地点</div><div class="field-value">${addrVal}</div></div></div>
        <div class="card-row"><div><div class="field-label">作品集</div><div class="field-value">${state.task.selectedPortfolio ? state.task.selectedPortfolio.name : "未选择"}</div></div></div>
      </div>
      <div class="section-title">快捷入口(模拟)</div>
      <div class="btn-row">
        <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="openAppPreview('calendar')">打开日历</button>
        <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="openAppPreview('route')">查看路线</button>
        <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="openAppPreview('file')">查看文件</button>
      </div>
      <div class="section-title">任务状态明细</div>
      <div class="card">${rows}</div>
      <div class="btn-block-group">
        <button class="btn btn-ghost" onclick="resetDemo()">重新开始演示</button>
      </div>
    </div>
  `;
}

function renderOverlayUndo() {
  const s = findStep(state.overlayParam);
  return `
    <div class="overlay-backdrop">
      <div class="overlay-sheet">
        <div class="grabber"></div>
        <div class="sheet-title">撤销「${s.title}」?</div>
        <div class="sheet-body">${s.id === "create_event" ? "将删除已创建的日历事件,不影响其他步骤。" : "将撤销该操作的结果,不影响其他步骤。"}</div>
        <div class="btn-block-group">
          <button class="btn btn-danger" onclick="confirmUndo()">确认撤销</button>
          <button class="btn btn-secondary" onclick="closeOverlay()">取消</button>
        </div>
      </div>
    </div>
  `;
}

function renderOverlayAppPreview() {
  const type = state.overlayParam;
  const dateVal = findField("date").value;
  const timeVal = findField("time").value;
  const addrVal = findField("address").value;
  let title, body;
  if (type === "calendar") { title = "日历 · 事件详情(模拟)"; body = `Product Designer 面试<br/>${dateVal} ${timeVal}<br/>${addrVal}`; }
  else if (type === "route") { title = "地图 · 路线(模拟)"; body = `前往 ${addrVal}<br/>距离约 6.2 公里 · 预计车程 22 分钟`; }
  else { title = "文件 · 作品集(模拟)"; body = state.task.selectedPortfolio ? `${state.task.selectedPortfolio.name}<br/>${state.task.selectedPortfolio.location}` : "尚未选择文件"; }
  return `
    <div class="overlay-backdrop">
      <div class="overlay-sheet">
        <div class="grabber"></div>
        <div class="sheet-title">${title}</div>
        <div class="sheet-body">${body}</div>
        <div class="empty-note">此预览为原型模拟界面,不代表真实 App 的完整功能。</div>
        <div class="btn-block-group"><button class="btn btn-secondary" onclick="closeOverlay()">关闭</button></div>
      </div>
    </div>
  `;
}

function renderSystemSurfaces() {
  const s = computeOverallStatus(state.task);
  const nextStep = activeSteps().find(x => x.status === "pending") || activeSteps().find(x => x.status === "waiting_confirmation");
  return `
    ${navBar("系统级持续状态")}
    <div class="screen-pad">
      <div class="banner banner-info"><span class="icon">🔁</span><span>同一个任务状态会以不同形式持续出现在系统各处,而不是分别做成 5 个独立界面。</span></div>
      <div class="system-surface-grid" style="margin-top:12px;">
        <div class="surface-card">
          <h4>锁屏 / 实时活动</h4>
          <div class="lockscreen-mini">
            <div class="time">9:41</div>
            <div class="activity">🗂 面试准备任务<br/>${s} · ${nextStep ? "下一步:" + nextStep.title : "全部完成"}</div>
          </div>
        </div>
        <div class="surface-card">
          <h4>主屏幕小组件</h4>
          <div class="widget-mini">
            <div class="wtitle">面试准备任务</div>
            <div class="wprog"><i style="width:${Math.round((activeSteps().filter(x=>['done','cancelled','skipped'].includes(x.status)).length/activeSteps().length)*100)}%"></i></div>
            <div style="font-size:11px;">${s}</div>
          </div>
        </div>
        <div class="surface-card">
          <h4>通知</h4>
          <div class="notif-mini">
            <div class="ntitle">面试准备任务</div>
            <div class="nbody">${nextStep ? nextStep.title + " 需要你的确认" : "任务已完成"}</div>
          </div>
        </div>
        <div class="surface-card">
          <h4>Siri / 系统搜索</h4>
          <div class="siri-mini">
            <div class="sq">"我的面试准备得怎么样了？"</div>
            <div class="sa">${s} · ${nextStep ? "下一步是" + nextStep.title : "所有步骤已处理"}</div>
          </div>
        </div>
      </div>
      <div class="empty-note">以上四处均读取同一个任务状态对象,不是四套独立界面。</div>
    </div>
  `;
}

/* ===================== 渲染:主分发 ===================== */
const SCREEN_RENDERERS = {
  mail: renderMail,
  extracting: renderExtracting,
  info_confirm: renderInfoConfirm,
  plan: renderPlan,
  batch_confirm: renderBatchConfirm,
  executing: renderExecuting,
  conflict: renderConflict,
  message_draft: renderMessageDraft,
  file_finder: renderFileFinder,
  failure_recovery: renderFailureRecovery,
  complete: renderComplete,
  system_surfaces: renderSystemSurfaces
};
const OVERLAY_RENDERERS = {
  suggestion: renderOverlaySuggestion,
  confirmSend: renderOverlayConfirmSend,
  undo: renderOverlayUndo,
  appPreview: renderOverlayAppPreview
};

function render() {
  const screenRoot = document.getElementById("screenRoot");
  const overlayRoot = document.getElementById("overlayRoot");
  const fn = SCREEN_RENDERERS[state.screen] || renderMail;
  screenRoot.innerHTML = fn();
  overlayRoot.innerHTML = state.overlay ? (OVERLAY_RENDERERS[state.overlay] || (() => ""))() : "";
  screenRoot.scrollTop = state.overlay ? screenRoot.scrollTop : screenRoot.scrollTop;

  document.querySelectorAll(".control-btn[data-screen]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.screen === state.screen);
  });
  const readout = document.getElementById("stateReadout");
  if (readout) {
    readout.innerHTML = `
      <b>当前屏幕</b>:${state.screen}<br/>
      <b>整体状态</b>:${computeOverallStatus(state.task)}<br/>
      <b>历史栈深度</b>:${state.history.length}
    `;
  }
}

document.addEventListener("DOMContentLoaded", render);
