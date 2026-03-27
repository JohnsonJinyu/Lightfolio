import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AssetRecord, ImportSummary, LibrarySnapshot, TimelineGroup } from '@lightfolio/shared';

const bootTimeline: TimelineGroup[] = [
  {
    id: '2026-03',
    label: '2026 / 03',
    coverTitle: '夜色与余温',
    assets: [
      {
        id: 'boot-01',
        kind: 'image',
        source: 'files',
        filePath: 'samples/night-street.jpg',
        fileName: 'night-street.jpg',
        capturedAt: '2026-03-11T18:30:00.000Z',
        importedAt: '2026-03-25T11:30:00.000Z',
        cameraModel: 'Sony A7C II',
        lensModel: '35mm F1.8',
        location: { label: '待手动标记地点' },
        tags: [
          { id: 'tag-01', label: '精选' },
          { id: 'tag-02', label: '街头' }
        ],
        caption: {
          title: '夜色与余温',
          body: '用时间轴快速回看一整个拍摄阶段，也为精选作品保留更舒展的叙述空间。'
        },
        isFeatured: true
      },
      {
        id: 'boot-02',
        kind: 'video',
        source: 'files',
        filePath: 'samples/travel-notes.mov',
        fileName: 'travel-notes.mov',
        capturedAt: '2026-03-06T08:00:00.000Z',
        importedAt: '2026-03-25T11:30:00.000Z',
        tags: [{ id: 'tag-03', label: '旅途' }],
        location: { label: '待手动标记地点' },
        caption: {
          title: '旅途片段',
          body: '视频资源在同一条时间线上展示，后续也可继续扩展封面帧与片段预览。'
        },
        isFeatured: false
      }
    ]
  }
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function latestAsset(groups: TimelineGroup[]): AssetRecord | null {
  return groups.flatMap((group) => group.assets)[0] ?? null;
}

function mergeImportSummaries(current: ImportSummary | null, incoming: ImportSummary) {
  if (!current) {
    return incoming;
  }

  const assetMap = new Map<string, AssetRecord>();

  for (const asset of current.assets) {
    assetMap.set(asset.id, asset);
  }

  for (const asset of incoming.assets) {
    assetMap.set(asset.id, asset);
  }

  const assets = Array.from(assetMap.values()).sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));
  const grouped = new Map<string, AssetRecord[]>();

  for (const asset of assets) {
    const key = asset.capturedAt.slice(0, 7);
    const collection = grouped.get(key) ?? [];
    collection.push(asset);
    grouped.set(key, collection);
  }

  const timeline = Array.from(grouped.entries())
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([key, groupAssets]) => ({
      id: key,
      label: key.replace('-', ' / '),
      coverTitle: (groupAssets[0]?.caption?.title ?? groupAssets[0]?.fileName ?? '未命名作品').replace(/\.[^.]+$/, ''),
      assets: groupAssets.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))
    }));

  const featured = assets.filter((asset) => asset.isFeatured).slice(0, 3);

  return {
    source: incoming.source,
    pickedPaths: Array.from(new Set([...current.pickedPaths, ...incoming.pickedPaths])),
    assets,
    timeline,
    story: {
      id: 'story-featured',
      title: '本期精选画册',
      summary: '把导入的作品重新编排为适合安静观看的一段视觉章节。',
      blocks: featured.map((asset, index) => ({
        id: asset.id,
        eyebrow: `章节 ${String(index + 1).padStart(2, '0')}`,
        title: asset.caption?.title ?? asset.fileName.replace(/\.[^.]+$/, ''),
        body: asset.caption?.body ?? '为图片、视频和文字保留共同出现的位置。'
      }))
    }
  } satisfies ImportSummary;
}

function filterTimeline(groups: TimelineGroup[], hiddenAssetIds: Set<string>): TimelineGroup[] {
  return groups
    .map((group) => ({
      ...group,
      assets: group.assets.filter((asset) => !hiddenAssetIds.has(asset.id))
    }))
    .filter((group) => group.assets.length > 0);
}

function collectAssetMap(groups: TimelineGroup[]) {
  const map = new Map<string, AssetRecord>();

  for (const group of groups) {
    for (const asset of group.assets) {
      map.set(asset.id, asset);
    }
  }

  return map;
}

function folderFromPath(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : '未分类目录';
}

function folderLabel(folder: string) {
  const normalized = folder.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? folder;
}

function tileVariant(assetId: string) {
  const seed = assetId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const bucket = seed % 5;

  if (bucket === 0) {
    return 'tile-wide';
  }

  if (bucket === 1) {
    return 'tile-tall';
  }

  return 'tile-normal';
}

function assetAspectRatio(asset: AssetRecord) {
  if (asset.pixelWidth && asset.pixelHeight) {
    return asset.pixelWidth / asset.pixelHeight;
  }

  return 1;
}

function filmstripThumbWidth(asset: AssetRecord) {
  return Math.max(88, Math.min(260, Math.round(filmstripThumbHeight * assetAspectRatio(asset))));
}

const fileUrlCache = new Map<string, string | null>();
const waterfallMinTileWidth = 208;
const waterfallGap = 10;
const filmstripThumbHeight = 92;
const chromeAnimationDurationMs = 320;
const contextMenuWidth = 248;
const contextMenuHeight = 168;
const contextMenuViewportPadding = 12;
type DetailSectionKey = 'description' | 'tags' | 'fileInfo';

function isAbsoluteFilePath(filePath: string) {
  return /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\') || filePath.startsWith('/');
}

function getFileUrlCached(filePath: string, mode: 'full' | 'thumb', size = 480) {
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

function clampContextMenuPosition(x: number, y: number) {
  const maxX = Math.max(contextMenuViewportPadding, window.innerWidth - contextMenuWidth - contextMenuViewportPadding);
  const maxY = Math.max(contextMenuViewportPadding, window.innerHeight - contextMenuHeight - contextMenuViewportPadding);

  return {
    x: Math.min(Math.max(contextMenuViewportPadding, x), maxX),
    y: Math.min(Math.max(contextMenuViewportPadding, y), maxY)
  };
}

function preloadImage(filePath: string, mode: 'full' | 'thumb', size = 480) {
  const url = getFileUrlCached(filePath, mode, size);

  if (!url) {
    return;
  }

  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}

function preloadImageTask(filePath: string, mode: 'full' | 'thumb', size = 480) {
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

function ImagePreview({
  asset,
  className,
  mode,
  size,
  shouldLoad,
  onError
}: {
  asset: AssetRecord;
  className: string;
  mode: 'full' | 'thumb';
  size?: number;
  shouldLoad: boolean;
  onError: () => void;
}) {
  const source = useMemo(() => {
    if (!shouldLoad) {
      return null;
    }

    return getFileUrlCached(asset.filePath, mode, size);
  }, [asset.filePath, mode, shouldLoad, size]);

  if (!source) {
    return null;
  }

  return (
    <img
      className={className}
      src={source}
      alt={asset.caption?.title ?? asset.fileName}
      loading="lazy"
      decoding="async"
      onError={onError}
    />
  );
}

function ProgressiveSingleImage({ asset, onError }: { asset: AssetRecord; onError: () => void }) {
  const fullSource = useMemo(() => getFileUrlCached(asset.filePath, 'full'), [asset.filePath]);
  const [displayedImage, setDisplayedImage] = useState<{ src: string; alt: string } | null>(null);
  const displayedImageRef = useRef<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    displayedImageRef.current = displayedImage;
  }, [displayedImage]);

  useEffect(() => {
    if (!fullSource) {
      setDisplayedImage(null);
      return;
    }

    let cancelled = false;
    let resolved = false;
    const image = new Image();
    image.decoding = 'async';
    image.src = fullSource;

    const markReady = () => {
      if (cancelled || resolved) {
        return;
      }

      resolved = true;

      const nextImage = {
        src: fullSource,
        alt: asset.caption?.title ?? asset.fileName
      };
      const currentImage = displayedImageRef.current;

      if (currentImage?.src === nextImage.src && currentImage.alt === nextImage.alt) {
        return;
      }

      setDisplayedImage(nextImage);
    };

    image.onload = markReady;
    image.onerror = () => {
      if (!cancelled) {
        onError();
      }
    };

    void image.decode().then(markReady).catch(() => {
      if (image.complete && image.naturalWidth > 0) {
        markReady();
        return;
      }

      if (!cancelled) {
        onError();
      }
    });

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [asset.caption?.title, asset.fileName, fullSource, onError]);

  return (
    <div className="progressive-stage">
      <div className="progressive-stage-ambient" aria-hidden="true" />
      {displayedImage ? (
        <img
          className="detail-media detail-media-full detail-media-layer-current"
          src={displayedImage.src}
          alt={displayedImage.alt}
          decoding="async"
          onError={onError}
        />
      ) : null}
    </div>
  );
}

export function App() {
  const [importState, setImportState] = useState<ImportSummary | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isLibraryReady, setIsLibraryReady] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [hiddenAssetIds, setHiddenAssetIds] = useState<Set<string>>(new Set());
  const [removedFromAlbumIds, setRemovedFromAlbumIds] = useState<string[]>([]);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [failedPreviewIds, setFailedPreviewIds] = useState<Set<string>>(new Set());
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'single' | 'waterfall'>('single');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; assetId: string } | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFolderListCollapsed, setIsFolderListCollapsed] = useState(false);
  const [isDetailPanelCollapsed, setIsDetailPanelCollapsed] = useState(false);
  const [isFilmstripCollapsed, setIsFilmstripCollapsed] = useState(false);
  const [collapsedDetailSections, setCollapsedDetailSections] = useState<Record<DetailSectionKey, boolean>>({
    description: false,
    tags: false,
    fileInfo: false
  });
  const [navDirection, setNavDirection] = useState<'forward' | 'backward' | 'none'>('none');
  const [warmupProgress, setWarmupProgress] = useState<{ done: number; total: number; running: boolean }>({ done: 0, total: 0, running: false });
  const [toast, setToast] = useState<{ message: string; actionLabel?: string; action?: () => void; tone?: 'info' | 'danger' } | null>(null);
  const [pendingDeleteAsset, setPendingDeleteAsset] = useState<AssetRecord | null>(null);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [isChromeAnimating, setIsChromeAnimating] = useState(false);
  const wheelLockUntilRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);
  const holdKeyRef = useRef<string | null>(null);
  const chromeAnimationTimerRef = useRef<number | null>(null);
  const filmstripTrackRef = useRef<HTMLDivElement | null>(null);
  const waterfallRef = useRef<HTMLDivElement | null>(null);
  const [waterfallMetrics, setWaterfallMetrics] = useState({ width: 0, height: 0, scrollTop: 0 });

  const sourceTimeline = importState?.timeline ?? (isLibraryReady ? [] : bootTimeline);
  const timeline = filterTimeline(sourceTimeline, hiddenAssetIds);
  const assetMap = collectAssetMap(sourceTimeline);
  const visibleAssets = useMemo(() => timeline.flatMap((group) => group.assets), [timeline]);
  const folderItems = useMemo(() => {
    const map = new Map<string, number>();

    for (const asset of visibleAssets) {
      const folder = folderFromPath(asset.filePath);
      map.set(folder, (map.get(folder) ?? 0) + 1);
    }

    return Array.from(map.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
  }, [visibleAssets]);
  const filteredAssets = useMemo(() => {
    let nextAssets = visibleAssets;

    if (activeFolder !== 'all') {
      nextAssets = nextAssets.filter((asset) => folderFromPath(asset.filePath) === activeFolder);
    }

    return nextAssets;
  }, [activeFolder, visibleAssets]);
  const selected = selectedAssetId
    ? filteredAssets.find((asset) => asset.id === selectedAssetId) ?? filteredAssets[0] ?? null
    : filteredAssets[0] ?? null;
  const selectedIndex = selected ? filteredAssets.findIndex((asset) => asset.id === selected.id) : -1;
  const removedAssets = removedFromAlbumIds
    .map((assetId) => assetMap.get(assetId))
    .filter((asset): asset is AssetRecord => Boolean(asset));
  const previewFailureCount = failedPreviewIds.size;
  const totalAssets = visibleAssets.length;

  useEffect(() => () => {
    if (chromeAnimationTimerRef.current) {
      window.clearTimeout(chromeAnimationTimerRef.current);
    }
  }, []);
  const activeSource = importState?.source === 'directory' ? '目录导入' : importState?.source === 'files' ? '文件导入' : '示例内容';
  const folderSequence = useMemo(() => ['all', ...folderItems.map((item) => item.path)], [folderItems]);
  const isViewerLoading = !isLibraryReady || (isBusy && !importState);
  const selectedFolderLabel = selected ? folderLabel(folderFromPath(selected.filePath)) : '未选择';
  const detailTags = selected?.tags ?? [];

  const waterfallLayout = useMemo(() => {
    const width = Math.max(0, waterfallMetrics.width);
    const columns = Math.max(1, Math.floor((width + waterfallGap) / (waterfallMinTileWidth + waterfallGap)));
    const columnWidth = Math.max(160, Math.floor((width - waterfallGap * (columns - 1)) / columns));
    const rowHeight = Math.max(220, Math.round(columnWidth * 0.72) + 56);
    const totalRows = Math.ceil(filteredAssets.length / columns);
    const startRow = Math.max(0, Math.floor(waterfallMetrics.scrollTop / rowHeight) - 2);
    const visibleRowCount = Math.ceil((waterfallMetrics.height || 700) / rowHeight) + 4;
    const endRow = Math.min(totalRows, startRow + visibleRowCount);
    const startIndex = startRow * columns;
    const endIndex = Math.min(filteredAssets.length, endRow * columns);

    return {
      columns,
      columnWidth,
      rowHeight,
      totalRows,
      startIndex,
      endIndex,
      totalHeight: totalRows * rowHeight
    };
  }, [filteredAssets.length, waterfallMetrics.height, waterfallMetrics.scrollTop, waterfallMetrics.width]);

  const waterfallVisible = useMemo(
    () => filteredAssets.slice(waterfallLayout.startIndex, waterfallLayout.endIndex),
    [filteredAssets, waterfallLayout.endIndex, waterfallLayout.startIndex]
  );
  const selectByIndex = useCallback((nextIndex: number) => {
    if (filteredAssets.length === 0) {
      return;
    }

    const bounded = Math.max(0, Math.min(filteredAssets.length - 1, nextIndex));
    const currentIndex = selectedIndex < 0 ? bounded : selectedIndex;
    const nextDirection = bounded > currentIndex ? 'forward' : bounded < currentIndex ? 'backward' : 'none';

    setNavDirection(nextDirection);
    setSelectedAssetId(filteredAssets[bounded]?.id ?? null);
  }, [filteredAssets, selectedIndex]);

  const selectOffset = useCallback((offset: number) => {
    if (filteredAssets.length === 0) {
      return;
    }

    const currentIndex = selectedIndex < 0 ? 0 : selectedIndex;
    selectByIndex(currentIndex + offset);
  }, [filteredAssets.length, selectByIndex, selectedIndex]);

  const selectById = useCallback((assetId: string) => {
    const nextIndex = filteredAssets.findIndex((asset) => asset.id === assetId);

    if (nextIndex < 0) {
      return;
    }

    selectByIndex(nextIndex);
  }, [filteredAssets, selectByIndex]);

  const preloadAroundSelection = useCallback((anchorIndex: number) => {
    const candidates = [anchorIndex - 1, anchorIndex + 1]
      .map((index) => filteredAssets[index])
      .filter((asset): asset is AssetRecord => Boolean(asset));

    for (const asset of candidates) {
      if (asset.kind !== 'image' || failedPreviewIds.has(asset.id)) {
        continue;
      }

      preloadImage(asset.filePath, 'full');
      preloadImage(asset.filePath, 'thumb', 640);
    }
  }, [failedPreviewIds, filteredAssets]);

  useEffect(() => {
    let cancelled = false;

    setIsBusy(true);

    void window.lightfolio.loadLibrary()
      .then((snapshot) => {
        if (cancelled) {
          return;
        }

        setImportState(snapshot.importState);
        setHiddenAssetIds(new Set(snapshot.hiddenAssetIds));
        setRemovedFromAlbumIds(snapshot.removedFromAlbumIds);
        setSelectedAssetId(
          snapshot.uiState?.selectedAssetId
          ?? snapshot.importState?.assets.find((asset) => !snapshot.hiddenAssetIds.includes(asset.id))?.id
          ?? snapshot.importState?.assets[0]?.id
          ?? null
        );
        setActiveFolder(snapshot.uiState?.activeFolder ?? 'all');
        setViewMode(snapshot.uiState?.viewMode ?? 'single');
        setIsSidebarCollapsed(snapshot.uiState?.isSidebarCollapsed ?? false);
        setIsFolderListCollapsed(snapshot.uiState?.isFolderListCollapsed ?? false);
        setIsDetailPanelCollapsed(snapshot.uiState?.isDetailPanelCollapsed ?? false);
        setIsFilmstripCollapsed(snapshot.uiState?.isFilmstripCollapsed ?? false);
        setFailedPreviewIds(new Set());

        if (snapshot.importState?.assets.length) {
          void warmupThumbnails(snapshot.importState.assets, 60);
        }
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsBusy(false);
        setIsLibraryReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLibraryReady) {
      return;
    }

    const snapshot: LibrarySnapshot = {
      version: 1,
      importState,
      hiddenAssetIds: Array.from(hiddenAssetIds),
      removedFromAlbumIds,
      uiState: {
        selectedAssetId,
        activeFolder,
        viewMode,
        isSidebarCollapsed,
        isFolderListCollapsed,
        isDetailPanelCollapsed,
        isFilmstripCollapsed
      },
      updatedAt: new Date().toISOString()
    };

    void window.lightfolio.saveLibrary(snapshot);
  }, [activeFolder, hiddenAssetIds, importState, isDetailPanelCollapsed, isFilmstripCollapsed, isFolderListCollapsed, isLibraryReady, isSidebarCollapsed, removedFromAlbumIds, selectedAssetId, viewMode]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  useEffect(() => {
    if (activeFolder !== 'all' && !folderItems.some((item) => item.path === activeFolder)) {
      setActiveFolder('all');
    }
  }, [activeFolder, folderItems]);

  useEffect(() => {
    if (selectedAssetId && !filteredAssets.some((asset) => asset.id === selectedAssetId)) {
      setNavDirection('none');
      setSelectedAssetId(filteredAssets[0]?.id ?? null);
    }
  }, [filteredAssets, selectedAssetId]);

  useEffect(() => {
    if (selectedIndex < 0) {
      return;
    }

    preloadAroundSelection(selectedIndex);
  }, [preloadAroundSelection, selectedIndex]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    function closeMenu() {
      setContextMenu(null);
    }

    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    function onGlobalKeyDown(event: KeyboardEvent) {
      if (event.key === '?') {
        event.preventDefault();
        setShowShortcutHelp((previous) => !previous);
        return;
      }

      if (event.key === 'Escape') {
        if (pendingDeleteAsset) {
          setPendingDeleteAsset(null);
          return;
        }

        if (showShortcutHelp) {
          setShowShortcutHelp(false);
          return;
        }

        if (contextMenu) {
          setContextMenu(null);
          return;
        }
      }
    }

    window.addEventListener('keydown', onGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', onGlobalKeyDown);
    };
  }, [contextMenu, pendingDeleteAsset, showShortcutHelp]);

  useEffect(() => {
    if (viewMode !== 'single') {
      return;
    }

    function clearHoldTimer() {
      if (holdTimerRef.current) {
        window.clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      holdKeyRef.current = null;
    }

    function directionFromKey(key: string) {
      if (key === 'ArrowRight' || key === 'ArrowDown') {
        return 1;
      }

      if (key === 'ArrowLeft' || key === 'ArrowUp') {
        return -1;
      }

      return 0;
    }

    function onKeyDown(event: KeyboardEvent) {
      const direction = directionFromKey(event.key);

      if (direction === 0) {
        return;
      }

      event.preventDefault();

      if (holdKeyRef.current === event.key && holdTimerRef.current) {
        return;
      }

      clearHoldTimer();
      selectOffset(direction);
      holdKeyRef.current = event.key;
      holdTimerRef.current = window.setInterval(() => {
        selectOffset(direction);
      }, 120);
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.key === holdKeyRef.current) {
        clearHoldTimer();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHoldTimer);

    return () => {
      clearHoldTimer();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHoldTimer);
    };
  }, [selectOffset, viewMode]);

  useEffect(() => {
    const element = waterfallRef.current;

    if (!element) {
      return;
    }

    let frame = 0;
    const update = () => {
      setWaterfallMetrics({
        width: element.clientWidth,
        height: element.clientHeight,
        scrollTop: element.scrollTop
      });
    };

    const onScroll = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      observer.disconnect();
      element.removeEventListener('scroll', onScroll);
    };
  }, [viewMode]);

  useEffect(() => {
    if (!selected?.id || !filmstripTrackRef.current) {
      return;
    }

    const target = filmstripTrackRef.current.querySelector(`[data-asset-id="${selected.id}"]`) as HTMLElement | null;

    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center'
    });
  }, [selected?.id]);

  async function runImport(mode: 'files' | 'directory') {
    setIsBusy(true);
    setDeleteFeedback(null);
    setToast(null);
    setWarmupProgress({ done: 0, total: 0, running: false });

    try {
      const summary = mode === 'files'
        ? await window.lightfolio.pickFiles()
        : await window.lightfolio.pickDirectory();

      if (summary) {
        const mergedSummary = mergeImportSummaries(importState, summary);
        const availableIds = new Set(mergedSummary.assets.map((asset) => asset.id));

        setImportState(mergedSummary);
        setHiddenAssetIds((previous) => new Set(Array.from(previous).filter((assetId) => availableIds.has(assetId))));
        setRemovedFromAlbumIds((previous) => previous.filter((assetId) => availableIds.has(assetId)));
        setSelectedAssetId(summary.assets[0]?.id ?? null);
        setNavDirection('none');
        setFailedPreviewIds(new Set());
        setActiveFolder('all');
        void warmupThumbnails(summary.assets);
        setToast({
          message: `已导入 ${summary.assets.length} 个资源，当前相册共有 ${mergedSummary.assets.length} 个资源。`,
          tone: 'info'
        });
      }
    } finally {
      setIsBusy(false);
    }
  }

  function markPreviewFailed(assetId: string) {
    setFailedPreviewIds((previous) => {
      if (previous.has(assetId)) {
        return previous;
      }

      const next = new Set(previous);
      next.add(assetId);
      return next;
    });
  }

  function removeFromAlbum(asset: AssetRecord) {
    setContextMenu(null);
    setHiddenAssetIds((previous) => {
      const next = new Set(previous);
      next.add(asset.id);
      return next;
    });

    setRemovedFromAlbumIds((previous) => {
      if (previous.includes(asset.id)) {
        return previous;
      }

      return [asset.id, ...previous];
    });

    setSelectedAssetId(null);
    setDeleteFeedback(`已从相册隐藏 ${asset.fileName}，原文件仍保留在磁盘中。`);
    setToast({
      message: `已从相册隐藏 ${asset.fileName}`,
      actionLabel: '撤销',
      action: () => restoreAsset(asset.id),
      tone: 'info'
    });
  }

  async function confirmDeleteFromDisk(asset: AssetRecord) {
    setPendingDeleteAsset(null);
    setContextMenu(null);

    setIsBusy(true);
    setDeleteFeedback(null);

    try {
      const deleted = await window.lightfolio.deleteFile(asset.filePath);

      if (deleted) {
        setHiddenAssetIds((previous) => {
          const next = new Set(previous);
          next.add(asset.id);
          return next;
        });

        setRemovedFromAlbumIds((previous) => previous.filter((item) => item !== asset.id));
        setSelectedAssetId(null);
        setDeleteFeedback(`已将 ${asset.fileName} 移动到系统回收站。`);
        setToast({
          message: `${asset.fileName} 已移入回收站。`,
          tone: 'danger'
        });
      } else {
        setDeleteFeedback(`删除失败：无法处理 ${asset.fileName}。`);
        setToast({
          message: `删除失败：无法处理 ${asset.fileName}`,
          tone: 'danger'
        });
      }
    } finally {
      setIsBusy(false);
    }
  }

  function requestDeleteFromDisk(asset: AssetRecord) {
    setContextMenu(null);
    setPendingDeleteAsset(asset);
  }

  function restoreAsset(assetId: string) {
    setHiddenAssetIds((previous) => {
      const next = new Set(previous);
      next.delete(assetId);
      return next;
    });

    setRemovedFromAlbumIds((previous) => previous.filter((item) => item !== assetId));
    selectById(assetId);
    setDeleteFeedback(null);
    setToast({
      message: '已恢复到相册。',
      tone: 'info'
    });
  }

  function restoreAllFromAlbum() {
    if (removedFromAlbumIds.length === 0) {
      return;
    }

    setHiddenAssetIds((previous) => {
      const next = new Set(previous);

      for (const assetId of removedFromAlbumIds) {
        next.delete(assetId);
      }

      return next;
    });

    setRemovedFromAlbumIds([]);
    setDeleteFeedback(null);
    setToast({
      message: `已恢复 ${removedFromAlbumIds.length} 个资源。`,
      tone: 'info'
    });
  }

  function retryFailedPreviews() {
    if (failedPreviewIds.size === 0) {
      return;
    }

    setFailedPreviewIds(new Set());

    if (selected?.kind === 'image') {
      preloadImage(selected.filePath, 'full');
      preloadImage(selected.filePath, 'thumb', 960);
    }

    void warmupThumbnails(filteredAssets, 40);
    setToast({
      message: '已重新尝试加载失败的预览。',
      tone: 'info'
    });
  }

  function toggleDetailSection(section: DetailSectionKey) {
    setCollapsedDetailSections((previous) => ({
      ...previous,
      [section]: !previous[section]
    }));
  }

  function pulseChromeAnimation() {
    if (chromeAnimationTimerRef.current) {
      window.clearTimeout(chromeAnimationTimerRef.current);
    }

    setIsChromeAnimating(true);
    chromeAnimationTimerRef.current = window.setTimeout(() => {
      setIsChromeAnimating(false);
      chromeAnimationTimerRef.current = null;
    }, chromeAnimationDurationMs);
  }

  function toggleDetailPanel() {
    pulseChromeAnimation();
    setIsDetailPanelCollapsed((previous) => !previous);
  }

  function toggleFilmstrip() {
    pulseChromeAnimation();
    setIsFilmstripCollapsed((previous) => !previous);
  }

  async function revealInExplorer(asset: AssetRecord) {
    const revealed = await window.lightfolio.revealFile(asset.filePath);

    if (!revealed) {
      setToast({
        message: `无法在资源管理器中定位 ${asset.fileName}`,
        tone: 'danger'
      });
      return;
    }

    setToast({
      message: `已在资源管理器中定位 ${asset.fileName}`,
      tone: 'info'
    });
  }

  function openAssetMenu(event: React.MouseEvent, assetId: string) {
    event.preventDefault();
    const position = clampContextMenuPosition(event.clientX, event.clientY);

    setContextMenu({
      x: position.x,
      y: position.y,
      assetId
    });
    selectById(assetId);
  }

  function onSingleWheel(event: React.WheelEvent) {
    if (viewMode !== 'single' || filteredAssets.length <= 1) {
      return;
    }

    event.preventDefault();

    const now = Date.now();

    if (now < wheelLockUntilRef.current) {
      return;
    }

    if (event.deltaY > 6) {
      selectOffset(1);
      wheelLockUntilRef.current = now + 140;
      return;
    }

    if (event.deltaY < -6) {
      selectOffset(-1);
      wheelLockUntilRef.current = now + 140;
    }
  }

  function onFilmstripWheel(event: React.WheelEvent) {
    if (filteredAssets.length <= 1) {
      return;
    }

    event.preventDefault();

    const now = Date.now();

    if (now < wheelLockUntilRef.current) {
      return;
    }

    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;

    if (delta > 4) {
      selectOffset(1);
      wheelLockUntilRef.current = now + 120;
      return;
    }

    if (delta < -4) {
      selectOffset(-1);
      wheelLockUntilRef.current = now + 120;
    }
  }

  function cycleFolder(offset: number) {
    if (folderSequence.length <= 1) {
      return;
    }

    const currentIndex = Math.max(0, folderSequence.indexOf(activeFolder));
    const nextIndex = (currentIndex + offset + folderSequence.length) % folderSequence.length;
    setNavDirection('none');
    setActiveFolder(folderSequence[nextIndex]);
  }

  const contextAsset = contextMenu ? filteredAssets.find((asset) => asset.id === contextMenu.assetId) ?? null : null;

  async function warmupThumbnails(assets: AssetRecord[], maxAssets = 120) {
    const imageAssets = assets.filter((asset) => asset.kind === 'image').slice(0, maxAssets);
    const total = imageAssets.length;

    if (total === 0) {
      setWarmupProgress({ done: 0, total: 0, running: false });
      return;
    }

    setWarmupProgress({ done: 0, total, running: true });

    const concurrency = 6;
    let pointer = 0;
    let done = 0;
    let lastReportDone = 0;
    let lastReportTs = performance.now();

    async function worker() {
      while (pointer < total) {
        const index = pointer;
        pointer += 1;
        await preloadImageTask(imageAssets[index].filePath, 'thumb', 640);
        done += 1;

        const now = performance.now();
        if (done === total || done - lastReportDone >= 6 || now - lastReportTs >= 120) {
          lastReportDone = done;
          lastReportTs = now;
          setWarmupProgress({ done, total, running: true });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
    setWarmupProgress({ done: total, total, running: false });
  }

  return (
    <div className={`shell ${isSidebarCollapsed ? 'shell-sidebar-collapsed' : ''}`}>
      <header className="topbar">
        <div className="topbar-brand">
          <h1>Lightfolio</h1>
          <p>{activeSource} · {totalAssets} 个资源</p>
        </div>
        <div className="topbar-actions">
          <button className="button button-ghost" onClick={() => setShowShortcutHelp(true)}>快捷键</button>
          <div className="view-switch">
            <button className={`button button-tab ${viewMode === 'single' ? 'button-tab-active' : ''}`} onClick={() => setViewMode('single')}>
              单图
            </button>
            <button className={`button button-tab ${viewMode === 'waterfall' ? 'button-tab-active' : ''}`} onClick={() => setViewMode('waterfall')}>
              瀑布流
            </button>
          </div>
          {removedAssets.length > 0 ? (
            <button className="button button-ghost" onClick={restoreAllFromAlbum} disabled={isBusy}>恢复已移除 {removedAssets.length}</button>
          ) : null}
        </div>
      </header>

      <aside className={`sidebar ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-rail">
          <button
            className="rail-button"
            title={isSidebarCollapsed ? '展开目录' : '收起目录'}
            onClick={() => setIsSidebarCollapsed((previous) => !previous)}
          >
            <span className="rail-icon">{isSidebarCollapsed ? '»' : '«'}</span>
          </button>
          <button
            className={`rail-button ${activeFolder === 'all' ? 'rail-button-active' : ''}`}
            title="全部照片"
            onClick={() => {
              setNavDirection('none');
              setActiveFolder('all');
            }}
          >
            <span className="rail-icon">▦</span>
          </button>
          <button className="rail-button" title="上一个目录" onClick={() => cycleFolder(-1)}>
            <span className="rail-icon">↑</span>
          </button>
          <button className="rail-button" title="下一个目录" onClick={() => cycleFolder(1)}>
            <span className="rail-icon">↓</span>
          </button>
        </div>

        <div className="sidebar-panel">
        <div className="sidebar-head">
          <div>
            <h2>照片目录</h2>
            <span>{folderItems.length} 个目录 · {filteredAssets.length} 个结果</span>
          </div>
          <button className="folder-collapse-toggle" onClick={() => setIsFolderListCollapsed((previous) => !previous)}>
            <span>{isFolderListCollapsed ? '▸' : '▾'}</span>
          </button>
        </div>
        {warmupProgress.total > 0 ? (
          <div className="import-progress">
            <div className="import-progress-head">
              <span>{warmupProgress.running ? '正在建立缩略图缓存' : '缩略图缓存已就绪'}</span>
              <em>{Math.round((warmupProgress.done / warmupProgress.total) * 100)}%</em>
            </div>
            <div className="import-progress-track">
              <div className="import-progress-fill" style={{ width: `${(warmupProgress.done / warmupProgress.total) * 100}%` }} />
            </div>
          </div>
        ) : null}
        {!isFolderListCollapsed ? (
        <div className="sidebar-scroll">
          <button className={`folder-item ${activeFolder === 'all' ? 'folder-item-active' : ''}`} onClick={() => {
            setNavDirection('none');
            setActiveFolder('all');
          }}>
            <span>全部照片</span>
            <em>{totalAssets}</em>
          </button>
          <div className="folder-list">
            {folderItems.map((folder) => (
              <button
                key={folder.path}
                className={`folder-item ${activeFolder === folder.path ? 'folder-item-active' : ''}`}
                onClick={() => {
                  setNavDirection('none');
                  setActiveFolder(folder.path);
                }}
                title={folder.path}
              >
                <span>{folderLabel(folder.path)}</span>
                <em>{folder.count}</em>
              </button>
            ))}
          </div>
        </div>
        ) : null}
        {previewFailureCount > 0 ? (
          <div className="hint-actions">
            <p className="hint-line">有 {previewFailureCount} 个文件暂时无法预览，可能是格式或权限问题。</p>
            <button className="button button-ghost button-inline" onClick={retryFailedPreviews}>重新尝试</button>
          </div>
        ) : null}
        <div className="sidebar-footer">
          <div className="sidebar-import-actions">
            <button className="button button-primary" onClick={() => runImport('directory')} disabled={isBusy}>添加目录</button>
            <button className="button button-secondary" onClick={() => runImport('files')} disabled={isBusy}>导入照片</button>
          </div>
        </div>
        </div>
      </aside>

      <main className={`content ${isFilmstripCollapsed ? 'content-filmstrip-collapsed' : ''}`}>
        <section className="viewer">
          {isViewerLoading ? (
            <div className="viewer-loading">
              <div className="viewer-loading-art" />
              <div className="viewer-loading-copy">
                <h3>{isLibraryReady ? '正在整理导入内容' : '正在恢复你的相册'}</h3>
                <p>{isLibraryReady ? '正在更新预览与缩略图缓存。' : '正在读取上次的导入结果和浏览状态。'}</p>
              </div>
            </div>
          ) : selected ? (
            viewMode === 'single' ? (
              <article className={`viewer-single ${isDetailPanelCollapsed ? 'viewer-single-detail-collapsed' : ''} ${isChromeAnimating ? 'viewer-single-chrome-animating' : ''}`} onWheel={onSingleWheel}>
                <div className={`viewer-stage ${isChromeAnimating ? 'viewer-stage-chrome-animating' : ''}`} onContextMenu={(event) => openAssetMenu(event, selected.id)}>
                  <div className={`viewer-media viewer-media-${selected.kind} media-${navDirection}`}>
                    {!failedPreviewIds.has(selected.id) ? (
                      selected.kind === 'image' ? (
                        <ProgressiveSingleImage asset={selected} onError={() => markPreviewFailed(selected.id)} />
                      ) : (
                        <div className="video-placeholder detail-media" />
                      )
                    ) : null}
                  </div>
                  <div className="viewer-overlay-meta">
                    <span>{formatDate(selected.capturedAt)}</span>
                    <strong>{selected.caption?.title ?? selected.fileName}</strong>
                    <em>{selected.kind === 'video' ? '视频' : '照片'} · {selectedFolderLabel}</em>
                  </div>
                </div>
                <aside className={`detail-panel-shell ${isDetailPanelCollapsed ? 'detail-panel-shell-collapsed' : ''}`} onWheel={onSingleWheel}>
                  <button
                    className={`detail-panel-toggle ${isDetailPanelCollapsed ? 'detail-panel-toggle-collapsed' : ''}`}
                    type="button"
                    aria-label={isDetailPanelCollapsed ? '展开信息栏' : '收起信息栏'}
                    title={isDetailPanelCollapsed ? '展开信息栏' : '收起信息栏'}
                    onClick={toggleDetailPanel}
                  >
                    <span aria-hidden="true">{isDetailPanelCollapsed ? '‹' : '›'}</span>
                  </button>
                  <div className={`detail-panel-content ${isDetailPanelCollapsed ? 'detail-panel-content-hidden' : ''}`} aria-hidden={isDetailPanelCollapsed}>
                    <div className="detail-panel">
                      <div className="detail-panel-header">
                        <div>
                          <span className="detail-eyebrow">当前作品</span>
                          <h3>{selected.caption?.title ?? selected.fileName}</h3>
                        </div>
                        <div className="detail-panel-header-actions">
                          {selected.isFeatured ? <span className="detail-badge">精选</span> : null}
                        </div>
                      </div>
                      <>
                        <p className="detail-description">{selected.caption?.body ?? '右键主图或下方胶卷缩略图，可执行打开、移除和删除操作。'}</p>
                        <div className="detail-grid">
                          <div className="detail-card">
                            <span>拍摄时间</span>
                            <strong>{formatDateTime(selected.capturedAt)}</strong>
                          </div>
                          <div className="detail-card">
                            <span>所在目录</span>
                            <strong title={folderFromPath(selected.filePath)}>{selectedFolderLabel}</strong>
                          </div>
                          <div className="detail-card">
                            <span>设备</span>
                            <strong>{selected.cameraModel ?? '未读取到相机信息'}</strong>
                          </div>
                          <div className="detail-card">
                            <span>镜头</span>
                            <strong>{selected.lensModel ?? '未读取到镜头信息'}</strong>
                          </div>
                        </div>
                        <div className={`detail-section ${collapsedDetailSections.description ? 'detail-section-collapsed' : ''}`}>
                          <button className="detail-section-toggle" onClick={() => toggleDetailSection('description')}>
                            <span className="detail-section-title">作品说明</span>
                            <span>{collapsedDetailSections.description ? '展开' : '收起'}</span>
                          </button>
                          {!collapsedDetailSections.description ? (
                            <div className="detail-section-body">
                              <p>{selected.caption?.body ?? '这张作品还没有补充说明。'}</p>
                            </div>
                          ) : null}
                        </div>
                        <div className={`detail-section ${collapsedDetailSections.tags ? 'detail-section-collapsed' : ''}`}>
                          <button className="detail-section-toggle" onClick={() => toggleDetailSection('tags')}>
                            <span className="detail-section-title">标签</span>
                            <span>{collapsedDetailSections.tags ? '展开' : '收起'}</span>
                          </button>
                          {!collapsedDetailSections.tags ? (
                            <div className="detail-section-body">
                              <div className="detail-tags">
                                {detailTags.length > 0 ? detailTags.map((tag) => (
                                  <span key={tag.id} className="detail-tag">{tag.label}</span>
                                )) : <span className="detail-tag detail-tag-muted">暂无标签</span>}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className={`detail-section ${collapsedDetailSections.fileInfo ? 'detail-section-collapsed' : ''}`}>
                          <button className="detail-section-toggle" onClick={() => toggleDetailSection('fileInfo')}>
                            <span className="detail-section-title">文件信息</span>
                            <span>{collapsedDetailSections.fileInfo ? '展开' : '收起'}</span>
                          </button>
                          {!collapsedDetailSections.fileInfo ? (
                            <div className="detail-section-body">
                              <dl className="detail-list">
                                <div>
                                  <dt>文件名</dt>
                                  <dd>{selected.fileName}</dd>
                                </div>
                                <div>
                                  <dt>导入时间</dt>
                                  <dd>{formatDateTime(selected.importedAt)}</dd>
                                </div>
                                <div>
                                  <dt>尺寸</dt>
                                  <dd>{selected.pixelWidth && selected.pixelHeight ? `${selected.pixelWidth} × ${selected.pixelHeight}` : '待补充'}</dd>
                                </div>
                                <div>
                                  <dt>地点</dt>
                                  <dd>{selected.location?.label ?? '待手动标记地点'}</dd>
                                </div>
                              </dl>
                            </div>
                          ) : null}
                        </div>
                      </>
                    </div>
                  </div>
                </aside>
              </article>
            ) : (
              <div className="waterfall-grid" ref={waterfallRef}>
                <div className="waterfall-canvas" style={{ height: waterfallLayout.totalHeight }}>
                {waterfallVisible.map((asset, index) => {
                  const absoluteIndex = waterfallLayout.startIndex + index;
                  const row = Math.floor(absoluteIndex / waterfallLayout.columns);
                  const column = absoluteIndex % waterfallLayout.columns;
                  const x = column * (waterfallLayout.columnWidth + waterfallGap);
                  const y = row * waterfallLayout.rowHeight;

                  return (
                  <article
                    key={asset.id}
                    className={`waterfall-tile ${tileVariant(asset.id)} ${selected?.id === asset.id ? 'waterfall-tile-active' : ''}`}
                    onClick={() => selectById(asset.id)}
                    onContextMenu={(event) => openAssetMenu(event, asset.id)}
                    style={{
                      width: waterfallLayout.columnWidth,
                      transform: `translate(${x}px, ${y}px)`
                    }}
                  >
                    <div className={`asset-preview asset-preview-${asset.kind}`}>
                      {!failedPreviewIds.has(asset.id) ? (
                        asset.kind === 'image' ? (
                          <ImagePreview
                            asset={asset}
                            className="asset-media media-enter"
                            mode="thumb"
                            size={640}
                            shouldLoad
                            onError={() => markPreviewFailed(asset.id)}
                          />
                        ) : (
                          <div className="video-placeholder" />
                        )
                      ) : null}
                    </div>
                    <div className="waterfall-tile-copy">
                      <p>{asset.caption?.title ?? asset.fileName}</p>
                      <span>{formatDate(asset.capturedAt)}</span>
                    </div>
                  </article>
                );
                })}
                </div>
              </div>
            )
          ) : (
            <div className="detail-empty">
              <p>{importState ? '当前目录没有可展示的作品。' : '还没有导入任何作品。'}</p>
              <p>{importState ? '可切换左侧目录，或恢复已移除资源。' : '先添加一个目录，Lightfolio 会为你构建时间轴。'}</p>
            </div>
          )}

          {deleteFeedback ? <p className="feedback-line">{deleteFeedback}</p> : null}
        </section>

        <section className={`filmstrip ${isFilmstripCollapsed ? 'filmstrip-collapsed' : ''}`}>
          <button
            className={`filmstrip-toggle ${isFilmstripCollapsed ? 'filmstrip-toggle-collapsed' : ''}`}
            type="button"
            aria-label={isFilmstripCollapsed ? '展开胶卷栏' : '收起胶卷栏'}
            title={isFilmstripCollapsed ? '展开胶卷栏' : '收起胶卷栏'}
            onClick={toggleFilmstrip}
          >
            <span aria-hidden="true">{isFilmstripCollapsed ? '‹' : '›'}</span>
          </button>
          <div className={`filmstrip-body ${isFilmstripCollapsed ? 'filmstrip-body-collapsed' : ''}`} aria-hidden={isFilmstripCollapsed}>
            <div className="filmstrip-head">
              <div>
                <h2>胶卷</h2>
                <span>{filteredAssets.length} 张</span>
              </div>
            </div>
            <div className="filmstrip-track" ref={filmstripTrackRef} onWheel={onFilmstripWheel}>
              {filteredAssets.map((asset) => {
                return (
                <button
                  key={asset.id}
                  className={`film-thumb ${selected?.id === asset.id ? 'film-thumb-active' : ''}`}
                  onClick={() => selectById(asset.id)}
                  onContextMenu={(event) => openAssetMenu(event, asset.id)}
                  data-asset-id={asset.id}
                  style={{ width: `${filmstripThumbWidth(asset)}px`, height: `${filmstripThumbHeight}px` }}
                >
                  <div className={`asset-preview asset-preview-${asset.kind}`}>
                    {!failedPreviewIds.has(asset.id) ? (
                      asset.kind === 'image' ? (
                        <ImagePreview
                          asset={asset}
                          className="asset-media media-enter"
                          mode="thumb"
                          size={384}
                          shouldLoad
                          onError={() => markPreviewFailed(asset.id)}
                        />
                      ) : (
                        <div className="video-placeholder" />
                      )
                    ) : null}
                  </div>
                </button>
              );
              })}
            </div>
          </div>
        </section>
      </main>

      {contextMenu && contextAsset ? (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="context-menu-title">{contextAsset.caption?.title ?? contextAsset.fileName}</div>
          <button className="context-item" onClick={() => void revealInExplorer(contextAsset)}>在资源管理器中打开</button>
          <button className="context-item" onClick={() => removeFromAlbum(contextAsset)}>从相册移除</button>
          <button className="context-item context-item-danger" onClick={() => requestDeleteFromDisk(contextAsset)}>删除磁盘文件（回收站）</button>
        </div>
      ) : null}

      {pendingDeleteAsset ? (
        <div className="modal-backdrop" onClick={() => setPendingDeleteAsset(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <span className="modal-eyebrow">危险操作确认</span>
            <h3>将 {pendingDeleteAsset.fileName} 移动到系统回收站？</h3>
            <p>这个操作会影响磁盘中的原始文件。若只是不想在 Lightfolio 中显示它，建议改用“从相册移除”。</p>
            <div className="modal-meta">
              <span>当前目录：{folderLabel(folderFromPath(pendingDeleteAsset.filePath))}</span>
              <span>拍摄时间：{formatDateTime(pendingDeleteAsset.capturedAt)}</span>
            </div>
            <div className="modal-actions">
              <button className="button button-ghost" onClick={() => setPendingDeleteAsset(null)}>取消</button>
              <button className="button button-secondary" onClick={() => removeFromAlbum(pendingDeleteAsset)}>改为仅从相册移除</button>
              <button className="button button-danger" onClick={() => void confirmDeleteFromDisk(pendingDeleteAsset)}>确认删除</button>
            </div>
          </div>
        </div>
      ) : null}

      {showShortcutHelp ? (
        <div className="modal-backdrop" onClick={() => setShowShortcutHelp(false)}>
          <div className="modal-card modal-card-shortcuts" onClick={(event) => event.stopPropagation()}>
            <span className="modal-eyebrow">快捷键帮助</span>
            <h3>浏览</h3>
            <div className="shortcut-list">
              <div><kbd>←</kbd><span>上一张</span></div>
              <div><kbd>→</kbd><span>下一张</span></div>
              <div><kbd>?</kbd><span>打开或关闭帮助</span></div>
              <div><kbd>Esc</kbd><span>关闭菜单或对话框</span></div>
            </div>
            <div className="modal-actions">
              <button className="button button-primary" onClick={() => setShowShortcutHelp(false)}>知道了</button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`toast ${toast.tone === 'danger' ? 'toast-danger' : ''}`}>
          <span>{toast.message}</span>
          {toast.action && toast.actionLabel ? (
            <button
              className="toast-action"
              onClick={() => {
                toast.action?.();
                setToast(null);
              }}
            >
              {toast.actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}
