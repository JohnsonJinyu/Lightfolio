import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AssetRecord, ImportSummary, TimelineGroup } from '@lightfolio/shared';

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

function latestAsset(groups: TimelineGroup[]): AssetRecord | null {
  return groups.flatMap((group) => group.assets)[0] ?? null;
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
  return Math.max(60, Math.min(220, Math.round(filmstripThumbHeight * assetAspectRatio(asset))));
}

const fileUrlCache = new Map<string, string | null>();
const waterfallMinTileWidth = 220;
const waterfallGap = 10;
const filmstripThumbHeight = 92;

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
  const thumbSource = useMemo(() => getFileUrlCached(asset.filePath, 'thumb', 960), [asset.filePath]);
  const fullSource = useMemo(() => getFileUrlCached(asset.filePath, 'full'), [asset.filePath]);
  const [isFullReady, setIsFullReady] = useState(false);
  const [resolvedFullSource, setResolvedFullSource] = useState<string | null>(null);

  useEffect(() => {
    setIsFullReady(false);
    setResolvedFullSource(null);
  }, [asset.id]);

  useEffect(() => {
    if (!fullSource) {
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.decoding = 'async';
    image.src = fullSource;

    const markReady = () => {
      if (cancelled) {
        return;
      }

      setResolvedFullSource(fullSource);
      setIsFullReady(true);
    };

    image.onload = markReady;
    image.onerror = () => {
      if (!cancelled) {
        onError();
      }
    };

    void image.decode().then(markReady).catch(() => {
      if (!cancelled) {
        onError();
      }
    });

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [fullSource, onError]);

  return (
    <div className="progressive-stage">
      {thumbSource ? (
        <img
          className={`detail-media detail-media-thumb ${isFullReady ? 'detail-media-thumb-hidden' : ''}`}
          src={thumbSource}
          alt={asset.caption?.title ?? asset.fileName}
        />
      ) : null}
      {resolvedFullSource ? (
        <img
          className={`detail-media detail-media-full ${isFullReady ? 'detail-media-full-ready' : ''}`}
          src={resolvedFullSource}
          alt={asset.caption?.title ?? asset.fileName}
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
  const [navDirection, setNavDirection] = useState<'forward' | 'backward' | 'none'>('none');
  const [warmupProgress, setWarmupProgress] = useState<{ done: number; total: number; running: boolean }>({ done: 0, total: 0, running: false });
  const wheelLockUntilRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);
  const holdKeyRef = useRef<string | null>(null);
  const filmstripTrackRef = useRef<HTMLDivElement | null>(null);
  const waterfallRef = useRef<HTMLDivElement | null>(null);
  const [waterfallMetrics, setWaterfallMetrics] = useState({ width: 0, height: 0, scrollTop: 0 });

  const sourceTimeline = importState?.timeline ?? bootTimeline;
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
    if (activeFolder === 'all') {
      return visibleAssets;
    }

    return visibleAssets.filter((asset) => folderFromPath(asset.filePath) === activeFolder);
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
  const activeSource = importState?.source === 'directory' ? '目录导入' : importState?.source === 'files' ? '文件导入' : '示例内容';
  const folderSequence = useMemo(() => ['all', ...folderItems.map((item) => item.path)], [folderItems]);

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
    setWarmupProgress({ done: 0, total: 0, running: false });

    try {
      const summary = mode === 'files'
        ? await window.lightfolio.pickFiles()
        : await window.lightfolio.pickDirectory();

      if (summary) {
        setImportState(summary);
        setHiddenAssetIds(new Set());
        setRemovedFromAlbumIds([]);
        setSelectedAssetId(summary.assets[0]?.id ?? null);
        setNavDirection('none');
        setFailedPreviewIds(new Set());
        setActiveFolder('all');
        void warmupThumbnails(summary.assets);
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
  }

  async function deleteFromDisk(asset: AssetRecord) {
    setContextMenu(null);
    const approved = window.confirm(`将 ${asset.fileName} 移动到系统回收站？该操作会影响磁盘源文件。`);

    if (!approved) {
      return;
    }

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
      } else {
        setDeleteFeedback(`删除失败：无法处理 ${asset.fileName}。`);
      }
    } finally {
      setIsBusy(false);
    }
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
  }

  function openAssetMenu(event: React.MouseEvent, assetId: string) {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
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

  async function warmupThumbnails(assets: AssetRecord[]) {
    const imageAssets = assets.filter((asset) => asset.kind === 'image');
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
            <span>{folderItems.length} 个目录</span>
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
          <p className="hint-line">有 {previewFailureCount} 个文件暂时无法预览，可能是格式或权限问题。</p>
        ) : null}
        <div className="sidebar-footer">
          <div className="sidebar-import-actions">
            <button className="button button-primary" onClick={() => runImport('directory')} disabled={isBusy}>添加目录</button>
            <button className="button button-secondary" onClick={() => runImport('files')} disabled={isBusy}>导入照片</button>
          </div>
        </div>
        </div>
      </aside>

      <main className="content">
        <section className="viewer">
          {selected ? (
            viewMode === 'single' ? (
              <article className="viewer-single" onContextMenu={(event) => openAssetMenu(event, selected.id)} onWheel={onSingleWheel}>
                <div key={selected.id} className={`viewer-media viewer-media-${selected.kind} media-${navDirection}`}>
                  {!failedPreviewIds.has(selected.id) ? (
                    selected.kind === 'image' ? (
                      <ProgressiveSingleImage asset={selected} onError={() => markPreviewFailed(selected.id)} />
                    ) : (
                      <div className="video-placeholder detail-media" />
                    )
                  ) : null}
                </div>
                <div className="viewer-meta">
                  <h3>{selected.caption?.title ?? selected.fileName}</h3>
                  <p>{selected.caption?.body ?? '右键当前照片可进行移除或删除操作。'}</p>
                  <span>{formatDate(selected.capturedAt)}</span>
                </div>
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
                    <p>{asset.caption?.title ?? asset.fileName}</p>
                  </article>
                );
                })}
                </div>
              </div>
            )
          ) : (
            <div className="detail-empty">
              <p>当前目录没有可展示的作品。</p>
              <p>可切换左侧目录，或先导入新照片。</p>
            </div>
          )}

          {deleteFeedback ? <p className="feedback-line">{deleteFeedback}</p> : null}
        </section>

        <section className="filmstrip">
          <div className="filmstrip-head">
            <h2>胶卷</h2>
            <span>{filteredAssets.length} 张</span>
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
                        size={256}
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
        </section>
      </main>

      {contextMenu && contextAsset ? (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button className="context-item" onClick={() => removeFromAlbum(contextAsset)}>从相册移除（不删原文件）</button>
          <button className="context-item context-item-danger" onClick={() => void deleteFromDisk(contextAsset)}>删除磁盘文件（回收站）</button>
          <button className="context-item" onClick={() => setContextMenu(null)}>取消</button>
        </div>
      ) : null}

    </div>
  );
}
