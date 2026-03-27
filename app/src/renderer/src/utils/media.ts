import {
  CONTEXT_MENU_HEIGHT,
  CONTEXT_MENU_VIEWPORT_PADDING,
  CONTEXT_MENU_WIDTH
} from '../constants/layout';

const fileUrlCache = new Map<string, string | null>();

function isAbsoluteFilePath(filePath: string) {
  return /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\') || filePath.startsWith('/');
}

export function getFileUrlCached(filePath: string, mode: 'full' | 'thumb', size = 480) {
  if (!isAbsoluteFilePath(filePath)) {
    return null;
  }

  const key = `${mode}:${size}:${filePath}`;
  const cached = fileUrlCache.get(key);

  if (typeof cached !== 'undefined') {
    return cached;
  }

  const url = mode === 'thumb'
    ? window.lightfolio.toThumbUrl(filePath, size, size)
    : window.lightfolio.toFileUrl(filePath);

  fileUrlCache.set(key, url);
  return url;
}

export function clampContextMenuPosition(x: number, y: number) {
  const maxX = Math.max(CONTEXT_MENU_VIEWPORT_PADDING, window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_VIEWPORT_PADDING);
  const maxY = Math.max(CONTEXT_MENU_VIEWPORT_PADDING, window.innerHeight - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_VIEWPORT_PADDING);

  return {
    x: Math.min(Math.max(CONTEXT_MENU_VIEWPORT_PADDING, x), maxX),
    y: Math.min(Math.max(CONTEXT_MENU_VIEWPORT_PADDING, y), maxY)
  };
}

export function preloadImage(filePath: string, mode: 'full' | 'thumb', size = 480) {
  const url = getFileUrlCached(filePath, mode, size);

  if (!url) {
    return;
  }

  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}

export function preloadImageTask(filePath: string, mode: 'full' | 'thumb', size = 480) {
  const url = getFileUrlCached(filePath, mode, size);

  if (!url) {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}