import { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, shell } from 'electron';
import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { nativeImage } from 'electron';

import { createCuratedStory, createImportSummary, createStorageAdapter, groupAssetsByMonth, readExifSnapshot } from '@lightfolio/core';
import type { AssetRecord, LibrarySnapshot } from '@lightfolio/shared';

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

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.bmp']);
const thumbnailMemoryCache = new Map<string, Buffer>();
const thumbnailCacheDir = path.join(app.getPath('userData'), 'thumb-cache');
const maxThumbnailMemoryItems = 256;
const THUMBNAIL_CACHE_VERSION = '2';

function imageSizeForPath(filePath: string) {
  try {
    const image = nativeImage.createFromPath(filePath);

    if (image.isEmpty()) {
      return null;
    }

    const size = image.getSize();
    if (!size.width || !size.height) {
      return null;
    }

    return size;
  } catch {
    return null;
  }
}

function toInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function rememberThumbnail(key: string, data: Buffer) {
  thumbnailMemoryCache.set(key, data);

  if (thumbnailMemoryCache.size <= maxThumbnailMemoryItems) {
    return;
  }

  const first = thumbnailMemoryCache.keys().next().value;
  if (first) {
    thumbnailMemoryCache.delete(first);
  }
}

async function loadThumbnailBuffer(filePath: string, width: number, height: number) {
  const extension = path.extname(filePath).toLowerCase();

  if (!imageExtensions.has(extension)) {
    return null;
  }

  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch {
    return null;
  }

  const keySource = `${THUMBNAIL_CACHE_VERSION}|${filePath}|${stats.size}|${Math.trunc(stats.mtimeMs)}|${width}|${height}`;
  const key = crypto.createHash('sha1').update(keySource).digest('hex');
  const inMemory = thumbnailMemoryCache.get(key);

  if (inMemory) {
    return inMemory;
  }

  try {
    await fs.mkdir(thumbnailCacheDir, { recursive: true });
    const thumbnailPath = path.join(thumbnailCacheDir, `${key}.png`);

    try {
      const diskBuffer = await fs.readFile(thumbnailPath);
      rememberThumbnail(key, diskBuffer);
      return diskBuffer;
    } catch {
      // continue building thumbnail
    }

    const image = nativeImage.createFromPath(filePath);
    const originalSize = image.getSize();

    if (image.isEmpty() || !originalSize.width || !originalSize.height) {
      return null;
    }

    const scale = Math.min(width / originalSize.width, height / originalSize.height);
    const targetWidth = Math.max(1, Math.round(originalSize.width * scale));
    const targetHeight = Math.max(1, Math.round(originalSize.height * scale));

    const buffer = image
      .resize({ width: targetWidth, height: targetHeight, quality: 'good' })
      .toPNG();

    await fs.writeFile(thumbnailPath, buffer);
    rememberThumbnail(key, buffer);
    return buffer;
  } catch {
    return null;
  }
}

function enrichImportSummaryWithDimensions<T extends { assets: Array<{ kind: string; filePath: string; pixelWidth?: number; pixelHeight?: number }> }>(summary: T) {
  for (const asset of summary.assets) {
    if (asset.kind !== 'image') {
      continue;
    }

    if (asset.pixelWidth && asset.pixelHeight) {
      continue;
    }

    const size = imageSizeForPath(asset.filePath);

    if (!size) {
      continue;
    }

    asset.pixelWidth = size.width;
    asset.pixelHeight = size.height;
  }

  return summary;
}

async function isLikelyFallbackCapturedAt(asset: AssetRecord) {
  if (asset.capturedAt === asset.importedAt) {
    return true;
  }

  try {
    const stats = await fs.stat(asset.filePath);

    if (Number.isNaN(stats.mtimeMs)) {
      return false;
    }

    return new Date(stats.mtimeMs).toISOString() === asset.capturedAt;
  } catch {
    return false;
  }
}

async function hydrateLibrarySnapshot(snapshot: LibrarySnapshot) {
  const importState = snapshot.importState;

  if (!importState?.assets.length) {
    return snapshot;
  }

  let changed = false;

  const assets = await Promise.all(importState.assets.map(async (asset) => {
    if (asset.kind !== 'image') {
      return asset;
    }

    const exif = await readExifSnapshot(asset.filePath);

    const size = (!exif.pixelWidth || !exif.pixelHeight)
      ? imageSizeForPath(asset.filePath)
      : null;

    const nextPixelWidth = exif.pixelWidth ?? asset.pixelWidth ?? size?.width;
    const nextPixelHeight = exif.pixelHeight ?? asset.pixelHeight ?? size?.height;

    const needsMetadata = !asset.cameraModel
      || !asset.lensModel
      || !asset.aperture
      || !asset.shutterSpeed
      || !asset.iso
      || nextPixelWidth !== asset.pixelWidth
      || nextPixelHeight !== asset.pixelHeight
      || await isLikelyFallbackCapturedAt(asset);

    if (!needsMetadata) {
      return asset;
    }

    const nextCapturedAt = exif.capturedAt ?? asset.capturedAt;
    const nextCameraModel = exif.cameraModel ?? asset.cameraModel;
    const nextLensModel = exif.lensModel ?? asset.lensModel;
    const nextAperture = exif.aperture ?? asset.aperture;
    const nextShutterSpeed = exif.shutterSpeed ?? asset.shutterSpeed;
    const nextIso = exif.iso ?? asset.iso;

    if (
      nextPixelWidth === asset.pixelWidth
      && nextPixelHeight === asset.pixelHeight
      && nextCapturedAt === asset.capturedAt
      && nextCameraModel === asset.cameraModel
      && nextLensModel === asset.lensModel
      && nextAperture === asset.aperture
      && nextShutterSpeed === asset.shutterSpeed
      && nextIso === asset.iso
    ) {
      return asset;
    }

    changed = true;

    return {
      ...asset,
      pixelWidth: nextPixelWidth,
      pixelHeight: nextPixelHeight,
      capturedAt: nextCapturedAt,
      cameraModel: nextCameraModel,
      lensModel: nextLensModel,
      aperture: nextAperture,
      shutterSpeed: nextShutterSpeed,
      iso: nextIso
    };
  }));

  if (!changed) {
    return snapshot;
  }

  const sortedAssets = assets.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));

  return {
    ...snapshot,
    importState: {
      ...importState,
      assets: sortedAssets,
      timeline: groupAssetsByMonth(sortedAssets),
      story: createCuratedStory(sortedAssets)
    },
    updatedAt: new Date().toISOString()
  };
}

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
    backgroundColor: '#121a25',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#eef4ff',
      height: 52
    },
    backgroundMaterial: process.platform === 'win32' ? 'acrylic' : 'auto',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.setMenuBarVisibility(false);

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  const libraryStorage = createStorageAdapter({
    filePath: path.join(app.getPath('userData'), 'library-state.json')
  });

  Menu.setApplicationMenu(null);

  void libraryStorage.initialize();

  protocol.handle('lightfolio-media', (request) => {
    const requestUrl = new URL(request.url);
    const filePath = requestUrl.searchParams.get('path');
    const thumb = requestUrl.searchParams.get('thumb') === '1';
    const thumbWidth = toInt(requestUrl.searchParams.get('w'), 480);
    const thumbHeight = toInt(requestUrl.searchParams.get('h'), 480);

    if (!filePath) {
      return new Response('Missing file path.', { status: 400 });
    }

    if (thumb) {
      return loadThumbnailBuffer(filePath, thumbWidth, thumbHeight)
        .then((buffer) => {
          if (!buffer) {
            return new Response('Unable to generate thumbnail.', { status: 404 });
          }

          return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
              'content-type': 'image/png',
              'cache-control': 'no-store'
            }
          });
        });
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
    const summary = await createImportSummary(dedupedPaths, 'files');
    return enrichImportSummaryWithDimensions(summary);
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
    const summary = await createImportSummary(dedupedPaths, 'directory');
    return enrichImportSummaryWithDimensions(summary);
  });

  ipcMain.handle('library:load', async () => {
    const snapshot = await libraryStorage.load();
    const hydratedSnapshot = await hydrateLibrarySnapshot(snapshot);

    if (hydratedSnapshot !== snapshot) {
      await libraryStorage.save(hydratedSnapshot);
    }

    return hydratedSnapshot;
  });

  ipcMain.handle('library:save', async (_event, snapshot: LibrarySnapshot) => {
    await libraryStorage.save(snapshot);
    return true;
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

  ipcMain.handle('library:reveal-file', async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    try {
      await fs.access(filePath);
      shell.showItemInFolder(filePath);
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
