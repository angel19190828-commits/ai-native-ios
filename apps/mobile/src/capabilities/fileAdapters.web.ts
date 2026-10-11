import { CapabilityError, type CapabilityAdapter } from './types';

const DEFAULT_TYPES = ['text/plain', 'text/markdown', 'application/json', 'text/csv'];
const SUPPORTED_FILE_NAME = /\.(txt|md|json|csv)$/i;
const SAFE_CREATED_FILE_NAME = /^[^\\/:*?"<>|]+\.(txt|md|json|csv)$/i;

interface BrowserSelectedFile {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  text(): Promise<string>;
}

interface BrowserFileIo {
  chooseTextFile(acceptedTypes: string[]): Promise<BrowserSelectedFile>;
  requestDownload(output: Record<string, unknown>): void;
}

const chooseTextFile = (acceptedTypes: string[]) => new Promise<File>((resolve, reject) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = acceptedTypes.join(',');
  input.style.display = 'none';
  const cleanup = () => input.remove();
  input.addEventListener('cancel', () => {
    cleanup();
    reject(new CapabilityError('cancelled', 'File selection was cancelled'));
  }, { once: true });
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    cleanup();
    if (file) resolve(file);
    else reject(new CapabilityError('cancelled', 'No file was selected'));
  }, { once: true });
  document.body.appendChild(input);
  input.click();
});

function downloadableDocument(output: Record<string, unknown>) {
  const fileName = typeof output.fileName === 'string' ? output.fileName : undefined;
  const content = typeof output.content === 'string' ? output.content : undefined;
  if (!fileName || content === undefined) throw new Error('The file receipt does not contain downloadable content');
  const mimeType = typeof output.mimeType === 'string' ? output.mimeType : 'text/plain;charset=utf-8';
  return { fileName, mimeType, blob: new Blob([content], { type: mimeType }) };
}

function requestBrowserDownload(output: Record<string, unknown>) {
  const { fileName, blob } = downloadableDocument(output);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = fileName; link.style.display = 'none';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const browserFileIo: BrowserFileIo = {
  chooseTextFile,
  requestDownload: requestBrowserDownload,
};

export async function openDocumentResult(output: Record<string, unknown>) {
  const { fileName, mimeType, blob } = downloadableDocument(output);
  const savePicker = (window as typeof window & {
    showSaveFilePicker?: (options: Record<string, unknown>) => Promise<{
      createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
    }>;
  }).showSaveFilePicker;
  if (!savePicker) {
    requestBrowserDownload(output);
    return;
  }
  const extension = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '.txt';
  const handle = await savePicker({
    suggestedName: fileName,
    types: [{ description: 'Document', accept: { [mimeType.split(';')[0]]: [extension] } }],
  });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export function createFileCapabilityAdapters(io: BrowserFileIo = browserFileIo): CapabilityAdapter[] {
  const read: CapabilityAdapter = {
    descriptor: {
      id: 'files.document.read', title: 'Read a user-selected text document', risk: 'read',
      executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['files.read.user-selected'],
    },
    async execute(input, context) {
      if (context.signal.aborted) throw new CapabilityError('cancelled', 'File selection was cancelled');
      const acceptedTypes = Array.isArray(input.acceptedTypes)
        ? input.acceptedTypes.filter((value): value is string => typeof value === 'string') : DEFAULT_TYPES;
      const maxBytes = typeof input.maxBytes === 'number' ? input.maxBytes : 200000;
      const file = await io.chooseTextFile(acceptedTypes.length ? acceptedTypes : DEFAULT_TYPES);
      if (!SUPPORTED_FILE_NAME.test(file.name) || (file.type && !DEFAULT_TYPES.includes(file.type))) {
        throw new CapabilityError('decision_required', '仅支持 .txt、.md、.json 和 .csv 文本文件');
      }
      if (file.size > maxBytes) throw new CapabilityError('decision_required', `文件超过 ${maxBytes} bytes 的读取上限`);
      const content = await file.text();
      return {
        summary: `已读取文件「${file.name}」`, externalId: `browser-file:${file.name}:${file.lastModified}`,
        output: {
          fileName: file.name, mimeType: file.type || 'text/plain', sizeBytes: file.size,
          content, contentPreview: content.slice(0, 500), source: 'browser-file-picker', simulated: false,
        },
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
      const fileName = typeof input.fileName === 'string' ? input.fileName : '';
      const content = typeof input.content === 'string' ? input.content : '';
      if (!fileName || !content) throw new CapabilityError('decision_required', '文件名和内容不能为空');
      if (!SAFE_CREATED_FILE_NAME.test(fileName)) throw new CapabilityError('decision_required', '文件名或扩展名不受支持');
      const mimeType = typeof input.mimeType === 'string' ? input.mimeType : 'text/plain;charset=utf-8';
      const output = { fileName, mimeType, sizeBytes: new Blob([content]).size, content, contentPreview: content.slice(0, 500), source: 'browser-download', downloadRequested: true, simulated: false };
      io.requestDownload(output);
      return { summary: `已生成可下载文件「${fileName}」`, externalId: `browser-download:${context.attemptId}`, output };
    },
  };
  return [read, create];
}
