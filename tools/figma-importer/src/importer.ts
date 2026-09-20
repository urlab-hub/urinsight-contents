import { parseContent, validatePng } from './package.js';
import { loadFonts } from './fonts.js';
import { t, coverOverlay, frameGap, sectionPadding } from './tokens.js';
import { TextBuilder, rectangle } from './text.js';
import type { TextStyle } from './text.js';
import type { CarouselContent, PackagePayload, ImportResult } from './types.js';

export async function importPackage(api: PluginAPI, payload: PackagePayload): Promise<ImportResult> {
  const content = parseContent(payload.content);
  validatePng(payload.cover, 'cover.png'); validatePng(payload.insight, 'insight.png');
  const fonts = await loadFonts(api);
  const image = async (bytes: Uint8Array, name: string) => {
    try {
      const result = api.createImage(bytes);
      await result.getSizeAsync(); // Decode before adding any canvas nodes.
      return result.hash;
    } catch { throw new Error(`${name}: Figma에서 이미지를 읽지 못했습니다. 정상 PNG인지 확인해 주세요.`); }
  };
  const coverHash = await image(payload.cover, 'cover.png');
  const insightHash = await image(payload.insight, 'insight.png');
  const page = api.currentPage; // Bind after async font/image work to the current page.
  const base = `URINSIGHT — ${content.slug}`;
  const names = new Set(page.children.map(n => n.name));
  let name = base, suffix = 2;
  while (names.has(name)) name = `${base} (${suffix++})`;
  const previous = [...page.children];
  const section = api.createSection();
  let text: TextBuilder | undefined;
  const warnings: string[] = [];
  try {
    section.name = name;
    section.x = Math.round(api.viewport.center.x);
    section.y = Math.round(Math.max(api.viewport.center.y, ...previous.map(n => n.y + n.height + 160)));
    section.resizeWithoutConstraints(sectionPadding * 2 + (content.body.length + 3) * t.canvas.width + (content.body.length + 2) * frameGap,
      sectionPadding * 2 + t.canvas.height);
    section.setPluginData('urinsight', JSON.stringify({ version: 1, slug: content.slug, spec: '1.10', direction: 'JSON → Figma' }));
    const accent = t.categories[content.category].color;
    text = new TextBuilder(api, section, fonts, accent, warnings);
    const builder = text;
    const frames: FrameNode[] = [];
    const frame = (label: string): FrameNode => {
      const node = api.createFrame(); section.appendChild(node);
      node.name = `${String(frames.length + 1).padStart(2, '0')} ${label}`;
      node.resize(t.canvas.width, t.canvas.height);
      node.x = sectionPadding + frames.length * (t.canvas.width + frameGap); node.y = sectionPadding;
      node.fills = []; node.clipsContent = true;
      node.exportSettings = [{ format: 'PNG', constraint: { type: 'SCALE', value: 1 }, suffix: '' }];
      frames.push(node);
      return node;
    };
    const photo = (parent: FrameNode, hash: string, opacity: number) => {
      const node = rectangle(api, parent, 'Background Image', 0, 0, t.canvas.width, t.canvas.height, '#ffffff');
      node.fills = [{ type: 'IMAGE', imageHash: hash, scaleMode: 'FILL' }];
      const overlay = rectangle(api, parent, 'Black Overlay', 0, 0, t.canvas.width, t.canvas.height, '#000000');
      overlay.opacity = opacity;
    };
    const regular = (size: number, color: string = t.colors.ink): TextStyle => ({ size, line: size * 1.2, color });
    const cover = frame('COVER');
    photo(cover, coverHash, coverOverlay.opacity);
    builder.text(cover, 'Brand', t.brand, t.layout.left, t.cover.brandTop, regular(t.cover.brandSize, '#ffffff'));
    builder.highlighted(cover, 'Title', content.cover.titleLines.join(' '), content.cover.highlight, content.cover.titleLines,
      t.layout.left, t.cover.titleTop, t.cover.titleWidth, { size: t.cover.titleSize, line: t.cover.titleLine, bold: true, color: '#ffffff' }, t.highlight.cover);
    builder.text(cover, 'Category', `#${t.categories[content.category].label}`, t.layout.left, t.cover.categoryTop,
      { ...regular(t.cover.categorySize, accent), bold: true, spacing: t.cover.categoryLetterSpacing });
    builder.text(cover, 'Footer', t.footer, t.layout.left, t.cover.footerTop, regular(t.cover.footerSize, '#ffffff'));

    const paragraphs = (parent: FrameNode, p: Pick<CarouselContent['summary'], 'paragraphs' | 'paragraphLines'>, y: number): number => {
      p.paragraphs.forEach((value, i) => {
        const style = { size: t.body.textSize, line: t.body.textLine, color: t.colors.body };
        // Keep semantic paragraphs as a single editable node. Authored line breaks
        // are preserved; otherwise Figma performs native width-constrained wrapping.
        const node = builder.text(parent, `Paragraph ${String(i + 1).padStart(2, '0')}`,
          p.paragraphLines?.[i]?.join('\n') ?? value, t.layout.left, y, style, t.layout.width);
        y += node.height + t.body.paragraphGap;
      });
      return y - t.body.paragraphGap;
    };
    const fit = (parent: FrameNode, bodyBottom: number, key: SceneNode, maxGap: number) => {
      if (bodyBottom + maxGap > key.y + 0.5) warnings.push(`${parent.name}: 본문과 강조문장 사이가 ${maxGap}px 미만입니다. Paragraph 원고/줄바꿈을 검토해 주세요.`);
      if (key.height > t.body.keyLine * t.content.maxKeyLines + 0.5) warnings.push(`${parent.name}: 강조문장이 2줄을 초과합니다. 원고/줄바꿈을 검토해 주세요.`);
    };
    content.body.forEach((p, i) => {
      const node = frame(`BODY ${String(i + 1).padStart(2, '0')}`);
      rectangle(api, node, 'Background', 0, 0, t.canvas.width, t.canvas.height, t.colors.paper);
      const brand = builder.text(node, 'Brand', t.brand, 0, t.body.brandTop, regular(t.body.brandSize, accent));
      brand.x = t.canvas.width - t.layout.right - brand.width;
      builder.text(node, 'Number', `${p.number}.`, t.layout.left, t.body.titleTop, { size: t.body.titleSize, line: t.body.titleLine, bold: true });
      builder.highlighted(node, 'Subtitle', p.title, p.highlight, [p.title], t.layout.left + t.body.numberWidth, t.body.titleTop,
        t.layout.width - t.body.numberWidth, { size: t.body.titleSize, line: t.body.titleLine, bold: true, spacing: t.body.titleLetterSpacing }, t.highlight.body);
      const bodyBottom = paragraphs(node, p, t.body.textTop);
      const key = builder.text(node, 'Key Sentence', p.keySentenceLines?.join('\n') ?? p.keySentence, t.layout.left, 0,
        { size: t.body.keySize, line: t.body.keyLine, bold: true, color: accent }, t.layout.width);
      key.y = t.content.emphasisBottomY - key.height;
      fit(node, bodyBottom, key, t.body.keyGap);
    });
    const summary = frame('SUMMARY'), p = content.summary;
    rectangle(api, summary, 'Background', 0, 0, t.canvas.width, t.canvas.height, t.colors.paper);
    builder.text(summary, 'Label', p.label, t.layout.left, t.insight.labelTop,
      { ...regular(t.summary.labelSize, accent), bold: true, spacing: t.summary.labelLetterSpacing });
    const headline = builder.highlighted(summary, 'Headline', p.headline, p.highlight, p.headlineLines, t.layout.left, t.summary.titleTop,
      t.layout.width, { size: t.summary.titleSize, line: t.summary.titleLine, bold: true }, t.highlight.summary);
    const bodyBottom = paragraphs(summary, p, headline.y + headline.height + t.content.titleToBodyGap);
    const key = builder.highlighted(summary, 'Key Sentence', p.keySentence, p.keySentenceHighlight ?? p.keySentence, undefined, t.layout.left, 0,
      t.layout.width, { size: t.summary.keySize, line: t.body.keyLine, bold: true }, t.highlight.summaryKey);
    key.y = t.content.emphasisBottomY - key.height;
    fit(summary, bodyBottom, key, t.summary.keyGap);
    if (headline.height > t.summary.titleLine * 3 + 0.5) warnings.push(`${summary.name}: headline이 3줄을 초과합니다. 원고/줄바꿈을 검토해 주세요.`);

    const insight = frame('INSIGHT');
    photo(insight, insightHash, t.insightImage.overlayOpacity);
    builder.text(insight, 'Brand', t.brand, t.layout.left, t.insight.labelTop, regular(t.insight.labelSize, accent));
    const insightTitle = builder.highlighted(insight, 'Headline', content.insight.headline, content.insight.highlight, content.insight.headlineLines,
      t.layout.left, t.insight.titleTop, t.layout.width, { size: t.insight.titleSize, line: t.insight.titleLine, bold: true, color: '#ffffff' }, t.highlight.insight);
    if (insightTitle.y + insightTitle.height > t.insight.footerTop) warnings.push(`${insight.name}: headline이 footer 영역과 겹칩니다. 줄바꿈/원고를 검토해 주세요.`);
    const slogan = builder.text(insight, 'Slogan', t.slogan, t.layout.left, t.insight.footerTop, { ...regular(t.insight.sloganSize, t.colors.muted), bold: true });
    builder.text(insight, 'Footer Brand', t.brand, t.layout.left, slogan.y + slogan.height + t.insight.brandGap, regular(t.insight.brandSize, '#ffffff'));
    if (content.cover.image) warnings.push('cover.image 경로는 읽지 않습니다. 선택한 cover.png를 사용했습니다.');
    builder.dispose(); text = undefined;
    page.selection = [section];
    api.viewport.scrollAndZoomIntoView([section]);
    return { name, pages: frames.length, fonts: [fonts.regular, fonts.bold].map(f => `${f.family} ${f.style}`), warnings };
  } catch (error) {
    // Roll back this attempt only. Prior imports and manual edits are never removed.
    text?.dispose(); section.remove();
    throw error;
  }
}
