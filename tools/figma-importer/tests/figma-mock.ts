// Contract test double, NOT a Figma runtime emulator. Actual font shaping, painting,
// UI handles and section behavior still require the desktop acceptance checklist.
export class MockNode {
  type: string; name = ''; x = 0; y = 0; visible = true; locked = false; opacity = 1;
  children: MockNode[] = []; parent: MockNode | null = null; removed = false;
  fills: unknown[] = []; clipsContent = false; exportSettings: unknown[] = [];
  fontName: FontName = { family: 'Inter', style: 'Regular' }; fontSize = 12;
  lineHeight = { unit: 'PIXELS', value: 14 }; letterSpacing = { unit: 'PIXELS', value: 0 };
  textAutoResize = 'NONE'; characters = ''; selection: MockNode[] = [];
  ranges: { start: number; end: number; fills: unknown[] }[] = [];
  data: Record<string, string> = {};
  private w = 100; private h = 100;
  constructor(type: string) { this.type = type; }
  measure(text: string) { return Array.from(text).reduce((w, c) => w + this.fontSize * (/\s/.test(c) ? 0.25 : /[\u0000-\u007f]/.test(c) ? 0.52 : 0.87) + this.letterSpacing.value, 0); }
  get width(): number { return this.type === 'TEXT' && this.textAutoResize === 'WIDTH_AND_HEIGHT' ? Math.max(0.01, ...this.characters.split('\n').map(t => this.measure(t))) : this.w; }
  get height(): number {
    if (this.type !== 'TEXT' || this.textAutoResize === 'NONE') return this.h;
    return this.characters.split('\n').reduce((count, line) => count + (this.textAutoResize === 'HEIGHT' ? Math.max(1, Math.ceil(this.measure(line) / this.w)) : 1), 0) * this.lineHeight.value;
  }
  resize(w: number, h: number) { if (!(w > 0 && h > 0)) throw new Error('Invalid resize'); this.w = w; this.h = h; }
  resizeWithoutConstraints(w: number, h: number) { this.resize(w, h); }
  appendChild(node: MockNode) { node.detach(); node.parent = this; this.children.push(node); }
  insertChild(index: number, node: MockNode) { node.detach(); node.parent = this; this.children.splice(index, 0, node); }
  private detach() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); }
  remove() { this.detach(); this.removed = true; }
  setRangeFills(start: number, end: number, fills: unknown[]) { this.ranges.push({ start, end, fills }); }
  setPluginData(key: string, value: string) { this.data[key] = value; }
}
export function descendants(node: MockNode): MockNode[] { return node.children.flatMap(n => [n, ...descendants(n)]); }
export function mockFigma() {
  const page = new MockNode('PAGE');
  const loaded: FontName[] = [], images: Uint8Array[] = [];
  let focused: unknown[] = [];
  const create = (type: string) => { const node = new MockNode(type); page.appendChild(node); return node; };
  const mock = {
    currentPage: page,
    viewport: { center: { x: 0, y: 0 }, scrollAndZoomIntoView: (nodes: unknown[]) => { focused = nodes; } },
    listAvailableFontsAsync: async () => ['Regular', 'Bold'].map(style => ({ fontName: { family: 'Pretendard', style } })),
    loadFontAsync: async (font: FontName) => { loaded.push(font); },
    createImage: (bytes: Uint8Array) => { images.push(bytes); return { hash: `image-${images.length}`, getSizeAsync: async () => ({ width: 1080, height: 1350 }) }; },
    createSection: () => create('SECTION'), createFrame: () => create('FRAME'),
    createRectangle: () => create('RECTANGLE'), createText: () => create('TEXT'),
  };
  return { api: mock as unknown as PluginAPI, mock, page, loaded, images, focused: () => focused };
}
