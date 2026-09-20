import { t } from './tokens.js';
import type { Fonts } from './fonts.js';

export const solid = (hex: string): SolidPaint => ({ type: 'SOLID', color: {
  r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255,
} });
export type TextStyle = { size: number; line: number; bold?: boolean; color?: string; spacing?: number };
type Parent = FrameNode | SectionNode;

export function rectangle(api: PluginAPI, parent: Parent, name: string, x: number, y: number, width: number, height: number, color: string): RectangleNode {
  const node = api.createRectangle();
  parent.appendChild(node);
  node.name = name; node.x = x; node.y = y;
  node.resize(Math.max(0.01, width), Math.max(0.01, height));
  node.fills = [solid(color)];
  return node;
}

export class TextBuilder {
  private probe: TextNode;
  private widths = new Map<string, number>();
  constructor(private api: PluginAPI, parent: Parent, private fonts: Fonts, private accent: string, private warnings: string[]) {
    this.probe = api.createText();
    parent.appendChild(this.probe);
    this.probe.name = 'Temporary text measurement';
    this.probe.visible = false;
  }
  dispose() { this.probe.remove(); }
  private style(node: TextNode, style: TextStyle) {
    node.fontName = style.bold ? this.fonts.bold : this.fonts.regular;
    node.fontSize = style.size;
    node.lineHeight = { unit: 'PIXELS', value: style.line };
    node.letterSpacing = { unit: 'PIXELS', value: style.spacing ?? 0 };
    node.fills = [solid(style.color ?? t.colors.ink)];
    node.textAutoResize = 'WIDTH_AND_HEIGHT';
  }
  measure(text: string, style: TextStyle): number {
    if (!text) return 0;
    const key = JSON.stringify([text, style.size, style.line, style.bold, style.spacing]);
    if (!this.widths.has(key)) {
      this.style(this.probe, style);
      this.probe.characters = text;
      this.widths.set(key, this.probe.width);
    }
    return this.widths.get(key)!;
  }
  text(parent: Parent, name: string, value: string, x: number, y: number, style: TextStyle, width?: number): TextNode {
    const node = this.api.createText();
    parent.appendChild(node);
    node.name = name;
    this.style(node, style);
    node.characters = value;
    if (width !== undefined) {
      node.textAutoResize = 'HEIGHT';
      node.resize(width, style.line);
    }
    node.x = x; node.y = y;
    return node;
  }

  // Initial word wrapping uses the loaded Figma font. A highlighted phrase stays together,
  // just like renderer mark{white-space:nowrap}; authored line boundaries remain untouched.
  wrap(value: string, target: string | undefined, width: number, style: TextStyle): string[] {
    const at = target ? value.indexOf(target) : -1;
    const units = at < 0 ? value.match(/\S+|\s+/g) ?? [] : [
      ...(value.slice(0, at).match(/\S+|\s+/g) ?? []), target!, ...(value.slice(at + target!.length).match(/\S+|\s+/g) ?? []),
    ];
    const lines: string[] = [];
    let line = '';
    for (const unit of units) {
      if (line.trim() && unit.trim() && this.measure(line + unit, style) > width) {
        lines.push(line.trimEnd()); line = unit.trimStart();
      } else line += unit;
    }
    if (line.trim()) lines.push(line.trimEnd());
    return lines.length ? lines : [value];
  }

  highlighted(parent: FrameNode, name: string, value: string, target: string | undefined, lines: string[] | undefined,
    x: number, y: number, width: number, style: TextStyle, padding: { top: number; bottom: number }): FrameNode {
    const group = this.api.createFrame();
    parent.appendChild(group);
    group.name = name; group.x = x; group.y = y; group.fills = []; group.clipsContent = false;
    const initialLines = lines ?? this.wrap(value, target, width, style);
    let bottom = 0;
    initialLines.forEach((line, index) => {
      const text = this.text(group, `Line ${String(index + 1).padStart(2, '0')}`, line, 0, bottom, style);
      const at = target ? line.indexOf(target) : -1;
      if (at >= 0 && target) {
        text.name += ' — Highlight Text';
        const prefix = line.slice(0, at);
        const left = this.measure(prefix, style);
        const right = this.measure(prefix + target, style);
        // Cap background-only visual padding at 5/7px, and at the neighboring
        // space's half advance; touching glyphs get no extra horizontal padding.
        const side = (char: string | undefined, cap: number) => char === undefined ? cap : /\s/.test(char)
          ? Math.max(0, Math.min(cap, this.measure(char, style) / 2 - t.highlight.horizontal.inkGap)) : 0;
        const padLeft = side(at ? line[at - 1] : undefined, t.highlight.horizontal.left);
        const padRight = side(line[at + target.length], t.highlight.horizontal.right);
        // Plugin API exposes text advance, not browser glyph ink bounds. Keep this
        // approximation explicit and editable; never outline/flatten the TextNode.
        const background = rectangle(this.api, group, `Highlight Background ${String(index + 1).padStart(2, '0')}`,
          left - padLeft, bottom + (style.line - style.size) / 2 - padding.top,
          right - left + padLeft + padRight, style.size + padding.top + padding.bottom, this.accent);
        group.insertChild(group.children.indexOf(text), background);
        text.setRangeFills(at, at + target.length, [solid('#ffffff')]);
        background.setPluginData('visualPadding', JSON.stringify({ left: padLeft, right: padRight, ...padding }));
      }
      if (text.width > width + 0.5) this.warnings.push(`${parent.name} / ${name} ${index + 1}행: 너비 ${Math.ceil(text.width)}px > ${width}px. 글자 크기를 유지했습니다. 줄바꿈/원고를 검토해 주세요.`);
      bottom += text.height;
    });
    group.resize(width, Math.max(1, bottom));
    return group;
  }
}
