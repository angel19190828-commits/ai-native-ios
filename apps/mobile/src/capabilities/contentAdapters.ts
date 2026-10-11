import type { KeyValueStore } from '../storage/keyValueStore';
import { ContentArtifactStore } from '../storage/contentArtifactStore';
import { CapabilityError, type CapabilityAdapter } from './types';

const requiredText = (input: Record<string, unknown>, key: string, max: number) => {
  const value = input[key];
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new CapabilityError('decision_required', `${key} is required`);
  }
  return value.trim();
};

const artifactId = (kind: string, attemptId: string) =>
  `taskspace-${kind}-${attemptId.replace(/[^a-zA-Z0-9._-]/g, '-')}`;

export function createContentCapabilityAdapters(store: KeyValueStore): CapabilityAdapter[] {
  const artifacts = new ContentArtifactStore(store, 'capability-artifacts');

  const note: CapabilityAdapter = {
    descriptor: {
      id: 'taskspace.notes.create', title: 'Save a Taskspace note', risk: 'write',
      executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['taskspace.notes.write'],
    },
    async execute(input, context) {
      if (context.signal.aborted) throw new CapabilityError('cancelled', 'Note creation was cancelled');
      const title = requiredText(input, 'title', 160);
      const content = requiredText(input, 'content', 12000);
      const id = artifactId('note', context.attemptId);
      const saved = await artifacts.saveArtifact(context.userId, {
        id, kind: 'note', title, content, createdAt: new Date().toISOString(), taskId: context.taskId,
        idempotencyKey: context.idempotencyKey,
        metadata: { tags: Array.isArray(input.tags) ? input.tags : [] },
      });
      return { summary: `已保存笔记「${saved.title}」`, externalId: saved.id, output: { artifactId: saved.id, artifactType: saved.kind, title: saved.title, contentPreview: saved.content.slice(0, 500), persisted: true, simulated: false } };
    },
  };

  const messageDraft: CapabilityAdapter = {
    descriptor: {
      id: 'taskspace.messaging.createDraft', title: 'Create a Taskspace message draft', risk: 'write',
      executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['taskspace.messaging.draft.write'],
    },
    async execute(input, context) {
      if (context.signal.aborted) throw new CapabilityError('cancelled', 'Draft creation was cancelled');
      const body = requiredText(input, 'body', 12000);
      const recipient = typeof input.recipient === 'string' && input.recipient.trim() ? input.recipient.trim() : undefined;
      const title = typeof input.subject === 'string' && input.subject.trim()
        ? input.subject.trim().slice(0, 160)
        : recipient ? `给 ${recipient} 的消息草稿` : '消息草稿';
      const id = artifactId('message-draft', context.attemptId);
      const saved = await artifacts.saveArtifact(context.userId, {
        id, kind: 'message-draft', title, content: body, createdAt: new Date().toISOString(), taskId: context.taskId,
        idempotencyKey: context.idempotencyKey,
        metadata: { recipient, channel: input.channel },
      });
      return { summary: recipient ? `已创建给 ${recipient} 的消息草稿（未发送）` : '已创建消息草稿（未发送）', externalId: saved.id, output: { artifactId: saved.id, artifactType: saved.kind, title: saved.title, contentPreview: saved.content.slice(0, 500), recipient, persisted: true, sent: false, simulated: false } };
    },
  };

  const approvalDemo: CapabilityAdapter = {
    descriptor: {
      id: 'taskspace.messaging.approvalDemo', title: 'Demonstrate approval for an external send', risk: 'external-action',
      executor: 'device', interactionMode: 'structured', confirmation: 'always', scopes: ['taskspace.messaging.approval-demo'],
    },
    async execute(input, context) {
      if (context.signal.aborted) throw new CapabilityError('cancelled', 'Approval demo was cancelled');
      const recipient = requiredText(input, 'recipient', 300);
      requiredText(input, 'body', 2000);
      return {
        summary: `已验证给 ${recipient} 的逐次批准边界；没有发送任何消息`,
        output: { recipient, approved: true, sent: false, simulated: true, referenceOnly: true },
      };
    },
  };

  const preference: CapabilityAdapter = {
    descriptor: {
      id: 'taskspace.preferences.set', title: 'Save an explicit user preference', risk: 'write',
      executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['taskspace.preferences.write'],
    },
    async execute(input, context) {
      if (context.signal.aborted) throw new CapabilityError('cancelled', 'Preference save was cancelled');
      const key = requiredText(input, 'key', 100);
      const value = requiredText(input, 'value', 500);
      const saved = await artifacts.savePreference(context.userId, {
        key, value,
        category: typeof input.category === 'string' ? input.category.trim().slice(0, 100) : undefined,
        updatedAt: new Date().toISOString(), taskId: context.taskId, idempotencyKey: context.idempotencyKey,
      });
      return { summary: `已保存明确偏好：${saved.value}`, externalId: `taskspace-preference-${saved.key}`, output: { preferenceKey: saved.key, value: saved.value, persisted: true, explicit: true, simulated: false } };
    },
  };

  return [note, messageDraft, approvalDemo, preference];
}
