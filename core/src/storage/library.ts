import fs from 'node:fs/promises';
import path from 'node:path';

import type { LibrarySnapshot, LibraryViewState } from '@lightfolio/shared';

const librarySnapshotVersion = 1;

function createDefaultViewState(): LibraryViewState {
  return {
    selectedAssetId: null,
    activeFolder: 'all',
    viewMode: 'single',
    searchText: '',
    showFeaturedOnly: false,
    isSidebarCollapsed: false,
    isFolderListCollapsed: false,
    isDetailPanelCollapsed: false,
    isFilmstripCollapsed: false
  };
}

export interface LibraryStorageAdapter {
  initialize(): Promise<void>;
  load(): Promise<LibrarySnapshot>;
  save(snapshot: LibrarySnapshot): Promise<void>;
}

function createEmptyLibrarySnapshot(): LibrarySnapshot {
  return {
    version: librarySnapshotVersion,
    importState: null,
    hiddenAssetIds: [],
    removedFromAlbumIds: [],
    uiState: createDefaultViewState(),
    updatedAt: new Date(0).toISOString()
  };
}

function normalizeSnapshot(snapshot: Partial<LibrarySnapshot> | null | undefined): LibrarySnapshot {
  const rawUiState = snapshot?.uiState;

  return {
    version: librarySnapshotVersion,
    importState: snapshot?.importState ?? null,
    hiddenAssetIds: Array.isArray(snapshot?.hiddenAssetIds) ? snapshot.hiddenAssetIds : [],
    removedFromAlbumIds: Array.isArray(snapshot?.removedFromAlbumIds) ? snapshot.removedFromAlbumIds : [],
    uiState: {
      ...createDefaultViewState(),
      ...(rawUiState ?? {})
    },
    updatedAt: typeof snapshot?.updatedAt === 'string' ? snapshot.updatedAt : new Date().toISOString()
  };
}

export function createStorageAdapter(options: { filePath: string }): LibraryStorageAdapter {
  const { filePath } = options;

  return {
    async initialize() {
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      try {
        await fs.access(filePath);
      } catch {
        await this.save(createEmptyLibrarySnapshot());
      }
    },

    async load() {
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        return normalizeSnapshot(JSON.parse(raw) as Partial<LibrarySnapshot>);
      } catch {
        return createEmptyLibrarySnapshot();
      }
    },

    async save(snapshot: LibrarySnapshot) {
      const nextSnapshot = normalizeSnapshot({
        ...snapshot,
        updatedAt: new Date().toISOString()
      });
      const temporaryFilePath = `${filePath}.tmp`;

      await fs.writeFile(temporaryFilePath, JSON.stringify(nextSnapshot, null, 2), 'utf-8');
      await fs.rename(temporaryFilePath, filePath);
    }
  };
}
