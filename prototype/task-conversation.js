/* One task lifecycle owns planning, conversation, execution and activity.
 * The existing mother prototype remains the entry point for Mail and WhatsApp.
 * All task operations below are local, deterministic prototype simulations.
 */
(() => {
  'use strict';
  const legacyRender = render;
  const legacyIsland = island;
  const legacyClose = closePlanningV2;
  const legacyLanguage = setUiLanguage;
  const legacyIslandClick = isl.onclick;
  const timers = new Map();
  const parameters = new URLSearchParams(location.search);
  const store = window.TaskStore = { activeTaskId: 'interview', viewedTaskId: 'interview', panelMode: 'collapsed', tasks: [] };
  const recommendation = '1285 W Pender Street';
  const words = (zh, en) => uiLanguage === 'en' ? en : zh;
  const clone = value => structuredClone(value);
  let panel = null;
  let composer = null;
  const screenHost = document.querySelector('.screen');
  const nativeKeyboard = navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches;
  const legacyShowKeyboard = showSimulatedKeyboard;
  const legacyHideKeyboard = hideSimulatedKeyboard;
  let keyboardHeight = 0, keyboardFrame = 0, panelResizeTimer = 0;
  let resizeComposer = null;
  let aux = null;
  let sourceIndex = null;
  let keyboardVoice = null;
  let taskSequence = 0;

  const glyphPaths = {
    calendar: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4m8-4v4M4 10h16M8 14h3m-3 3h6"/>',
    walk: '<circle cx="14" cy="4" r="2"/><path d="m11 9 3-2 3 4 3 1M11 9l-2 5 4 2 2 5M11 9l-4 3M9 14l-3 7"/>',
    bike: '<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><circle cx="16" cy="4" r="1.5"/><path d="m5 17 5-9 4 4 5 5M10 8l-2-2m6 6-3 5H5m9-5 2-4 3 1"/>',
    transit: '<rect x="5" y="3" width="14" height="16" rx="4"/><path d="M5 10h14M8 19l-1 2m9-2 1 2M8 6h8"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>',
    drive: '<path d="m5 9 2-5h10l2 5M4 9h16v10H4zM4 19v2m16-2v2M4 12h16"/><circle cx="7" cy="16" r="1"/><circle cx="17" cy="16" r="1"/>',
    bell: '<path d="M6 17h12l-2-3V9a4 4 0 0 0-8 0v5l-2 3m4 3h4"/>',
    note: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/>',
    map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0m-6 6v4m-3 0h6"/>',
    send: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
  };
  const icon = key => '<span class="task-glyph" aria-hidden="true"><svg viewBox="0 0 24 24">' + (glyphPaths[key] || glyphPaths.note) + '</svg></span>';
  const clock = value => { const total = (value + 1440) % 1440; return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0'); };
  const minutes = value => Number(value.split(':')[0]) * 60 + Number(value.split(':')[1]);
  const modeLabel = key => ({ walk: words('步行', 'Walk'), bike: words('骑行', 'Cycle'), transit: words('公交', 'Transit'), drive: words('驾车', 'Drive') }[key]);
  const scopeLabel = key => ({ interview: words('面试', 'Interview'), commute: words('通勤', 'Commute'), reminder: words('提醒', 'Reminders'), preparation: words('准备事项', 'Preparation') }[key] || '');
  const current = () => store.tasks.find(task => task.id === store.viewedTaskId);
  const primary = () => store.tasks.find(task => task.id === 'interview');
  const needsDecision = task => ['conflict', 'origin', 'review', 'draft', 'paused'].includes(task.phase);
  const isRunning = task => ['planning', 'routing', 'reminder-planning', 'executing'].includes(task.phase);
  const isVisible = task => panel && !panel.hidden && panel.dataset.taskId === task.id && !aux;
  const dateLabel = plan => {
    const [, month, day] = plan.date.split('-').map(Number);
    return uiLanguage === 'en' ? new Date(plan.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : month + '月' + day + '日';
  };
  function derive(plan) {
    const duration = { walk: 58, bike: 28, transit: 32, drive: 18 }[plan.mode];
    const arrive = minutes(plan.time) - plan.arrivalLead - plan.buffer;
    plan.route = { duration, arrival: clock(arrive), departure: clock(arrive - duration) };
    plan.reminderTime = clock(arrive - duration - plan.reminderLead);
    return plan;
  }
  function planFromLegacy() {
    const date = facts.dateTime.match(/(\d{1,2})月(\d{1,2})日/);
    return derive({ date: '2026-' + String(date ? date[1] : 7).padStart(2, '0') + '-' + String(date ? date[2] : 28).padStart(2, '0'), time: eventTime(), address: facts.address || '', origin: recommendation, mode: mode || 'transit', preparation: facts.preparation || '携带作品集', arrivalLead: 15, buffer: 8, reminderLead: reminderLead || 30, calendar: calendarEnabled, travel: prefs.travel, reminders: prefs.reminders });
  }
  function planningSteps() {
    return [
      { id: 'mail', app: 'Mail', zh: '读取邀请信息', en: 'Read the invitation', status: 'waiting', access: 'Read' },
      { id: 'calendar', app: 'Calendar', zh: '检查日程冲突', en: 'Check for conflicts', status: 'waiting', access: 'Read' },
      { id: 'maps', app: 'Maps', zh: '计算通勤安排', en: 'Plan the commute', status: 'waiting', access: 'Read' },
      { id: 'reminders', app: 'Reminders', zh: '生成提醒草稿', en: 'Prepare reminder drafts', status: 'waiting', access: 'Draft' },
    ];
  }
  function ensurePrimary(phase = 'review') {
    if (primary()) return primary();
    const task = { id: 'interview', kind: 'interview', title: ['面试安排', 'Interview plan'], phase, plan: planFromLegacy(), steps: planningSteps(), currentStep: 0, context: [], conversationDraft: '', conversation: [], feedback: null, revision: 1, confirmedSnapshot: null, results: [], routeExpanded: false, routeStepCount: [3, 5, 7].includes(Number(parameters.get('routeSteps'))) ? Number(parameters.get('routeSteps')) : 3, conflictAccepted: false, returnAfterConflict: 'origin', sourcePermissions: {}, notificationEnabled: true };
    if (['review', 'complete'].includes(phase)) { task.steps.forEach(step => step.status = 'complete'); task.conflictAccepted = true; }
    if (phase === 'origin') { task.steps[0].status = 'complete'; task.steps[1].status = 'complete'; task.steps[2].status = 'needs-input'; task.currentStep = 2; }
    store.tasks.push(task);
    return task;
  }
  function ensureGathering() {
    let task = store.tasks.find(item => item.id === 'gathering');
    if (!task) {
      task = { id: 'gathering', kind: 'gathering', title: ['Weekend Dinner 聚餐', 'Weekend Dinner'], phase: 'review', plan: clone(gathering), steps: [], currentStep: 0, context: [], conversationDraft: '', conversation: [], feedback: null, revision: 1, confirmedSnapshot: null, results: [], notificationEnabled: true };
      store.tasks.push(task);
    }
    return task;
  }
  function syncLegacy(task) {
    if (!task || task.kind !== 'interview') return;
    const plan = task.plan;
    facts.dateTime = plan.date.slice(5, 7).replace(/^0/, '') + '月' + plan.date.slice(8).replace(/^0/, '') + '日 ' + plan.time;
    facts.address = plan.address; facts.preparation = plan.preparation;
    origin = 'home'; mode = plan.mode; reminderLead = plan.reminderLead;
    departureOverride = plan.route.departure; buffer = plan.buffer;
    prefs.travel = plan.travel; prefs.reminders = plan.reminders; calendarEnabled = plan.calendar;
    completedItems = task.results.map(result => result.id);
    activeTask = task.phase !== 'stopped';
  }
  const stateFor = task => task.kind === 'gathering' ? (task.phase === 'executing' ? 'gatheringExecuting' : task.phase === 'complete' ? 'gatheringComplete' : 'gatheringConfirm') : ({ planning: 'processing', conflict: 'action', origin: 'commute', routing: 'commuteCalculating', 'reminder-planning': 'finishing', review: 'plan', executing: 'executing', complete: 'task', paused: 'paused', draft: 'options', stopped: 'stopped' }[task.phase] || 'processing');
  function feedback(task, zh, en) { task.feedback = [zh, en]; }
  function statusLabel(task) {
    if (task.phase === 'conflict') return words('日程有冲突', 'Schedule conflict');
    if (task.phase === 'origin') return words('通勤安排', 'Commute plan');
    if (task.phase === 'review') return words('安排已整理', 'Plan ready');
    if (task.phase === 'complete') return words('已完成', 'Completed');
    if (task.phase === 'stopped') return words('已停止', 'Stopped');
    if (task.phase === 'paused') return words('稍后处理', 'On hold');
    if (task.phase === 'draft') return words('改期草稿', 'Reschedule draft');
    const step = task.steps[task.currentStep];
    return step ? words(step.zh, step.en) : words('正在整理', 'Organizing');
  }
  function updateIsland() {
    const task = current() || primary();
    if (!task) return;
    const tasks = store.tasks.filter(item => item.phase !== 'stopped');
    const waiting = tasks.filter(needsDecision).length;
    const running = tasks.filter(isRunning).length;
    const type = waiting ? 'action' : running ? 'progress' : 'notice';
    const message = tasks.length > 1 ? words(tasks.length + ' 个任务', tasks.length + ' tasks') : statusLabel(task);
    const count = tasks.length > 1 ? (waiting ? words(waiting + ' 个需要决定', waiting + ' need a decision') : running ? words(running + ' 个进行中', running + ' running') : words('已完成', 'Completed')) : needsDecision(task) ? words('等待确认', 'Your decision') : isRunning(task) ? (task.currentStep + 1) + ' / ' + task.steps.length : task.kind === 'interview' && task.phase === 'complete' ? task.plan.route.departure + words(' 出发', ' departure') : '';
    legacyIsland(type, message, count);
    isl.classList.add('task-island');
    isl.querySelector('.island-stop-v6')?.classList.toggle('is-visible', isRunning(task));
    isl.setAttribute('aria-label', message + ' · ' + count);
    isl.setAttribute('aria-expanded', String(!!panel && !panel.hidden));
  }
  isl.addEventListener('click', event => {
    const stop = event.target.closest('.task-island .island-stop-v6');
    if (!stop) return;
    const task = current() || primary();
    if (!task || !isRunning(task)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    show(task, 'stop');
  }, true);
  function cancelTimer(task) { clearTimeout(timers.get(task.id)); timers.delete(task.id); }
  function runStep(task, index, after) {
    cancelTimer(task);
    task.currentStep = index;
    const step = task.steps[index];
    step.status = 'running'; step.startedAt = performance.now(); step.visibleSince = isVisible(task) ? step.startedAt : null;
    refresh(task);
    const tick = () => {
      if (step.status !== 'running' || task.phase === 'stopped') return;
      const wait = step.visibleSince !== null && isVisible(task) ? 1200 - (performance.now() - step.visibleSince) : 0;
      if (wait > 0) { timers.set(task.id, setTimeout(tick, wait + 5)); return; }
      step.status = 'complete';
      if (task.phase === 'executing') task.results.push({ id: step.id, app: step.app, completedAt: Date.now(), revision: task.confirmedSnapshot.revision });
      if (task.stopAfterCurrent) { task.phase = 'stopped'; task.stopAfterCurrent = false; refresh(task); return; }
      after();
      refresh(task);
    };
    timers.set(task.id, setTimeout(tick, isVisible(task) ? 1250 : 750));
  }
  function conflict(plan) {
    return plan.date === '2026-07-28' && minutes(plan.time) < 660 && minutes(plan.time) + 60 > 600;
  }
  function startPlanning(task) {
    cancelTimer(task); task.plan = planFromLegacy(); task.phase = 'planning'; task.steps = planningSteps(); task.results = []; task.conflictAccepted = false; task.feedback = null; task.confirmedSnapshot = null;
    runStep(task, 0, () => runStep(task, 1, () => {
      if (conflict(task.plan)) { task.phase = 'conflict'; task.steps[1].status = 'needs-input'; task.returnAfterConflict = 'origin'; task.conversationDraft = words('保留面试', 'Keep interview'); }
      else { task.phase = 'origin'; task.steps[2].status = 'needs-input'; }
    }));
  }
  function calculateRoute(task) {
    if (!task.plan.origin.trim()) { feedback(task, '请输入出发地址。', 'Enter a starting address.'); refresh(task); return; }
    task.phase = 'routing'; task.feedback = null; derive(task.plan);
    runStep(task, 2, () => {
      task.phase = 'reminder-planning';
      runStep(task, 3, () => { task.phase = 'review'; feedback(task, '通勤和提醒已整理好，可以继续修改或告诉我按此安排。', 'The commute and reminders are ready. Make changes or tell me to use this plan.'); });
    });
  }
  function executionSteps(plan) {
    return [
      plan.calendar && { id: 'calendar', app: 'Calendar', zh: '创建面试日历', en: 'Create the calendar event', access: 'Write' },
      plan.travel && { id: 'maps', app: 'Maps', zh: '启用已确认的通勤安排', en: 'Enable the confirmed commute', access: 'Read' },
      plan.reminders && { id: 'reminders', app: 'Reminders', zh: '写入准备和出发提醒', en: 'Create preparation and departure reminders', access: 'Write' },
    ].filter(Boolean).map(step => ({ ...step, status: 'waiting' }));
  }
  function beginExecution(task) {
    if (task.phase !== 'review' || task.steps.some(step => ['running', 'needs-input'].includes(step.status))) return;
    task.confirmedSnapshot = Object.freeze({ revision: task.revision, plan: clone(task.plan) });
    task.phase = 'executing'; task.results = []; task.steps = executionSteps(task.confirmedSnapshot.plan); task.context = []; task.feedback = null;
    collapse();
    const next = index => {
      if (index === task.steps.length) { task.phase = 'complete'; refresh(task); return; }
      runStep(task, index, () => next(index + 1));
    };
    next(0);
  }
  function beginGatheringExecution(task) {
    if (task.phase === 'executing' || task.phase === 'complete') return;
    task.plan = clone(gathering); task.confirmedSnapshot = Object.freeze({ revision: task.revision, plan: clone(task.plan) });
    task.phase = 'executing'; task.results = [];
    task.steps = [
      { id: 'reservation', app: words('预约服务', 'Reservations'), zh: '预约六人桌位', en: 'Reserve a table for six', access: 'External Action', status: 'waiting' },
      { id: 'calendar', app: 'Calendar', zh: '创建聚餐日程', en: 'Create the dinner event', access: 'Write', status: 'waiting' },
      { id: 'whatsapp', app: 'WhatsApp', zh: '生成群聊确认草稿', en: 'Draft the group confirmation', access: 'Draft only', status: 'waiting' },
    ];
    collapse();
    runStep(task, 0, () => runStep(task, 1, () => {
      task.steps[2].status = 'needs-input'; task.currentStep = 2;
      gathering.waDraft = words(
        gathering.venue + ' · ' + gathering.time + '，6 人桌位已经订好啦，到时候见 🎉',
        'Table for 6 at ' + gathering.venue + ', ' + gathering.time + ' — see you there 🎉'
      );
      refresh(task);
      paintGatheringDraft();
    }));
  }
  function paintGatheringDraft() {
    const bar = document.querySelector('.wa-draft-bar-v16');
    if (!bar) return;
    const input = bar.querySelector('.wa-draft-input-v16');
    bar.hidden = !gathering.waDraft;
    if (gathering.waDraft && input) input.value = gathering.waDraft;
  }
  function sendGatheringDraft(task) {
    if (!task || task.steps[2]?.status !== 'needs-input') return;
    const bar = document.querySelector('.wa-draft-bar-v16');
    const text = bar?.querySelector('.wa-draft-input-v16')?.value.trim() || gathering.waDraft;
    document.querySelector('.wa-chat-v16')?.insertAdjacentHTML('beforeend', '<div class="wa-bubble-v16 me">' + esc(text) + '<time>' + new Date().toTimeString().slice(0, 5) + '</time></div>');
    task.steps[2].status = 'complete';
    task.results.push({ id: 'whatsapp', app: 'WhatsApp', completedAt: Date.now(), revision: task.confirmedSnapshot.revision });
    gathering.waDraft = null;
    task.phase = 'complete';
    paintGatheringDraft();
    refresh(task);
  }
  function refresh(task) {
    if (task.id === store.viewedTaskId) {
      state = stateFor(task); syncLegacy(task);
      if (panel && !panel.hidden) paint(task);
      else if (needsDecision(task)) show(task);
    }
    updateIsland();
  }
  function title(task) { return words(...task.title); }
  function opening(task) {
    if (aux === 'menu') return words('任务选项', 'Task options');
    if (aux === 'sources') return words('来源与权限', 'Sources & permissions');
    if (aux === 'source-detail') return words('本次操作的数据范围', 'Data used for this task');
    if (aux === 'switcher') return words('选择要继续的任务', 'Choose a task');
    if (aux === 'route') return words('这是当前安排使用的路线。', 'This is the route for your current plan.');
    if (aux === 'stop') return words('停止这项任务？', 'Stop this task?');
    if (task.kind === 'gathering') return task.phase === 'complete' ? words('聚餐已安排好，三个结果都保存在这里。', 'Dinner is arranged. All three results are kept here.') : task.phase === 'executing' ? words('正在执行你确认的聚餐安排。', 'Applying the dinner plan you approved.') : words('聚餐安排已保留。', 'Your dinner plan is kept here.');
    if (task.kind !== 'interview') return task.phase === 'complete' ? words('摘要已整理好。', 'Your summary is ready.') : words('我正在处理这项请求。', 'I’m working on this request.');
    return {
      planning: words('我正在逐项检查这份邀请。', 'I’m checking the invitation step by step.'),
      conflict: words('课程和面试撞时间了。我先停一下，你想怎么安排？', 'Your class overlaps with the interview. How would you like to handle it?'),
      origin: words('从哪里出发？确认后我会计算通勤和提醒时间。', 'Where will you leave from? I’ll calculate the commute and reminders.'),
      routing: words('正在计算通勤安排。', 'Calculating your commute.'),
      'reminder-planning': words('根据出发时间整理提醒草稿。', 'Preparing reminders from your departure time.'),
      review: words('安排整理好了。点选内容，或直接告诉我怎么改。', 'Your plan is ready. Select an item or tell me what to change.'),
      executing: words('正在写入你确认的安排。', 'Applying the plan you confirmed.'),
      complete: words('安排已设置。别忘了准备面试用品。', 'Your plan is set. Remember to prepare for the interview.'),
      draft: words('改期邮件已起草，尚未发送。', 'Your reschedule email is drafted, not sent.'),
      paused: words('安排已保留，可以随时继续。', 'Your plan is saved here. Continue whenever you’re ready.'),
      stopped: words('任务已停止，已完成的结果保留。', 'The task has stopped. Completed results are kept.'),
    }[task.phase];
  }

  function sizeInput() {
    if (!composer?.isConnected || composer.hidden) { layoutConversation(); return; }
    const input = composer.querySelector('[data-task-input]');
    input.style.height = '24px';
    input.style.height = Math.min(72, Math.max(24, input.scrollHeight)) + 'px';
    input.style.overflowY = input.scrollHeight > 72 ? 'auto' : 'hidden';
    composer.classList.toggle('expanded', !!current()?.context || input.scrollHeight > 24);
    layoutConversation();
  }
  function layoutConversation() {
    const legacyDock = ov.querySelector('.legacy-conversation-dock');
    if (legacyDock) {
      const bottom = (keyboardHeight || 34) + 8;
      screenHost.style.setProperty('--task-keyboard-height', keyboardHeight + 'px');
      legacyDock.style.bottom = bottom + 'px';
      ov.querySelector('.legacy-docked-panel')?.style.setProperty('--legacy-panel-height', Math.max(100, screenHost.clientHeight - 92 - bottom - legacyDock.offsetHeight - 16) + 'px');
    }
    if (!panel?.isConnected) return;
    const safe = parseFloat(getComputedStyle(screenHost).getPropertyValue('--task-safe-area')) || 34;
    const visible = composer?.isConnected && !composer.hidden && !panel.hidden;
    const bottom = Math.max(keyboardHeight, keyboardHeight > 0 ? 0 : safe) + 8;
    screenHost.style.setProperty('--task-keyboard-height', keyboardHeight + 'px');
    if (composer) composer.style.bottom = bottom + 'px';
    updateOverlap();
    panel.style.setProperty('--task-panel-height', Math.max(100, screenHost.clientHeight - 92 - (visible ? bottom : keyboardHeight + 20)) + 'px');
    clearTimeout(panelResizeTimer);
    panelResizeTimer = setTimeout(() => {
      if (!panel?.isConnected) return;
      const selected = panel.querySelector('[data-scope][aria-pressed=true]');
      const body = panel.querySelector('.task-body');
      if (keyboardHeight > 0 && selected && body) {
        const a = selected.getBoundingClientRect(), b = body.getBoundingClientRect();
        const scale = screenHost.getBoundingClientRect().width / screenHost.offsetWidth || 1;
        if (a.bottom > b.bottom) body.scrollTop += (a.bottom - b.bottom) / scale;
        else if (a.top < b.top) body.scrollTop -= (b.top - a.top) / scale;
      }
    }, 400);
  }
  function updateOverlap() {
    if (!panel?.isConnected) return;
    const a = panel.getBoundingClientRect(), b = composer?.getBoundingClientRect();
    panel.classList.toggle('composer-overlap', !!b && !composer.hidden && !panel.hidden && a.bottom > b.top && a.top < b.bottom);
  }
  const overlapObserver = new ResizeObserver(updateOverlap);
  function moveKeyboard(target, immediate = false) {
    cancelAnimationFrame(keyboardFrame);
    const from = keyboardHeight, start = performance.now();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (immediate || reduced) {
      keyboardHeight = target; layoutConversation();
      if (reduced && composer && !composer.hidden) composer.animate([{ opacity: .65 }, { opacity: 1 }], { duration: 150 });
      return;
    }
    const tick = now => {
      const progress = Math.min(1, (now - start) / 250);
      keyboardHeight = from + (target - from) * (1 - Math.pow(1 - progress, 3));
      layoutConversation();
      if (progress < 1) keyboardFrame = requestAnimationFrame(tick);
    };
    keyboardFrame = requestAnimationFrame(tick);
  }
  function nativeViewportChanged() {
    if (!nativeKeyboard) return;
    const viewport = window.visualViewport;
    const focused = document.activeElement?.matches('[data-task-input], [data-origin-input], .legacy-conversation-dock [data-decision-input]');
    const bounds = screenHost.getBoundingClientRect();
    const scale = bounds.width / screenHost.offsetWidth || 1;
    const height = focused && viewport ? Math.max(0, (bounds.bottom - viewport.height - viewport.offsetTop) / scale) : 0;
    moveKeyboard(height, true);
  }
  showSimulatedKeyboard = function(input) {
    if (input?.matches('[data-task-input], [data-origin-input], .legacy-conversation-dock [data-decision-input]')) {
      if (nativeKeyboard) { nativeViewportChanged(); return; }
      simulatedKeyboardTarget = input;
      const keyboard = ensureSimulatedKeyboard();
      keyboard.classList.add('visible', 'task-keyboard');
      moveKeyboard(keyboard.offsetHeight);
      return;
    }
    if (!nativeKeyboard) legacyShowKeyboard(input);
  };
  hideSimulatedKeyboard = function() {
    const target = simulatedKeyboardTarget || document.activeElement;
    legacyHideKeyboard();
    if (target?.matches('[data-task-input], [data-origin-input], .legacy-conversation-dock [data-decision-input]')) target.blur();
    moveKeyboard(0, nativeKeyboard);
  };
  window.visualViewport?.addEventListener('resize', nativeViewportChanged);
  window.visualViewport?.addEventListener('scroll', nativeViewportChanged);
  window.addEventListener('resize', () => { nativeViewportChanged(); layoutConversation(); });

  function mount(task) {
    if (panel && panel.isConnected && panel.dataset.taskId === task.id) { panel.hidden = false; return; }
    hideSimulatedKeyboard();
    ov.innerHTML = '<section class="planning-sheet-v2 conversation-sheet-v4 task-panel" role="dialog" aria-label="' + words('任务对话', 'Task conversation') + '" data-task-id="' + task.id + '"><header class="task-top"><div class="task-top-label"><i class="task-dot"></i><span data-task-title></span></div><div class="task-top-actions"><button class="task-icon-button" data-task-back hidden aria-label="' + words('返回', 'Back') + '">‹</button><button class="task-icon-button" data-task-menu aria-label="' + words('任务菜单', 'Task menu') + '">•••</button><button class="task-icon-button" data-task-collapse aria-label="' + words('收起任务', 'Collapse task') + '">−</button></div></header><div class="ai-opening-v3"><span class="ai-avatar-v3">AI</span><p data-task-opening></p></div><div class="task-body"><div class="task-history is-empty"><div class="task-history-inner"><details><summary></summary><div></div></details></div></div><div class="task-view"></div></div><p class="task-feedback" role="status" aria-live="polite" hidden></p></section><form class="task-composer" autocomplete="off"><div class="task-context-list" hidden></div><div class="task-composer-row"><div class="task-composer-input"><textarea rows="1" data-task-input aria-label="' + words('告诉 AI', 'Message AI') + '"></textarea><button type="button" class="task-mic" data-task-mic aria-label="' + words('语音输入', 'Voice input') + '">' + icon('mic') + '</button></div><button type="submit" class="task-send" aria-label="' + words('发送', 'Send') + '">' + icon('send') + '</button></div></form>';
    panel = ov.querySelector('.task-panel');
    panel.querySelector('[data-task-menu]').innerHTML = '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><g fill="currentColor"><circle cx="5" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/></g></svg>';
    panel.querySelector('[data-task-collapse]').innerHTML = '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M5 10h10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
    panel.querySelector('[data-task-collapse]').title = words('收起任务', 'Collapse task');
    overlapObserver.disconnect(); overlapObserver.observe(panel);
    panel.addEventListener('click', handlePanelClick);
    composer = ov.querySelector('.task-composer');
    composer.dataset.taskId = task.id;
    composer.setAttribute('aria-label', words('任务输入', 'Task input'));
    composer.addEventListener('click', handlePanelClick);
    composer.addEventListener('focusin', event => { if (event.target.matches('[data-task-input]')) showSimulatedKeyboard(event.target); });
    composer.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); composer.requestSubmit(); }
      if (event.key === 'Escape') { event.preventDefault(); hideSimulatedKeyboard(); }
    });
    resizeComposer?.disconnect();
    resizeComposer = new ResizeObserver(() => layoutConversation());
    resizeComposer.observe(composer);
    screenHost.classList.add('task-layout');
    composer.addEventListener('submit', event => { event.preventDefault(); send(task, composer.querySelector('[data-task-input]').value); });
    composer.querySelector('[data-task-input]').addEventListener('input', event => { task.conversationDraft = event.target.value; composer.querySelector('.task-send').disabled = !event.target.value.trim(); sizeInput(); });
    panel.addEventListener('input', event => {
      if (event.target.matches('[data-origin-input]')) { task.plan.origin = event.target.value; task.revision++; }
    });
  }
  function show(task, auxiliary = null) {
    store.activeTaskId = task.id; store.viewedTaskId = task.id; aux = auxiliary;
    state = stateFor(task); syncLegacy(task); mount(task);
    const step = task.steps[task.currentStep];
    if (step?.status === 'running' && !aux) step.visibleSince = performance.now();
    store.panelMode = auxiliary === 'switcher' ? 'task-switcher' : needsDecision(task) ? 'decision' : 'activity';
    isPlanningSheetOpen = true; paint(task); updateIsland();
  }
  function collapse() {
    hideSimulatedKeyboard();
    if (composer) composer.hidden = true;
    if (panel) panel.hidden = true;
    else ov.replaceChildren(); // Dismiss a legacy entry sheet when handing off to a task.
    store.panelMode = 'collapsed'; isPlanningSheetOpen = false; aux = null;
    updateIsland();
  }
  function paint(task) {
    if (!panel || panel.hidden || panel.dataset.taskId !== task.id) return;
    panel.dataset.needsDecision = needsDecision(task);
    panel.setAttribute('aria-label', words('任务对话', 'Task conversation'));
    panel.querySelector('[data-task-title]').textContent = title(task) + ' · ' + statusLabel(task);
    panel.querySelector('[data-task-opening]').textContent = opening(task);
    panel.querySelector('[data-task-back]').hidden = !aux;
    panel.querySelector('[data-task-menu]').hidden = !!aux;
    const history = panel.querySelector('.task-history');
    const completed = task.steps.filter(step => step.status === 'complete');
    const showHistory = !aux && !['review', 'complete', 'stopped', 'draft'].includes(task.phase) && completed.length > 0;
    history.classList.toggle('is-empty', !showHistory);
    history.setAttribute('aria-hidden', String(!showHistory));
    history.inert = !showHistory;
    history.querySelector('summary').textContent = words('已完成 ' + completed.length + ' 项', completed.length + ' completed') + (task.phase === 'conflict' ? words(' · Calendar 发现冲突', ' · Calendar found a conflict') : '');
    history.querySelector('details > div').innerHTML = completed.map(step => '<span>✓ ' + esc(step.app + ' · ' + words(step.zh, step.en)) + '</span>').join('');
    if (task.phase === 'conflict' || task.phase === 'origin') history.querySelector('details').open = false;
    const view = panel.querySelector('.task-view');
    const key = [task.phase, aux, sourceIndex, uiLanguage, task.revision, task.context.join(','), task.currentStep, task.steps.map(step => step.status).join(','), task.results.length, store.tasks.map(item => item.phase).join(',')].join('|');
    if (view.dataset.renderSignature !== key) {
      const scroll = panel.querySelector('.task-body').scrollTop;
      view.innerHTML = viewMarkup(task); view.dataset.renderSignature = key;
      panel.querySelector('.task-body').scrollTop = scroll;
    }
    const message = panel.querySelector('.task-feedback');
    message.hidden = !task.feedback || !!aux;
    message.textContent = task.feedback ? words(...task.feedback) : '';
    composer.hidden = !!aux || task.phase === 'stopped';
    if (composer.hidden) hideSimulatedKeyboard();
    const contextList = composer.querySelector('.task-context-list');
    contextList.hidden = !task.context.length;
    contextList.innerHTML = task.context.map(scope => '<span class="task-context"><span>' + esc(scopeLabel(scope)) + '</span><button type="button" data-context-clear="' + scope + '" aria-label="' + words('移除上下文', 'Clear context') + '">×</button></span>').join('');
    const input = composer.querySelector('[data-task-input]');
    if (document.activeElement !== input) input.value = task.conversationDraft;
    input.placeholder = task.phase === 'executing' ? words('可以添加另一项任务…', 'Add another task…') : task.context.length ? words('告诉我想怎么改…', 'Tell me what to change…') : words('修改安排，或告诉我按此安排…', 'Make changes, or tell me to use this plan…');
    composer.querySelector('.task-send').disabled = !input.value.trim();
    composer.querySelector('.task-send').setAttribute('aria-label', words('发送', 'Send'));
    composer.querySelector('.task-mic').setAttribute('aria-label', words('语音输入', 'Voice input'));
    panel.querySelectorAll('[data-scope]').forEach(row => row.setAttribute('aria-pressed', String(task.context.includes(row.dataset.scope))));
    sizeInput();
  }
  function row(scope, glyph, label, value, detail = '') {
    return '<button class="task-row" data-scope="' + scope + '" aria-pressed="false">' + icon(glyph) + '<span class="task-row-content"><span class="task-row-label">' + label + '</span><strong class="task-row-value">' + esc(value) + '</strong>' + (detail ? '<span class="task-row-detail">' + esc(detail) + '</span>' : '') + '</span></button>';
  }
  function planMarkup(task) {
    const plan = task.plan;
    return '<div class="task-plan">' + row('interview', 'calendar', words('面试', 'Interview'), dateLabel(plan) + ' · ' + plan.time, plan.address) +
      row('commute', plan.mode, words('通勤安排', 'Commute plan'), plan.route.departure + words(' 出发', ' departure'), modeLabel(plan.mode) + ' · ' + words('预计 ', 'Arrive ') + plan.route.arrival + words(' 到达', '')) +
      row('reminder', 'bell', words('提醒', 'Reminders'), plan.reminderTime + words(' 准备 · ', ' prepare · ') + plan.route.departure + words(' 出发', ' depart')) +
      row('preparation', 'note', words('准备事项', 'Preparation'), uiLanguage === 'en' && plan.preparation === '携带作品集' ? 'Bring your portfolio' : plan.preparation) + '</div>';
  }
  function progressMarkup(task) {
    const step = task.steps[task.currentStep];
    if (!step) return '';
    const next = task.steps[task.currentStep + 1];
    const detail = task.kind === 'interview' ? step.id === 'maps' ? task.plan.origin + ' → ' + task.plan.address : step.id === 'calendar' ? dateLabel(task.plan) + ' · ' + task.plan.time : step.id === 'reminders' ? task.plan.reminderTime + words(' 准备 · ', ' prepare · ') + task.plan.route.departure + words(' 出发', ' depart') : words('当前 Alex 邮件', 'Current email from Alex') : task.kind === 'gathering' ? task.plan.time + ' · ' + task.plan.venue : task.request;
    return '<div class="task-current"><div class="task-progress-line"><i class="task-running-dot"></i><b>' + esc(step.app + ' · ' + words(step.zh, step.en)) + '</b></div><p>' + esc(detail) + '</p><p>' + (task.currentStep + 1) + ' / ' + task.steps.length + ' · ' + esc(step.access) + '</p></div>' + (next ? '<p class="task-next">' + words('下一步 · ', 'Next · ') + esc(next.app + ' · ' + words(next.zh, next.en)) + '</p>' : '');
  }
  function conflictMarkup(task) {
    const classStart = 600, classEnd = 660;
    const interviewStart = minutes(task.plan.time), interviewEnd = interviewStart + 60;
    const rangeStart = Math.min(classStart, interviewStart), rangeEnd = Math.max(classEnd, interviewEnd);
    const span = rangeEnd - rangeStart;
    const pct = m => (m - rangeStart) / span * 100;
    const overlap = Math.max(0, Math.min(classEnd, interviewEnd) - Math.max(classStart, interviewStart));
    return '<div class="task-conflict"><div class="task-conflict-head"><span>' + clock(rangeStart) + '</span><b>' + words('重叠 ' + overlap + ' 分钟', overlap + ' min overlap') + '</b></div><div class="task-conflict-track"><span class="task-conflict-bar" style="left:' + pct(classStart) + '%;width:' + (pct(classEnd) - pct(classStart)) + '%">' + words('课程', 'Class') + ' · 10:00–11:00</span><span class="task-conflict-bar active" style="left:' + pct(interviewStart) + '%;width:' + (pct(interviewEnd) - pct(interviewStart)) + '%">' + words('面试', 'Interview') + ' · ' + task.plan.time + '–' + clock(interviewEnd) + '</span><i class="task-conflict-marker" style="left:' + pct(interviewEnd) + '%"><span>' + clock(interviewEnd) + '</span></i></div></div><div class="task-pills">' + [['保留面试', 'Keep interview'], ['联系 Alex 改期', 'Ask Alex to reschedule'], ['稍后处理', 'Decide later']].map(copy => '<button class="task-pill" data-task-prompt="' + esc(words(...copy)) + '">' + words(...copy) + '</button>').join('') + '</div>';
  }
  function originMarkup(task) {
    return '<div class="task-choice"><b>' + words('出发地点', 'Starting point') + '</b><button class="task-origin" data-recommend-origin><b>' + recommendation + '</b><small>Recommendation</small></button><label for="task-origin-address">' + words('也可以输入其他地址', 'Or enter another address') + '</label><input class="task-address" id="task-origin-address" data-origin-input value="' + esc(task.plan.origin) + '" placeholder="' + words('输入地址或地点', 'Enter an address or place') + '"></div><div class="task-choice"><b>' + words('交通方式', 'Travel mode') + '</b><div class="task-modes">' + Object.keys(modes).map(key => '<button class="task-mode" data-task-mode="' + key + '" aria-pressed="' + (key === task.plan.mode) + '">' + icon(key) + '<span>' + modeLabel(key) + '</span></button>').join('') + '</div></div><button class="task-primary" data-calculate-route>' + words('计算通勤安排', 'Calculate commute') + '</button>';
  }
  function routeSteps(task) {
    if (task.plan.mode !== 'transit') return [];
    const addresses = [task.plan.origin, 'R5', 'Granville Street', '10', 'Burrard Street', task.plan.address, task.plan.address];
    const titles = task.routeStepCount === 3 ? [['步行至公交站', 'Walk to the bus stop'], ['乘坐 R5 公交', 'Take the R5 bus'], ['步行至面试地点', 'Walk to the interview']] : task.routeStepCount === 5 ? [['步行至公交站', 'Walk to the bus stop'], ['乘坐 R5 公交', 'Take the R5 bus'], ['步行换乘', 'Walk to the transfer'], ['乘坐 10 路公交', 'Take bus 10'], ['步行至面试地点', 'Walk to the interview']] : [['步行至公交站', 'Walk to the bus stop'], ['乘坐 R5 公交', 'Take the R5 bus'], ['步行至换乘站', 'Walk to the transfer stop'], ['乘坐 10 路公交', 'Take bus 10'], ['在 Burrard 下车', 'Exit at Burrard'], ['步行至大楼', 'Walk to the building'], ['前往面试入口', 'Walk to the entrance']];
    const times = task.routeStepCount === 3 ? [4, 21, 7] : task.routeStepCount === 5 ? [4, 12, 3, 6, 7] : [4, 10, 3, 7, 1, 5, 2];
    return titles.map((copy, index) => ({ title: words(...copy), detail: task.routeStepCount === 3 ? [task.plan.origin, words('R5 · 无需换乘', 'R5 · no transfer'), task.plan.address][index] : addresses[index], time: times[index] }));
  }
  function routeMarkup(task) {
    const steps = routeSteps(task);
    const stepHTML = (step, index) => '<div class="task-route-step"><i>' + (index + 1) + '</i><span><b>' + esc(step.title) + '</b><small>' + esc(step.detail) + '</small></span><em>' + step.time + words(' 分钟', ' min') + '</em></div>';
    return '<div class="task-route-summary">' + icon(task.plan.mode) + '<div><strong>' + task.plan.route.departure + words(' 出发', ' departure') + '</strong><p>' + modeLabel(task.plan.mode) + ' · ' + task.plan.route.duration + words(' 分钟 · ', ' min · ') + words('预计 ', 'Arrive ') + task.plan.route.arrival + words(' 到达', '') + '</p><p>' + esc(task.plan.origin) + '</p></div></div><div class="task-map-preview" aria-label="' + words('路线示意图', 'Illustrative route map') + '"><i class="task-map-line"></i><small>' + words('路线示意', 'Route preview') + '</small></div>' + (steps.length ? '<div class="task-route-list">' + steps.slice(0, 3).map(stepHTML).join('') + (steps.length > 3 ? '<div class="task-route-extra ' + (task.routeExpanded ? 'open' : '') + '" id="task-extra-steps" aria-hidden="' + !task.routeExpanded + '"><div>' + steps.slice(3).map((step, index) => stepHTML(step, index + 3)).join('') + '</div></div><button class="task-route-more" data-route-expand aria-controls="task-extra-steps" aria-expanded="' + task.routeExpanded + '">' + routeToggleLabel(task) + '</button>' : '') + '</div>' : '') + '<button class="task-link" data-task-maps>' + words('在地图中查看', 'Open in Maps') + '</button>';
  }
  function routeToggleLabel(task) { return task.routeExpanded ? words('收起路线', 'Collapse route') : words('查看其余 ' + (routeSteps(task).length - 3) + ' 步', 'Show ' + (routeSteps(task).length - 3) + ' more steps'); }
  function sourceRows(task) {
    if (task.kind === 'gathering') return [
      ['mail', 'WhatsApp', ['读取当前群聊；确认后发送安排', 'Read this group; send the approved plan'], ['Weekend Dinner 群聊的时间与饮食要求', 'Time and dietary requirements in Weekend Dinner'], 'Read / External Action'],
      ['calendar', 'Calendar', ['查询共享忙闲；创建已确认的日程', 'Check shared availability; create the approved event'], ['只读取共享忙闲，不读取参与者的事件内容', 'Shared availability only, not participants’ event details'], 'Read / Write'],
      ['map', 'Maps', ['查询餐厅位置', 'Find restaurant locations'], [task.plan.venue + ' · Downtown', task.plan.venue + ' · Downtown'], 'Read'],
      ['note', words('预约服务', 'Reservations'), ['提交你确认的预约', 'Submit the reservation you approved'], [task.plan.venue + ' · ' + task.plan.time + ' · 6 人', task.plan.venue + ' · ' + task.plan.time + ' · 6 people'], 'External Action'],
    ];
    return task.kind === 'interview' ? [
      ['mail', 'Mail', ['读取当前 Alex 邀请', 'Read Alex’s current invitation'], ['仅当前邮件正文中的日期、地点与准备要求', 'Date, place and preparation requirements in the current email'], 'Read'],
      ['calendar', 'Calendar', ['检查冲突；确认后创建日程', 'Check conflicts; create the approved event'], ['面试当天的忙闲时间，以及你确认的面试日程', 'Availability on the interview date and your approved event'], 'Read / Write'],
      ['map', 'Maps', ['计算并启用通勤安排', 'Calculate and enable the commute'], [task.plan.origin + ' → ' + task.plan.address, task.plan.origin + ' → ' + task.plan.address], 'Read'],
      ['bell', 'Reminders', ['写入已确认的提醒', 'Create approved reminders'], [task.plan.reminderTime + ' / ' + task.plan.route.departure + ' · ' + task.plan.preparation, task.plan.reminderTime + ' / ' + task.plan.route.departure + ' · ' + (task.plan.preparation === '携带作品集' ? 'Bring your portfolio' : task.plan.preparation)], 'Write'],
    ] : [[task.kind === 'email' ? 'mail' : 'note', task.kind === 'email' ? 'Mail' : 'AI Task', [task.kind === 'email' ? '整理邮件摘要' : '整理当前请求', task.kind === 'email' ? 'Prepare an email summary' : 'Organize this request'], [task.kind === 'email' ? '原型中的邮件示例；不发送或删除邮件' : task.request, task.kind === 'email' ? 'Prototype email examples; no emails sent or deleted' : task.request], 'Read']];
  }
  function viewMarkup(task) {
    if (aux === 'menu') return '<div class="task-menu"><button data-task-sources>' + words('来源与权限', 'Sources & permissions') + '</button><button data-task-switcher>' + words('切换任务', 'Switch tasks') + '</button><button data-task-settings>' + words('管理通知', 'Notification settings') + '</button>' + (isRunning(task) || needsDecision(task) ? '<button class="task-stop" data-task-stop>' + words('停止任务', 'Stop task') + '</button>' : '') + '</div>';
    if (aux === 'sources') return '<div class="task-source-list">' + sourceRows(task).map((item, index) => '<button class="task-source task-link" style="width:100%;text-align:left" data-source-index="' + index + '">' + icon(item[0]) + '<span><b>' + item[1] + ' · ' + words(...item[2]) + '</b><small>' + esc(words(...item[3])) + '</small><span class="task-badge">' + item[4] + '</span></span><span>›</span></button>').join('') + '</div>';
    if (aux === 'source-detail') { const item = sourceRows(task)[sourceIndex]; return '<div class="task-current">' + icon(item[0]) + '<b>' + item[1] + '</b><p>' + words(...item[2]) + '</p><p>' + esc(words(...item[3])) + '</p><span class="task-badge">' + item[4] + '</span></div>'; }
    if (aux === 'switcher') return '<div class="task-switcher">' + store.tasks.map(item => '<button class="task-row" data-open-task="' + item.id + '">' + icon(item.kind === 'interview' ? 'calendar' : 'mail') + '<span class="task-row-content"><strong class="task-row-value">' + esc(title(item)) + '</strong><span class="task-row-detail">' + statusLabel(item) + '</span></span></button>').join('') + '</div>';
    if (aux === 'route') return routeMarkup(task);
    if (aux === 'stop') return '<p class="task-feedback">' + (task.phase === 'executing' ? words('当前写入会先完成，随后停止剩余操作。', 'The current write will finish; remaining operations will stop.') : words('当前安排会保留，后续步骤停止。', 'Your current plan will be kept; upcoming steps will stop.')) + '</p><div class="task-menu"><button class="task-stop" data-confirm-stop>' + words('停止后续操作', 'Stop remaining operations') + '</button></div>';
    if (task.kind === 'gathering' && !isRunning(task)) return '<div class="task-current"><b>' + esc(task.plan.venue) + '</b><p>' + esc(task.plan.time) + ' · ' + words('6 人', '6 people') + '</p>' + task.results.map(result => '<p>✓ ' + esc(result.app) + '</p>').join('') + '</div><button class="task-link" data-return-gathering>' + words(task.phase === 'complete' ? '返回群聊' : '返回聚餐安排', task.phase === 'complete' ? 'Return to group' : 'Return to dinner plan') + '</button>';
    if (task.kind !== 'interview' && task.phase === 'complete') return '<div class="task-current"><b>' + words('已整理的内容', 'Prepared summary') + '</b><p>' + esc(task.kind === 'email' ? words('Alex 的邀请：确认时间与地点，准备作品集。原面试任务仍保留在任务列表中。', 'Alex’s invitation: review the time and place, and prepare your portfolio. Your interview task remains in the task list.') : task.request) + '</p></div>';
    if (task.phase === 'conflict') return conflictMarkup(task);
    if (task.phase === 'origin') return originMarkup(task);
    if (task.phase === 'review' || task.phase === 'complete') return planMarkup(task) + (task.context.includes('commute') ? '<button class="task-link" data-task-route>' + words('查看路线详情', 'View route details') + '</button>' : '');
    if (task.phase === 'paused') return '<button class="task-pill" data-task-prompt="' + words('继续处理', 'Continue planning') + '">' + words('继续处理', 'Continue planning') + '</button>';
    if (task.phase === 'draft') return '<div class="task-draft">Hi Alex,<br><br>Thank you for the invitation. I have a schedule conflict at the proposed time. Would another interview time be possible?<br><br>Best,<br>Jade</div><p class="task-next">' + words('草稿未发送，面试时间还没有更改。', 'Draft not sent. The interview time has not changed.') + '</p><button class="task-pill" data-task-prompt="' + words('保留面试', 'Keep interview') + '">' + words('保留原面试时间', 'Keep the original interview') + '</button>';
    if (task.phase === 'stopped') return '<p class="task-next">' + words('已完成 ' + task.results.length + ' 项操作。', task.results.length + ' operations completed.') + '</p>';
    return progressMarkup(task);
  }
  function setContext(task, scope) {
    task.context = scope === null ? [] : [scope]; task.feedback = null;
    paint(task);
    const input = composer.querySelector('[data-task-input]');
    input.focus({ preventScroll: true });
    showSimulatedKeyboard(input);
  }
  function selectContext(task, scope) {
    const i = task.context.indexOf(scope);
    if (i !== -1) task.context.splice(i, 1);
    task.context.push(scope);
    task.feedback = null;
    const approvalPreset = words('按这个安排', 'Use this plan');
    if (task.phase === 'review' && (!task.conversationDraft.trim() || task.conversationDraft === approvalPreset)) task.conversationDraft = approvalPreset;
    paint(task);
    if (task.phase === 'review') return;
    const input = composer.querySelector('[data-task-input]');
    input.focus({ preventScroll: true });
    showSimulatedKeyboard(input);
  }
  function removeContext(task, scope) {
    const i = task.context.indexOf(scope);
    if (i !== -1) task.context.splice(i, 1);
    task.feedback = null;
    paint(task);
  }
  function prompt(task, value) {
    task.conversationDraft = value;
    const input = composer.querySelector('[data-task-input]'); input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    panel.querySelectorAll('[data-task-prompt]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.taskPrompt === value)));
  }
  function handlePanelClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const task = current();
    if (button.matches('[data-scope]')) selectContext(task, button.dataset.scope);
    else if (button.matches('[data-context-clear]')) removeContext(task, button.dataset.contextClear);
    else if (button.matches('[data-task-prompt]')) prompt(task, button.dataset.taskPrompt);
    else if (button.matches('[data-task-collapse]')) collapse();
    else if (button.matches('[data-task-menu]')) { hideSimulatedKeyboard(); aux = 'menu'; paint(task); }
    else if (button.matches('[data-task-back]')) {
      if (aux === 'sources' && task.sourceReturnScreen) { const back = task.sourceReturnScreen; task.sourceReturnScreen = null; render(back); return; }
      aux = aux === 'source-detail' ? 'sources' : aux === 'sources' || aux === 'stop' ? 'menu' : null; paint(task);
    }
    else if (button.matches('[data-task-sources]')) { aux = 'sources'; paint(task); }
    else if (button.matches('[data-source-index]')) { sourceIndex = Number(button.dataset.sourceIndex); aux = 'source-detail'; paint(task); }
    else if (button.matches('[data-task-switcher]')) { aux = 'switcher'; store.panelMode = 'task-switcher'; paint(task); }
    else if (button.matches('[data-open-task]')) show(store.tasks.find(item => item.id === button.dataset.openTask));
    else if (button.matches('[data-task-route]')) { hideSimulatedKeyboard(); aux = 'route'; paint(task); }
    else if (button.matches('[data-task-mode]')) { task.plan.mode = button.dataset.taskMode; task.revision++; paint(task); }
    else if (button.matches('[data-recommend-origin]')) { task.plan.origin = recommendation; task.revision++; paint(task); }
    else if (button.matches('[data-calculate-route]')) { hideSimulatedKeyboard(); calculateRoute(task); }
    else if (button.matches('[data-route-expand]')) {
      task.routeExpanded = !task.routeExpanded;
      const container = panel.querySelector('.task-route-extra');
      container.classList.toggle('open', task.routeExpanded); container.setAttribute('aria-hidden', String(!task.routeExpanded));
      button.setAttribute('aria-expanded', String(task.routeExpanded)); button.textContent = routeToggleLabel(task);
    }
    else if (button.matches('[data-task-maps]')) mapChooser(task);
    else if (button.matches('[data-task-settings]')) settings(task);
    else if (button.matches('[data-task-stop]')) { aux = 'stop'; paint(task); }
    else if (button.matches('[data-confirm-stop]')) {
      if (task.phase === 'executing') task.stopAfterCurrent = true;
      else { cancelTimer(task); task.phase = 'stopped'; }
      aux = null; refresh(task);
    }
    else if (button.matches('[data-task-mic]')) dictate(task);
    else if (button.matches('[data-return-gathering]')) render(task.phase === 'complete' ? 'gatheringChat' : 'gatheringConfirm');
  }
  function mapChooser(task) {
    if (document.querySelector('.task-map-sheet')) return;
    const sheet = document.createElement('div'); sheet.className = 'task-map-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', words('选择地图 App', 'Choose a map app'));
    sheet.innerHTML = '<div><button data-map-provider="Apple Maps">Apple Maps</button><button data-map-provider="Google Maps">Google Maps</button><button data-map-dismiss>' + words('取消', 'Cancel') + '</button></div>';
    document.querySelector('.screen').appendChild(sheet);
    sheet.addEventListener('click', event => {
      const provider = event.target.closest('[data-map-provider]');
      if (provider) {
        const name = provider.dataset.mapProvider;
        sheet.innerHTML = '<div><button disabled>' + words('已切换至 ', 'Opened ') + name + '</button><button data-map-dismiss>' + words('返回当前任务', 'Return to task') + '</button></div>';
        task.mapHandoff = { provider: name, revision: task.revision };
      } else if (event.target.closest('[data-map-dismiss]') || event.target === sheet) { sheet.remove(); panel.querySelector('[data-task-maps]')?.focus(); }
    });
  }
  function settings(task) {
    if (ov.querySelector('.task-settings')) return;
    panel.hidden = true; composer.hidden = true; hideSimulatedKeyboard();
    const page = document.createElement('div'); page.className = 'task-settings';
    page.innerHTML = '<button data-settings-return>‹ ' + words('返回', 'Back') + '</button><h2>AI Tasks</h2><div class="task-settings-group"><div class="task-settings-row"><span>' + words('允许通知', 'Allow notifications') + '</span><button role="switch" aria-label="' + words('允许通知', 'Allow notifications') + '" aria-checked="' + task.notificationEnabled + '"></button></div><div class="task-settings-row"><span>' + words('需要决定', 'Decisions') + '</span><span>' + words('立即', 'Immediately') + '</span></div><div class="task-settings-row"><span>' + words('任务进度', 'Progress') + '</span><span>' + words('灵动岛', 'Dynamic Island') + '</span></div></div>';
    ov.appendChild(page);
    page.addEventListener('click', event => {
      if (event.target.closest('[data-settings-return]')) { page.remove(); panel.hidden = false; paint(task); }
      if (event.target.closest('[role=switch]')) { task.notificationEnabled = !task.notificationEnabled; event.target.closest('button').setAttribute('aria-checked', String(task.notificationEnabled)); }
    });
  }
  function dictate(task) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { feedback(task, '当前浏览器不支持语音输入，请输入文字。', 'Voice input is unavailable in this browser. Please type your message.'); paint(task); return; }
    if (keyboardVoice) { keyboardVoice.stop(); return; }
    const recognition = new Recognition(); keyboardVoice = recognition;
    recognition.lang = uiLanguage === 'en' ? 'en-US' : 'zh-CN'; recognition.interimResults = true; recognition.continuous = false;
    recognition.onresult = event => {
      task.conversationDraft = Array.from(event.results).map(result => result[0].transcript).join('');
      if (current().id === task.id && panel && !panel.hidden) prompt(task, task.conversationDraft);
    };
    recognition.onstart = () => composer?.querySelector('.task-mic')?.classList.add('listening');
    recognition.onerror = () => { feedback(task, '没有收到语音，可以重试或输入文字。', 'No voice input received. Try again or type your message.'); paint(task); };
    recognition.onend = () => { keyboardVoice = null; composer?.querySelector('.task-mic')?.classList.remove('listening'); };
    try { recognition.start(); } catch { keyboardVoice = null; feedback(task, '语音暂时不可用，请输入文字。', 'Voice input is unavailable. Please type instead.'); paint(task); }
  }
  function independentRequest(text) {
    if (/^(?:再|另外|还有|顺便|also|another|separately)/i.test(text) && /(?:整理|总结|summari[sz]e|organize).*(?:邮件|email|收件箱|inbox)/i.test(text)) return true;
    return /^(?:再|另外|还有|顺便|也)?(?:帮我)?(?:提醒我|remind me to).*(?:买|打电话|喝水|buy|call|drink)/i.test(text) || /^(?:新任务[：:]|new task:)/i.test(text);
  }
  function addTask(text) {
    const kind = /邮件|email|收件箱|inbox/i.test(text) ? 'email' : 'request';
    const task = { id: 'task-' + (++taskSequence), kind, title: kind === 'email' ? ['整理邮件', 'Email summary'] : [text, text], request: text, phase: 'planning', steps: [{ id: 'read', app: kind === 'email' ? 'Mail' : 'AI Task', zh: '整理请求范围', en: 'Review the request', status: 'waiting', access: 'Read' }, { id: 'summarize', app: 'AI Task', zh: '整理重点与待办', en: 'Organize key points and actions', status: 'waiting', access: 'Read' }, { id: 'result', app: 'AI Task', zh: '生成摘要', en: 'Prepare a summary', status: 'waiting', access: 'Read' }], currentStep: 0, context: [], conversationDraft: '', conversation: [], results: [], revision: 1, feedback: null, notificationEnabled: true };
    store.tasks.push(task);
    // Keep the current task in place, including an unresolved decision and draft.
    const next = index => index === task.steps.length ? (task.phase = 'complete', refresh(task)) : runStep(task, index, () => next(index + 1));
    next(0);
    return task;
  }
  function parseNumber(text) {
    if (/^\d+$/.test(text)) return Number(text);
    const digits = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (text === '十') return 10;
    if (text.includes('十')) { const [a, b] = text.split('十'); return (a ? digits[a] : 1) * 10 + (b ? digits[b] : 0); }
    return digits[text];
  }
  function parseEdits(task, text) {
    const changes = {};
    const activeScope = task.context[task.context.length - 1] || null;
    const wantsEdit = /改|换|调|设为|设置|提前|推迟|从.+出发|change|move|switch|make|set|leave from/i.test(text) || task.context.length > 0;
    if (!wantsEdit || /[?？]|是不是|是否|几点|能否|can you confirm|what time/i.test(text)) return changes;
    const date = text.match(/(?:(202\d)[-\/])?(\d{1,2})[-\/]([0-3]?\d)(?!\d)/) || text.match(/(\d{1,2})月(\d{1,2})[日号]/);
    if (date) {
      const chinese = date[0].includes('月');
      const year = chinese ? Number(task.plan.date.slice(0, 4)) : Number(date[1] || task.plan.date.slice(0, 4));
      const month = Number(date[chinese ? 1 : 2]), day = Number(date[chinese ? 2 : 3]);
      const actual = new Date(year, month - 1, day);
      if (actual.getMonth() !== month - 1 || actual.getDate() !== day) return { error: true };
      changes.date = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    }
    const time = text.match(/(\d{1,2})[:：]([0-5]\d)\s*(am|pm)?/i);
    const chineseTime = text.match(/([零一二两三四五六七八九十\d]{1,3})[点时](半|[零一二两三四五六七八九十\d]{1,3}分?)?/);
    let hour, minute;
    if (time) { hour = Number(time[1]); minute = Number(time[2]); }
    else if (chineseTime) { hour = parseNumber(chineseTime[1]); minute = chineseTime[2] === '半' ? 30 : chineseTime[2] ? parseNumber(chineseTime[2].replace('分', '')) : 0; }
    if (hour !== undefined) {
      if (/下午|晚上|\bpm\b/i.test(text) && hour < 12) hour += 12;
      if (/上午|早上|\bam\b/i.test(text) && hour === 12) hour = 0;
      if (!Number.isFinite(hour) || hour > 23 || !Number.isFinite(minute) || minute > 59) return { error: true };
      if (activeScope === 'reminder') return { unsupportedTime: true };
      changes.time = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
    }
    const transport = text.match(/开车|驾车|公交|巴士|步行|走路|骑行|自行车|drive|driving|transit|bus|walk|bike|cycl/i);
    if (transport) changes.mode = /开车|驾车|driv/i.test(transport[0]) ? 'drive' : /公交|巴士|transit|bus/i.test(transport[0]) ? 'transit' : /步行|走路|walk/i.test(transport[0]) ? 'walk' : 'bike';
    const lead = text.match(/提前\s*(\d{1,3})\s*分钟|(?:remind|reminder).*?(\d{1,3})\s*min/i);
    if (lead) changes.reminderLead = Number(lead[1] || lead[2]);
    const from = text.match(/(?:从|出发(?:地点|地址)?(?:改成|改为|设为)?[：:]?|leave from\s+)(.+?)(?:出发|[,，。]|$)/i);
    if (from && from[1].trim()) changes.origin = from[1].trim();
    const destination = text.match(/(?:面试(?:地点|地址)|地点|地址|location|address)(?:改成|改为|设为|换成|\s+to)?[：:]?\s*(.+?)(?:[,，。]|$)/i);
    if (destination && !from && destination[1].trim()) changes.address = destination[1].trim();
    if (activeScope === 'commute' && !from && !destination && !transport && /\d.+(?:street|st\b|road|rd\b|ave|路|街)/i.test(text)) changes.origin = text.replace(/^(改成|改为|从|change to|leave from)\s*/i, '').trim();
    const prep = text.match(/(?:准备事项|携带物品|preparation)(?:改成|改为|设为|\s+to)?[：:]?\s*(.+)$/i);
    if (prep) changes.preparation = prep[1].trim();
    else if (activeScope === 'preparation' && /^(?:改成|改为|带|携带|bring|change to)/i.test(text)) changes.preparation = text.replace(/^(改成|改为|change to)\s*/i, '').trim();
    return changes;
  }
  function send(task, raw) {
    const text = raw.trim();
    if (!text) return;
    hideSimulatedKeyboard();
    task.conversation.push({ role: 'user', text, context: task.context.slice() });
    task.conversationDraft = ''; composer.querySelector('[data-task-input]').value = '';
    if (independentRequest(text)) {
      addTask(text);
      feedback(task, '已新建并行任务；这里的安排和待确认内容已保留。点灵动岛可以切换任务。', 'A parallel task has started. This plan and its pending decision are kept. Tap the Dynamic Island to switch.');
      refresh(task); return;
    }
    if (/不要|别执行|不执行|先不|暂不|不确认|取消执行|do not|don.t|not yet|cancel execution|hold off/i.test(text)) {
      if (task.phase === 'executing') {
        task.stopAfterCurrent = true;
        feedback(task, '会在当前写入完成后停止剩余操作，已完成的内容保留。', 'Remaining operations will stop after the current write. Completed results are kept.');
      } else feedback(task, '好的，不提交新的操作。当前安排已保留。', 'Okay, no new operations will be submitted. Your current plan is kept.');
      refresh(task); return;
    }
    if (task.phase === 'executing') {
      feedback(task, '正在提交已确认的安排。可以添加另一项任务，完成后再修改本次安排。', 'Your confirmed plan is being applied. You can add another task and edit this plan after it finishes.'); refresh(task); return;
    }
    if (task.kind !== 'interview') { feedback(task, '这条补充已保存在当前任务中。', 'Your note has been saved to this task.'); refresh(task); return; }
    if (/(?:查看|看看|打开).*(?:路线|地图)|show.*route|view.*route/i.test(text)) { aux = 'route'; paint(task); return; }
    if (/[?？]|确认一下|确认时间|是不是|是否|几点|what time|can you confirm/i.test(text)) {
      feedback(task, '当前面试是 ' + dateLabel(task.plan) + ' ' + task.plan.time + '，' + task.plan.route.departure + ' 出发。尚未提交新改动。', 'The interview is ' + dateLabel(task.plan) + ' at ' + task.plan.time + ', departing at ' + task.plan.route.departure + '. No new changes have been submitted.'); refresh(task); return;
    }
    const edits = parseEdits(task, text);
    if (edits.error) { feedback(task, '这个日期或时间无效，请再输入一次。', 'That date or time is invalid. Please enter it again.'); refresh(task); return; }
    if (edits.unsupportedTime) { feedback(task, '提醒要在出发前多久？例如“提前 20 分钟提醒”。', 'How long before departure should I remind you? For example, “remind me 20 minutes before”.'); refresh(task); return; }
    if (Object.keys(edits).length) {
      const wasConflict = task.phase === 'conflict';
      const priorReturn = task.returnAfterConflict;
      if (isRunning(task)) cancelTimer(task);
      Object.assign(task.plan, edits); derive(task.plan); task.revision++; task.confirmedSnapshot = null;
      task.context = [];
      task.phase = 'review'; task.steps = planningSteps(); task.steps.forEach(step => step.status = 'complete');
      const calendarChanged = 'date' in edits || 'time' in edits;
      if (calendarChanged) task.conflictAccepted = false;
      if (!task.conflictAccepted && conflict(task.plan)) {
        task.phase = 'conflict'; task.steps[1].status = 'needs-input'; task.returnAfterConflict = wasConflict ? priorReturn : 'review';
        task.steps[2].status = 'waiting'; task.steps[3].status = 'waiting'; task.currentStep = 1;
        task.conversationDraft = words('保留面试', 'Keep interview');
      }
      feedback(task, '已更新安排，并重新计算受影响的通勤与提醒。请查看新计划，确认后再执行。', 'The plan and dependent commute and reminders are updated. Review the new plan before confirming.');
      refresh(task); return;
    }
    if (/^(保留面试|保留原面试时间|继续处理|继续规划|keep interview|continue planning)[。.!！]?$/i.test(text)) {
      task.conflictAccepted = true; task.steps[1].status = 'complete'; task.feedback = null;
      task.phase = task.returnAfterConflict === 'review' ? 'review' : 'origin';
      if (task.phase === 'origin') { task.steps[2].status = 'needs-input'; task.currentStep = 2; }
      else task.steps.forEach(step => step.status = 'complete');
      refresh(task); return;
    }
    if (/联系\s*Alex.*改期|ask alex to reschedule/i.test(text)) { task.phase = 'draft'; task.context = []; task.feedback = null; task.conversationDraft = words('保留原面试时间', 'Keep the original interview'); refresh(task); return; }
    if (/^(稍后|稍后处理|稍后再说|decide later)$/i.test(text)) { task.phase = 'paused'; task.conversationDraft = words('继续处理', 'Continue planning'); refresh(task); return; }
    if (task.phase === 'origin' && /^(确认|就这样|按这个安排|计算|计算通勤安排|confirm|use this plan|calculate)$/i.test(text)) { calculateRoute(task); return; }
    const globalApproval = /^(?:请)?(?:按(?:整个|全部)(?:计划|安排)(?:执行)?|确认(?:整个|全部)(?:计划|安排)(?:并执行)?|执行整个计划|execute (?:the )?(?:whole|entire) plan)[。.!！]?$/i.test(text);
    const approval = /^(?:请)?(?:确认(?:并执行)?|就这样|按(?:这个|此)安排(?:执行)?|开始执行|执行|confirm|use this plan|go ahead|execute(?: the plan)?)[。.!！]?$/i.test(text);
    if (task.context.length && approval && !globalApproval && task.phase !== 'review') {
      const label = task.context.map(scopeLabel).join(uiLanguage === 'en' ? ', ' : '、'); task.context = [];
      feedback(task, label + '保持当前内容。整个计划仍等待你确认执行。', 'That item is kept as shown. The whole plan still awaits your approval.'); refresh(task); return;
    }
    if ((approval || globalApproval) && task.phase === 'review') { beginExecution(task); return; }
    feedback(task, '我还没确定要改哪一项。可以点选内容，再说“改成 11:30”或“改成开车”。', 'I’m not sure which item to change. Select one, then say “change to 11:30” or “switch to driving”.');
    refresh(task);
  }

  // Route former edit screens to the same task with a composer annotation.
  const taskScreens = new Set(['processing', 'finishing', 'action', 'commute', 'commuteCalculating', 'commuteRoute', 'plan', 'adjustMenu', 'calendarEdit', 'reminderEdit', 'reminders', 'executing', 'task', 'taskMenu', 'sources', 'notificationSettings', 'paused', 'options', 'stopped']);
  render = function(next) {
    if (next.startsWith('gathering')) {
      if (next === 'gatheringChat') { if (composer) composer.hidden = true; hideSimulatedKeyboard(); if (panel) panel.hidden = true; panel = null; aux = null; store.panelMode = 'collapsed'; isl.classList.remove('task-island'); return legacyRender(next); }
      const task = ensureGathering();
      store.activeTaskId = task.id; store.viewedTaskId = task.id;
      task.plan = clone(gathering);
      if (next === 'gatheringExecuting') { beginGatheringExecution(task); return; }
      if (next === 'gatheringComplete') { task.phase = 'complete'; show(task); return; }
      if (next === 'gatheringSources') { task.sourceReturnScreen = state.startsWith('gathering') && state !== 'gatheringSources' ? state : 'gatheringConfirm'; show(task, 'sources'); return; }
      if (composer) composer.hidden = true; hideSimulatedKeyboard();
      if (panel) panel.hidden = true; panel = null; aux = null; store.panelMode = 'collapsed';
      const result = legacyRender(next); updateIsland(); return result;
    }
    if (!taskScreens.has(next)) {
      if (composer) composer.hidden = true; hideSimulatedKeyboard();
      if (panel?.isConnected) panel.hidden = true;
      panel = null; aux = null; store.panelMode = 'collapsed'; isl.classList.remove('task-island');
      return legacyRender(next);
    }
    const task = ensurePrimary(next === 'action' ? 'conflict' : next === 'commute' ? 'origin' : 'review');
    store.activeTaskId = task.id; store.viewedTaskId = task.id;
    if (next === 'processing') {
      if (!isRunning(task)) {
        if (!panel?.isConnected) { panel = null; collapse(); }
        startPlanning(task);
      }
      state = stateFor(task); updateIsland(); return;
    }
    if (next === 'executing') { beginExecution(task); return; }
    if (next === 'finishing' || next === 'commuteCalculating') { calculateRoute(task); return; }
    if (next === 'action') { task.phase = 'conflict'; task.steps[0].status = 'complete'; task.steps[1].status = 'needs-input'; task.currentStep = 1; task.conversationDraft = words('保留面试', 'Keep interview'); }
    if (next === 'commute') task.phase = 'origin';
    if (next === 'plan' && !isRunning(task)) task.phase = 'review';
    if (next === 'paused') { task.phase = 'paused'; task.conversationDraft = words('继续处理', 'Continue planning'); }
    if (next === 'options') { task.phase = 'draft'; task.conversationDraft = words('保留原面试时间', 'Keep the original interview'); }
    if (next === 'stopped') { cancelTimer(task); task.phase = 'stopped'; }
    if (next === 'task' && task.phase !== 'complete' && !isRunning(task)) { task.phase = 'complete'; task.steps = executionSteps(task.plan); task.steps.forEach(step => step.status = 'complete'); }
    if (['adjustMenu', 'calendarEdit', 'reminderEdit', 'reminders'].includes(next)) { task.phase = 'review'; task.context = next === 'calendarEdit' ? ['interview'] : next === 'adjustMenu' ? [] : ['reminder']; }
    if (!app.innerHTML) app.innerHTML = mail();
    show(task, next === 'taskMenu' ? 'menu' : next === 'sources' ? 'sources' : next === 'commuteRoute' ? 'route' : null);
    if (next === 'notificationSettings') settings(task);
  };
  closePlanningV2 = function() { if (panel?.isConnected && !panel.hidden) collapse(); else legacyClose(); };
  showProgress = function() { show(ensurePrimary('planning')); };
  updateProgressPanel = function() { if (current() && panel && !panel.hidden) paint(current()); };
  plannedPreparation = function() { return primary()?.plan.preparation || facts.preparation || ''; };
  setUiLanguage = function(language) {
    if (current() && (panel?.isConnected || store.panelMode === 'collapsed' && taskScreens.has(state))) {
      uiLanguage = language; isEnglish = language === 'en'; localStorage.setItem('ai-prototype-language', language); document.documentElement.lang = isEnglish ? 'en' : 'zh-CN';
      if (panel && !panel.hidden) paint(current()); updateIsland(); syncLanguageToggle();
      translateTree(prototypeNav, language); return;
    }
    legacyLanguage(language);
    emphasizeEntry();
  };
  isl.onclick = function(event) {
    if (store.tasks.length && (taskScreens.has(state) || state.startsWith('gathering') || store.tasks.some(isRunning) || store.tasks.some(needsDecision))) {
      event.preventDefault();
      const task = current() || primary();
      if (store.tasks.length > 1) show(task, 'switcher');
      else if (panel && !panel.hidden) collapse();
      else show(task);
      return;
    }
    legacyIslandClick?.call(isl, event);
  };
  // Capture legacy action names before document-level handlers can navigate away.
  window.addEventListener('click', event => {
    const button = event.target.closest('[data-a]');
    if (!button || button.closest('.task-panel')) return;
    const action = button.dataset.a;
    const aliases = { calendarEdit: 'interview', reminderEdit: 'reminder', editCommute: 'commute', editCommuteAdjust: 'commute', adjustMenu: null };
    if (Object.hasOwn(aliases, action) && primary()) {
      event.preventDefault(); event.stopImmediatePropagation(); const task = primary();
      show(task); setContext(task, aliases[action]); return;
    }
    if (action === 'submitDecisionContext' && primary() && taskScreens.has(state)) {
      event.preventDefault(); event.stopImmediatePropagation(); const value = document.querySelector('[data-decision-input]')?.value || ''; show(primary()); send(primary(), value);
    }
    if (action === 'sendGatheringDraft') {
      event.preventDefault(); event.stopImmediatePropagation(); sendGatheringDraft(ensureGathering());
    }
  }, true);
  function emphasizeEntry() {
    ov.querySelectorAll('.entry-process-row-v15').forEach(row => {
      const appName = row.querySelector('b')?.textContent, span = row.querySelector('span'); if (!span) return;
      if (appName === 'Calendar') span.innerHTML = words('<strong>只读</strong>检查是否存在<strong>日程冲突</strong>', '<strong>Read-only</strong> check for <strong>schedule conflicts</strong>');
      if (appName === 'Maps') span.innerHTML = words('估算<strong>路线、到达时间与建议出发时间</strong>', 'Estimate the <strong>route, arrival and departure time</strong>');
      if (appName === 'Reminders') span.innerHTML = words('准备提醒，<strong>最终确认后写入</strong>', 'Prepare reminders; <strong>write after final approval</strong>');
    });
  }
  const finalRender = render;
  function detachLegacyComposer() {
    const dock = ov.querySelector('.conversation-sheet-v4:not(.task-panel) .decision-composer-v4');
    if (!dock) return;
    dock.closest('section').classList.add('legacy-docked-panel');
    dock.classList.add('legacy-conversation-dock');
    ov.append(dock);
    dock.addEventListener('focusin', event => { if (event.target.matches('[data-decision-input]')) showSimulatedKeyboard(event.target); });
    layoutConversation();
  }
  render = function(next) { const result = finalRender(next); emphasizeEntry(); detachLegacyComposer(); return result; };
  // Direct review links initialize the same controller used by the live flow.
  processTimers.forEach(clearTimeout); processTimers = [];
  if (taskScreens.has(state) || state === 'gatheringExecuting' || state === 'gatheringSources' || state === 'gatheringComplete') {
    const initial = state; panel = null;
    if (initial === 'executing') { ensurePrimary('review'); beginExecution(primary()); }
    else render(initial);
  }
  emphasizeEntry();
  detachLegacyComposer();
})();
