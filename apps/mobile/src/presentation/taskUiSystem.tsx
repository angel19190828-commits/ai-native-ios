import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export const taskUi = {
  color: {
    stage: '#f5f6f9', panel: '#111318', card: '#191c22', cardSelected: '#192a43',
    border: '#303640', ink: '#f2f3f5', muted: '#9da5b2', subtle: '#737c89',
    blue: '#0a84ff', blueSoft: '#8fb8f6', green: '#70d895', orange: '#ff9138',
    red: '#ff7772', glass: '#f5f6f9ee',
  },
  space: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 28 },
  radius: { annotation: 10, control: 16, row: 20, composer: 29, sheet: 34, round: 999 },
  icon: { sm: 16, md: 20, lg: 24, touch: 44 },
  motion: { quick: 150, standard: 220, sheet: 280 },
} as const;

export type TaskButtonVariant = 'primary' | 'secondary' | 'destructive' | 'text' | 'icon';
export type TaskButtonSize = 'small' | 'medium' | 'large';

export function TaskButton(props: {
  label: string; onPress: () => void; variant?: TaskButtonVariant; size?: TaskButtonSize;
  disabled?: boolean; loading?: boolean; icon?: ReactNode; accessibilityLabel?: string;
}) {
  const variant = props.variant ?? 'primary';
  const size = props.size ?? 'medium';
  const iconOnly = variant === 'icon';
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={props.accessibilityLabel ?? props.label}
    disabled={props.disabled || props.loading}
    onPress={props.onPress}
    style={({ pressed }) => [c.button, c[`button_${size}`], c[`button_${variant}`], iconOnly && c.iconButton, pressed && c.pressed, (props.disabled || props.loading) && c.disabled]}
  >
    {props.loading ? <ActivityIndicator color={variant === 'primary' || variant === 'destructive' ? '#fff' : taskUi.color.blue} /> : <>{props.icon}{!iconOnly ? <Text style={[c.buttonLabel, c[`label_${variant}`]]}>{props.label}</Text> : null}</>}
  </Pressable>;
}

export function TaskSurface({ variant = 'card', children }: { variant?: 'sheet' | 'card' | 'modal' | 'glass'; children: ReactNode }) {
  return <View style={[c.surface, c[`surface_${variant}`]]}>{children}</View>;
}

export type TaskUiStatus = 'idle' | 'running' | 'completed' | 'failed' | 'blocked' | 'simulated' | 'stopped';

export function TaskStatus({ status, label }: { status: TaskUiStatus; label?: string }) {
  const marks: Record<TaskUiStatus, string> = { idle: '○', running: '●', completed: '✓', failed: '!', blocked: '!', simulated: '◇', stopped: '■' };
  return <View style={[c.status, c[`status_${status}`]]}><Text style={c.statusMark}>{marks[status]}</Text>{label ? <Text style={c.statusLabel}>{label}</Text> : null}</View>;
}

export function DecisionPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [c.pill, selected && c.pillSelected, pressed && c.pressed]}><Text style={[c.pillText, selected && c.pillTextSelected]}>{label}</Text></Pressable>;
}

export function ContextAnnotation({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return <Pressable disabled={!onRemove} onPress={onRemove} style={c.annotation}><Text numberOfLines={1} style={c.annotationText}>{label}{onRemove ? '　×' : ''}</Text></Pressable>;
}

export function TaskActionRow(props: {
  glyph?: string; annotation: string; title: string; detail?: string; selected?: boolean;
  status?: TaskUiStatus; trailing?: ReactNode; children?: ReactNode; onPress?: () => void;
}) {
  return <Pressable disabled={!props.onPress} onPress={props.onPress} style={({ pressed }) => [c.actionRow, props.selected && c.actionRowSelected, pressed && props.onPress && c.pressed]}>
    {props.status ? <TaskStatus status={props.status} /> : props.glyph ? <View style={c.rowGlyph}><Text style={c.rowGlyphText}>{props.glyph}</Text></View> : null}
    <View style={c.rowCopy}><Text style={c.rowAnnotation}>{props.annotation}</Text><Text style={c.rowTitle}>{props.title}</Text>{props.detail ? <Text style={c.rowDetail}>{props.detail}</Text> : null}{props.children}</View>
    {props.trailing}
  </Pressable>;
}

export function TaskComposer(props: {
  value: string; onChangeText: (value: string) => void; onSend: () => void; placeholder: string;
  context?: string; onClearContext?: () => void; disabled?: boolean; busy?: boolean;
}) {
  return <View style={c.composerArea}>
    {props.context ? <ContextAnnotation label={props.context} onRemove={props.onClearContext} /> : null}
    <View style={c.composerRow}><View style={c.composerInput}><TextInput value={props.value} onChangeText={props.onChangeText} multiline maxLength={1000} placeholder={props.placeholder} placeholderTextColor="#9ca3ae" style={c.composerText} /><Text style={c.mic}>♩</Text></View><TaskButton label="发送" accessibilityLabel="发送给 AI" variant="icon" size="large" disabled={props.disabled} loading={props.busy} onPress={props.onSend} icon={<Text style={c.sendGlyph}>↑</Text>} /></View>
  </View>;
}

export function PermissionCard(props: {
  icon: string; title: string; description: string; risk: 'read' | 'write' | 'high-impact';
  status: 'request' | 'pending' | 'denied' | 'granted'; onAction?: () => void;
}) {
  const statusCopy = { request: '需要授权', pending: '等待系统确认', denied: '未授权', granted: '已授权' }[props.status];
  const actionCopy = { request: '继续授权', pending: '等待中', denied: '打开设置', granted: '完成' }[props.status];
  const blocked = props.status === 'pending' || props.status === 'granted';
  return <TaskSurface><View style={c.permissionHead}><View style={c.permissionIcon}><Text style={c.permissionIconText}>{props.icon}</Text></View><View style={c.permissionCopy}><Text style={c.permissionTitle}>{props.title}</Text><Text style={c.permissionDescription}>{props.description}</Text></View></View><View style={c.permissionFooter}><TaskStatus status={props.status === 'granted' ? 'completed' : props.status === 'denied' ? 'failed' : props.status === 'pending' ? 'running' : 'idle'} label={`${statusCopy} · ${props.risk}`} /><TaskButton label={actionCopy} variant={props.status === 'denied' ? 'secondary' : 'primary'} size="small" disabled={blocked} onPress={props.onAction ?? (() => undefined)} /></View></TaskSurface>;
}

const c = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1 },
  button_small: { minHeight: 36, paddingHorizontal: 12, borderRadius: 12 }, button_medium: { minHeight: 44, paddingHorizontal: 16, borderRadius: 14 }, button_large: { minHeight: 52, paddingHorizontal: 18, borderRadius: 16 },
  button_primary: { backgroundColor: taskUi.color.blue, borderColor: taskUi.color.blue }, button_secondary: { backgroundColor: '#1a1e25', borderColor: '#363d47' }, button_destructive: { backgroundColor: '#783238', borderColor: '#914047' }, button_text: { backgroundColor: 'transparent', borderColor: 'transparent' }, button_icon: { backgroundColor: '#e7f0ff', borderColor: '#e7f0ff' },
  iconButton: { width: 52, paddingHorizontal: 0, borderRadius: 26 }, buttonLabel: { fontSize: 13, fontWeight: '700' }, label_primary: { color: '#fff' }, label_secondary: { color: '#edf0f4' }, label_destructive: { color: '#ffd9d7' }, label_text: { color: taskUi.color.blueSoft }, label_icon: { color: taskUi.color.blue },
  pressed: { opacity: .84, transform: [{ scale: .985 }] }, disabled: { opacity: .46 },
  surface: { borderWidth: 1, borderColor: taskUi.color.border }, surface_sheet: { borderRadius: taskUi.radius.sheet, padding: taskUi.space.lg, backgroundColor: taskUi.color.panel }, surface_card: { borderRadius: taskUi.radius.row, padding: taskUi.space.md, backgroundColor: taskUi.color.card }, surface_modal: { borderTopLeftRadius: taskUi.radius.sheet, borderTopRightRadius: taskUi.radius.sheet, padding: taskUi.space.lg, backgroundColor: taskUi.color.panel }, surface_glass: { borderRadius: taskUi.radius.composer, padding: taskUi.space.md, backgroundColor: '#4b4d54d9' },
  status: { minWidth: 30, height: 30, paddingHorizontal: 8, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#2b3546' }, status_idle: { backgroundColor: '#2b3546' }, status_running: { backgroundColor: '#173d61' }, status_completed: { backgroundColor: '#194530' }, status_failed: { backgroundColor: '#6a292e' }, status_blocked: { backgroundColor: '#5b3820' }, status_simulated: { backgroundColor: '#303a4c' }, status_stopped: { backgroundColor: '#35383e' }, statusMark: { color: '#fff', fontSize: 12, fontWeight: '800' }, statusLabel: { color: '#dce2ea', fontSize: 10, fontWeight: '600' },
  pill: { minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: '#383f4a', paddingHorizontal: 15, justifyContent: 'center', backgroundColor: '#191d24' }, pillSelected: { borderColor: '#5a9afa', backgroundColor: '#1c375c' }, pillText: { color: '#e2e5ea', fontSize: 13, fontWeight: '600' }, pillTextSelected: { color: '#fff' },
  annotation: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 32, paddingHorizontal: 11, borderRadius: taskUi.radius.annotation, justifyContent: 'center', backgroundColor: '#263a5b', marginBottom: 8 }, annotationText: { color: '#bfd5fa', fontSize: 11, fontWeight: '600' },
  actionRow: { minHeight: 82, padding: 13, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: taskUi.color.border, borderRadius: taskUi.radius.row, backgroundColor: taskUi.color.card }, actionRowSelected: { borderColor: '#6aa5ff', backgroundColor: taskUi.color.cardSelected }, rowGlyph: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#22304a', marginRight: 13 }, rowGlyphText: { color: '#a9c9ff', fontSize: 16, fontWeight: '700' }, rowCopy: { flex: 1, paddingLeft: 12 }, rowAnnotation: { color: '#919aa8', fontSize: 11, marginBottom: 4 }, rowTitle: { color: taskUi.color.ink, fontSize: 15, lineHeight: 20, fontWeight: '700' }, rowDetail: { color: '#a8afb9', fontSize: 11, lineHeight: 16, marginTop: 4 },
  composerArea: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18, backgroundColor: 'transparent' }, composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 }, composerInput: { flex: 1, minHeight: 58, maxHeight: 112, borderRadius: taskUi.radius.composer, paddingLeft: 18, paddingRight: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#4b4d54e8', borderWidth: StyleSheet.hairlineWidth, borderColor: '#ffffff28', shadowColor: '#1a1d24', shadowOpacity: .2, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 6 }, composerText: { flex: 1, maxHeight: 90, color: '#fff', fontSize: 14, lineHeight: 20, textAlignVertical: 'center' }, mic: { color: '#8dbbff', fontSize: 20, marginLeft: 8 }, sendGlyph: { color: taskUi.color.blue, fontSize: 29, lineHeight: 32, fontWeight: '300' },
  permissionHead: { flexDirection: 'row', alignItems: 'flex-start' }, permissionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#22304a', marginRight: 12 }, permissionIconText: { color: '#a9c9ff', fontWeight: '700' }, permissionCopy: { flex: 1 }, permissionTitle: { color: taskUi.color.ink, fontSize: 15, fontWeight: '700' }, permissionDescription: { color: taskUi.color.muted, fontSize: 11, lineHeight: 16, marginTop: 4 }, permissionFooter: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
