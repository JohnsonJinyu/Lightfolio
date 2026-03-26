export type AssetKind = 'image' | 'video';

export type ImportSourceKind = 'directory' | 'files';

export interface AssetTag {
  id: string;
  label: string;
}

export interface AssetCaption {
  title: string;
  body: string;
}

export interface AssetLocation {
  label?: string;
  latitude?: number;
  longitude?: number;
}

export interface AssetRecord {
  id: string;
  kind: AssetKind;
  source: ImportSourceKind;
  filePath: string;
  fileName: string;
  pixelWidth?: number;
  pixelHeight?: number;
  capturedAt: string;
  importedAt: string;
  cameraModel?: string;
  lensModel?: string;
  location?: AssetLocation;
  tags: AssetTag[];
  caption?: AssetCaption;
  isFeatured: boolean;
}

export interface TimelineGroup {
  id: string;
  label: string;
  coverTitle: string;
  assets: AssetRecord[];
}

export interface CuratedStoryBlock {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
}

export interface CuratedStory {
  id: string;
  title: string;
  summary: string;
  blocks: CuratedStoryBlock[];
}

export interface ImportSummary {
  source: ImportSourceKind;
  pickedPaths: string[];
  assets: AssetRecord[];
  timeline: TimelineGroup[];
  story: CuratedStory;
}

export interface LibraryViewState {
  selectedAssetId: string | null;
  activeFolder: string;
  viewMode: 'single' | 'waterfall';
  searchText: string;
  showFeaturedOnly: boolean;
  isSidebarCollapsed: boolean;
  isFolderListCollapsed: boolean;
  isDetailPanelCollapsed: boolean;
  isFilmstripCollapsed: boolean;
}

export interface LibrarySnapshot {
  version: number;
  importState: ImportSummary | null;
  hiddenAssetIds: string[];
  removedFromAlbumIds: string[];
  uiState?: LibraryViewState;
  updatedAt: string;
}
