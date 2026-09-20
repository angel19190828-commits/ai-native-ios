/* Behavioral checks for the local prototype. No external apps are called. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(process.env.LOCALAPPDATA, '..', '..', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')); }
const url = pathToFileURL(path.resolve(__dirname, '../wireframes-high-fidelity-v2.html')).href;
const failures = [];
let browser;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function pageFor(screen, extra = '') {
  const page = await browser.newPage({ viewport: { width: 829, height: 1000 }, locale: 'zh-CN' });
  page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  await page.route('**/extract', route => route.abort());
  await page.addInitScript(() => localStorage.setItem('ai-prototype-language', 'zh'));
  await page.goto(url + '?screen=' + screen + extra);
  await page.waitForFunction(() => typeof TaskStore !== 'undefined');
  return page;
}
async function say(page, text) { await page.locator('[data-task-input]').fill(text); await page.locator('[data-task-input]').press('Enter'); }
async function task(page, index = 0) { return page.evaluate(index => TaskStore.tasks[index], index); }
async function check(name, fn) {
  try { await fn(); console.log('PASS ' + name); }
  catch (error) { failures.push(name); console.error('FAIL ' + name + '\n' + error.stack); }
}
async function finish(page) { assert.deepEqual(page.errors, []); await page.close(); }

(async () => {
  browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
  await check('annotation preserves the panel and draft; time edits update dependent data', async () => {
    const page = await pageFor('plan');
    assert.equal(await page.locator('.task-plan > button').count(), 4);
    assert.equal(await page.locator('.plan-primary-v20, .task-panel [data-a="executing"]').count(), 0);
    await page.evaluate(() => window.savedPanel = document.querySelector('.task-panel'));
    await page.locator('[data-scope="interview"]').click();
    assert.equal(await page.locator('.task-context span').innerText(), '面试');
    await page.locator('[data-task-input]').fill('改成7月28号上午11点半');
    await page.locator('[data-scope="reminder"]').click();
    assert.equal(await page.locator('[data-task-input]').inputValue(), '改成7月28号上午11点半');
    await page.locator('[data-scope="interview"]').click();
    await page.locator('[data-task-input]').press('Enter');
    const updated = await task(page);
    assert.equal(updated.plan.time, '11:30'); assert.equal(updated.plan.route.departure, '10:35'); assert.equal(updated.plan.reminderTime, '10:05');
    assert.equal(updated.phase, 'review'); assert.equal(updated.results.length, 0);
    assert.equal(await page.evaluate(() => window.savedPanel === document.querySelector('.task-panel')), true);
    await say(page, '改成开车'); assert.equal((await task(page)).plan.mode, 'drive');
    await finish(page);
  });
  await check('negations, questions and invalid times never submit', async () => {
    const page = await pageFor('plan');
    for (const text of ['先不要执行', '确认一下时间', '不要确认', '确认时间是不是11:30', '改成25:30']) {
      await say(page, text); assert.equal((await task(page)).phase, 'review'); assert.equal((await task(page)).results.length, 0);
    }
    await say(page, '改成11:30并执行'); assert.equal((await task(page)).phase, 'review');
    assert.equal((await task(page)).confirmedSnapshot, null);
    await finish(page);
  });
  await check('selecting a plan item presets approval and send advances to execution', async () => {
    const page = await pageFor('plan');
    await page.locator('[data-scope="interview"]').click();
    assert.equal(await page.locator('[data-task-input]').inputValue(), '按这个安排');
    await page.locator('[data-scope="commute"]').click();
    assert.equal(await page.locator('.task-context').count(), 2);
    await page.locator('.task-send').click();
    assert.equal((await task(page)).phase, 'executing');
    assert.equal(await page.locator('.task-panel').isHidden(), true);
    await finish(page);
  });
  await check('running task exposes the orange stop control from the island', async () => {
    const page = await pageFor('executing'); await pause(100);
    assert.equal(await page.locator('.island-stop-v6.is-visible').count(), 1);
    await page.locator('.island-stop-v6').click();
    assert.equal(await page.locator('[data-confirm-stop]').count(), 1);
    await finish(page);
  });
  await check('execution collapses; task-owned order and immutable revision survive repeated opening', async () => {
    const page = await pageFor('plan'); await say(page, '按这个安排执行');
    assert.equal(await page.locator('.task-panel').isHidden(), true);
    assert.equal((await task(page)).phase, 'executing');
    for (let i = 0; i < 4; i++) await page.locator('#island').click();
    await page.locator('#island').click();
    await page.evaluate(() => window.savedPanel = document.querySelector('.task-panel'));
    await page.waitForFunction(() => TaskStore.tasks[0].phase === 'complete');
    const completed = await task(page);
    assert.deepEqual(completed.results.map(item => item.id), ['calendar', 'maps', 'reminders']);
    assert.equal(new Set(completed.results.map(item => item.revision)).size, 1);
    assert.equal(await page.evaluate(() => window.savedPanel === document.querySelector('.task-panel')), true);
    assert.equal(await page.locator('.task-panel').isVisible(), true);
    await finish(page);
  });
  await check('background completion stays collapsed; no extra result dialog opens', async () => {
    const page = await pageFor('plan'); await say(page, '确认并执行');
    await page.waitForFunction(() => TaskStore.tasks[0].phase === 'complete');
    assert.equal(await page.locator('.task-panel').isHidden(), true);
    await finish(page);
  });
  await check('live planning respects reading time and transitions in the same panel', async () => {
    const page = await pageFor('mail'); await page.evaluate(() => render('processing')); await page.locator('#island').click();
    await page.evaluate(() => window.savedPanel = document.querySelector('.task-panel'));
    const visibleStep = (await task(page)).currentStep;
    await pause(600); assert.equal((await task(page)).steps[visibleStep].status, 'running');
    await page.waitForFunction(() => TaskStore.tasks[0].phase === 'conflict');
    assert.equal(await page.evaluate(() => window.savedPanel === document.querySelector('.task-panel')), true);
    await say(page, '改成开车'); assert.equal((await task(page)).phase, 'conflict');
    assert.equal((await task(page)).steps[3].status, 'waiting');
    await say(page, '保留面试'); assert.equal((await task(page)).phase, 'origin');
    await page.locator('[data-origin-input]').fill('100 Very Long Example Street, North Vancouver, BC');
    await page.locator('[data-calculate-route]').click();
    await page.waitForFunction(() => TaskStore.tasks[0].phase === 'review');
    assert.equal(await page.evaluate(() => window.savedPanel === document.querySelector('.task-panel')), true);
    assert.equal((await task(page)).plan.origin, '100 Very Long Example Street, North Vancouver, BC');
    assert.equal((await task(page)).results.length, 0);
    await finish(page);
  });
  await check('parallel request keeps the unresolved original task and source context', async () => {
    const page = await pageFor('action');
    await say(page, '另外帮我整理今天的邮件');
    assert.equal((await task(page)).phase, 'conflict');
    assert.equal(await page.evaluate(() => TaskStore.tasks.length), 2);
    assert.equal(await page.locator('#island').innerText().then(text => text.includes('2 个任务')), true);
    await page.locator('#island').click(); await page.locator('[data-open-task="task-1"]').click();
    await page.locator('[data-task-menu]').click(); await page.locator('[data-task-sources]').click();
    assert.equal(await page.locator('.task-source').count(), 1);
    await page.locator('[data-task-back]').click(); await page.locator('[data-task-back]').click();
    await page.waitForFunction(() => TaskStore.tasks[1].phase === 'complete');
    await page.locator('#island').click(); await page.locator('[data-open-task="interview"]').click();
    assert.equal((await task(page)).phase, 'conflict');
    assert.equal(await page.locator('.task-conflict').count(), 1);
    await finish(page);
  });
  await check('route expand is local, remembers state; Maps cancel and return keep context', async () => {
    const page = await pageFor('plan', '&routeSteps=7');
    await page.locator('[data-scope="commute"]').click();
    await page.locator('[data-task-route]').click();
    await page.evaluate(() => { window.savedPanel = document.querySelector('.task-panel'); window.savedRoute = document.querySelector('.task-route-list'); });
    assert.equal(await page.locator('.task-route-extra').getAttribute('aria-hidden'), 'true');
    await page.locator('[data-route-expand]').click();
    assert.equal(await page.locator('[data-route-expand]').innerText(), '收起路线');
    assert.equal(await page.evaluate(() => savedRoute === document.querySelector('.task-route-list')), true);
    await page.locator('[data-task-maps]').click(); await page.locator('[data-map-dismiss]').click();
    for (const provider of ['Apple Maps', 'Google Maps']) { await page.locator('[data-task-maps]').click(); await page.locator('[data-map-provider="' + provider + '"]').click(); await page.locator('[data-map-dismiss]').click(); }
    await page.locator('[data-task-back]').click(); await page.locator('[data-task-route]').click();
    assert.equal(await page.locator('[data-route-expand]').getAttribute('aria-expanded'), 'true');
    await page.locator('[data-route-expand]').click();
    assert.equal(await page.evaluate(() => savedPanel === document.querySelector('.task-panel')), true);
    await finish(page);
  });
  await check('settings has no composer; route single segment has no timeline; English and reduced motion fit', async () => {
    const page = await pageFor('plan'); await say(page, '改成开车');
    await page.locator('[data-scope="commute"]').click(); await page.locator('[data-task-route]').click();
    assert.equal(await page.locator('.task-route-step').count(), 0);
    await page.locator('[data-task-back]').click(); await page.locator('[data-task-menu]').click(); await page.locator('[data-task-settings]').click();
    assert.equal(await page.locator('.task-composer').isVisible(), false);
    await page.locator('.task-settings [role=switch]').click();
    assert.equal(await page.locator('.task-settings [role=switch]').getAttribute('aria-checked'), 'false');
    await page.locator('[data-settings-return]').click(); await page.locator('[data-task-back]').click();
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.evaluate(() => setUiLanguage('en'));
    assert.equal(await page.locator('[data-scope="commute"] .task-row-label').innerText(), 'Commute plan');
    const overflow = await page.locator('.task-panel').evaluate(el => el.scrollWidth > el.clientWidth);
    assert.equal(overflow, false);
    assert.equal(await page.locator('.task-panel img').count(), 0);
    await finish(page);
  });
  await check('WhatsApp entry is below the island in normal flow and remains interactive', async () => {
    const page = await pageFor('gatheringChat');
    const button = await page.locator('.wa-ai-v16').boundingBox(), island = await page.locator('#island').boundingBox();
    assert.ok(button.y > island.y + island.height);
    assert.equal(await page.locator('.wa-ai-v16').evaluate(el => getComputedStyle(el).position), 'static');
    await page.locator('.wa-ai-v16').click(); assert.equal(await page.locator('.gathering-sheet-v16').count(), 1);
    await finish(page);
  });
  await check('Mail entry hands off without a stale sheet and preserves the keyword hierarchy', async () => {
    const page = await pageFor('suggest');
    await page.locator('.entry-expand-v3').click();
    assert.equal(await page.locator('.entry-process-row-v15 strong').count(), 4);
    await page.locator('[data-a="submitAndPlan"]').click();
    await page.waitForFunction(() => TaskStore.tasks[0]?.phase === 'planning');
    assert.equal(await page.locator('#overlay > section').count(), 0);
    await page.locator('#island').click();
    assert.equal(await page.locator('.task-panel').isVisible(), true);
    await finish(page);
  });
  await check('Dinner confirmation collapses, executes once and retains scoped sources', async () => {
    const page = await pageFor('gatheringChat');
    await page.locator('.wa-ai-v16').click();
    for (const next of ['gatheringSchedule', 'gatheringVenue', 'gatheringConfirm']) await page.locator('[data-a="' + next + '"]').click();
    await page.locator('[data-a="gatheringSources"]').click();
    assert.equal(await page.locator('.task-source').count(), 4);
    await page.locator('[data-task-back]').click();
    await page.locator('[data-a="gatheringExecuting"]').click();
    assert.equal(await page.locator('#overlay > section:visible').count(), 0);
    await page.waitForFunction(() => TaskStore.tasks.find(item => item.kind === 'gathering')?.steps[2]?.status === 'needs-input');
    assert.deepEqual((await task(page)).results.map(item => item.id), ['reservation', 'calendar']);
    await page.waitForSelector('.wa-draft-bar-v16:visible');
    assert.ok((await page.locator('.wa-draft-input-v16').inputValue()).length > 0);
    await page.locator('.wa-draft-send-v16').click();
    await page.waitForFunction(() => TaskStore.tasks.find(item => item.kind === 'gathering')?.phase === 'complete');
    assert.deepEqual((await task(page)).results.map(item => item.id), ['reservation', 'calendar', 'whatsapp']);
    assert.equal(await page.locator('.wa-draft-bar-v16').isVisible(), false);
    assert.equal(await page.locator('.wa-bubble-v16.me').last().isVisible(), true);
    await page.locator('#island').click();
    assert.equal(await page.locator('.task-panel').isVisible(), true);
    await page.locator('[data-return-gathering]').click();
    assert.equal(await page.locator('.wa-ai-v16').isVisible(), true);
    await finish(page);
  });
  await check('Voice transcription only fills the draft until the user sends it', async () => {
    const page = await pageFor('plan');
    await page.evaluate(() => {
      window.SpeechRecognition = class {
        start() { this.onstart(); this.onresult({ results: [[{ transcript: '按这个安排执行' }]] }); this.onend(); }
        stop() { this.onend(); }
      };
    });
    await page.locator('[data-task-mic]').click();
    assert.equal(await page.locator('[data-task-input]').inputValue(), '按这个安排执行');
    assert.equal((await task(page)).phase, 'review');
    assert.equal((await task(page)).confirmedSnapshot, null);
    await page.locator('.task-send').click();
    assert.equal((await task(page)).phase, 'executing');
    await finish(page);
  });
  await check('composer stays below the dialog and above keyboard; selected row and draft survive', async () => {
    const page = await pageFor('plan');
    const measure = () => page.evaluate(() => {
      const box = selector => { const r = document.querySelector(selector)?.getBoundingClientRect(); return r && { top: r.top, bottom: r.bottom, height: r.height }; };
      return { screen: box('.screen'), panel: box('.task-panel'), bar: box('.task-composer'), keys: box('.ios-keyboard-v10'), body: box('.task-body'), selected: box('[data-scope][aria-pressed=true]'), position: getComputedStyle(document.querySelector('.task-composer')).position, inputBackground: getComputedStyle(document.querySelector('[data-task-input]')).backgroundColor };
    });
    await pause(400);
    const idle = await measure();
    assert.equal(idle.position, 'absolute');
    assert.ok(Math.abs(idle.screen.bottom - idle.bar.bottom - 42) < 1);
    assert.equal(idle.inputBackground, 'rgba(0, 0, 0, 0)');
    await page.locator('[data-scope="preparation"]').click();
    await page.locator('[data-task-input]').click(); await pause(700);
    const editing = await measure();
    assert.ok(Math.abs(editing.panel.top - idle.panel.top) < 1);
    assert.ok(Math.abs(editing.keys.top - editing.bar.bottom - 8) < 1);
    assert.ok(editing.selected.bottom <= editing.body.bottom + 1, 'selected row stays visible');
    await page.locator('[data-task-input]').fill('准备一份简历\n打印作品集\n带上笔记本\n还有一支笔');
    assert.ok(await page.locator('[data-task-input]').evaluate(el => el.clientHeight <= 72));
    await page.locator('[data-key="return"]').click(); await pause(400);
    const dismissed = await measure();
    assert.ok(Math.abs(dismissed.screen.bottom - dismissed.bar.bottom - 42) < 1);
    assert.equal(await page.locator('.task-context span').innerText(), '准备事项');
    assert.ok((await page.locator('[data-task-input]').inputValue()).includes('打印作品集'));
    await finish(page);
  });
  await check('review feedback: rounded context, external send, conditional fade and legacy dock', async () => {
    const page = await pageFor('action');
    await pause(400);
    assert.equal(await page.locator('.task-panel').evaluate(el => getComputedStyle(el).maskImage), 'none');
    assert.equal(await page.locator('[data-task-menu] svg circle').count(), 3);
    assert.equal(await page.locator('[data-task-collapse] svg').count(), 1);
    await page.goto(url + '?screen=plan');
    await page.locator('[data-scope="preparation"]').click();
    assert.equal(await page.locator('.task-context').evaluate(el => getComputedStyle(el).borderRadius), '999px');
    assert.equal(await page.locator('.task-composer-input .task-send').count(), 0);
    await page.goto(url + '?screen=assistant');
    assert.equal(await page.locator('#overlay > .legacy-conversation-dock').count(), 1);
    await page.locator('[data-decision-input]').click(); await pause(500);
    assert.ok(await page.locator('.legacy-conversation-dock').evaluate(el => {
      const keys = document.querySelector('.ios-keyboard-v10').getBoundingClientRect();
      return Math.abs(keys.top - el.getBoundingClientRect().bottom - 8) < 1;
    }));
    await page.goto(url + '?screen=gatheringConfirm');
    assert.equal(await page.locator('.wa-ai-v16').count(), 0);
    await finish(page);
  });
  await browser.close();
  console.log(failures.length ? failures.length + ' checks failed' : 'All task conversation checks passed');
  process.exitCode = failures.length ? 1 : 0;
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
