import { contextBridge, ipcRenderer } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

const imageMimeTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.heic': 'image/heic'
};

async function loadImageDataUrl(filePath: string) {
  try {
    const buffer = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const mimeType = imageMimeTypes[extension] ?? 'application/octet-stream';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

contextBridge.exposeInMainWorld('lightfolio', {
  pickFiles: () => ipcRenderer.invoke('library:pick-files'),
  pickDirectory: () => ipcRenderer.invoke('library:pick-directory'),
  deleteFile: (filePath: string) => ipcRenderer.invoke('library:delete-file', filePath),
  toFileUrl: (filePath: string) => `lightfolio-media://asset?path=${encodeURIComponent(filePath)}`,
  loadImageDataUrl
});
