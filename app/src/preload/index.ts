import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('lightfolio', {
  pickFiles: () => ipcRenderer.invoke('library:pick-files'),
  pickDirectory: () => ipcRenderer.invoke('library:pick-directory'),
  deleteFile: (filePath: string) => ipcRenderer.invoke('library:delete-file', filePath),
  toFileUrl: (filePath: string) => `lightfolio-media://asset?path=${encodeURIComponent(filePath)}`,
  toThumbUrl: (filePath: string, width: number, height: number) =>
    `lightfolio-media://asset?path=${encodeURIComponent(filePath)}&thumb=1&w=${width}&h=${height}`
});
