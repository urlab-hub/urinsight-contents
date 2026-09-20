import { importPackage } from './importer.js';
import type { UIMessage } from './types.js';

figma.showUI(__html__, { width: 440, height: 720, themeColors: true });
let busy = false;
figma.ui.onmessage = async (message: UIMessage) => {
  if (message?.type !== 'import') return;
  if (busy) { figma.ui.postMessage({ type: 'error', message: 'Import 진행 중입니다. 완료 후 다시 시도해 주세요.' }); return; }
  busy = true;
  try {
    const result = await importPackage(figma, message.payload);
    figma.ui.postMessage({ type: 'success', result });
    figma.notify(`${result.pages}개의 editable frame 생성 완료${result.warnings.length ? ' — UI 경고를 확인해 주세요.' : ''}`);
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  } finally { busy = false; }
};
