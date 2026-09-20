import { readPackage, selectFiles } from './package.js';
import { t } from './tokens.js';
import type { PackagePayload, ImportResult } from './types.js';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const filesInput = element<HTMLInputElement>('files'), directory = element<HTMLInputElement>('directory');
const importButton = element<HTMLButtonElement>('import'), select = element<HTMLButtonElement>('select'), folder = element<HTMLButtonElement>('folder');
const drop = element('drop'), status = element('status');
let payload: PackagePayload | undefined;
let generation = 0, importing = false;
function show(message: string, error = false) {
  status.textContent = message; status.classList.toggle('error', error);
}
function busy(value: boolean) { importing = value; select.disabled = value; folder.disabled = value; importButton.disabled = value || !payload; }
function reset() {
  payload = undefined; importButton.disabled = true;
  element('slug').textContent = '—'; element('category').textContent = '—';
  for (const id of ['json-state', 'cover-state', 'insight-state']) element(id).textContent = '—';
}
async function decode(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: 'image/png' }));
  try {
    const image = new Image(); image.src = url;
    await image.decode();
  } catch { throw new Error(`${name}: 깨진 PNG입니다. 정상 이미지 파일을 선택해 주세요.`); }
  finally { URL.revokeObjectURL(url); }
}
async function prepare(files: File[], ticket: number) {
  try {
    if (ticket !== generation) return;
    const found = selectFiles(files);
    for (const [name, id] of [['carousel.json', 'json-state'], ['cover.png', 'cover-state'], ['insight.png', 'insight-state']]) {
      element(id).textContent = found.has(name) ? '✓ 선택됨' : '✕ missing';
    }
    const next = await readPackage(files);
    await Promise.all([decode(next.cover, 'cover.png'), decode(next.insight, 'insight.png')]);
    if (ticket !== generation) return; // A slower, older selection cannot replace a newer package.
    payload = next;
    element('slug').textContent = next.content.slug;
    element('category').textContent = t.categories[next.content.category].label;
    for (const id of ['json-state', 'cover-state', 'insight-state']) element(id).textContent = '✓';
    importButton.disabled = false;
    show(`Ready — ${next.content.body.length + 3} pages\nImport 시 Pretendard Regular / Bold 사용 가능 여부를 확인합니다.`);
  } catch (error) { if (ticket === generation) show(`Error — ${error instanceof Error ? error.message : String(error)}`, true); }
}
function accept(files: File[]) {
  if (importing) return;
  const ticket = ++generation;
  reset(); show('파일 확인 중…');
  void prepare(files, ticket);
}
select.onclick = () => { filesInput.value = ''; filesInput.click(); };
folder.onclick = () => { directory.value = ''; directory.click(); };
filesInput.onchange = () => accept(Array.from(filesInput.files ?? []));
directory.onchange = () => accept(Array.from(directory.files ?? []));

// Chromium directory entries are optional; plain FileList is always the fallback.
async function entryFiles(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) return [await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))];
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const files: File[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) break;
    // One package directory only: do not recursively traverse unrelated folders.
    for (const child of batch) if (child.isFile) files.push(...await entryFiles(child));
  }
  return files;
}
drop.ondragover = event => { event.preventDefault(); if (!importing) drop.classList.add('active'); };
drop.ondragleave = () => drop.classList.remove('active');
drop.ondrop = async event => {
  event.preventDefault(); drop.classList.remove('active');
  if (importing || !event.dataTransfer) return;
  const ticket = ++generation;
  reset(); show('파일 확인 중…');
  try {
    // Capture all handles synchronously; the drag data store expires after this event.
    const fallback = Array.from(event.dataTransfer.files);
    const entries = Array.from(event.dataTransfer.items).map(item => item.webkitGetAsEntry?.()).filter((entry): entry is FileSystemEntry => !!entry);
    if (entries.some(entry => entry.isDirectory) && entries.length !== 1) throw new Error('한 package 폴더만 놓아 주세요.');
    const files = entries.length ? (await Promise.all(entries.map(entryFiles))).flat() : fallback;
    if (!files.length) throw new Error('폴더를 읽지 못했습니다. Select Package Files에서 파일 3개를 선택해 주세요.');
    await prepare(files, ticket);
  } catch (error) { if (ticket === generation) show(`Error — ${error instanceof Error ? error.message : String(error)}`, true); }
};
importButton.onclick = () => {
  if (!payload || importing) return;
  busy(true); show('Importing — 폰트와 이미지를 확인하고 editable layer를 생성합니다…');
  parent.postMessage({ pluginMessage: { type: 'import', payload } }, '*');
};
window.onmessage = event => {
  if (event.source !== parent) return;
  const message = event.data?.pluginMessage;
  if (message?.type === 'success') {
    busy(false);
    const result = message.result as ImportResult;
    show(`Imported — ${result.name}\n${result.pages} frames · ${result.fonts.join(' / ')}${result.warnings.length ? `\n\n검토 필요:\n${result.warnings.join('\n')}` : ''}`);
  } else if (message?.type === 'error') {
    busy(false); show(`Error — ${message.message}`, true);
  }
};
