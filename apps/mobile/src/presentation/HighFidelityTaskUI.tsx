import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, KeyboardAvoidingView, Platform, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Easing, FadeIn, FadeInDown, FadeOut, FadeOutUp, ReduceMotion,
  useAnimatedStyle, useSharedValue, withSpring, type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { OrchestrationContextInput } from '../api/orchestratorClient';
import type { ExecutionPresentationModel, ExecutionPresentationStep, TaskPresentationModel, TaskPresentationRow } from './taskPresentation';
import { DecisionPill, TaskActionRow, TaskButton, TaskComposer, TaskSurface, type TaskUiStatus } from './taskUiSystem';

const PANEL = '#111318';
const CARD = '#191c22';

function Enter({ children }: { children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [progress]);
  return <Animated.View style={{ flex: 1, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>{children}</Animated.View>;
}

function BrowserModeNote({ plannerSource }: { plannerSource: string }) {
  const [expanded, setExpanded] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={({ pressed }) => [s.browserNote, pressed && s.pressed]}>
    <View style={s.browserQuietDot} />
    <View style={s.browserCopy}><Text style={s.browserTitle}>浏览器测试模式 · Gemini 实时规划</Text>{expanded ? <><Text style={s.browserText}>{plannerSource}</Text><Text style={s.browserText}>文件选择与保存使用真实浏览器能力；内置浏览器若拦截下载，请在系统 Chrome 验证。Calendar、Route、Notifications 仍为模拟。</Text></> : null}</View>
    <Text style={s.browserDisclosure}>{expanded ? '收起' : '详情'}</Text>
  </Pressable>;
}

export function HighFidelityIntake(props: {
  sourceText: string; setSourceText: (value: string) => void;
  goalText: string; setGoalText: (value: string) => void;
  sourceKind: OrchestrationContextInput['kind']; setSourceKind: (value: OrchestrationContextInput['kind']) => void;
  origin: string; setOrigin: (value: string) => void;
  busy: boolean; notice?: string; plannerSource: string; analyzeGoal: () => void;
}) {
  const contextMode = props.sourceKind !== 'direct-input';
  const [open, setOpen] = useState(false);
  useEffect(() => { if (props.notice) setOpen(true); }, [props.notice]);
  if (!open) return <SafeAreaView style={s.stage}><Enter><View style={s.collapsedStage}>
    <Pressable accessibilityRole="button" accessibilityLabel="打开 AI" onPress={() => setOpen(true)} style={({ pressed }) => [s.island, pressed && s.islandPressed]}><View style={s.liveDot} /><Text style={s.islandAI}>AI</Text><Text style={s.islandMessage}>点击开始</Text></Pressable>
  </View></Enter></SafeAreaView>;
  const composerValue = contextMode ? props.goalText : props.sourceText;
  const setComposerValue = contextMode ? props.setGoalText : props.setSourceText;
  return <SafeAreaView style={s.stage}><Enter><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={s.taskFrame}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.intakeTaskScroll}>
      <Pressable accessibilityRole="button" accessibilityLabel="收起 AI" onPress={() => setOpen(false)} style={({ pressed }) => [s.island, pressed && s.islandPressed]}><View style={s.liveDot} /><Text style={s.islandAI}>AI</Text><Text style={s.islandMessage}>新的任务</Text></Pressable>
      {Platform.OS === 'web' ? <BrowserModeNote plannerSource={props.plannerSource} /> : null}
      <View style={s.intakePanel}>
        <View style={s.handle} />
        <View style={s.aiOpening}><View style={s.aiAvatar}><Text style={s.aiAvatarText}>AI</Text></View><Text style={s.openingText}>有什么需要我帮你做的？</Text></View>
        <Text style={s.suggestionLabel}>AI 建议</Text>
        <View style={s.modeRow}>
          <DecisionPill label="直接说目标" selected={!contextMode} onPress={() => props.setSourceKind('direct-input')} />
          <DecisionPill label="添加内容作为上下文" selected={contextMode} onPress={() => props.setSourceKind('shared-content')} />
        </View>
        {contextMode ? <View style={s.contextPreview}>
          <View style={s.previewHeader}><Text style={s.previewKind}>当前上下文</Text><Text style={s.previewSource}>{props.sourceKind}</Text></View>
          <TextInput value={props.sourceText} onChangeText={props.setSourceText} multiline maxLength={20000} placeholder="粘贴邮件、消息、网页或商品信息…" placeholderTextColor="#737b88" style={s.contextInput} />
        </View> : null}
        {props.notice ? <Text accessibilityRole="alert" style={s.notice}>{props.notice}</Text> : null}
      </View>
    </ScrollView>
    <View style={s.composerLayer}><TaskComposer context={contextMode ? '当前上下文' : undefined} value={composerValue} onChangeText={setComposerValue} onSend={props.analyzeGoal} placeholder={contextMode ? '告诉 AI 你想如何处理…' : '告诉 AI 你想完成什么…'} busy={props.busy} /></View>
    </View>
  </KeyboardAvoidingView></Enter></SafeAreaView>;
}

const REORDER_ROW_HEIGHT = 76;
const REORDER_SPRING = { duration: 400, dampingRatio: .8, reduceMotion: ReduceMotion.System } as const;
const EASE_OUT = Easing.bezier(.23, 1, .32, 1);
const REVIEW_ENTER = FadeInDown.duration(280).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
const REVIEW_EXIT = FadeOutUp.duration(180).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
const PROCESSING_ENTER = FadeIn.duration(150).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
const PROCESSING_EXIT = FadeOut.duration(150).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

type SequenceRow = TaskPresentationRow & { executionDetails?: string[] };

function ReorderRow(props: {
  row: SequenceRow; index: number; count: number; positions: SharedValue<Record<string, number>>;
  activeId: SharedValue<string>; dragY: SharedValue<number>; startY: SharedValue<number>;
  selected: boolean; disabled: boolean; onPress: () => void; onCommit: (ids: string[]) => void;
}) {
  const pan = useMemo(() => Gesture.Pan()
    .enabled(!props.disabled)
    .activeOffsetY([-7, 7])
    .onStart(() => {
      props.activeId.set(props.row.id);
      props.startY.set((props.positions.get()[props.row.id] ?? props.index) * REORDER_ROW_HEIGHT);
      props.dragY.set(0);
    })
    .onUpdate((event) => {
      props.dragY.set(event.translationY);
      const current = props.positions.get();
      const origin = current[props.row.id] ?? props.index;
      const target = Math.max(0, Math.min(props.count - 1, Math.round((props.startY.get() + event.translationY) / REORDER_ROW_HEIGHT)));
      if (target === origin) return;
      const next = { ...current };
      Object.keys(next).forEach((id) => {
        if (id === props.row.id) return;
        const slot = current[id];
        if (target > origin && slot > origin && slot <= target) next[id] = slot - 1;
        if (target < origin && slot >= target && slot < origin) next[id] = slot + 1;
      });
      next[props.row.id] = target;
      props.positions.set(next);
    })
    .onEnd((event) => {
      const ordered = Object.entries(props.positions.get()).sort((a, b) => a[1] - b[1]).map(([id]) => id);
      props.dragY.set(withSpring(0, { ...REORDER_SPRING, velocity: event.velocityY }));
      props.activeId.set('');
      scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
      scheduleOnRN(props.onCommit, ordered);
    }), [props.activeId, props.count, props.disabled, props.dragY, props.index, props.onCommit, props.positions, props.row.id, props.startY]);
  const animatedStyle = useAnimatedStyle(() => {
    const active = props.activeId.get() === props.row.id;
    const destination = (props.positions.get()[props.row.id] ?? props.index) * REORDER_ROW_HEIGHT;
    return {
      zIndex: active ? 5 : 1,
      transform: [
        { translateY: active ? props.startY.get() + props.dragY.get() : withSpring(destination, REORDER_SPRING) },
        { scale: withSpring(active ? 1.015 : 1, REORDER_SPRING) },
      ],
      shadowOpacity: withSpring(active ? .28 : 0, REORDER_SPRING),
    };
  });
  return <GestureDetector gesture={pan}><Reanimated.View style={[s.reorderItem, animatedStyle]}>
    <Pressable disabled={props.disabled} onPress={props.onPress} style={({ pressed }) => [s.sequenceRow, props.selected && s.sequenceRowSelected, pressed && s.sequenceRowPressed]}>
      <View style={s.sequenceNumber}><Text style={s.sequenceNumberText}>{props.index + 1}</Text></View>
      <View style={s.sequenceCopy}><Text numberOfLines={1} style={s.sequenceTitle}>{props.row.primary}</Text>{props.row.annotation ? <Text numberOfLines={1} style={s.sequenceDetail}>{props.row.annotation}{props.row.secondary ? ` · ${props.row.secondary}` : ''}</Text> : null}
        {props.selected && props.row.executionDetails?.length ? <Text numberOfLines={1} style={s.executionMeta}>执行方式：{props.row.executionDetails.join(' · ')}</Text> : null}
      </View>
      <View accessibilityLabel="拖动调整顺序" style={s.dragHandle}><View style={s.dragLine} /><View style={s.dragLine} /><View style={s.dragLine} /></View>
    </Pressable>
  </Reanimated.View></GestureDetector>;
}

function ReorderablePlanList(props: {
  rows: SequenceRow[]; selectedContext?: string; disabled: boolean; reordering: boolean; revisionKey: string;
  onSelectRow: (row: SequenceRow) => void; onReorder: (rows: Array<{ id: string; primary: string }>) => void;
}) {
  const [proposedRows, setProposedRows] = useState(props.rows);
  const positions = useSharedValue<Record<string, number>>(Object.fromEntries(props.rows.map((row, index) => [row.id, index])));
  const activeId = useSharedValue(''); const dragY = useSharedValue(0); const startY = useSharedValue(0);
  const sourceSignature = props.rows.map((row) => `${row.id}:${row.primary}:${row.secondary ?? ''}`).join('|');
  useEffect(() => {
    if (props.reordering) return;
    setProposedRows(props.rows);
    positions.set(Object.fromEntries(props.rows.map((row, index) => [row.id, index])));
  }, [positions, props.reordering, props.revisionKey, sourceSignature]);
  const commit = (orderedIds: string[]) => {
    const byId = new Map(proposedRows.map((row) => [row.id, row]));
    const ordered = orderedIds.map((id) => byId.get(id)).filter((row): row is SequenceRow => Boolean(row));
    if (ordered.length !== proposedRows.length || ordered.every((row, index) => row.id === proposedRows[index]?.id)) return;
    setProposedRows(ordered);
    props.onReorder(ordered.map(({ id, primary }) => ({ id, primary })));
  };
  return <View style={[s.reorderList, { height: proposedRows.length * REORDER_ROW_HEIGHT }]}>{proposedRows.map((row, index) => <ReorderRow
    key={row.id} row={row} index={index} count={proposedRows.length} positions={positions} activeId={activeId} dragY={dragY} startY={startY}
    selected={props.selectedContext === row.primary} disabled={props.disabled} onPress={() => props.onSelectRow(row)} onCommit={commit}
  />)}</View>;
}

function PlanOverview({ model }: { model: TaskPresentationModel }) {
  const items = [
    ['时间', model.overview?.time], ['地点与顺序', model.overview?.places],
    ['到达目标', model.overview?.arrivalTarget], ['关键约束', model.overview?.constraints],
    ['参考偏好', model.overview?.preferences], ['触发条件', model.overview?.trigger],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  if (!items.length) return null;
  return <TaskSurface><Text style={s.overviewTitle}>你的计划</Text>{items.map(([label, value]) => <View key={label} style={s.overviewRow}><Text style={s.overviewLabel}>{label}</Text><Text style={s.overviewValue}>{value}</Text></View>)}</TaskSurface>;
}

export function HighFidelityTaskSurface(props: {
  model: TaskPresentationModel;
  selectedContext?: string;
  draft: string; setDraft: (value: string) => void;
  busy: boolean; reordering: boolean; notice?: string; browserTestMode: boolean; plannerSource: string;
  onSelectRow: (row: TaskPresentationRow) => void;
  onClearContext: () => void;
  onSend: () => void;
  onReorder: (rows: Array<{ id: string; primary: string }>) => void;
  onStartNewTask: () => void;
}) {
  const decision = props.model.mode === 'decision';
  const planning = props.model.mode === 'planning';
  return <SafeAreaView style={s.stage}><Enter>
    <View style={s.taskFrame}>
      <View style={s.island}><View style={[s.liveDot, decision && s.decisionDot]} /><Text style={s.islandAI}>AI</Text><Text numberOfLines={1} style={s.islandMessage}>{props.model.islandTitle}</Text><Text style={[s.islandState, decision && s.islandDecision]}>{props.reordering ? '正在更新' : props.model.islandState}</Text></View>
      {props.browserTestMode ? <BrowserModeNote plannerSource={props.plannerSource} /> : null}
      <ScrollView contentContainerStyle={s.taskScroll} keyboardShouldPersistTaps="handled">
        {props.reordering ? <Reanimated.View key="reorder-processing" entering={PROCESSING_ENTER} exiting={PROCESSING_EXIT} style={s.processingWrap}>
          <View style={s.processingSurface}><View style={s.processingPulse} /><View style={s.processingCopy}><Text style={s.processingTitle}>正在重新安排…</Text><Text style={s.processingText}>根据新的顺序重新计算时间、路线和提醒</Text></View></View>
        </Reanimated.View> : <Reanimated.View key={`review-${props.model.revisionLabel}`} entering={REVIEW_ENTER} exiting={REVIEW_EXIT}>
        <View style={s.conversationSheet}>
          <View style={s.handle} />
          <View style={s.sheetHeader}><Text style={s.eyebrow}>●　{props.model.eyebrow}</Text><Pressable onPress={props.onStartNewTask}><Text style={s.more}>•••</Text></Pressable></View>
          <View style={s.aiOpening}><View style={s.aiAvatar}><Text style={s.aiAvatarText}>AI</Text></View><View style={s.headlineWrap}><Text style={s.openingText}>{props.model.headline}</Text>{props.model.supportingText ? <Text style={s.supporting}>{props.model.supportingText}</Text> : null}</View></View>
          {decision && props.model.decisionOptions.length ? <View style={s.decisionOptions}>{props.model.decisionOptions.map((option) => <DecisionPill key={option} label={option} selected={props.draft === option} onPress={() => props.setDraft(option)} />)}</View> : null}
          {!decision && !planning ? <View style={s.summaryList}><PlanOverview model={props.model} /><View style={s.sequenceHeading}><Text style={s.sequenceLabel}>计划顺序</Text><Text style={s.sequenceHint}>按住并拖动</Text></View><ReorderablePlanList rows={props.model.sequence.length ? props.model.sequence : props.model.rows} selectedContext={props.selectedContext} disabled={props.busy} reordering={props.reordering} revisionKey={props.model.revisionLabel} onSelectRow={props.onSelectRow} onReorder={props.onReorder} /></View> : null}
          {planning ? <View style={s.planningBlock}><View style={s.planningPulse} /><Text style={s.planningText}>Gemini 正在生成新的 PlanDefinition</Text></View> : null}
          <Text style={s.revision}>{props.model.revisionLabel}</Text>
          {props.notice ? <Text accessibilityRole="alert" style={s.noticeDark}>{props.notice}</Text> : null}
        </View></Reanimated.View>}
      </ScrollView>
      {!props.reordering ? <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.composerLayer}>
        <TaskComposer context={props.selectedContext} onClearContext={props.onClearContext} value={props.draft} onChangeText={props.setDraft} onSend={props.onSend} placeholder={decision ? '告诉 AI 你的决定…' : '告诉 AI 你想怎么改…'} disabled={planning} busy={props.busy} />
      </KeyboardAvoidingView> : null}
    </View>
  </Enter></SafeAreaView>;
}

const stepStatus: Record<ExecutionPresentationStep['status'], TaskUiStatus> = {
  waiting: 'idle', running: 'running', needs_decision: 'blocked', completed: 'completed', failed: 'failed', stopped: 'stopped',
};

function formatReceiptTime(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function HighFidelityExecutionSurface(props: {
  model: ExecutionPresentationModel;
  notice?: string;
  browserTestMode: boolean;
  plannerSource: string;
  busy: boolean;
  selectedContext?: string;
  draft: string;
  setDraft: (value: string) => void;
  onSelectFailedStep: (step: ExecutionPresentationStep) => void;
  onOpenResult: (step: ExecutionPresentationStep) => void;
  onClearContext: () => void;
  onRecover: () => void;
  onApprove: (stepId: string) => void;
  onDeclineApproval: (stepId: string) => void;
  onStop: () => void;
  onStartNewTask: () => void;
}) {
  const [expandedStep, setExpandedStep] = useState<string>();
  const [confirmStop, setConfirmStop] = useState(false);
  const executing = props.model.mode === 'waiting' || props.model.mode === 'execution' || props.model.mode === 'approval';
  const approval = props.model.mode === 'approval' ? props.model.pendingApproval : undefined;
  const recoverable = props.model.mode === 'partial_failure' || props.model.mode === 'failed';
  return <SafeAreaView style={s.stage}><Enter><View style={s.taskFrame}>
    <View style={s.island}>
      <View style={[s.liveDot, recoverable && s.decisionDot, props.model.mode === 'stopped' && s.stoppedDot]} />
      <Text style={s.islandAI}>AI</Text><Text numberOfLines={1} style={s.islandMessage}>{props.model.islandTitle}</Text>
      <Text style={[s.islandState, recoverable && s.islandDecision]}>{props.model.islandState}</Text>
      {executing ? <View style={s.islandStop}><TaskButton label="停止" accessibilityLabel="停止任务" variant="destructive" size="small" onPress={() => setConfirmStop(true)} /></View> : null}
    </View>
    {props.browserTestMode ? <BrowserModeNote plannerSource={props.plannerSource} /> : null}
    <ScrollView contentContainerStyle={[s.taskScroll, recoverable && s.recoveryScroll]} keyboardShouldPersistTaps="handled">
      <View style={s.conversationSheet}>
        <View style={s.handle} />
        <View style={s.sheetHeader}><Text style={s.eyebrow}>●　{props.model.eyebrow}</Text><Text style={s.progressCount}>{props.model.completedCount}/{props.model.totalCount}</Text></View>
        <View style={s.aiOpening}><View style={s.aiAvatar}><Text style={s.aiAvatarText}>AI</Text></View><View style={s.headlineWrap}><Text style={s.openingText}>{props.model.headline}</Text><Text style={s.supporting}>{props.model.supportingText}</Text></View></View>
        {approval ? <TaskSurface variant="card">
          <Text style={s.approvalLabel}>即将产生的后果</Text>
          <Text style={s.approvalTitle}>{approval.consequence}</Text>
          {approval.detail ? <Text style={s.approvalDetail}>{approval.detail}</Text> : null}
          <Text style={s.approvalBoundary}>本次批准只适用于上面显示的对象和内容；修改计划后需要重新批准。</Text>
          <View style={s.approvalActions}><TaskButton label="单独批准并继续" variant="primary" size="large" onPress={() => props.onApprove(approval.stepId)} /><TaskButton label="拒绝并返回修改" variant="secondary" size="large" onPress={() => props.onDeclineApproval(approval.stepId)} /></View>
        </TaskSurface> : null}
        {props.model.recurrence ? <TaskSurface variant="card">
          <Text style={s.recurrenceTitle}>{props.model.recurrence.label}</Text>
          <Text style={s.recurrenceMeta}>已完成 {props.model.recurrence.completedRuns} 次{props.model.recurrence.nextRunAt ? ` · 下次 ${formatReceiptTime(props.model.recurrence.nextRunAt)}` : ''}</Text>
          {props.model.pastOccurrences.slice(0, 3).map((occurrence) => <View key={occurrence.sequence} style={s.occurrenceRow}><Text style={[s.occurrenceIndex, occurrence.status === 'failed' && s.occurrenceFailed]}>第 {occurrence.sequence} 次</Text><View style={s.occurrenceCopy}><Text style={s.occurrenceTime}>{formatReceiptTime(occurrence.completedAt)} · {occurrence.status === 'failed' ? '未完成' : '已完成'}</Text><Text style={s.occurrenceSummary}>{occurrence.summaries.join('；')}</Text></View></View>)}
        </TaskSurface> : null}
        <View style={s.activityList}>{props.model.steps.map((step) => {
          const expanded = expandedStep === step.id;
          const canExpand = Boolean(step.receiptSummary || step.externalId || step.receiptAt || step.result);
          const detail = step.result?.metadata ?? step.receiptSummary ?? (step.status === 'failed' ? '点按此步骤，用自然语言调整后重新规划。' : undefined);
          const title = step.result?.title ?? step.title;
          return <TaskActionRow key={step.id} status={stepStatus[step.status]} annotation={`${step.result ? '结果' : step.capability} · ${step.statusLabel}`} title={title} detail={detail} onPress={canExpand || step.status === 'failed' ? () => step.status === 'failed' ? props.onSelectFailedStep(step) : setExpandedStep(expanded ? undefined : step.id) : undefined} trailing={canExpand ? <Text style={s.activityChevron}>{expanded ? '⌃' : '⌄'}</Text> : undefined}>
            {expanded ? <View style={s.receiptDetail}>
              {step.result?.preview ? <Text style={s.resultPreview}>{step.result.preview}</Text> : null}
              {step.result?.actionLabel ? <View style={s.resultAction}><TaskButton label={step.result.actionLabel} variant="secondary" size="medium" onPress={() => props.onOpenResult(step)} /></View> : null}
              <Text style={s.receiptLabel}>执行详情</Text>
              {step.receiptSummary ? <Text style={s.receiptText}>{step.receiptSummary}</Text> : null}
              {step.receiptAt ? <Text style={s.receiptText}>{formatReceiptTime(step.receiptAt)}</Text> : null}{step.externalId ? <Text style={s.receiptText}>External ID · {step.externalId}</Text> : null}
            </View> : null}
          </TaskActionRow>;
        })}</View>
        {props.notice ? <Text accessibilityRole="alert" style={s.noticeDark}>{props.notice}</Text> : null}
        {props.model.mode === 'receipt' || props.model.mode === 'stopped' ? <View style={s.secondaryWrap}><TaskButton label="开始新任务" variant="secondary" size="large" onPress={props.onStartNewTask} /></View> : null}
      </View>
    </ScrollView>
    {recoverable ? <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.composerLayer}><TaskComposer context={props.selectedContext} onClearContext={props.onClearContext} value={props.draft} onChangeText={props.setDraft} onSend={props.onRecover} placeholder="告诉 AI 想怎么恢复…" disabled={!props.selectedContext} busy={props.busy} /></KeyboardAvoidingView> : null}
    {confirmStop ? <View style={s.stopOverlay}><TaskSurface variant="modal"><View style={s.handle} /><Text style={s.stopTitle}>停止这项任务？</Text><Text style={s.stopBody}>AI 不会再派发新的操作。已经完成的操作与回执会继续保留。</Text><TaskButton label="确认停止" variant="destructive" size="large" onPress={() => { setConfirmStop(false); props.onStop(); }} /><TaskButton label="继续执行" variant="text" size="medium" onPress={() => setConfirmStop(false)} /></TaskSurface></View> : null}
  </View></Enter></SafeAreaView>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, stage: { flex: 1, backgroundColor: '#f4f5f8' },
  collapsedStage: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingTop: 14 }, islandPressed: { transform: [{ scale: .985 }], opacity: .9 },
  intakeScroll: { flexGrow: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28 }, intakeTaskScroll: { flexGrow: 1, paddingHorizontal: 10, paddingTop: 14, paddingBottom: 150 },
  taskFrame: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: '#f5f6f9' },
  island: { alignSelf: 'center', width: '84%', minHeight: 52, borderRadius: 27, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1b1b1c', shadowColor: '#10131a', shadowOpacity: .22, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#6ed89a', marginRight: 8 }, decisionDot: { backgroundColor: '#ef6a67' }, islandAI: { color: '#fff', fontSize: 12, fontWeight: '700', marginRight: 9 }, islandMessage: { color: '#e9eaed', fontSize: 12, fontWeight: '600', flex: 1 }, islandState: { color: '#8db7ff', fontSize: 11, fontWeight: '700' }, islandDecision: { color: '#ff837d' },
  stoppedDot: { backgroundColor: '#858b95' }, islandStop: { marginLeft: 8, marginRight: -10 }, planningBlock: { minHeight: 82, marginTop: 20, borderRadius: 20, backgroundColor: CARD, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17 }, planningPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6fa8ff', marginRight: 12 }, planningText: { color: '#c7ced8', fontSize: 12, fontWeight: '600' },
  approvalLabel: { color: '#ff9d78', fontSize: 10, fontWeight: '800', letterSpacing: .5, textTransform: 'uppercase' }, approvalTitle: { color: '#f6f7f9', fontSize: 16, lineHeight: 22, fontWeight: '700', marginTop: 8 }, approvalDetail: { color: '#c7cdd6', fontSize: 12, lineHeight: 18, marginTop: 8 }, approvalBoundary: { color: '#8993a1', fontSize: 10, lineHeight: 15, marginTop: 12 }, approvalActions: { gap: 8, marginTop: 16 },
  recurrenceTitle: { color: '#eef1f5', fontSize: 15, fontWeight: '700' }, recurrenceMeta: { color: '#8f98a6', fontSize: 10, marginTop: 5, marginBottom: 8 }, occurrenceRow: { flexDirection: 'row', paddingTop: 9, marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#343a44' }, occurrenceIndex: { width: 48, color: '#8fb8f6', fontSize: 10, fontWeight: '700' }, occurrenceFailed: { color: '#ff8e88' }, occurrenceCopy: { flex: 1 }, occurrenceTime: { color: '#9ca4af', fontSize: 9 }, occurrenceSummary: { color: '#d9dde3', fontSize: 11, lineHeight: 16, marginTop: 3 },
  browserNote: { marginTop: 10, marginHorizontal: 8, minHeight: 32, borderRadius: 12, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' }, browserQuietDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#8995a6', marginRight: 7 }, browserCopy: { flex: 1 }, browserTitle: { color: '#89919c', fontSize: 9, fontWeight: '600' }, browserText: { marginTop: 2, color: '#9ba2ac', fontSize: 8 }, browserDisclosure: { color: '#9ba2ac', fontSize: 8, marginLeft: 8 },
  intakePanel: { marginTop: 18, borderRadius: 34, padding: 20, paddingTop: 10, backgroundColor: PANEL, shadowColor: '#111827', shadowOpacity: .26, shadowRadius: 28, shadowOffset: { width: 0, height: 18 }, elevation: 10 }, handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#6f7681', marginBottom: 18 },
  aiOpening: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, aiAvatar: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf2ff' }, aiAvatarText: { color: '#1473e6', fontWeight: '800', fontSize: 15 }, openingText: { color: '#f4f5f7', fontSize: 20, lineHeight: 27, fontWeight: '700' }, headlineWrap: { flex: 1 }, supporting: { color: '#a6adb8', fontSize: 12, lineHeight: 18, marginTop: 5 },
  suggestionLabel: { marginTop: 18, color: '#8792a2', fontSize: 10, fontWeight: '700', letterSpacing: .4 }, modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 14 }, modePill: { minHeight: 39, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#343a44', backgroundColor: '#1a1d23' }, modePillActive: { borderColor: '#4f8ddd', backgroundColor: '#183052' }, modeText: { color: '#c4c9d1', fontSize: 12, fontWeight: '600' }, modeTextActive: { color: '#ecf4ff' },
  contextPreview: { borderRadius: 18, borderWidth: 1, borderColor: '#303640', backgroundColor: CARD, overflow: 'hidden', marginBottom: 12 }, previewHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12 }, previewKind: { color: '#e4e7ec', fontSize: 11, fontWeight: '700' }, previewSource: { color: '#8190a5', fontSize: 10 }, contextInput: { minHeight: 112, padding: 14, paddingTop: 9, color: '#dce0e6', fontSize: 13, lineHeight: 19, textAlignVertical: 'top' },
  goalField: { minHeight: 58, borderRadius: 18, borderWidth: 1, borderColor: '#303640', backgroundColor: '#171a20', paddingHorizontal: 14, justifyContent: 'center' }, annotation: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 9, minHeight: 24, justifyContent: 'center', borderRadius: 9, backgroundColor: '#203553' }, annotationText: { color: '#a9c9fa', fontSize: 10, fontWeight: '700' }, goalInput: { minHeight: 54, maxHeight: 96, color: '#f1f3f6', fontSize: 14, lineHeight: 20, textAlignVertical: 'center' }, originInput: { marginTop: 10, minHeight: 46, borderRadius: 15, borderWidth: 1, borderColor: '#303640', paddingHorizontal: 14, color: '#e9ebef', fontSize: 12, backgroundColor: '#171a20' },
  notice: { marginTop: 12, borderRadius: 13, padding: 11, color: '#ffc1bc', fontSize: 11, lineHeight: 16, backgroundColor: '#3b2022' }, primaryWrap: { marginTop: 14 }, pressed: { opacity: .84, transform: [{ scale: .99 }] }, disabled: { opacity: .48 },
  taskScroll: { flexGrow: 1, paddingTop: 18, paddingBottom: 160 }, conversationSheet: { marginHorizontal: 10, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22, borderRadius: 34, backgroundColor: PANEL, shadowColor: '#141821', shadowOpacity: .27, shadowRadius: 28, shadowOffset: { width: 0, height: 18 }, elevation: 10 }, sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, eyebrow: { color: '#9aa2af', fontSize: 11, fontWeight: '600' }, more: { color: '#abb2bd', fontSize: 17, letterSpacing: 2 },
  decisionOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 18 }, option: { minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: '#383f4a', paddingHorizontal: 15, justifyContent: 'center', backgroundColor: '#191d24' }, optionSelected: { borderColor: '#5a9afa', backgroundColor: '#1c375c' }, optionText: { color: '#e2e5ea', fontSize: 13, fontWeight: '600' }, optionTextSelected: { color: '#fff' },
  summaryList: { gap: 12, marginTop: 20 }, summaryRow: { minHeight: 94, borderRadius: 20, borderWidth: 1, borderColor: '#303640', backgroundColor: CARD, padding: 15, flexDirection: 'row', alignItems: 'center' }, summaryRowSelected: { borderColor: '#6aa5ff', backgroundColor: '#192a43' }, rowGlyph: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#22304a', marginRight: 13 }, rowGlyphText: { color: '#a9c9ff', fontSize: 16, fontWeight: '700' }, rowCopy: { flex: 1 }, rowAnnotation: { color: '#919aa8', fontSize: 11, marginBottom: 4 }, rowPrimary: { color: '#f2f3f5', fontSize: 16, lineHeight: 21, fontWeight: '700' }, rowSecondary: { color: '#a8afb9', fontSize: 11, lineHeight: 16, marginTop: 4 }, chevron: { color: '#8eb7f5', fontSize: 20, marginLeft: 8 }, revision: { color: '#6f7784', fontSize: 9, marginTop: 16, textAlign: 'right', textTransform: 'uppercase', letterSpacing: .7 }, noticeDark: { marginTop: 12, color: '#ffc0bb', fontSize: 11, lineHeight: 16 },
  sequenceHeading: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sequenceHint: { color: '#69717d', fontSize: 9 },
  reorderList: { position: 'relative', overflow: 'visible' }, reorderItem: { position: 'absolute', left: 0, right: 0, top: 0, height: REORDER_ROW_HEIGHT, paddingBottom: 1, shadowColor: '#05070b', shadowRadius: 16, shadowOffset: { width: 0, height: 9 } },
  sequenceRow: { flex: 1, minHeight: 68, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#303640', borderRadius: 14, backgroundColor: CARD }, sequenceRowSelected: { borderColor: '#6aa5ff', backgroundColor: '#1b2029' }, sequenceRowPressed: { borderColor: '#526174' },
  sequenceNumber: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#222b39', marginRight: 11 }, sequenceNumberText: { color: '#a9c9ff', fontSize: 11, fontWeight: '800' }, sequenceCopy: { flex: 1, minWidth: 0 }, sequenceTitle: { color: '#f2f3f5', fontSize: 14, lineHeight: 19, fontWeight: '700' }, sequenceDetail: { color: '#8f98a6', fontSize: 10, lineHeight: 15, marginTop: 2 },
  dragHandle: { width: 44, height: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center', gap: 3 }, dragLine: { width: 14, height: 1.5, borderRadius: 1, backgroundColor: '#697483' },
  processingWrap: { paddingHorizontal: 10, paddingTop: 42 }, processingSurface: { minHeight: 112, borderRadius: 28, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: PANEL, borderWidth: StyleSheet.hairlineWidth, borderColor: '#303640', shadowColor: '#141821', shadowOpacity: .2, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 8 }, processingPulse: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#6fa8ff', marginRight: 14 }, processingCopy: { flex: 1 }, processingTitle: { color: '#f1f3f6', fontSize: 17, lineHeight: 23, fontWeight: '700' }, processingText: { color: '#929ba8', fontSize: 11, lineHeight: 17, marginTop: 5 },
  overviewTitle: { color: '#f2f4f7', fontSize: 15, fontWeight: '700', marginBottom: 7 }, overviewRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#343a44' }, overviewLabel: { width: 66, color: '#8f98a6', fontSize: 10, fontWeight: '600' }, overviewValue: { flex: 1, color: '#dfe3e9', fontSize: 12, lineHeight: 17, fontWeight: '600' }, sequenceLabel: { marginTop: 4, color: '#8f98a6', fontSize: 10, fontWeight: '700', letterSpacing: .4 }, executionMeta: { color: '#748196', fontSize: 9, lineHeight: 13, marginTop: 7 },
  composerLayer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  recoveryScroll: { paddingBottom: 160 }, progressCount: { color: '#8fb8f6', fontSize: 11, fontWeight: '700' }, activityList: { gap: 10, marginTop: 20 }, activityChevron: { color: '#8fb8f6', fontSize: 15, marginLeft: 8 }, receiptDetail: { marginTop: 10, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3a404a' }, resultPreview: { color: '#e0e4ea', fontSize: 12, lineHeight: 18, marginBottom: 10 }, resultAction: { marginBottom: 12 }, receiptLabel: { color: '#758092', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: .6 }, receiptText: { color: '#858d99', fontSize: 10, marginTop: 4 }, secondaryWrap: { marginTop: 16 }, stopOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end', backgroundColor: '#0c0e1370' }, stopTitle: { color: '#f5f6f8', fontSize: 21, fontWeight: '700' }, stopBody: { color: '#a7aeb9', fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 18 },
});
