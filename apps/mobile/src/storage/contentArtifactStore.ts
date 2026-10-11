import type { KeyValueStore } from './keyValueStore';

export type ContentArtifactKind = 'note' | 'message-draft';

export interface ContentArtifact {
  id: string;
  kind: ContentArtifactKind;
  title: string;
  content: string;
  createdAt: string;
  taskId: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface ExplicitPreference {
  key: string;
  value: string;
  category?: string;
  updatedAt: string;
  taskId: string;
  idempotencyKey: string;
}

interface UserContentRecord {
  version: 1;
  artifacts: ContentArtifact[];
  preferences: ExplicitPreference[];
}

const emptyRecord = (): UserContentRecord => ({ version: 1, artifacts: [], preferences: [] });
const safeUserId = (userId: string) => userId.replace(/[^a-zA-Z0-9._-]/g, '_');

export class ContentArtifactStore {
  constructor(private readonly store: KeyValueStore, private readonly namespace = 'local') {}

  private key(userId: string) {
    return `taskspace:${this.namespace}:content:v1:${safeUserId(userId)}`;
  }

  private async load(userId: string): Promise<UserContentRecord> {
    const raw = await this.store.getItem(this.key(userId));
    if (!raw) return emptyRecord();
    const parsed = JSON.parse(raw) as Partial<UserContentRecord>;
    if (parsed.version !== 1 || !Array.isArray(parsed.artifacts) || !Array.isArray(parsed.preferences)) {
      throw new Error('Content artifact store is corrupted');
    }
    return parsed as UserContentRecord;
  }

  async saveArtifact(userId: string, artifact: ContentArtifact) {
    const record = await this.load(userId);
    const existing = record.artifacts.find((item) => item.idempotencyKey === artifact.idempotencyKey);
    if (existing) return existing;
    const next = { ...record, artifacts: [...record.artifacts, artifact].slice(-200) };
    await this.store.setItem(this.key(userId), JSON.stringify(next));
    return artifact;
  }

  async savePreference(userId: string, preference: ExplicitPreference) {
    const record = await this.load(userId);
    const existing = record.preferences.find((item) => item.idempotencyKey === preference.idempotencyKey);
    if (existing) return existing;
    const nextPreferences = record.preferences.filter((item) => item.key !== preference.key);
    const next = { ...record, preferences: [...nextPreferences, preference].slice(-100) };
    await this.store.setItem(this.key(userId), JSON.stringify(next));
    return preference;
  }

  async listArtifacts(userId: string) {
    return (await this.load(userId)).artifacts;
  }

  async listPreferences(userId: string) {
    return (await this.load(userId)).preferences;
  }
}
