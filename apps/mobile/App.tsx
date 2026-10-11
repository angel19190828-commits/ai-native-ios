import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AccountClient } from './src/api/accountClient';
import { AiApiClient, AiApiError } from './src/api/aiClient';
import { OrchestratorApiClient, OrchestrationContextInput } from './src/api/orchestratorClient';
import { RouteApiClient } from './src/api/routeClient';
import { TaskSyncClient, TaskSyncError } from './src/api/taskSyncClient';
import { createDeviceCapabilityRegistry, executeNextStep, openDocumentResult, resolveStepInput } from './src/capabilities';
import { Task, TaskEvent } from './src/domain/task';
import { createTaskFromPlan } from './src/domain/taskFactory';
import { createTaskFromDefinition } from './src/domain/planCompiler';
import { taskReducer } from './src/domain/taskReducer';
import { nextRecurrenceRun, nextTaskRunAt, waitsForFutureTime } from './src/domain/timeTrigger';
import { mergeRecoverySteps } from './src/domain/taskRecovery';
import { genericProposalToPlanDefinition } from './src/scenarios/generic';
import { clearLocalAuthSession, currentSession, getAccessToken, getSupabaseClient, isAuthConfigured, requestEmailCode, signOut, startAuthAutoRefresh, verifyEmailCode } from './src/auth/supabaseAuth';
import { createEncryptedTaskStore, deleteTaskEncryptionKey } from './src/storage/nativeStores';
import { ContentArtifactStore } from './src/storage/contentArtifactStore';
import { buildExplicitPreferenceContext } from './src/personalization/explicitPreferenceContext';
import { TaskCache } from './src/storage/taskCache';
import TaskspaceIntakeModule from './modules/taskspace-intake/src/TaskspaceIntakeModule';
import { consumeAppIntents, TaskspaceAppIntentInvocation } from './src/native/taskspaceAppIntents';
import { captureOperationalError, traceOperation, withMonitoring } from './src/observability/monitoring';
import { createBrowserQaProposal } from './src/testing/browserQaFixture';
import { HighFidelityExecutionSurface, HighFidelityIntake, HighFidelityTaskSurface } from './src/presentation/HighFidelityTaskUI';
import { createExecutionPresentationModel, createTaskPresentationModel } from './src/presentation/taskPresentation';

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string>();
  const [authEmail, setAuthEmail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [authNotice, setAuthNotice] = useState<string>();
  const [task, setTask] = useState<Task>();
  const [sourceText, setSourceText] = useState('');
  const [goalText, setGoalText] = useState('');
  const [sourceKind, setSourceKind] = useState<OrchestrationContextInput['kind']>('direct-input');
  const [origin, setOrigin] = useState('');
  const [draft, setDraft] = useState('按这个安排');
  const [selectedContext, setSelectedContext] = useState<string>();
  const [cacheReady, setCacheReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [notice, setNotice] = useState<string>();
  const executionController = useRef<AbortController | undefined>(undefined);
  const taskRef = useRef<Task | undefined>(undefined);
  const browserTestMode = Platform.OS === 'web';
  const guestAllowed = browserTestMode || process.env.EXPO_PUBLIC_ALLOW_GUEST === 'true';
  const taskCache = useMemo(() => {
    const namespace = userId ?? 'unauthenticated';
    return new TaskCache(createEncryptedTaskStore(namespace), 50, namespace);
  }, [userId]);
  const preferenceStore = useMemo(() => new ContentArtifactStore(
    createEncryptedTaskStore('capability-artifacts'), 'capability-artifacts',
  ), []);
  const lastTaskKey = `taskspace:${userId ?? 'unauthenticated'}:last-task:v1`;
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
  const aiClient = useMemo(() => new AiApiClient({
    baseUrl: apiBaseUrl,
    getAccessToken,
  }), [apiBaseUrl]);
  const orchestratorClient = useMemo(() => new OrchestratorApiClient({
    baseUrl: apiBaseUrl,
    getAccessToken,
    // Local Vercel + Metro can spend several seconds warming before the API's
    // own Gemini timeout starts. Keep native strict; give Browser Test Mode
    // enough time to receive an explicit backend response instead of aborting.
    timeoutMs: browserTestMode ? 45000 : undefined,
    // Keep the browser transport as a thin adapter. Calling through globalThis
    // preserves the browser fetch receiver without changing native networking.
    fetch: browserTestMode ? ((input, init) => globalThis.fetch(input, init)) : undefined,
  }), [apiBaseUrl, browserTestMode]);
  const routeClient = useMemo(() => new RouteApiClient({
    baseUrl: apiBaseUrl,
    getAccessToken,
  }), [apiBaseUrl]);
  const taskSyncClient = useMemo(() => new TaskSyncClient({ baseUrl: apiBaseUrl, getAccessToken }), [apiBaseUrl]);
  const accountClient = useMemo(() => new AccountClient({ baseUrl: apiBaseUrl, getAccessToken }), [apiBaseUrl]);
  const serverSyncEnabled = isAuthConfigured() && Boolean(apiBaseUrl);
  const useBrowserDemoPlanner = browserTestMode && !apiBaseUrl;
  const plannerSource = useBrowserDemoPlanner
    ? 'Planner: QA Fixture · 原因：未配置 EXPO_PUBLIC_API_BASE_URL'
    : 'Planner: Gemini · /api/orchestrate';

  const propose = async (input: Parameters<OrchestratorApiClient['propose']>[0]) => {
    if (useBrowserDemoPlanner) return {
      proposal: createBrowserQaProposal(input), requestId: `browser-${Crypto.randomUUID()}`,
      model: 'deterministic-browser-fixture', catalogVersion: 'browser-qa-v1',
    };
    return orchestratorClient.propose(input);
  };

  useEffect(() => { taskRef.current = task; }, [task]);

  const handleAppIntent = (invocation: TaskspaceAppIntentInvocation) => {
      if (invocation.name === 'createTask') {
        const request = typeof invocation.params.request === 'string' ? invocation.params.request : '';
        executionController.current?.abort();
        setTask(undefined);
        setSourceText(request);
        setGoalText(request);
        setSourceKind('direct-input');
        setOrigin('');
        setSelectedContext(undefined);
        setNotice(request ? '已从 Siri 或快捷指令带入任务内容，请检查后生成计划。' : '已打开新任务，请输入目标。');
      } else if (invocation.name === 'showPendingDecision') {
        setNotice(task?.pendingDecision?.prompt ?? '当前没有等待你处理的决定。');
      } else if (invocation.name === 'continueTask') {
        setNotice(task ? '已打开最近的任务和执行回执。' : '当前没有可继续的任务。');
      } else if (invocation.name === 'requestStopTask') {
        setNotice(task?.phase === 'executing' || task?.phase === 'waiting' ? '请在灵动岛点击橙色停止按钮，确认停止剩余操作。' : '当前没有正在执行的任务。');
      }
  };

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const consume = async () => { for (const invocation of await consumeAppIntents()) handleAppIntent(invocation); };
    void consume();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void consume(); });
    return () => subscription.remove();
  }, [task]);

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      let parsed: URL;
      try { parsed = new URL(url); } catch { return; }
      const action = parsed.hostname || parsed.pathname.replace(/^\//, '');
      if (action === 'create') {
        executionController.current?.abort();
        setTask(undefined);
        setSourceText(parsed.searchParams.get('text') ?? '');
        setGoalText(parsed.searchParams.get('text') ?? '');
        setSourceKind('direct-input');
        setSelectedContext(undefined);
        setNotice('已从系统快捷方式打开新任务。');
      } else if (action === 'continue') {
        setNotice(taskRef.current ? '已打开最近的任务和执行回执。' : '当前没有可继续的任务。');
      } else if (action === 'stop') {
        setNotice(taskRef.current?.phase === 'executing' || taskRef.current?.phase === 'waiting' ? '请点击橙色停止按钮确认停止剩余操作。' : '当前没有正在执行的任务。');
      }
    };
    void Linking.getInitialURL().then((url) => { if (url) handleUrl({ url }); });
    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const intakeModule = TaskspaceIntakeModule;
    if (Platform.OS !== 'android' || !intakeModule) return;
    const consume = async () => {
      const text = await intakeModule.consumeSharedTextAsync();
      if (!text) return;
      executionController.current?.abort();
      setTask(undefined);
      setSourceText(text);
      setGoalText('根据这些内容帮我形成一个可执行的安排');
      setSourceKind('shared-content');
      setOrigin('');
      setSelectedContext(undefined);
      setNotice('已从其他 App 接收文字，请检查后生成计划。');
    };
    void consume();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void consume(); });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!isAuthConfigured()) {
      if (guestAllowed) setUserId('local-guest');
      setAuthReady(true);
      return () => { mounted = false; };
    }
    const stopRefresh = startAuthAutoRefresh();
    const { data: listener } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      if (mounted) setUserId(session?.user.id);
    });
    void currentSession().then((session) => { if (mounted) setUserId(session?.user.id); }).catch(() => {
      captureOperationalError('auth_session_restore_failed', { phase: 'authentication', operation: 'session.restore' });
      if (mounted) setAuthNotice('无法恢复登录会话。');
    }).finally(() => { if (mounted) setAuthReady(true); });
    return () => {
      mounted = false;
      stopRefresh();
      listener.subscription.unsubscribe();
    };
  }, [guestAllowed]);

  useEffect(() => {
    if (!authReady || !userId) return;
    let mounted = true;
    setCacheReady(false);
    void (async () => {
      try {
        const lastTaskId = await AsyncStorage.getItem(lastTaskKey);
        let restored: Task | undefined;
        let serverRestoreSucceeded = false;
        if (serverSyncEnabled) {
          try {
            restored = await taskSyncClient.latest();
            serverRestoreSucceeded = true;
            if (restored) {
              await taskCache.save(restored);
              await AsyncStorage.setItem(lastTaskKey, restored.id);
            } else if (lastTaskId) {
              await taskCache.remove(lastTaskId);
              await AsyncStorage.removeItem(lastTaskKey);
            }
          } catch {
            captureOperationalError('server_task_restore_failed', { phase: 'restoring', operation: 'task.restore' });
            if (mounted) setNotice('服务端任务暂时不可用，正在显示这台设备最近保存的状态。');
          }
        }
        if (!serverRestoreSucceeded) restored ??= lastTaskId ? await taskCache.load(lastTaskId) : undefined;
        if (!mounted || !restored) return;
        const interrupted = restored.steps.find((step) => step.status === 'running');
        if (restored.phase === 'executing' && interrupted) {
          const event: TaskEvent = { type: 'step.failed', at: new Date().toISOString(), stepId: interrupted.id };
          restored = taskReducer(restored, event);
          if (serverSyncEnabled) restored = await taskSyncClient.sync(restored, event);
          await taskCache.save(restored);
          if (mounted) setNotice('上次操作在确认结果前中断，系统没有重复执行；请检查已完成结果并调整未完成步骤。');
        }
        setTask(restored);
        const restoredDraft = await taskCache.loadDraft(restored.id);
        setDraft(restored.phase === 'needs_decision' ? restoredDraft : restoredDraft || '按这个安排');
      } catch {
        captureOperationalError('local_task_restore_failed', { phase: 'restoring', operation: 'task.restore' });
        if (mounted) setNotice('本地任务恢复失败；发送前请重新检查安排。');
      } finally {
        if (mounted) setCacheReady(true);
      }
    })();
    return () => { mounted = false; };
  }, [authReady, lastTaskKey, serverSyncEnabled, taskCache, taskSyncClient, userId]);

  useEffect(() => {
    if (!cacheReady || !task) return;
    const timer = setTimeout(() => {
      void taskCache.saveDraft(task.id, draft).catch(() => setNotice('草稿尚未保存。'));
    }, 200);
    return () => clearTimeout(timer);
  }, [cacheReady, draft, task]);

  const saveSnapshot = async (next: Task, event?: TaskEvent | { type: 'task.created'; at: string }) => {
    const canonical = serverSyncEnabled ? await taskSyncClient.sync(next, event) : next;
    await taskCache.save(canonical);
    return canonical;
  };

  const appendEvent = async (taskId: string, event: TaskEvent) => {
    const current = await taskCache.load(taskId);
    if (!current) throw new Error(`Cannot append to missing task: ${taskId}`);
    const next = taskReducer(current, event);
    return saveSnapshot(next, event);
  };

  const analyzeInvitation = async () => {
    setNotice(undefined);
    if (!sourceText.trim()) return setNotice('先粘贴邀请或通知内容。');
    if (!apiBaseUrl && !useBrowserDemoPlanner) return setNotice('尚未配置 EXPO_PUBLIC_API_BASE_URL，无法连接 AI 服务。');
    if (useBrowserDemoPlanner) return analyzeGoal();
    setBusy(true);
    try {
      const response = await traceOperation('task.plan', 'ai.plan', () => aiClient.planInvitation({
        sourceText,
        locale: Intl.DateTimeFormat().resolvedOptions().locale || 'zh-CN',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }));
      const now = new Date().toISOString();
      const proposedTask = createTaskFromPlan({ id: Crypto.randomUUID(), request: sourceText, plan: response.plan, now, origin: origin.trim() || undefined });
      const nextTask = await saveSnapshot(proposedTask, { type: 'task.created', at: now });
      await AsyncStorage.setItem(lastTaskKey, nextTask.id);
      await taskCache.saveDraft(nextTask.id, nextTask.phase === 'needs_decision' ? '' : '按这个安排');
      setTask(nextTask);
      setDraft(nextTask.phase === 'needs_decision' ? '' : '按这个安排');
      setSelectedContext(undefined);
      if (nextTask.phase === 'needs_decision') setNotice(nextTask.pendingDecision?.prompt);
    } catch (error) {
      const code = error instanceof AiApiError ? error.code : 'unknown';
      captureOperationalError(`ai_plan_${code}`, { phase: 'planning', operation: 'ai.plan' });
      setNotice(`AI 规划失败（${code}）。你的原始内容仍保留，可以重试。`);
    } finally {
      setBusy(false);
    }
  };

  const analyzeGoal = async () => {
    setNotice(undefined);
    const goal = (sourceKind === 'direct-input' ? sourceText : goalText).trim();
    if (!goal) return setNotice('先描述你想完成的目标。');
    if (!apiBaseUrl && !useBrowserDemoPlanner) return setNotice('尚未配置 EXPO_PUBLIC_API_BASE_URL，无法连接 AI 服务。');
    let preferenceContext: OrchestrationContextInput | undefined;
    try {
      preferenceContext = buildExplicitPreferenceContext(await preferenceStore.listPreferences(userId ?? 'local-user'));
    } catch {
      captureOperationalError('explicit_preferences_restore_failed', { phase: 'planning', operation: 'preference.restore' });
      return setNotice('无法读取已确认的偏好，因此没有开始规划。请重试或检查本地任务存储。');
    }
    setBusy(true);
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'zh-CN';
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const context: OrchestrationContextInput[] = [
        { id: 'primary-context', kind: sourceKind, content: goal },
        ...(origin.trim() ? [{ id: 'origin', kind: 'direct-input' as const, title: '出发地点', content: origin.trim() }] : []),
        ...(preferenceContext ? [preferenceContext] : []),
      ];
      const response = await traceOperation('task.plan', 'ai.plan', () => propose({ goal, context, locale, timeZone }));
      const now = new Date().toISOString();
      const proposedTask = createTaskFromDefinition({
        id: Crypto.randomUUID(), request: goal, now,
        plan: genericProposalToPlanDefinition({ request: goal, proposal: response.proposal, context, now, origin: origin.trim() || undefined }),
      });
      const nextTask = await saveSnapshot(proposedTask, { type: 'task.created', at: now });
      await AsyncStorage.setItem(lastTaskKey, nextTask.id);
      await taskCache.saveDraft(nextTask.id, nextTask.phase === 'needs_decision' ? '' : '按这个安排');
      setTask(nextTask);
      setDraft(nextTask.phase === 'needs_decision' ? '' : '按这个安排');
      setSelectedContext(undefined);
      if (nextTask.phase === 'needs_decision') setNotice(nextTask.pendingDecision?.prompt);
    } catch (error) {
      const code = error instanceof AiApiError ? error.code : 'unknown';
      captureOperationalError(`orchestrator_plan_${code}`, { phase: 'planning', operation: 'ai.plan' });
      const debug = browserTestMode && error instanceof AiApiError
        ? ` 请求：${apiBaseUrl.replace(/\/$/, '')}/api/orchestrate · HTTP：${error.status ?? '未收到'} · code：${code}${error.detail ? ` · ${error.detail}` : ''}`
        : '';
      setNotice(`Gemini planner 调用失败（${code}）。未使用 QA Fixture；你的输入仍保留，可以重试。${debug}`);
    } finally {
      setBusy(false);
    }
  };

  const submitDecision = async () => {
    if (!task?.pendingDecision) return;
    const answer = draft.trim();
    if (!answer || answer === '按这个安排') return setNotice('先回答当前问题，再发送。');
    if (!apiBaseUrl && !useBrowserDemoPlanner) return setNotice('尚未配置 API，无法继续规划。');
    setBusy(true);
    setNotice(undefined);
    try {
      const at = new Date().toISOString();
      let planning = await appendEvent(task.id, { type: 'decision.resolved', at });
      setTask(planning);
      let candidate: Task;
      if (task.goal?.id === 'general-intent') {
        const priorContext: OrchestrationContextInput[] = (task.context ?? []).map((item) => ({
          id: item.id, kind: item.kind, sourceApp: item.sourceApp, title: item.title,
          content: typeof item.data.content === 'string' ? item.data.content : JSON.stringify(item.data),
        }));
        const decisionContext: OrchestrationContextInput = {
          id: `decision-${task.revision + 1}`, kind: 'direct-input', title: task.pendingDecision.prompt,
          content: answer,
        };
        const context = [...priorContext, decisionContext];
        const response = await traceOperation('task.replan', 'ai.plan', () => propose({
          goal: task.goal?.summary ?? task.request,
          context,
          locale: Intl.DateTimeFormat().resolvedOptions().locale || 'zh-CN',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }));
        candidate = createTaskFromDefinition({
          id: task.id, request: task.request, now: at,
          plan: genericProposalToPlanDefinition({ request: task.request, proposal: response.proposal, context, now: at, origin: task.facts.origin }),
        });
      } else {
        const response = await traceOperation('task.replan', 'ai.plan', () => aiClient.planInvitation({
          sourceText: task.request,
          locale: Intl.DateTimeFormat().resolvedOptions().locale || 'zh-CN',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }));
        candidate = createTaskFromPlan({ id: task.id, request: task.request, plan: response.plan, now: at, origin: answer });
      }
      planning = await appendEvent(planning.id, {
        type: 'planning.ready', at, facts: candidate.facts, steps: candidate.steps,
        goal: candidate.goal, context: candidate.context, triggers: candidate.triggers,
      });
      if (candidate.pendingDecision) {
        planning = await appendEvent(planning.id, { type: 'decision.required', at, decision: candidate.pendingDecision });
      }
      setTask(planning);
      setDraft(candidate.pendingDecision ? '' : '按这个安排');
      setSelectedContext(undefined);
      setNotice(candidate.pendingDecision?.prompt ?? '已根据你的回答更新计划，请重新审阅。');
    } catch (error) {
      const code = error instanceof AiApiError ? error.code : 'unknown';
      captureOperationalError(`decision_replan_${code}`, { phase: 'planning', operation: 'task.replan' });
      try {
        const restored = await appendEvent(task.id, { type: 'decision.required', at: new Date().toISOString(), decision: task.pendingDecision });
        setTask(restored);
        setNotice(`继续规划失败（${code}）。你的回答仍保留，可以重试。`);
      } catch {
        captureOperationalError('decision_restore_failed', { phase: 'planning', operation: 'task.replan' });
        setNotice('继续规划失败，并且无法恢复决定状态。尚未确认或执行任何新操作，请重新载入任务。');
      }
    } finally {
      setBusy(false);
    }
  };

  const executeConfirmedTask = async (confirmed: Task) => {
    const controller = new AbortController();
    executionController.current = controller;
    let current = confirmed.phase === 'executing' ? confirmed : await appendEvent(confirmed.id, { type: 'execution.started', at: new Date().toISOString() });
    setTask(current);
    const registry = createDeviceCapabilityRegistry(routeClient);
    try {
      while (current.phase === 'executing' && !controller.signal.aborted) {
        const next = current.steps.find((candidate) => candidate.status === 'waiting'
          && candidate.dependsOn.every((id) => current.steps.find((dependency) => dependency.id === id)?.status === 'completed'));
        if (next?.policy?.confirmation === 'always' && !next.approval) {
          setNotice('这项操作需要执行前单独批准。尚未产生任何外部影响。');
          break;
        }
        let emitted = current;
        const outcome = await traceOperation('task.execute_step', 'task.execute', () => executeNextStep(current, registry, {
          userId: userId ?? 'local-user',
          deviceId: 'local-device',
          signal: controller.signal,
          createAttemptId: Crypto.randomUUID,
          onEvent: async (event) => {
            if (controller.signal.aborted && event.type === 'step.failed') return;
            emitted = await appendEvent(confirmed.id, event);
            current = emitted;
            setTask(emitted);
          },
        }));
        current = emitted;
        if (!outcome) {
          if (current.steps.some((step) => step.status === 'running')) {
            setNotice('上次系统操作的结果尚未核对；不会自动重复执行。');
          }
          break;
        }
        if (outcome.error) {
          setNotice(`执行停在 ${outcome.error.code}。已完成的步骤和回执会保留。`);
          break;
        }
      }
      if (current.phase === 'completed' || current.phase === 'failed' || current.phase === 'partially_completed') {
        const nextRunAt = nextRecurrenceRun(current);
        if (nextRunAt) {
          const occurrenceFailed = current.phase !== 'completed';
          current = await appendEvent(current.id, { type: 'recurrence.scheduled', at: new Date().toISOString(), nextRunAt });
          setTask(current);
          setDraft('重复任务已继续');
          setNotice(occurrenceFailed
            ? `本次运行未完成，失败状态和已有回执已保留；规则继续，下一次将在 ${new Date(nextRunAt).toLocaleString()}。`
            : `本次运行已完成并保存回执；下一次将在 ${new Date(nextRunAt).toLocaleString()}。`);
        } else if (current.phase === 'completed') {
          setDraft('全部完成');
          setNotice('计划中的所有步骤均已完成，并保存了执行回执。');
        } else {
          setDraft('');
          setNotice(current.phase === 'partially_completed'
            ? '部分步骤没有完成；已完成的结果会保留且不会自动重复。请选择未完成步骤进行调整。'
            : '任务没有完成，系统已停止继续执行。请选择未完成步骤进行调整。');
        }
      }
    } catch {
      captureOperationalError('execution_record_interrupted', { phase: 'executing', operation: 'task.execute' });
      if (!controller.signal.aborted) setNotice('执行记录中断；已停止派发新操作，请从当前回执恢复。');
    } finally {
      if (executionController.current === controller) executionController.current = undefined;
    }
  };

  const confirmPlan = async () => {
    if (!task || task.phase === 'needs_decision') return setNotice(task?.pendingDecision?.prompt ?? '计划还不能确认。');
    if (selectedContext && draft.trim() !== '按这个安排') {
      return setNotice(`${selectedContext}的自然语言修改尚未提交到 AI；当前计划没有被更改。`);
    }
    setBusy(true);
    setNotice(undefined);
    try {
      const at = new Date().toISOString();
      const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify({
        revision: task.revision,
        goal: task.goal,
        context: task.context,
        triggers: task.triggers,
        facts: task.facts,
        steps: task.steps,
      }));
      const confirmed = await appendEvent(task.id, {
        type: 'plan.confirmed',
        at,
        snapshot: { revision: task.revision, digest, confirmedAt: at, steps: JSON.parse(JSON.stringify(task.steps)) as Task['steps'] },
      });
      setTask(confirmed);
      setDraft('已确认，开始执行');
      setSelectedContext(undefined);
      const runAt = waitsForFutureTime(confirmed);
      if (runAt) {
        const waiting = await appendEvent(confirmed.id, { type: 'trigger.waiting', at, runAt });
        setTask(waiting);
        setNotice(`任务已保存，将等待到 ${new Date(runAt).toLocaleString()} 后继续。`);
      } else {
        setNotice('计划已锁定，正在按确认顺序执行。');
        await executeConfirmedTask(confirmed);
      }
    } catch {
      captureOperationalError('confirmation_persist_failed', { phase: 'confirming', operation: 'plan.confirm' });
      setNotice('确认没有保存成功，尚未开始任何系统操作。');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (task?.phase !== 'waiting') return;
    const runAt = nextTaskRunAt(task);
    if (!runAt) {
      setNotice('等待条件无效；任务不会执行，请返回修改计划。');
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = () => {
      if (!active) return;
      const delay = Date.parse(runAt) - Date.now();
      if (delay > 0) {
        timer = setTimeout(poll, Math.min(delay, 60_000));
        return;
      }
      active = false;
      void (async () => {
        try {
          const current = taskRef.current;
          if (!current || current.id !== task.id || current.phase !== 'waiting') return;
          const fired = await appendEvent(current.id, { type: 'trigger.fired', at: new Date().toISOString() });
          setTask(fired);
          setNotice('时间条件已满足，正在继续已确认的任务。');
          await executeConfirmedTask(fired);
        } catch {
          setNotice('时间条件已满足，但任务恢复失败；尚未派发新的操作。');
        }
      })();
    };
    poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [task?.id, task?.phase, task?.revision, task?.triggerState?.nextRunAt]);

  const approveStep = async (stepId: string) => {
    if (!task || task.phase !== 'executing') return;
    const step = task.steps.find((candidate) => candidate.id === stepId);
    if (!step || step.status !== 'waiting' || step.policy?.confirmation !== 'always') return;
    setBusy(true);
    try {
      const approved = await appendEvent(task.id, {
        type: 'step.approved', at: new Date().toISOString(), stepId,
        revision: task.revision, capabilityId: step.capabilityId, input: resolveStepInput(step, task),
      });
      setTask(approved);
      setNotice('已批准当前操作；正在执行。');
      await executeConfirmedTask(approved);
    } catch {
      setNotice('逐次批准没有保存成功；操作尚未执行。');
    } finally {
      setBusy(false);
    }
  };

  const declineStepApproval = async (stepId: string) => {
    if (!task || task.phase !== 'executing') return;
    setBusy(true);
    try {
      const declined = await appendEvent(task.id, { type: 'step.approval_declined', at: new Date().toISOString(), stepId });
      setTask(declined);
      setDraft('按这个安排');
      setNotice('你拒绝了这次操作。原计划未执行，可以修改、重新确认或停止任务。');
    } catch {
      setNotice('拒绝操作没有保存成功；系统仍不会执行这项操作。');
    } finally {
      setBusy(false);
    }
  };

  const revisePlan = async () => {
    if (!task || !selectedContext) return;
    const instruction = draft.trim();
    if (!instruction || instruction === '按这个安排') return setNotice('请先写下想修改的内容。');
    if (!apiBaseUrl && !useBrowserDemoPlanner) return setNotice('尚未配置 API，无法修改计划。');
    setBusy(true);
    setNotice(undefined);
    try {
      const at = new Date().toISOString();
      const priorContext: OrchestrationContextInput[] = task.context?.length
        ? task.context.map((item) => ({
          id: item.id, kind: item.kind, sourceApp: item.sourceApp, title: item.title,
          content: typeof item.data.content === 'string' ? item.data.content : JSON.stringify(item.data),
        }))
        : [{ id: 'reference-source', kind: 'email', title: '原始邀请', content: task.request }];
      const context: OrchestrationContextInput[] = [...priorContext, {
        id: `review-change-${task.revision + 1}`, kind: 'direct-input',
        title: `修改：${selectedContext}`, content: instruction,
      }];
      const response = await traceOperation('task.revise', 'ai.plan', () => propose({
        goal: task.goal?.summary ?? task.request, context,
        locale: Intl.DateTimeFormat().resolvedOptions().locale || 'zh-CN',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }));
      const candidate = createTaskFromDefinition({
        id: task.id, request: task.request, now: at,
        plan: genericProposalToPlanDefinition({ request: task.request, proposal: response.proposal, context, now: at, origin: task.facts.origin }),
      });
      let revised = await appendEvent(task.id, { type: 'planning.started', at });
      const recovery = task.phase === 'failed' || task.phase === 'partially_completed';
      revised = await appendEvent(revised.id, {
        type: 'planning.ready', at, facts: candidate.facts, steps: recovery ? mergeRecoverySteps(task.steps, candidate.steps) : candidate.steps,
        goal: candidate.goal, context: candidate.context, triggers: candidate.triggers,
      });
      if (candidate.pendingDecision) revised = await appendEvent(revised.id, { type: 'decision.required', at, decision: candidate.pendingDecision });
      setTask(revised);
      setDraft('按这个安排');
      setSelectedContext(undefined);
      setNotice(candidate.pendingDecision?.prompt ?? '计划已按你的修改更新；这是新的 revision，请重新审阅。');
    } catch (error) {
      const code = error instanceof AiApiError ? error.code : 'unknown';
      captureOperationalError(`review_replan_${code}`, { phase: 'planning', operation: 'task.revise' });
      setNotice(`计划修改失败（${code}）。原计划和你的输入均未执行，可以重试。`);
    } finally {
      setBusy(false);
    }
  };

  const reorderPlan = async (orderedRows: Array<{ id: string; primary: string }>) => {
    if (!task || task.phase !== 'ready' || orderedRows.length < 2) return;
    if (!apiBaseUrl && !useBrowserDemoPlanner) return setNotice('尚未配置 API，无法重新安排计划。');
    setBusy(true);
    setReordering(true);
    setNotice(undefined);
    try {
      const at = new Date().toISOString();
      const priorContext: OrchestrationContextInput[] = task.context?.length
        ? task.context.map((item) => ({
          id: item.id, kind: item.kind, sourceApp: item.sourceApp, title: item.title,
          content: typeof item.data.content === 'string' ? item.data.content : JSON.stringify(item.data),
        }))
        : [{ id: 'reference-source', kind: 'direct-input', title: '原始目标', content: task.request }];
      const proposedOrder = orderedRows.map((row, index) => `${index + 1}. ${row.primary}`).join('\n');
      const context: OrchestrationContextInput[] = [...priorContext, {
        id: `review-reorder-${task.revision + 1}`,
        kind: 'direct-input',
        title: '调整计划顺序',
        content: `用户拖动计划项后提出以下新顺序。请根据这个顺序重新计算受影响的时间、路线、提醒和依赖关系；不要沿用与新顺序冲突的旧时间。\n${proposedOrder}`,
      }];
      const response = await traceOperation('task.reorder', 'ai.plan', () => propose({
        goal: task.goal?.summary ?? task.request,
        context,
        locale: Intl.DateTimeFormat().resolvedOptions().locale || 'zh-CN',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }));
      const candidate = createTaskFromDefinition({
        id: task.id, request: task.request, now: at,
        plan: genericProposalToPlanDefinition({ request: task.request, proposal: response.proposal, context, now: at, origin: task.facts.origin }),
      });
      let revised = await appendEvent(task.id, { type: 'planning.started', at });
      revised = await appendEvent(revised.id, {
        type: 'planning.ready', at, facts: candidate.facts, steps: candidate.steps,
        goal: candidate.goal, context: candidate.context, triggers: candidate.triggers,
      });
      if (candidate.pendingDecision) revised = await appendEvent(revised.id, { type: 'decision.required', at, decision: candidate.pendingDecision });
      setTask(revised);
      setDraft('按这个安排');
      setSelectedContext(undefined);
      setNotice(candidate.pendingDecision?.prompt ?? '已经按新的顺序重新安排。');
    } catch (error) {
      const code = error instanceof AiApiError ? error.code : 'unknown';
      captureOperationalError(`review_reorder_${code}`, { phase: 'planning', operation: 'task.reorder' });
      setNotice(`重新安排失败，原计划未修改（${code}）。可以再次拖动重试。`);
    } finally {
      setReordering(false);
      setBusy(false);
    }
  };

  const stopExecution = async () => {
    if (!task || (task.phase !== 'executing' && task.phase !== 'waiting')) return;
    executionController.current?.abort();
    try {
      const requested = await appendEvent(task.id, { type: 'stop.requested', at: new Date().toISOString() });
      const stopped = await appendEvent(requested.id, { type: 'task.stopped', at: new Date().toISOString() });
      setTask(stopped);
      setNotice('已停止剩余操作；已经完成的操作和回执不会被隐藏。');
    } catch (error) {
      captureOperationalError(error instanceof TaskSyncError && error.status === 409 ? 'stop_sync_conflict' : 'stop_persist_failed', { phase: 'stopping', operation: 'task.stop' });
      setNotice(error instanceof TaskSyncError && error.status === 409 ? '任务已在另一台设备更新，请重新载入后再停止。' : '停止请求未能保存，请检查当前任务状态。');
    }
  };

  const startNewTask = async () => {
    await AsyncStorage.removeItem(lastTaskKey);
    setTask(undefined);
    setSourceText('');
    setGoalText('');
    setSourceKind('direct-input');
    setOrigin('');
    setDraft('按这个安排');
    setSelectedContext(undefined);
    setNotice(undefined);
  };

  const sendLoginCode = async () => {
    setBusy(true);
    setAuthNotice(undefined);
    try {
      const normalized = await requestEmailCode(authEmail);
      setAuthEmail(normalized);
      setCodeSent(true);
      setAuthNotice('验证码已经发送，请检查邮箱。');
    } catch (error) {
      setAuthNotice(error instanceof Error ? error.message : '验证码发送失败。');
    } finally {
      setBusy(false);
    }
  };

  const completeLogin = async () => {
    setBusy(true);
    setAuthNotice(undefined);
    try {
      const session = await verifyEmailCode(authEmail, authCode);
      setUserId(session.user.id);
    } catch (error) {
      setAuthNotice(error instanceof Error ? error.message : '登录失败。');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await signOut();
    executionController.current?.abort();
    setTask(undefined);
    setCacheReady(false);
    setUserId(undefined);
  };

  const requestAccountDeletion = () => {
    if (!userId || !serverSyncEnabled) {
      setNotice('账户删除尚未配置，请联系支持。');
      return;
    }
    Alert.alert(
      '永久删除账户？',
      '这会删除云端任务、执行记录、设备记录，以及这台设备上的任务和草稿。此操作无法撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除账户',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const deletedNamespace = userId;
              setBusy(true);
              try {
                await accountClient.deleteAccount();
                let cleanupFailed = false;
                try {
                  await taskCache.clearAll();
                  await AsyncStorage.removeItem(lastTaskKey);
                } catch {
                  cleanupFailed = true;
                  captureOperationalError('account_local_records_cleanup_failed', { phase: 'account', operation: 'account.delete' });
                }
                try {
                  await deleteTaskEncryptionKey(deletedNamespace);
                } catch {
                  cleanupFailed = true;
                  captureOperationalError('account_local_key_cleanup_failed', { phase: 'account', operation: 'account.delete' });
                }
                try {
                  await clearLocalAuthSession();
                } catch {
                  cleanupFailed = true;
                  captureOperationalError('account_local_session_cleanup_failed', { phase: 'account', operation: 'account.delete' });
                }
                executionController.current?.abort();
                setTask(undefined);
                setCacheReady(false);
                setUserId(undefined);
                setAuthEmail('');
                setAuthCode('');
                setCodeSent(false);
                setAuthNotice(cleanupFailed ? '云端账户已删除；这台设备的本地清理未完全完成，请联系支持或卸载 App。' : '账户和任务已永久删除。');
              } catch {
                captureOperationalError('account_deletion_failed', { phase: 'account', operation: 'account.delete' });
                setNotice('账户删除没有完成；本地数据和登录状态均已保留，请重试。');
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const requestTaskDeletion = () => {
    if (!task) return;
    Alert.alert(
      '永久删除这个任务？',
      '任务内容、确认快照和执行回执都会被删除。已经写入其他 App 的日历或提醒不会自动撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除任务',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                if (serverSyncEnabled) await taskSyncClient.delete(task.id);
                await taskCache.remove(task.id);
                await AsyncStorage.removeItem(lastTaskKey);
                executionController.current?.abort();
                setTask(undefined);
                setSourceText('');
                setGoalText('');
                setSourceKind('direct-input');
                setOrigin('');
                setDraft('按这个安排');
                setSelectedContext(undefined);
                setNotice('任务已永久删除。');
              } catch {
                captureOperationalError('task_deletion_failed', { phase: task.phase, operation: 'task.delete' });
                setNotice('任务删除没有完成，当前数据已保留，请重试。');
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  if (!authReady) return <SafeAreaView style={[styles.screen, styles.center]}><ActivityIndicator color="#1266fa" /></SafeAreaView>;
  if (!userId) return <AuthScreen configured={isAuthConfigured()} email={authEmail} setEmail={setAuthEmail} code={authCode} setCode={setAuthCode} codeSent={codeSent} notice={authNotice} busy={busy} sendCode={sendLoginCode} verify={completeLogin} />;
  if (!cacheReady) return <SafeAreaView style={[styles.screen, styles.center]}><ActivityIndicator color="#1266fa" /></SafeAreaView>;
  if (!task) return <HighFidelityIntake sourceText={sourceText} setSourceText={setSourceText} goalText={goalText} setGoalText={setGoalText} sourceKind={sourceKind} setSourceKind={setSourceKind} origin={origin} setOrigin={setOrigin} busy={busy} notice={notice} plannerSource={plannerSource} analyzeGoal={analyzeGoal} />;

  if (task.phase === 'draft' || task.phase === 'planning' || task.phase === 'needs_decision' || task.phase === 'ready') {
    const presentation = createTaskPresentationModel(task);
    return <HighFidelityTaskSurface
      model={presentation}
      selectedContext={selectedContext}
      draft={draft}
      setDraft={setDraft}
      busy={busy}
      reordering={reordering}
      notice={notice}
      browserTestMode={browserTestMode}
      plannerSource={plannerSource}
      onSelectRow={(row) => {
        setSelectedContext(row.primary);
        setDraft((current) => current === '按这个安排' ? '' : current);
      }}
      onClearContext={() => setSelectedContext(undefined)}
      onStartNewTask={startNewTask}
      onReorder={reorderPlan}
      onSend={task.phase === 'needs_decision'
        ? submitDecision
        : selectedContext && draft.trim() !== '按这个安排'
          ? revisePlan
          : confirmPlan}
    />;
  }

  if (task.phase === 'waiting' || task.phase === 'executing' || task.phase === 'completed' || task.phase === 'partially_completed' || task.phase === 'failed' || task.phase === 'stopped') {
    const presentation = createExecutionPresentationModel(task);
    return <HighFidelityExecutionSurface
      model={presentation}
      notice={notice}
      browserTestMode={browserTestMode}
      plannerSource={plannerSource}
      busy={busy}
      selectedContext={selectedContext}
      draft={draft}
      setDraft={setDraft}
      onSelectFailedStep={(step) => {
        setSelectedContext(step.title);
        setDraft('');
      }}
      onOpenResult={(step) => {
        if (step.result?.actionOutput) void openDocumentResult(step.result.actionOutput).catch((error) => {
          setNotice(error instanceof Error ? error.message : '无法打开文件');
        });
      }}
      onClearContext={() => setSelectedContext(undefined)}
      onRecover={revisePlan}
      onApprove={approveStep}
      onDeclineApproval={declineStepApproval}
      onStop={stopExecution}
      onStartNewTask={startNewTask}
    />;
  }

  return null;
}

function IntakeScreen({ sourceText, setSourceText, goalText, setGoalText, sourceKind, setSourceKind, origin, setOrigin, busy, notice, plannerSource, analyzeGoal, analyzeInvitation, deleteAccount }: {
  sourceText: string; setSourceText: (value: string) => void; goalText: string; setGoalText: (value: string) => void;
  sourceKind: OrchestrationContextInput['kind']; setSourceKind: (value: OrchestrationContextInput['kind']) => void;
  origin: string; setOrigin: (value: string) => void; busy: boolean; notice?: string; plannerSource: string;
  analyzeGoal: () => void; analyzeInvitation: () => void; deleteAccount?: () => void;
}) {
  const contextMode = sourceKind !== 'direct-input';
  const useDinnerDemo = () => {
    setSourceKind('message');
    setGoalText('根据群聊安排周五晚餐，创建日历、计算通勤并提醒我出发');
    setSourceText('Mia：周五一起吃饭？\nAlex：晚上 7 点后可以，最好 Downtown。\nSam：想吃日料。\nJo：六个人，需要预留座位。\n暂定 Miku Vancouver，200 Granville Street。');
    setOrigin('');
  };
  const useInterviewDemo = () => {
    setSourceKind('email');
    setGoalText('安排这封面试邀请');
    setSourceText('Hi Jade,\n\nYour in-person interview with Alex is on July 28, 2027 at 10:30 AM. The address is 555 Burrard Street. Please arrive 15 minutes early and bring your portfolio.\n\nIf you need to reschedule, please contact Alex.');
    setOrigin('1285 W Pender Street, Vancouver');
  };
  return <SafeAreaView style={styles.screen}><StatusBar style="dark" /><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.intakeContent}>
    {Platform.OS === 'web' ? <View style={styles.browserBanner}><Text style={styles.browserBannerTitle}>WINDOWS 浏览器测试模式</Text><Text style={styles.browserBannerText}>{plannerSource}</Text><Text style={styles.browserBannerText}>Calendar、Notifications、App Intents、Sharesheet 仍需之后 iPhone 真机验证。</Text></View> : null}
    <Text style={styles.brand}>TASKSPACE AI</Text><Text style={styles.intakeTitle}>从意图开始，跨 App 完成</Text><Text style={styles.intakeSubtitle}>AI 会理解目标与当前上下文，提出可审阅计划，补齐决定，再通过已注册能力执行并留下回执。</Text>
    <View style={styles.entryTabs}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: !contextMode }} onPress={() => { setSourceKind('direct-input'); setGoalText(''); }} style={[styles.entryTab, !contextMode && styles.entryTabSelected]}><Text style={[styles.entryTabText, !contextMode && styles.entryTabTextSelected]}>直接说目标</Text></Pressable>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: contextMode }} onPress={() => { setSourceKind('shared-content'); if (!goalText) setGoalText('根据这些内容帮我完成一个任务'); }} style={[styles.entryTab, contextMode && styles.entryTabSelected]}><Text style={[styles.entryTabText, contextMode && styles.entryTabTextSelected]}>使用当前上下文</Text></Pressable>
    </View>
    {contextMode ? <>
      <Text style={styles.fieldLabel}>我想完成</Text>
      <TextInput accessibilityLabel="用户目标" maxLength={4000} value={goalText} onChangeText={setGoalText} placeholder="例如：根据群聊安排周五晚餐" placeholderTextColor="#858b95" style={styles.goalInput} />
      <Text style={styles.fieldLabel}>当前上下文</Text>
    </> : <Text style={styles.fieldLabel}>我想完成</Text>}
    <TextInput accessibilityLabel={contextMode ? '当前上下文' : '用户目标'} multiline maxLength={20000} value={sourceText} onChangeText={setSourceText} placeholder={contextMode ? '粘贴邮件、消息、网页或商品信息…' : '例如：安排周五晚餐，并在出发前提醒我。'} placeholderTextColor="#858b95" style={[styles.sourceInput, contextMode && styles.contextInput]} />
    <TextInput accessibilityLabel="出发地点" value={origin} onChangeText={setOrigin} placeholder="出发地点（通勤安排需要，可稍后补充）" placeholderTextColor="#858b95" style={styles.originInput} />
    <View style={styles.demoSection}><Text style={styles.demoLabel}>快速体验</Text><View style={styles.demoRow}><Pressable onPress={useDinnerDemo} style={styles.demoCard}><Text style={styles.demoTitle}>群聊 → 聚餐</Text><Text style={styles.demoDetail}>第二个真实场景</Text></Pressable><Pressable onPress={useInterviewDemo} style={styles.demoCard}><Text style={styles.demoTitle}>邮件 → 面试</Text><Text style={styles.demoDetail}>Reference scenario</Text></Pressable></View></View>
    {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
    <Pressable disabled={busy} onPress={analyzeGoal} style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>理解意图并生成计划</Text>}</Pressable>
    {sourceKind === 'email' ? <Pressable disabled={busy} onPress={analyzeInvitation} style={({ pressed }) => [styles.secondary, pressed && styles.pressed, busy && styles.disabled]}><Text style={styles.secondaryLabel}>使用面试邀请 Reference 解析器</Text></Pressable> : null}
    <Text style={styles.privacyHint}>{Platform.OS === 'web' ? '未配置 API 时使用确定性 QA fixture，不会把输入发送到 AI。浏览器持久化只验证任务恢复，不验证 SecureStore。' : '不会在手机中保存 API Key。原始内容仅发送到你配置的 Taskspace API。'}</Text>
    {deleteAccount ? <Pressable disabled={busy} onPress={deleteAccount}><Text style={styles.deleteAccountStandalone}>永久删除账户与数据</Text></Pressable> : null}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const JOURNEY = ['Intent', 'Plan', 'Decision', 'Review', 'Execution', 'Receipt'];

function TaskJourney({ phase }: { phase: Task['phase'] }) {
  const active = phase === 'draft' ? 0 : phase === 'planning' ? 1 : phase === 'needs_decision' ? 2 : phase === 'ready' ? 3 : phase === 'executing' ? 4 : 5;
  return <View accessibilityLabel={`任务阶段：${JOURNEY[active]}`} style={styles.journey}>{JOURNEY.map((label, index) => <View key={label} style={styles.journeyItem}><View style={[styles.journeyDot, index <= active && styles.journeyDotActive]} /><Text style={[styles.journeyLabel, index === active && styles.journeyLabelActive]}>{label}</Text></View>)}</View>;
}

function capabilityLabel(capabilityId: string) {
  return ({
    'system.calendar.createEvent': 'Calendar',
    'maps.route.estimate': '路线估算',
    'system.reminder.schedule': '提醒',
    'taskspace.notes.create': 'Taskspace 笔记',
    'taskspace.messaging.createDraft': '消息草稿',
    'taskspace.preferences.set': '明确偏好',
    'files.document.read': '文件读取',
    'files.document.create': '文件创建',
  } as Record<string, string>)[capabilityId] ?? capabilityId;
}

function capabilityReality(capabilityId: string) {
  if (Platform.OS === 'web') return ({
    'system.calendar.createEvent': '浏览器模拟 · 需要之后 iPhone Calendar 真机验证',
    'maps.route.estimate': '浏览器模拟 · 需要之后真实 Routes 服务验证',
    'system.reminder.schedule': '浏览器模拟 · 需要之后 iPhone Notifications 真机验证',
    'taskspace.notes.create': '真实保存到 Browser Test Mode 本地存储',
    'taskspace.messaging.createDraft': '真实保存草稿 · 不会发送',
    'taskspace.preferences.set': '真实保存用户明确偏好 · 不做隐式学习',
    'files.document.read': '真实读取用户在浏览器中选择的文件',
    'files.document.create': '真实生成并下载浏览器文件',
  } as Record<string, string>)[capabilityId] ?? '浏览器模拟 capability';
  return ({
    'system.calendar.createEvent': '真实写入设备 Calendar',
    'maps.route.estimate': '真实调用 Routes API',
    'system.reminder.schedule': '真实创建本地通知',
    'taskspace.notes.create': '真实保存到 Taskspace 加密本地存储',
    'taskspace.messaging.createDraft': '真实保存 Taskspace 草稿 · 不会发送',
    'taskspace.preferences.set': '真实保存用户明确偏好',
    'files.document.read': '使用系统文件选择器读取真实文件 · 仍需 iPhone 真机验证',
    'files.document.create': '创建真实文件并打开系统分享面板 · 仍需 iPhone 真机验证',
  } as Record<string, string>)[capabilityId] ?? '已注册 capability';
}

function summarizeStepInput(input: Record<string, unknown>) {
  const date = typeof input.startDate === 'string' ? formatDate(input.startDate) : typeof input.eventStartsAt === 'string' ? formatDate(input.eventStartsAt) : undefined;
  const location = typeof input.location === 'string' ? input.location : typeof input.destination === 'string' ? input.destination : undefined;
  const preparation = Array.isArray(input.preparation) ? input.preparation.filter((item): item is string => typeof item === 'string').join('、') : undefined;
  return [date, location, preparation].filter(Boolean).join(' · ') || '等待确认';
}

function AuthScreen({ configured, email, setEmail, code, setCode, codeSent, notice, busy, sendCode, verify }: { configured: boolean; email: string; setEmail: (value: string) => void; code: string; setCode: (value: string) => void; codeSent: boolean; notice?: string; busy: boolean; sendCode: () => void; verify: () => void }) {
  return <SafeAreaView style={styles.screen}><StatusBar style="dark" /><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.authContent}>
    <Text style={styles.brand}>TASKSPACE AI</Text><Text style={styles.intakeTitle}>登录你的任务空间</Text><Text style={styles.intakeSubtitle}>任务、确认快照和执行回执按账户隔离。我们会向邮箱发送一次性验证码。</Text>
    {!configured ? <Text accessibilityRole="alert" style={styles.notice}>尚未配置 Supabase。发布构建不会允许 guest 模式。</Text> : <>
      <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!codeSent} placeholder="you@example.com" placeholderTextColor="#858b95" style={styles.authInput} />
      {codeSent ? <TextInput autoComplete="one-time-code" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} placeholder="6 位验证码" placeholderTextColor="#858b95" style={styles.authInput} /> : null}
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      <Pressable disabled={busy} onPress={codeSent ? verify : sendCode} style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>{codeSent ? '登录' : '发送验证码'}</Text>}</Pressable>
    </>}
  </View></KeyboardAvoidingView></SafeAreaView>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function statusGlyph(status: Task['steps'][number]['status']) {
  return status === 'completed' ? '✓' : status === 'running' ? '●' : status === 'failed' ? '!' : status === 'stopped' ? '■' : '○';
}

function statusLabel(status: Task['steps'][number]['status']) {
  return ({ waiting: '等待', running: '正在执行', needs_decision: '需要决定', completed: '已完成', failed: '失败', stopped: '已停止' } as const)[status];
}

function PlanRow({ label, value, detail, selected, onPress }: { label: string; value: string; detail?: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.rowPressed]}><View style={styles.rowIcon}><Text style={styles.rowIconText}>•</Text></View><View style={styles.rowCopy}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text>{detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}</View></Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: '#f4f5f8' }, center: { alignItems: 'center', justifyContent: 'center' },
  intakeContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 52, paddingBottom: 30 }, brand: { color: '#1266fa', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  browserBanner: { marginHorizontal: 16, marginTop: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#e5ae57', backgroundColor: '#fff4dc' }, browserBannerTitle: { color: '#6d4606', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }, browserBannerText: { marginTop: 3, color: '#76571f', fontSize: 11, lineHeight: 16 },
  authContent: { flex: 1, paddingHorizontal: 24, paddingTop: 72 }, authInput: { minHeight: 58, marginTop: 16, paddingHorizontal: 18, borderRadius: 18, backgroundColor: '#e5e8ee', color: '#171a20', fontSize: 16 },
  intakeTitle: { marginTop: 18, maxWidth: 340, color: '#111318', fontSize: 34, lineHeight: 40, fontWeight: '700' }, intakeSubtitle: { marginTop: 12, color: '#626974', fontSize: 16, lineHeight: 24 },
  entryTabs: { marginTop: 24, padding: 4, borderRadius: 18, backgroundColor: '#e5e8ee', flexDirection: 'row' }, entryTab: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, entryTabSelected: { backgroundColor: '#fff' }, entryTabText: { color: '#747b86', fontSize: 14, fontWeight: '600' }, entryTabTextSelected: { color: '#171a20' },
  fieldLabel: { marginTop: 18, marginBottom: 8, color: '#626974', fontSize: 13, fontWeight: '700' }, goalInput: { minHeight: 58, paddingHorizontal: 18, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9dde5', color: '#171a20', fontSize: 16 },
  sourceInput: { minHeight: 190, padding: 18, borderRadius: 24, backgroundColor: '#171a20', color: '#f5f6f9', fontSize: 16, lineHeight: 24, textAlignVertical: 'top' }, contextInput: { minHeight: 170 },
  demoSection: { marginTop: 18 }, demoLabel: { color: '#626974', fontSize: 13, fontWeight: '700' }, demoRow: { marginTop: 8, flexDirection: 'row', gap: 10 }, demoCard: { flex: 1, minHeight: 68, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#e7eaf0', justifyContent: 'center' }, demoTitle: { color: '#20242b', fontSize: 14, fontWeight: '700' }, demoDetail: { marginTop: 3, color: '#777e89', fontSize: 11 },
  privacyHint: { marginTop: 14, color: '#7b818b', fontSize: 12, lineHeight: 18 }, primary: { minHeight: 58, marginTop: 18, borderRadius: 29, backgroundColor: '#1266fa', alignItems: 'center', justifyContent: 'center' }, primaryLabel: { color: '#fff', fontSize: 16, fontWeight: '700' }, pressed: { opacity: 0.82 }, disabled: { opacity: 0.45 },
  secondary: { minHeight: 52, marginTop: 10, borderRadius: 26, borderWidth: 1, borderColor: '#c5cad3', alignItems: 'center', justifyContent: 'center' }, secondaryLabel: { color: '#4f5662', fontSize: 14, fontWeight: '600' },
  originInput: { minHeight: 56, marginTop: 12, paddingHorizontal: 18, borderRadius: 18, backgroundColor: '#e5e8ee', color: '#171a20', fontSize: 15 },
  island: { alignSelf: 'center', width: 330, height: 48, marginTop: 8, paddingHorizontal: 14, borderRadius: 24, backgroundColor: '#111214', flexDirection: 'row', alignItems: 'center', gap: 8 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff615c' }, islandLabel: { flex: 1, color: '#f7f7fa', fontSize: 12, fontWeight: '600' }, islandState: { color: '#ff8a83', fontSize: 11, fontWeight: '600' }, stop: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ff8a35', alignItems: 'center', justifyContent: 'center' }, stopGlyph: { color: '#fff', fontSize: 11 },
  content: { padding: 20, paddingBottom: 150 }, taskHeader: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, eyebrow: { color: '#717784', fontSize: 13, fontWeight: '600' }, newTask: { color: '#1266fa', fontSize: 14, fontWeight: '600' }, dataActions: { marginTop: 12, marginBottom: 12, paddingVertical: 12, gap: 14, alignItems: 'center' }, deleteAccount: { color: '#a23b32', fontSize: 13, textDecorationLine: 'underline' }, deleteAccountStandalone: { marginTop: 24, color: '#a23b32', fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' }, signOut: { color: '#717784', fontSize: 14 },
  journey: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between' }, journeyItem: { flex: 1, alignItems: 'center' }, journeyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#cbd0d9' }, journeyDotActive: { backgroundColor: '#1266fa' }, journeyLabel: { marginTop: 5, color: '#9aa0aa', fontSize: 9 }, journeyLabelActive: { color: '#1266fa', fontWeight: '700' },
  title: { marginTop: 18, color: '#111318', fontSize: 28, lineHeight: 34, fontWeight: '700' }, subtitle: { marginTop: 6, marginBottom: 20, color: '#69707b', fontSize: 15, lineHeight: 22 }, notice: { marginTop: 12, marginBottom: 14, color: '#a23b32', fontSize: 13, lineHeight: 19 },
  executionBoundary: { marginBottom: 16, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#d5dae3', backgroundColor: '#fff' }, executionBoundaryTitle: { color: '#20242b', fontSize: 12, fontWeight: '800' }, executionBoundaryText: { marginTop: 5, color: '#1266fa', fontSize: 13, lineHeight: 18, fontWeight: '700' }, executionBoundaryHint: { marginTop: 5, color: '#777e89', fontSize: 11, lineHeight: 16 },
  activity: { marginBottom: 18, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, backgroundColor: '#e7eaf0' }, activityHeading: { marginBottom: 5, color: '#626974', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }, activityRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#c9ced8' }, activityStatus: { width: 22, color: '#1266fa', fontSize: 17, textAlign: 'center', fontWeight: '700' }, activityCopy: { flex: 1, paddingVertical: 8 }, activityTitle: { color: '#20242b', fontSize: 14, fontWeight: '600' }, activityDetail: { marginTop: 2, color: '#6f7580', fontSize: 12 }, receiptMeta: { marginTop: 3, color: '#8a909a', fontSize: 10 },
  row: { minHeight: 100, marginBottom: 12, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: 'transparent', backgroundColor: '#171a20', flexDirection: 'row', alignItems: 'center', gap: 14 }, rowPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] }, rowSelected: { borderColor: '#6da5ff', backgroundColor: '#192b45' }, rowIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#20304a', alignItems: 'center', justifyContent: 'center' }, rowIconText: { color: '#a8c8ff', fontSize: 20 }, rowCopy: { flex: 1, gap: 3 }, rowLabel: { color: '#939aa6', fontSize: 13 }, rowValue: { color: '#f4f6fa', fontSize: 20, lineHeight: 25, fontWeight: '700' }, rowDetail: { color: '#b2b8c2', fontSize: 14, lineHeight: 20 },
  composerLayer: { position: 'absolute', left: 0, right: 0, bottom: 0 }, composerRow: { marginHorizontal: 16, marginBottom: 18, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }, composer: { flex: 1, minHeight: 58, maxHeight: 118, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 29, backgroundColor: 'rgba(31,33,39,0.96)', justifyContent: 'center' }, context: { alignSelf: 'flex-start', marginBottom: 3, color: '#a8c8ff', fontSize: 12, fontWeight: '600' }, input: { minHeight: 24, maxHeight: 66, color: '#f5f6f9', fontSize: 16 }, send: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#e9f0ff', alignItems: 'center', justifyContent: 'center' }, sendGlyph: { color: '#1266fa', fontSize: 29, lineHeight: 31, fontWeight: '400' },
});

export default withMonitoring(App);
