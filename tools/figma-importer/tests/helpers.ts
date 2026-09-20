import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { parseContent } from '../src/package.js';
import type { PackagePayload } from '../src/types.js';

export async function fixture(): Promise<PackagePayload> {
  const content = parseContent(JSON.parse(await readFile(new URL('./fixtures/business.json', import.meta.url), 'utf8')));
  const png = async (background: string) => new Uint8Array(await sharp({ create: { width: 1080, height: 1350, channels: 3, background } }).png().toBuffer());
  return { content, cover: await png('#26435b'), insight: await png('#45514d') };
}
export const packageFiles = (payload: PackagePayload) => [
  { name: 'carousel.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload.content)) },
  { name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from(payload.cover) },
  { name: 'insight.png', mimeType: 'image/png', buffer: Buffer.from(payload.insight) },
];
