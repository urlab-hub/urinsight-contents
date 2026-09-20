export type Fonts = { regular: FontName; bold: FontName };
export async function loadFonts(api: PluginAPI): Promise<Fonts> {
  const available = await api.listAvailableFontsAsync();
  const find = (style: string): FontName => {
    const match = available.find(f => f.fontName.family === 'Pretendard' && f.fontName.style.toLowerCase() === style.toLowerCase());
    if (!match) throw new Error(`Pretendard ${style} unavailable — Pretendard를 로컬에 설치한 뒤 Figma Desktop을 다시 실행해 주세요. 다른 폰트로 대체하지 않습니다.`);
    return match.fontName;
  };
  const regular = find('Regular'), bold = find('Bold');
  for (const font of [regular, bold]) {
    try { await api.loadFontAsync(font); }
    catch { throw new Error(`Pretendard ${font.style} load failed — Figma의 로컬 폰트 접근 상태를 확인해 주세요.`); }
  }
  return { regular, bold };
}
