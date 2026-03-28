import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AssetRecord } from '@lightfolio/shared';

import { WATERFALL_GAP, WATERFALL_MIN_TILE_WIDTH } from '../constants/layout';
import type { BrowserFilters, NavDirection, ViewMode, WaterfallLayoutMetrics, WaterfallVisibleItem } from '../types/ui';
import { assetAspectRatio, folderFromPath } from '../utils/library';
import { preloadImage } from '../utils/media';

interface UseAssetBrowserOptions {
  isLibraryReady: boolean;
  folderItems: Array<{ path: string; count: number }>;
  visibleAssets: AssetRecord[];
  failedPreviewIds: Set<string>;
  filters: BrowserFilters;
}

interface WaterfallMetricsState {
  width: number;
  height: number;
  scrollTop: number;
}

export function useAssetBrowser({ isLibraryReady, folderItems, visibleAssets, failedPreviewIds, filters }: UseAssetBrowserOptions) {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [navDirection, setNavDirection] = useState<NavDirection>('none');
  const [waterfallMetrics, setWaterfallMetrics] = useState<WaterfallMetricsState>({ width: 0, height: 0, scrollTop: 0 });
  const filmstripTrackRef = useRef<HTMLDivElement | null>(null);
  const waterfallRef = useRef<HTMLDivElement | null>(null);
  const wheelLockUntilRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);
  const holdKeyRef = useRef<string | null>(null);
  const filteredAssets = useMemo(() => {
    const normalizedQuery = filters.searchQuery.trim().toLocaleLowerCase('zh-CN');

    return visibleAssets.filter((asset) => {
      if (activeFolder !== 'all' && folderFromPath(asset.filePath) !== activeFolder) {
        return false;
      }

      if (filters.mediaFilter !== 'all' && asset.kind !== filters.mediaFilter) {
        return false;
      }

      if (filters.activeTag && !asset.tags.some((tag) => tag.label === filters.activeTag)) {
        return false;
      }

      if (filters.activeCamera && asset.cameraModel !== filters.activeCamera) {
        return false;
      }

      if (filters.activeLens && asset.lensModel !== filters.activeLens) {
        return false;
      }

      if (filters.favoriteOnly && !asset.isFavorite) {
        return false;
      }

      if (filters.featuredOnly && !asset.isFeatured) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        asset.fileName,
        asset.caption?.title,
        asset.caption?.body,
        asset.cameraModel,
        asset.lensModel,
        asset.location?.label,
        ...asset.tags.map((tag) => tag.label)
      ]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .toLocaleLowerCase('zh-CN');

      return haystack.includes(normalizedQuery);
    });
  }, [activeFolder, filters.activeCamera, filters.activeLens, filters.activeTag, filters.favoriteOnly, filters.featuredOnly, filters.mediaFilter, filters.searchQuery, visibleAssets]);

  const selected = selectedAssetId
    ? filteredAssets.find((asset) => asset.id === selectedAssetId) ?? filteredAssets[0] ?? null
    : filteredAssets[0] ?? null;
  const selectedIndex = selected ? filteredAssets.findIndex((asset) => asset.id === selected.id) : -1;
  const folderSequence = useMemo(() => ['all', ...folderItems.map((item) => item.path)], [folderItems]);
  const isViewerLoading = !isLibraryReady;
  const selectedFolderLabel = selected ? folderFromPath(selected.filePath).replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? '未选择' : '未选择';
  const detailTags = selected?.tags ?? [];

  const waterfallLayout: WaterfallLayoutMetrics = useMemo(() => {
    const width = Math.max(0, waterfallMetrics.width);
    const columns = Math.max(1, Math.floor((width + WATERFALL_GAP) / (WATERFALL_MIN_TILE_WIDTH + WATERFALL_GAP)));
    const columnWidth = Math.max(160, Math.floor((width - WATERFALL_GAP * (columns - 1)) / columns));
    const columnHeights = Array.from({ length: columns }, () => 0);
    const items = filteredAssets.map((asset, index) => {
      const rawAspectRatio = asset.kind === 'video' && (!asset.pixelWidth || !asset.pixelHeight)
        ? 3 / 2
        : assetAspectRatio(asset);
      const aspectRatio = Math.max(0.55, Math.min(3.2, rawAspectRatio || 1));
      const height = Math.max(120, Math.round(columnWidth / aspectRatio));

      let targetColumn = 0;
      let minHeight = columnHeights[0] ?? 0;

      for (let column = 1; column < columns; column += 1) {
        const nextHeight = columnHeights[column] ?? 0;

        if (nextHeight < minHeight) {
          minHeight = nextHeight;
          targetColumn = column;
        }
      }

      const x = targetColumn * (columnWidth + WATERFALL_GAP);
      const y = minHeight;
      const bottom = y + height;

      columnHeights[targetColumn] = bottom + WATERFALL_GAP;

      return {
        index,
        assetId: asset.id,
        x,
        y,
        width: columnWidth,
        height,
        bottom
      };
    });

    const totalHeight = items.length === 0 ? 0 : Math.max(0, ...columnHeights) - WATERFALL_GAP;

    return {
      columns,
      columnWidth,
      totalHeight,
      items
    };
  }, [filteredAssets, waterfallMetrics.width]);

  const waterfallVisible: WaterfallVisibleItem[] = useMemo(() => {
    const viewportTop = Math.max(0, waterfallMetrics.scrollTop - 480);
    const viewportBottom = waterfallMetrics.scrollTop + (waterfallMetrics.height || 700) + 480;

    return waterfallLayout.items
      .filter((tile) => tile.bottom >= viewportTop && tile.y <= viewportBottom)
      .map((tile) => ({
        tile,
        asset: filteredAssets[tile.index] as AssetRecord
      }));
  }, [filteredAssets, waterfallLayout.items, waterfallMetrics.height, waterfallMetrics.scrollTop]);

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

  const onSingleWheel = useCallback((event: React.WheelEvent) => {
    if (viewMode !== 'single' || filteredAssets.length <= 1) {
      return;
    }

    if (event.ctrlKey || event.defaultPrevented) {
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
  }, [filteredAssets.length, selectOffset, viewMode]);

  const onFilmstripWheel = useCallback((event: React.WheelEvent) => {
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
  }, [filteredAssets.length, selectOffset]);

  const cycleFolder = useCallback((offset: number) => {
    if (folderSequence.length <= 1) {
      return;
    }

    const currentIndex = Math.max(0, folderSequence.indexOf(activeFolder));
    const nextIndex = (currentIndex + offset + folderSequence.length) % folderSequence.length;
    setNavDirection('none');
    setActiveFolder(folderSequence[nextIndex]);
  }, [activeFolder, folderSequence]);

  return {
    selectedAssetId,
    setSelectedAssetId,
    activeFolder,
    setActiveFolder,
    filteredAssets,
    viewMode,
    setViewMode,
    navDirection,
    setNavDirection,
    selected,
    selectedIndex,
    selectedFolderLabel,
    detailTags,
    folderSequence,
    isViewerLoading,
    waterfallLayout,
    waterfallVisible,
    filmstripTrackRef,
    waterfallRef,
    selectById,
    onSingleWheel,
    onFilmstripWheel,
    cycleFolder
  };
}