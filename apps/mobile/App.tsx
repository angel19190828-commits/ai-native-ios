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
import { createDeviceCapabilityRegistry, executeNextStep } from './src/capabilities';
import { Task, TaskEvent } from './src/domain/task';
import { createTaskFromPlan } from './src/domain/taskFactory';
import { createTaskFromDefinition } from './src/domain/planCompiler';
import { taskReducer } from './src/domain/taskReducer';
import { clearLocalAuthSession, currentSession, getAccessToken, getSupabaseClient, isAuthConfigured, requestEmailCode, signOut, startAuthAutoRefresh, verifyEmailCode } from './src/auth/supabaseAuth';
import { createEncryptedTaskStore, deleteTaskEncryptionKey } from './src/storage/nativeStores';
import { TaskCache } from './src/storage/taskCache';
import TaskspaceIntakeModule from './modules/taskspace-intake/src/TaskspaceIntakeModule';
import { consumeAppIntents, TaskspaceAppIntentInvocation } from './src/native/taskspaceAppIntents';
import { captureOperationalError, traceOperation, withMonitoring } from './src/observability/monitoring';

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string>();
  const [authEmail, setAuthEmail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [authNotice, setAuthNotice] = useState<string>();
  const [task, setTask] = useState<Task>();
  const [sourceText, setSourceText] = useState('');
  const [sourceKind, setSourceKind] = useState<OrchestrationContextInput['kind']>('direct-input');
  const [origin, setOrigin] = useState('');
  const [draft, setDraft] = useState('按这个安排');
  const [selectedContext, setSelectedContext] = useState<string>();
  const [cacheReady, setCacheReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const executionController = useRef<AbortController | undefined>(undefined);
  const taskRef = useRef<Task | undefined>(undefined);
  const guestAllowed = process.env.EXPO_PUBLIC_ALLOW_GUEST === 'true';
  const taskCache = useMemo(() => {
    const namespace = userId ?? 'unauthenticated';
    return new TaskCache(createEncryptedTaskStore(namespace), 50, namespace);
  }, [userId]);
  const lastTaskKey = `taskspace:${userId ?? 'unauthenticated'}:last-task:v1`;
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
  const aiClient = useMemo(() => new AiApiClient({
    baseUrl: apiBaseUrl,
    getAccessToken,
  }), [apiBaseUrl]);
  const orchestratorClient = useMemo(() => new OrchestratorApiClient({
    baseUrl: apiBaseUrl,
    getAccessToken,
  }), [apiBaseUrl]);
  const routeClient = useMemo(() => new RouteApiClient({
    baseUrl: apiBaseUrl,
    getAccessToken,
  }), [apiBaseUrl]);
  const taskSyncClient = useMemo(() => new TaskSyncClient({ baseUrl: apiBaseUrl, getAccessToken }), [apiBaseUrl]);
  const accountClient = useMemo(() => new AccountClient({ baseUrl: apiBaseUrl, getAccessToken }), [apiBaseUrl]);
  const serverSyncEnabled = isAuthConfigured() && Boolean(apiBaseUrl);

  useEffect(() => { taskRef.current = task; }, [task]);

  const handleAppIntent = (invocation: TaskspaceAppIntentInvocation) => {
      if (invocation.name === 'createTask') {
        const request = typeof invocation.params.request === 'string' ? invocation.params.request : '';
        executionController.current?.abort();
        setTask(undefined);
        setSourceText(request);
        setSourceKind('direct-input');
        setOrigin('');
        setSelectedContext(undefined);
        setNotice(request ? '已从 Siri 或快捷指令带入任务内容，请检查后生成计划。' : '已打开新任务，请输入目标。');
      } else if (invocation.name === 'showPendingDecision') {
        setNotice(task?.pendingDecision?.prompt ?? '当前没有等待你处理的决定。');
      } else if (invocation.name === 'continueTask') {
        setNotice(task ? '已打开最近的任务和执行回执。' : '当前没有可继续的任务。');
      } else if (invocation.name === 'requestStopTask') {
        setNotice(task?.phase === 'executing' ? '请在灵动岛点击橙色停止按钮，确认停止剩余操作。' : '当前没有正在执行的任务。');
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
        setSourceKind('direct-input');
        setSelectedContext(undefined);
        setNotice('已从系统快捷方式打开新任务。');
      } else if (action === 'continue') {
        setNotice(taskRef.current ? '已打开最近的任务和执行回执。' : '当前没有可继续的任务。');
      } else if (action === 'stop') {
        setNotice(taskRef.current?.phase === 'executing' ? '请点击橙色停止按钮确认停止剩余操作。' : '当前没有正在执行的任务。');
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
        setTask(restored);
        setDraft((await taskCache.loadDraft(restored.id)) || '按这个安排');
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
    if (!apiBaseUrl) return setNotice('尚未配置 EXPO_PUBLIC_API_BASE_URL，无法连接 AI 服务。');
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
      await taskCache.saveDraft(nextTask.id, '按这个安排');
      setTask(nextTask);
      setDraft('按这个安排');
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
    const goal = sourceText.trim();
    if (!goal) return setNotice('先描述你想完成的目标。');
    if (!apiBaseUrl) return setNotice('尚未配置 EXPO_PUBLIC_API_BASE_URL，无法连接 AI 服务。');
    setBusy(true);
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'zh-CN';
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const context = [
        { id: 'primary-context', kind: sourceKind, content: goal },
        ...(origin.trim() ? [{ id: 'origin', kind: 'direct-input' as const, title: '出发地点', content: origin.trim() }] : []),
      ];
      const response = await traceOperation('task.plan', 'ai.plan', () => orchestratorClient.propose({ goal, context, locale, timeZone }));
      const now = new Date().toISOString();
      const calendarInput = response.proposal.steps.find((step) => step.capabilityId === 'system.calendar.createEvent')?.input;
      const routeInput = response.proposal.steps.find((step) => step.capabilityId === 'maps.route.estimate')?.input;
      const reminderInput = response.proposal.steps.find((step) => step.capabilityId === 'system.reminder.schedule')?.input;
      const startsAt = typeof calendarInput?.startDate === 'string'
        ? calendarInput.startDate
        : typeof reminderInput?.eventStartsAt === 'string' ? reminderInput.eventStartsAt : now;
      const preparation = Array.isArray(reminderInput?.preparation)
        ? reminderInput.preparation.filter((item): item is string => typeof item === 'string') : [];
      const proposedTask = createTaskFromDefinition({
        id: Crypto.randomUUID(), request: goal, now,
        plan: {
          goal: { id: 'general-intent', summary: response.proposal.summary, desiredOutcome: response.proposal.desiredOutcome },
          context: context.map((item) => ({ id: item.id, kind: item.kind, title: item.title, data: { content: item.content } })),
          triggers: response.proposal.triggers,
          decisions: response.proposal.decisions,
          steps: response.proposal.steps,
          presentation: {
            title: response.proposal.summary,
            startsAt,
            address: typeof calendarInput?.location === 'string' ? calendarInput.location : typeof routeInput?.destination === 'string' ? routeInput.destination : '',
            preparation,
            origin: origin.trim() || undefined,
          },
        },
      });
      const nextTask = await saveSnapshot(proposedTask, { type: 'task.created', at: now });
      await AsyncStorage.setItem(lastTaskKey, nextTask.id);
      await taskCache.saveDraft(nextTask.id, '按这个安排');
      setTask(nextTask);
      setDraft('按这个安排');
      setSelectedContext(undefined);
      if (nextTask.phase === 'needs_decision') setNotice(nextTask.pendingDecision?.prompt);
    } catch (error) {
      const code = error instanceof AiApiError ? error.code : 'unknown';
      captureOperationalError(`orchestrator_plan_${code}`, { phase: 'planning', operation: 'ai.plan' });
      setNotice(`目标规划失败（${code}）。你的输入仍保留，可以重试。`);
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
      if (current.phase === 'completed') {
        setDraft('全部完成');
        setNotice('计划中的所有步骤均已完成，并保存了执行回执。');
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
      setNotice('计划已锁定，正在从 Calendar 开始执行。');
      await executeConfirmedTask(confirmed);
    } catch {
      captureOperationalError('confirmation_persist_failed', { phase: 'confirming', operation: 'plan.confirm' });
      setNotice('确认没有保存成功，尚未开始任何系统操作。');
    } finally {
      setBusy(false);
    }
  };

  const stopExecution = async () => {
    if (!task || task.phase !== 'executing') return;
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
  if (!task) return <IntakeScreen sourceText={sourceText} setSourceText={setSourceText} origin={origin} setOrigin={setOrigin} busy={busy} notice={notice} analyzeGoal={analyzeGoal} analyzeInvitation={analyzeInvitation} deleteAccount={isAuthConfigured() ? requestAccountDeletion : undefined} />;

  const routeOutput = task.steps.find((step) => step.id === 'commute')?.receipt?.output;
  const departureAt = typeof routeOutput?.departureAt === 'string' ? formatTime(routeOutput.departureAt) : task.facts.departureAt;
  const arrivalAt = typeof routeOutput?.arrivalAt === 'string' ? formatTime(routeOutput.arrivalAt) : task.facts.arrivalAt;
  const reminderOutput = task.steps.find((step) => step.id === 'reminders')?.receipt?.output;
  const preparationAt = typeof reminderOutput?.preparationAt === 'string' ? formatTime(reminderOutput.preparationAt) : undefined;
  const reminderDepartureAt = typeof reminderOutput?.departureAt === 'string' ? formatTime(reminderOutput.departureAt) : departureAt;
  const invitationRows = [
    { label: task.facts.title, value: formatDate(task.facts.startsAt), detail: task.facts.address },
    { label: '通勤', value: departureAt ? `${departureAt} 出发` : '等待路线计算', detail: arrivalAt ? `预计 ${arrivalAt} 到达` : '确认出发地后计算' },
    { label: '提醒', value: preparationAt && reminderDepartureAt ? `${preparationAt} 准备 · ${reminderDepartureAt} 出发` : '将在通勤之后设置' },
    { label: '准备事项', value: task.facts.preparation.join('、') || '无' },
  ];
  const rows = task.goal?.id === 'general-intent'
    ? task.steps.map((step) => ({
      label: step.title,
      value: capabilityLabel(step.capabilityId),
      detail: [summarizeStepInput(step.input), step.policy?.scopes.length ? `权限：${step.policy.scopes.join('、')}` : undefined].filter(Boolean).join(' · '),
    }))
    : invitationRows;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.island}>
        <View style={styles.dot} />
        <Text style={styles.islandLabel}>AI · {task.confirmedPlan ? '计划已确认' : '安排已整理'}</Text>
        <Text style={styles.islandState}>{task.phase === 'needs_decision' ? '需要决定' : task.phase === 'executing' ? '执行中' : task.phase === 'completed' ? '已完成' : task.confirmedPlan ? '等待执行' : '等待确认'}</Text>
        {task.phase === 'executing' ? <Pressable accessibilityRole="button" accessibilityLabel="停止任务" onPress={stopExecution} style={styles.stop}><Text style={styles.stopGlyph}>■</Text></Pressable> : null}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.taskHeader}><Text style={styles.eyebrow}>{task.facts.title}</Text><View style={styles.headerActions}><Pressable onPress={startNewTask}><Text style={styles.newTask}>新任务</Text></Pressable>{isAuthConfigured() ? <Pressable onPress={logout}><Text style={styles.signOut}>退出</Text></Pressable> : null}</View></View>
        <Text style={styles.title}>{task.phase === 'needs_decision' ? '还需要一点信息。' : '安排整理好了。'}</Text>
        <Text style={styles.subtitle}>点选内容进行修改，或直接按这个安排确认。</Text>
        {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
        {task.confirmedPlan ? <View style={styles.activity}>{task.steps.map((step) => <View key={step.id} style={styles.activityRow}><Text style={styles.activityStatus}>{statusGlyph(step.status)}</Text><View style={styles.activityCopy}><Text style={styles.activityTitle}>{step.title}</Text><Text style={styles.activityDetail}>{step.receipt?.summary ?? statusLabel(step.status)}</Text></View></View>)}</View> : null}
        {rows.map((row) => <PlanRow key={row.label} {...row} selected={selectedContext === row.label} onPress={() => { setSelectedContext(row.label); setDraft((current) => current === '按这个安排' ? '' : current); }} />)}
        <View style={styles.dataActions}>
          <Pressable disabled={busy} onPress={requestTaskDeletion}><Text style={styles.deleteAccount}>永久删除这个任务</Text></Pressable>
          {isAuthConfigured() ? <Pressable disabled={busy} onPress={requestAccountDeletion}><Text style={styles.deleteAccount}>永久删除账户与全部数据</Text></Pressable> : null}
        </View>
      </ScrollView>
      <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.composerLayer}>
        <View style={styles.composerRow}>
          <View style={styles.composer}>
            {selectedContext ? <Pressable onPress={() => setSelectedContext(undefined)}><Text style={styles.context}>{selectedContext}　×</Text></Pressable> : null}
            <TextInput style={styles.input} value={draft} onChangeText={setDraft} placeholder="告诉 AI 想怎么改…" placeholderTextColor="#8e949f" multiline maxLength={1000} />
          </View>
          <Pressable disabled={busy || task.phase === 'completed' || task.phase === 'stopped' || task.phase === 'executing'} accessibilityRole="button" accessibilityLabel="发送并确认" onPress={task.confirmedPlan ? () => executeConfirmedTask(task) : confirmPlan} style={({ pressed }) => [styles.send, pressed && styles.pressed, (busy || task.phase === 'completed' || task.phase === 'stopped' || task.phase === 'executing') && styles.disabled]}>
            {busy ? <ActivityIndicator color="#1266fa" /> : <Text style={styles.sendGlyph}>↑</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function IntakeScreen({ sourceText, setSourceText, origin, setOrigin, busy, notice, analyzeGoal, analyzeInvitation, deleteAccount }: { sourceText: string; setSourceText: (value: string) => void; origin: string; setOrigin: (value: string) => void; busy: boolean; notice?: string; analyzeGoal: () => void; analyzeInvitation: () => void; deleteAccount?: () => void }) {
  return <SafeAreaView style={styles.screen}><StatusBar style="dark" /><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.intakeContent}>
    <Text style={styles.brand}>TASKSPACE AI</Text><Text style={styles.intakeTitle}>说出目标，审阅后再执行</Text><Text style={styles.intakeSubtitle}>描述想完成的事，或粘贴来自邮件、消息、网页和其他 App 的内容。AI 提出计划；系统只执行已注册且由你确认的能力。</Text>
    <TextInput accessibilityLabel="目标或上下文" multiline maxLength={20000} value={sourceText} onChangeText={setSourceText} placeholder="例如：帮我安排明天下午与 Alex 的会面，并提前提醒我。" placeholderTextColor="#858b95" style={styles.sourceInput} />
    <TextInput accessibilityLabel="出发地点" value={origin} onChangeText={setOrigin} placeholder="出发地点（通勤安排需要，可稍后补充）" placeholderTextColor="#858b95" style={styles.originInput} />
    {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
    <Pressable disabled={busy} onPress={analyzeGoal} style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>根据目标生成计划</Text>}</Pressable>
    <Pressable disabled={busy} onPress={analyzeInvitation} style={({ pressed }) => [styles.secondary, pressed && styles.pressed, busy && styles.disabled]}><Text style={styles.secondaryLabel}>按邀请内容提取（Reference）</Text></Pressable>
    <Text style={styles.privacyHint}>不会在手机中保存 API Key。原始内容仅发送到你配置的 Taskspace API。</Text>
    {deleteAccount ? <Pressable disabled={busy} onPress={deleteAccount}><Text style={styles.deleteAccountStandalone}>永久删除账户与数据</Text></Pressable> : null}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function capabilityLabel(capabilityId: string) {
  return ({
    'system.calendar.createEvent': 'Calendar',
    'maps.route.estimate': '路线估算',
    'system.reminder.schedule': '提醒',
  } as Record<string, string>)[capabilityId] ?? capabilityId;
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
  authContent: { flex: 1, paddingHorizontal: 24, paddingTop: 72 }, authInput: { minHeight: 58, marginTop: 16, paddingHorizontal: 18, borderRadius: 18, backgroundColor: '#e5e8ee', color: '#171a20', fontSize: 16 },
  intakeTitle: { marginTop: 18, maxWidth: 330, color: '#111318', fontSize: 34, lineHeight: 40, fontWeight: '700' }, intakeSubtitle: { marginTop: 12, color: '#626974', fontSize: 16, lineHeight: 24 },
  sourceInput: { minHeight: 230, marginTop: 28, padding: 18, borderRadius: 24, backgroundColor: '#171a20', color: '#f5f6f9', fontSize: 16, lineHeight: 24, textAlignVertical: 'top' },
  privacyHint: { marginTop: 14, color: '#7b818b', fontSize: 12, lineHeight: 18 }, primary: { minHeight: 58, marginTop: 18, borderRadius: 29, backgroundColor: '#1266fa', alignItems: 'center', justifyContent: 'center' }, primaryLabel: { color: '#fff', fontSize: 16, fontWeight: '700' }, pressed: { opacity: 0.82 }, disabled: { opacity: 0.45 },
  secondary: { minHeight: 52, marginTop: 10, borderRadius: 26, borderWidth: 1, borderColor: '#c5cad3', alignItems: 'center', justifyContent: 'center' }, secondaryLabel: { color: '#4f5662', fontSize: 14, fontWeight: '600' },
  originInput: { minHeight: 56, marginTop: 12, paddingHorizontal: 18, borderRadius: 18, backgroundColor: '#e5e8ee', color: '#171a20', fontSize: 15 },
  island: { alignSelf: 'center', width: 330, height: 48, marginTop: 8, paddingHorizontal: 14, borderRadius: 24, backgroundColor: '#111214', flexDirection: 'row', alignItems: 'center', gap: 8 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff615c' }, islandLabel: { flex: 1, color: '#f7f7fa', fontSize: 12, fontWeight: '600' }, islandState: { color: '#ff8a83', fontSize: 11, fontWeight: '600' }, stop: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ff8a35', alignItems: 'center', justifyContent: 'center' }, stopGlyph: { color: '#fff', fontSize: 11 },
  content: { padding: 20, paddingBottom: 150 }, taskHeader: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 }, eyebrow: { color: '#717784', fontSize: 13, fontWeight: '600' }, newTask: { color: '#1266fa', fontSize: 14, fontWeight: '600' }, dataActions: { marginTop: 12, marginBottom: 12, paddingVertical: 12, gap: 14, alignItems: 'center' }, deleteAccount: { color: '#a23b32', fontSize: 13, textDecorationLine: 'underline' }, deleteAccountStandalone: { marginTop: 24, color: '#a23b32', fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' }, signOut: { color: '#717784', fontSize: 14 }, title: { marginTop: 18, color: '#111318', fontSize: 28, lineHeight: 34, fontWeight: '700' }, subtitle: { marginTop: 6, marginBottom: 20, color: '#69707b', fontSize: 15, lineHeight: 22 }, notice: { marginTop: 12, marginBottom: 14, color: '#a23b32', fontSize: 13, lineHeight: 19 },
  activity: { marginBottom: 18, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e7eaf0' }, activityRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#c9ced8' }, activityStatus: { width: 22, color: '#1266fa', fontSize: 17, textAlign: 'center', fontWeight: '700' }, activityCopy: { flex: 1 }, activityTitle: { color: '#20242b', fontSize: 14, fontWeight: '600' }, activityDetail: { marginTop: 2, color: '#6f7580', fontSize: 12 },
  row: { minHeight: 100, marginBottom: 12, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: 'transparent', backgroundColor: '#171a20', flexDirection: 'row', alignItems: 'center', gap: 14 }, rowPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] }, rowSelected: { borderColor: '#6da5ff', backgroundColor: '#192b45' }, rowIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#20304a', alignItems: 'center', justifyContent: 'center' }, rowIconText: { color: '#a8c8ff', fontSize: 20 }, rowCopy: { flex: 1, gap: 3 }, rowLabel: { color: '#939aa6', fontSize: 13 }, rowValue: { color: '#f4f6fa', fontSize: 20, lineHeight: 25, fontWeight: '700' }, rowDetail: { color: '#b2b8c2', fontSize: 14, lineHeight: 20 },
  composerLayer: { position: 'absolute', left: 0, right: 0, bottom: 0 }, composerRow: { marginHorizontal: 16, marginBottom: 18, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }, composer: { flex: 1, minHeight: 58, maxHeight: 118, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 29, backgroundColor: 'rgba(31,33,39,0.96)', justifyContent: 'center' }, context: { alignSelf: 'flex-start', marginBottom: 3, color: '#a8c8ff', fontSize: 12, fontWeight: '600' }, input: { minHeight: 24, maxHeight: 66, color: '#f5f6f9', fontSize: 16 }, send: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#e9f0ff', alignItems: 'center', justifyContent: 'center' }, sendGlyph: { color: '#1266fa', fontSize: 29, lineHeight: 31, fontWeight: '400' },
});

export default withMonitoring(App);
