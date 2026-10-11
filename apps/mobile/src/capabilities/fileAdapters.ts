import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { CapabilityError, type CapabilityAdapter } from './types';

const safeName = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-').slice(0, 160);
const SUPPORTED_FILE_NAME = /\.(txt|md|json|csv)$/i;
const SUPPORTED_TYPES = ['text/plain', 'text/markdown', 'application/json', 'text/csv'];

export async function openDocumentResult(output: Record<string, unknown>) {
  const uri = typeof output.uri === 'string' ? output.uri : undefined;
  if (!uri || !(await Sharing.isAvailableAsync())) throw new Error('System file sharing is unavailable');
  await Sharing.shareAsync(uri, { mimeType: typeof output.mimeType === 'string' ? output.mimeType : undefined });
}

export function createFileCapabilityAdapters(): CapabilityAdapter[] {
  const read: CapabilityAdapter = {
    descriptor: {
      id: 'files.document.read', title: 'Read a user-selected text document', risk: 'read',
      executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['files.read.user-selected'],
    },
    async execute(input, context) {
      if (context.signal.aborted) throw new CapabilityError('cancelled', 'File selection was cancelled');
      const acceptedTypes = Array.isArray(input.acceptedTypes)
        ? input.acceptedTypes.filter((value): value is string => typeof value === 'string') : ['text/plain', 'text/markdown', 'application/json', 'text/csv'];
      const selected = await DocumentPicker.getDocumentAsync({ type: acceptedTypes, copyToCacheDirectory: true, multiple: false });
      if (selected.canceled) throw new CapabilityError('cancelled', 'No file was selected');
      const asset = selected.assets[0];
      const file = new File(asset.uri);
      if (!SUPPORTED_FILE_NAME.test(asset.name) || (asset.mimeType && !SUPPORTED_TYPES.includes(asset.mimeType))) {
        throw new CapabilityError('decision_required', '仅支持 .txt、.md、.json 和 .csv 文本文件');
      }
      const size = file.size ?? asset.size ?? 0;
      const maxBytes = typeof input.maxBytes === 'number' ? input.maxBytes : 200000;
      if (size > maxBytes) throw new CapabilityError('decision_required', `文件超过 ${maxBytes} bytes 的读取上限`);
      const content = await file.text();
      return {
        summary: `已读取文件「${asset.name}」`, externalId: asset.uri,
        output: { fileName: asset.name, mimeType: asset.mimeType || file.type || 'text/plain', sizeBytes: size, content, contentPreview: content.slice(0, 500), uri: asset.uri, source: 'ios-document-picker', simulated: false, nativeVerificationPending: true },
      };
    },
  };

  const create: CapabilityAdapter = {
    descriptor: {
      id: 'files.document.create', title: 'Create a downloadable document', risk: 'write',
      executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['files.write.user-export'],
    },
    async execute(input, context) {
      if (context.signal.aborted) throw new CapabilityError('cancelled', 'File creation was cancelled');
      const fileName = typeof input.fileName === 'string' ? safeName(input.fileName) : '';
      const content = typeof input.content === 'string' ? input.content : '';
      if (!fileName || !content) throw new CapabilityError('decision_required', '文件名和内容不能为空');
      if (!SUPPORTED_FILE_NAME.test(fileName)) throw new CapabilityError('decision_required', '文件扩展名不受支持');
      const mimeType = typeof input.mimeType === 'string' ? input.mimeType : 'text/plain';
      const file = new File(Paths.document, `${Date.now()}-${fileName}`);
      file.create({ intermediates: true });
      file.write(content);
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) await Sharing.shareAsync(file.uri, { mimeType });
      return { summary: `已创建文件「${fileName}」`, externalId: file.uri, output: { fileName, mimeType, sizeBytes: file.size ?? content.length, content, contentPreview: content.slice(0, 500), uri: file.uri, source: 'ios-files', sharePresented: sharingAvailable, simulated: false, nativeVerificationPending: true } };
    },
  };
  return [read, create];
}
