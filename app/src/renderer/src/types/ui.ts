export type DetailSectionKey = 'description' | 'tags' | 'fileInfo';
export type ViewMode = 'single' | 'waterfall';
export type NavDirection = 'forward' | 'backward' | 'none';

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