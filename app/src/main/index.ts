import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron';
import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createImportSummary } from '@lightfolio/core';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lightfolio-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

const supportedExtensions = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.heic', '.bmp',
  '.mp4', '.mov', '.m4v', '.avi', '.webm'
]);

async function scanDirectoryForMedia(rootDirectory: string) {
  const pendingDirectories = [rootDirectory];
  const discoveredPaths: string[] = [];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();

    if (!currentDirectory) {
      continue;
    }

    let entries: Dirent[];

    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        pendingDirectories.push(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();

      if (supportedExtensions.has(extension)) {
        discoveredPaths.push(absolutePath);
      }
    }
  }

  return discoveredPaths;
}

async function dedupeImportPaths(paths: string[]) {
  const fingerprints = new Set<string>();
  const uniquePaths: string[] = [];

  for (const filePath of paths) {
    try {
      const [resolvedPath, stats] = await Promise.all([
        fs.realpath(filePath),
        fs.stat(filePath)
      ]);

      const fingerprint = `${resolvedPath.toLowerCase()}|${stats.size}|${Math.trunc(stats.mtimeMs)}`;

      if (fingerprints.has(fingerprint)) {
        continue;
      }

      fingerprints.add(fingerprint);
      uniquePaths.push(resolvedPath);
    } catch {
      const fallbackFingerprint = path.normalize(filePath).toLowerCase();

      if (fingerprints.has(fallbackFingerprint)) {
        continue;
      }

      fingerprints.add(fallbackFingerprint);
      uniquePaths.push(filePath);
    }
  }

  return uniquePaths;
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1460,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#f4ede3',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  protocol.handle('lightfolio-media', (request) => {
    const requestUrl = new URL(request.url);
    const filePath = requestUrl.searchParams.get('path');

    if (!filePath) {
      return new Response('Missing file path.', { status: 400 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });

  ipcMain.handle('library:pick-files', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Images and Videos',
          extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'bmp', 'mp4', 'mov', 'm4v', 'avi', 'webm']
        }
      ]
    });

    if (result.canceled) {
      return null;
    }

    const dedupedPaths = await dedupeImportPaths(result.filePaths);
    return createImportSummary(dedupedPaths, 'files');
  });

  ipcMain.handle('library:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const directory = result.filePaths[0];
    const scannedPaths = await scanDirectoryForMedia(directory);
    const dedupedPaths = await dedupeImportPaths(scannedPaths);
    return createImportSummary(dedupedPaths, 'directory');
  });

  ipcMain.handle('library:delete-file', async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    try {
      await fs.access(filePath);
      await shell.trashItem(filePath);
      return true;
    } catch {
      return false;
    }
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
