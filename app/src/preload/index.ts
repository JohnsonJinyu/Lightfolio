import { contextBridge, ipcRenderer } from 'electron';

import type { LibrarySnapshot } from '@lightfolio/shared';

const THUMBNAIL_URL_VERSION = '2';

contextBridge.exposeInMainWorld('lightfolio', {
  loadLibrary: () => ipcRenderer.invoke('library:load') as Promise<LibrarySnapshot>,
  saveLibrary: (snapshot: LibrarySnapshot) => ipcRenderer.invoke('library:save', snapshot) as Promise<boolean>,
  pickFiles: () => ipcRenderer.invoke('library:pick-files'),
  pickDirectory: () => ipcRenderer.invoke('library:pick-directory'),
  deleteFile: (filePath: string) => ipcRenderer.invoke('library:delete-file', filePath),
  revealFile: (filePath: string) => ipcRenderer.invoke('library:reveal-file', filePath) as Promise<boolean>,
  toFileUrl: (filePath: string) => `lightfolio-media://asset?path=${encodeURIComponent(filePath)}`,
  toThumbUrl: (filePath: string, width: number, height: number) =>
    `lightfolio-media://asset?path=${encodeURIComponent(filePath)}&thumb=1&w=${width}&h=${height}&v=${THUMBNAIL_URL_VERSION}`
});
