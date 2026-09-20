import type { CarouselContent } from '../../../src/schema/content.js';
export type { CarouselContent };
export type PackagePayload = { content: CarouselContent; cover: Uint8Array; insight: Uint8Array };
export type ImportResult = { name: string; pages: number; fonts: string[]; warnings: string[] };
export type UIMessage = { type: 'import'; payload: PackagePayload };
