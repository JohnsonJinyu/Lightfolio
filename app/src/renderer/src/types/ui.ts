export type DetailSectionKey = 'description' | 'tags' | 'fileInfo';
export type ViewMode = 'single' | 'waterfall';
export type NavDirection = 'forward' | 'backward' | 'none';
export type MediaFilter = 'all' | 'image' | 'video';

export interface BrowserFilters {
  searchQuery: string;
  mediaFilter: MediaFilter;
  activeTag: string | null;
  activeCamera: string | null;
  activeLens: string | null;
  favoriteOnly: boolean;
  featuredOnly: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  assetId: string;
}

export interface WarmupProgress {
  done: number;
  total: number;
  running: boolean;
}

export interface ToastState {
  message: string;
  actionLabel?: string;
  action?: () => void;
  tone?: 'info' | 'danger';
}

export interface WaterfallLayoutMetrics {
  columns: number;
  columnWidth: number;
  rowHeight: number;
  totalRows: number;
  startIndex: number;
  endIndex: number;
  totalHeight: number;
}