import { contentSchema } from '../../../src/schema/content.js';
import type { CarouselContent, PackagePayload } from './types.js';

export const requiredFiles = ['carousel.json', 'cover.png', 'insight.png'] as const;
export const maxJsonBytes = 1024 * 1024;
export const maxImageBytes = 32 * 1024 * 1024;
export type PackageFile = { name: string; size: number; webkitRelativePath?: string; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> };

export function parseContent(input: unknown): CarouselContent {
  if (typeof input === 'object' && input !== null && 'category' in input &&
      !['business', 'money', 'insight'].includes(String(input.category))) {
    throw new Error('unsupported category — business / money / insight 중 하나여야 합니다.');
  }
  const result = contentSchema.safeParse(input);
  if (!result.success) throw new Error(`carousel.json 형식 오류: ${result.error.issues.slice(0, 4).map(i => `${i.path.join('.')}: ${i.message}`).join('\n')}`);
  return result.data;
}

export function selectFiles(files: PackageFile[]): Map<string, PackageFile> {
  const found = new Map<string, PackageFile>();
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (!(requiredFiles as readonly string[]).includes(name)) continue;
    if (found.has(name)) throw new Error(`${name} 중복 — 한 package의 파일만 선택해 주세요.`);
    found.set(name, file);
  }
  return found;
}

export function validatePng(bytes: Uint8Array, name: string): void {
  if (!(bytes instanceof Uint8Array) || bytes.length > maxImageBytes) throw new Error(`${name}: PNG 파일은 32 MB 이하여야 합니다.`);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || signature.some((v, i) => bytes[i] !== v) ||
      String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') throw new Error(`${name}: 유효한 PNG 파일이 아닙니다.`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16), height = view.getUint32(20);
  if (!width || !height || width > 4096 || height > 4096) throw new Error(`${name}: Figma Image API를 위해 가로·세로 각각 1–4096 px PNG를 선택해 주세요.`);
}

export async function readPackage(files: PackageFile[]): Promise<PackagePayload> {
  const found = selectFiles(files);
  const missing = requiredFiles.filter(name => !found.has(name));
  if (missing.length) throw new Error(missing.map(name => `${name} missing`).join('\n'));
  const parents = requiredFiles.map(name => found.get(name)!.webkitRelativePath?.split('/').slice(0, -1).join('/')).filter(Boolean);
  if (new Set(parents).size > 1) throw new Error('파일이 서로 다른 폴더에 있습니다. 한 package만 선택해 주세요.');
  const json = found.get('carousel.json')!;
  if (json.size > maxJsonBytes) throw new Error('carousel.json: 1 MB 이하 파일을 선택해 주세요.');
  let raw: unknown;
  try { raw = JSON.parse((await json.text()).replace(/^\uFEFF/, '')); }
  catch { throw new Error('invalid JSON — carousel.json 문법을 확인해 주세요.'); }
  const content = parseContent(raw);
  const images = await Promise.all(['cover.png', 'insight.png'].map(async name => {
    const file = found.get(name)!;
    if (file.size > maxImageBytes) throw new Error(`${name}: 32 MB 이하 파일을 선택해 주세요.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    validatePng(bytes, name);
    return bytes;
  }));
  return { content, cover: images[0], insight: images[1] };
}
