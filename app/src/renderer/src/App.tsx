import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';

import type { AssetRecord, ImportSummary, LibrarySnapshot } from '@lightfolio/shared';

import { bootTimeline } from './data';
import {
  ContextMenu,
  DeleteConfirmModal,
  Filmstrip,
  ShortcutHelpModal,
  Sidebar,
  SingleViewer,
  Toast,
  TopBar,
  WaterfallGrid
} from './components';
import { useAssetBrowser, useResizableLayout, useThumbnailWarmup, useViewerChrome } from './hooks';
import type { BrowserFilters, ToastState } from './types';
import { collectAssetMap, filterTimeline, folderFromPath, mergeImportSummaries, preloadImage, rebuildImportSummary } from './utils';

export function App() {
  const [waterfallTileSize, setWaterfallTileSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [importState, setImportState] = useState<ImportSummary | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isLibraryReady, setIsLibraryReady] = useState(false);
  const [hiddenAssetIds, setHiddenAssetIds] = useState<Set<string>>(new Set());
  const [removedFromAlbumIds, setRemovedFromAlbumIds] = useState<string[]>([]);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [failedPreviewIds, setFailedPreviewIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingDeleteAsset, setPendingDeleteAsset] = useState<AssetRecord | null>(null);
  const [filters, setFilters] = useState<BrowserFilters>({
    searchQuery: '',
    mediaFilter: 'all',
    activeTag: null,
    activeCamera: null,
    activeLens: null,
    favoriteOnly: false,
    featuredOnly: false
  });
  const { warmupProgress, setWarmupProgress, warmupThumbnails } = useThumbnailWarmup();
  const layout = useResizableLayout();

  const sourceTimeline = importState?.timeline ?? (isLibraryReady ? [] : bootTimeline);
  const timeline = useMemo(() => filterTimeline(sourceTimeline, hiddenAssetIds), [hiddenAssetIds, sourceTimeline]);
  const assetMap = useMemo(() => collectAssetMap(sourceTimeline), [sourceTimeline]);
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
  const tagItems = useMemo(() => {
    const map = new Map<string, number>();

    for (const asset of visibleAssets) {
      for (const tag of asset.tags) {
        map.set(tag.label, (map.get(tag.label) ?? 0) + 1);
      }
    }

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-CN'))
      .slice(0, 16);
  }, [visibleAssets]);
  const cameraItems = useMemo(() => {
    const map = new Map<string, number>();

    for (const asset of visibleAssets) {
      if (!asset.cameraModel) {
        continue;
      }

      map.set(asset.cameraModel, (map.get(asset.cameraModel) ?? 0) + 1);
    }

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-CN'))
      .slice(0, 12);
  }, [visibleAssets]);
  const lensItems = useMemo(() => {
    const map = new Map<string, number>();

    for (const asset of visibleAssets) {
      if (!asset.lensModel) {
        continue;
      }

      map.set(asset.lensModel, (map.get(asset.lensModel) ?? 0) + 1);
    }

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-CN'))
      .slice(0, 12);
  }, [visibleAssets]);
  const previewFailureCount = failedPreviewIds.size;
  const totalAssets = visibleAssets.length;
  const favoriteCount = useMemo(() => visibleAssets.filter((asset) => asset.isFavorite).length, [visibleAssets]);
  const featuredCount = useMemo(() => visibleAssets.filter((asset) => asset.isFeatured).length, [visibleAssets]);
  const hasActiveFilters = filters.searchQuery.trim().length > 0
    || filters.mediaFilter !== 'all'
    || filters.activeTag !== null
    || filters.activeCamera !== null
    || filters.activeLens !== null
    || filters.favoriteOnly
    || filters.featuredOnly;
  const activeSource = importState?.source === 'directory' ? '目录导入' : importState?.source === 'files' ? '文件导入' : '示例内容';
  const browser = useAssetBrowser({
    isLibraryReady,
    folderItems,
    visibleAssets,
    failedPreviewIds,
    filters,
    waterfallTileSize
  });
  const chrome = useViewerChrome(browser.selectById);
  const filteredAssets = browser.filteredAssets;

  const cycleWaterfallTileSize = useCallback((direction: 1 | -1) => {
    const sizeOrder: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

    setWaterfallTileSize((current) => {
      const currentIndex = sizeOrder.indexOf(current);
      const nextIndex = Math.max(0, Math.min(sizeOrder.length - 1, currentIndex + direction));
      return sizeOrder[nextIndex] ?? current;
    });
  }, []);

  const onWaterfallWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();

    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;

    if (delta > 6) {
      cycleWaterfallTileSize(-1);
      return;
    }

    if (delta < -6) {
      cycleWaterfallTileSize(1);
    }
  }, [cycleWaterfallTileSize]);

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
        browser.setSelectedAssetId(
          snapshot.uiState?.selectedAssetId
          ?? snapshot.importState?.assets.find((asset) => !snapshot.hiddenAssetIds.includes(asset.id))?.id
          ?? snapshot.importState?.assets[0]?.id
          ?? null
        );
        browser.setActiveFolder(snapshot.uiState?.activeFolder ?? 'all');
        browser.setViewMode(snapshot.uiState?.viewMode ?? 'single');
        setFilters({
          searchQuery: snapshot.uiState?.searchQuery ?? '',
          mediaFilter: snapshot.uiState?.mediaFilter ?? 'all',
          activeTag: snapshot.uiState?.activeTag ?? null,
          activeCamera: snapshot.uiState?.activeCamera ?? null,
          activeLens: snapshot.uiState?.activeLens ?? null,
          favoriteOnly: snapshot.uiState?.favoriteOnly ?? false,
          featuredOnly: snapshot.uiState?.featuredOnly ?? false
        });
        layout.setLayoutSizes({
          sidebarWidth: snapshot.uiState?.sidebarWidth,
          detailPanelWidth: snapshot.uiState?.detailPanelWidth,
          filmstripHeight: snapshot.uiState?.filmstripHeight
        });
        chrome.setIsSidebarCollapsed(snapshot.uiState?.isSidebarCollapsed ?? false);
        chrome.setIsFolderListCollapsed(snapshot.uiState?.isFolderListCollapsed ?? false);
        chrome.setIsDetailPanelCollapsed(snapshot.uiState?.isDetailPanelCollapsed ?? false);
        chrome.setIsFilmstripCollapsed(snapshot.uiState?.isFilmstripCollapsed ?? false);
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
  }, [
    browser.setActiveFolder,
    browser.setSelectedAssetId,
    browser.setViewMode,
    chrome.setIsDetailPanelCollapsed,
    chrome.setIsFilmstripCollapsed,
    chrome.setIsFolderListCollapsed,
    chrome.setIsSidebarCollapsed,
    layout.setLayoutSizes,
    warmupThumbnails
  ]);

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
        selectedAssetId: browser.selectedAssetId,
        activeFolder: browser.activeFolder,
        viewMode: browser.viewMode,
        searchQuery: filters.searchQuery,
        mediaFilter: filters.mediaFilter,
        activeTag: filters.activeTag,
        activeCamera: filters.activeCamera,
        activeLens: filters.activeLens,
        favoriteOnly: filters.favoriteOnly,
        featuredOnly: filters.featuredOnly,
        sidebarWidth: layout.layoutSizes.sidebarWidth,
        detailPanelWidth: layout.layoutSizes.detailPanelWidth,
        filmstripHeight: layout.layoutSizes.filmstripHeight,
        isSidebarCollapsed: chrome.isSidebarCollapsed,
        isFolderListCollapsed: chrome.isFolderListCollapsed,
        isDetailPanelCollapsed: chrome.isDetailPanelCollapsed,
        isFilmstripCollapsed: chrome.isFilmstripCollapsed
      },
      updatedAt: new Date().toISOString()
    };

    void window.lightfolio.saveLibrary(snapshot);
  }, [browser.activeFolder, browser.selectedAssetId, browser.viewMode, chrome.isDetailPanelCollapsed, chrome.isFilmstripCollapsed, chrome.isFolderListCollapsed, chrome.isSidebarCollapsed, filters.activeCamera, filters.activeLens, filters.activeTag, filters.favoriteOnly, filters.featuredOnly, filters.mediaFilter, filters.searchQuery, hiddenAssetIds, importState, isLibraryReady, layout.layoutSizes.detailPanelWidth, layout.layoutSizes.filmstripHeight, layout.layoutSizes.sidebarWidth, removedFromAlbumIds]);

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
    function onGlobalKeyDown(event: KeyboardEvent) {
      if (event.key === '?') {
        event.preventDefault();
        chrome.setShowShortcutHelp((previous) => !previous);
        return;
      }

      if (event.key === 'Escape') {
        if (pendingDeleteAsset) {
          setPendingDeleteAsset(null);
          return;
        }

        if (chrome.showShortcutHelp) {
          chrome.setShowShortcutHelp(false);
          return;
        }

        if (chrome.contextMenu) {
          chrome.setContextMenu(null);
          return;
        }
      }
    }

    window.addEventListener('keydown', onGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', onGlobalKeyDown);
    };
  }, [chrome.contextMenu, chrome.setContextMenu, chrome.setShowShortcutHelp, chrome.showShortcutHelp, pendingDeleteAsset]);

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
        browser.setSelectedAssetId(summary.assets[0]?.id ?? null);
        browser.setNavDirection('none');
        setFailedPreviewIds(new Set());
        browser.setActiveFolder('all');
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
    chrome.setContextMenu(null);
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

    browser.setSelectedAssetId(null);
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
    chrome.setContextMenu(null);

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
        browser.setSelectedAssetId(null);
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
    chrome.setContextMenu(null);
    setPendingDeleteAsset(asset);
  }

  function restoreAsset(assetId: string) {
    setHiddenAssetIds((previous) => {
      const next = new Set(previous);
      next.delete(assetId);
      return next;
    });

    setRemovedFromAlbumIds((previous) => previous.filter((item) => item !== assetId));
    browser.selectById(assetId);
    setDeleteFeedback(null);
    setToast({
      message: '已恢复到相册。',
      tone: 'info'
    });
  }

  function retryFailedPreviews() {
    if (failedPreviewIds.size === 0) {
      return;
    }

    setFailedPreviewIds(new Set());

    if (browser.selected?.kind === 'image') {
      preloadImage(browser.selected.filePath, 'full');
      preloadImage(browser.selected.filePath, 'thumb', 960);
    }

    void warmupThumbnails(filteredAssets, 40);
    setToast({
      message: '已重新尝试加载失败的预览。',
      tone: 'info'
    });
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

  function updateAsset(assetId: string, updater: (asset: AssetRecord) => AssetRecord) {
    let hasChanged = false;

    setImportState((previous) => {
      if (!previous) {
        return previous;
      }

      const nextAssets = previous.assets.map((asset) => {
        if (asset.id !== assetId) {
          return asset;
        }

        const updatedAsset = updater(asset);

        if (updatedAsset !== asset) {
          hasChanged = true;
        }

        return updatedAsset;
      });

      return hasChanged ? rebuildImportSummary(previous, nextAssets) : previous;
    });

    return hasChanged;
  }

  function updateSelectedCaption(caption: AssetRecord['caption']) {
    if (!browser.selected) {
      return;
    }

    updateAsset(browser.selected.id, (asset) => {
      const nextTitle = caption?.title?.trim();
      const nextBody = caption?.body?.trim();
      const nextCaption = nextTitle || nextBody
        ? {
            ...(nextTitle ? { title: nextTitle } : {}),
            ...(nextBody ? { body: nextBody } : {})
          }
        : undefined;

      if (asset.caption?.title === nextCaption?.title && asset.caption?.body === nextCaption?.body) {
        return asset;
      }

      return {
        ...asset,
        caption: nextCaption
      };
    });
  }

  function addSelectedTag(label: string) {
    if (!browser.selected) {
      return;
    }

    const normalizedLabel = label.trim();

    if (!normalizedLabel) {
      return;
    }

    updateAsset(browser.selected.id, (asset) => {
      const exists = asset.tags.some((tag) => tag.label.localeCompare(normalizedLabel, 'zh-CN', { sensitivity: 'accent' }) === 0);

      if (exists) {
        return asset;
      }

      return {
        ...asset,
        tags: [
          ...asset.tags,
          {
            id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            label: normalizedLabel
          }
        ]
      };
    });

    if (!browser.selected.tags.some((tag) => tag.label.localeCompare(normalizedLabel, 'zh-CN', { sensitivity: 'accent' }) === 0)) {
      setToast({
        message: `已添加标签“${normalizedLabel}”`,
        tone: 'info'
      });
    }
  }

  function removeSelectedTag(tagId: string) {
    if (!browser.selected) {
      return;
    }

    updateAsset(browser.selected.id, (asset) => {
      const nextTags = asset.tags.filter((tag) => tag.id !== tagId);

      if (nextTags.length === asset.tags.length) {
        return asset;
      }

      return {
        ...asset,
        tags: nextTags
      };
    });

    setToast({
      message: '已移除标签',
      tone: 'info'
    });
  }

  function toggleSelectedFeatured() {
    if (!browser.selected) {
      return;
    }

    updateAsset(browser.selected.id, (asset) => ({
      ...asset,
      isFeatured: !asset.isFeatured
    }));

    setToast({
      message: browser.selected.isFeatured ? '已取消精选' : '已加入精选',
      tone: 'info'
    });
  }

  function toggleSelectedFavorite() {
    if (!browser.selected) {
      return;
    }

    updateAsset(browser.selected.id, (asset) => ({
      ...asset,
      isFavorite: !asset.isFavorite
    }));

    setToast({
      message: browser.selected.isFavorite ? '已取消收藏' : '已加入收藏',
      tone: 'info'
    });
  }

  const contextMenuAssetId = chrome.contextMenu?.assetId ?? null;
  const contextAsset = contextMenuAssetId ? filteredAssets.find((asset) => asset.id === contextMenuAssetId) ?? null : null;
  const shellStyle = useMemo(() => ({
    '--sidebar-width': `${layout.layoutSizes.sidebarWidth}px`,
    '--detail-panel-width': `${layout.layoutSizes.detailPanelWidth}px`,
    '--filmstrip-height': `${layout.layoutSizes.filmstripHeight}px`
  }) as React.CSSProperties, [layout.layoutSizes.detailPanelWidth, layout.layoutSizes.filmstripHeight, layout.layoutSizes.sidebarWidth]);

  return (
    <div
      className={`shell ${chrome.isSidebarCollapsed ? 'shell-sidebar-collapsed' : ''} ${layout.isResizing ? `shell-resizing shell-resizing-${layout.activeHandle}` : ''}`}
      style={shellStyle}
    >
      <TopBar
        activeSource={activeSource}
        totalAssets={totalAssets}
        filteredAssetsCount={filteredAssets.length}
        viewMode={browser.viewMode}
        waterfallTileSize={waterfallTileSize}
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        onShowShortcutHelp={() => chrome.setShowShortcutHelp(true)}
        onClearFilters={() => setFilters({
          searchQuery: '',
          mediaFilter: 'all',
          activeTag: null,
          activeCamera: null,
          activeLens: null,
          favoriteOnly: false,
          featuredOnly: false
        })}
        onSearchQueryChange={(value) => setFilters((previous) => ({ ...previous, searchQuery: value }))}
        onMediaFilterChange={(value) => setFilters((previous) => ({ ...previous, mediaFilter: value }))}
        onFavoriteOnlyChange={(value) => setFilters((previous) => ({ ...previous, favoriteOnly: value }))}
        onFeaturedOnlyChange={(value) => setFilters((previous) => ({ ...previous, featuredOnly: value }))}
        onViewModeChange={browser.setViewMode}
        onWaterfallTileSizeChange={setWaterfallTileSize}
      />

      <Sidebar
        isSidebarCollapsed={chrome.isSidebarCollapsed}
        isFolderListCollapsed={chrome.isFolderListCollapsed}
        activeFolder={browser.activeFolder}
        folderItems={folderItems}
        favoriteCount={favoriteCount}
        featuredCount={featuredCount}
        favoriteOnly={filters.favoriteOnly}
        featuredOnly={filters.featuredOnly}
        activeTag={filters.activeTag}
        tagItems={tagItems}
        activeCamera={filters.activeCamera}
        cameraItems={cameraItems}
        activeLens={filters.activeLens}
        lensItems={lensItems}
        filteredAssetsCount={filteredAssets.length}
        totalAssets={totalAssets}
        warmupProgress={warmupProgress}
        previewFailureCount={previewFailureCount}
        isBusy={isBusy}
        onResizeStart={layout.beginResize('sidebar')}
        onResizeReset={layout.resetSize('sidebar')}
        onToggleSidebar={() => chrome.setIsSidebarCollapsed((previous) => !previous)}
        onSelectAllFolders={() => {
          browser.setNavDirection('none');
          browser.setActiveFolder('all');
        }}
        onToggleFolderList={() => chrome.setIsFolderListCollapsed((previous) => !previous)}
        onSelectFolder={(path) => {
          browser.setNavDirection('none');
          browser.setActiveFolder(path);
        }}
        onToggleFavoriteOnly={() => setFilters((previous) => ({ ...previous, favoriteOnly: !previous.favoriteOnly }))}
        onToggleFeaturedOnly={() => setFilters((previous) => ({ ...previous, featuredOnly: !previous.featuredOnly }))}
        onSelectTag={(label) => setFilters((previous) => ({ ...previous, activeTag: label }))}
        onSelectCamera={(label) => setFilters((previous) => ({ ...previous, activeCamera: label }))}
        onSelectLens={(label) => setFilters((previous) => ({ ...previous, activeLens: label }))}
        onRetryFailedPreviews={retryFailedPreviews}
        onImport={runImport}
      />

      <main className="content">
        <section className="viewer">
          {browser.isViewerLoading || (isBusy && !importState) ? (
            <div className="viewer-loading">
              <div className="viewer-loading-art" />
              <div className="viewer-loading-copy">
                <h3>{isLibraryReady ? '正在整理导入内容' : '正在恢复你的相册'}</h3>
                <p>{isLibraryReady ? '正在更新预览与缩略图缓存。' : '正在读取上次的导入结果和浏览状态。'}</p>
              </div>
            </div>
          ) : browser.selected ? (
            browser.viewMode === 'single' ? (
              <SingleViewer
                asset={browser.selected}
                navDirection={browser.navDirection}
                selectedFolderLabel={browser.selectedFolderLabel}
                detailTags={browser.detailTags}
                failedPreviewIds={failedPreviewIds}
                isDetailPanelCollapsed={chrome.isDetailPanelCollapsed}
                isChromeAnimating={chrome.isChromeAnimating}
                collapsedDetailSections={chrome.collapsedDetailSections}
                onStartDetailResize={layout.beginResize('detail')}
                onResetDetailSize={layout.resetSize('detail')}
                onWheel={browser.onSingleWheel}
                onOpenAssetMenu={chrome.openAssetMenu}
                onToggleDetailPanel={chrome.toggleDetailPanel}
                onToggleDetailSection={chrome.toggleDetailSection}
                onUpdateCaption={updateSelectedCaption}
                onAddTag={addSelectedTag}
                onRemoveTag={removeSelectedTag}
                onToggleFavorite={toggleSelectedFavorite}
                onToggleFeatured={toggleSelectedFeatured}
                onPreviewError={markPreviewFailed}
              />
            ) : (
              <WaterfallGrid
                selectedId={browser.selected?.id ?? null}
                failedPreviewIds={failedPreviewIds}
                layout={browser.waterfallLayout}
                visibleItems={browser.waterfallVisible}
                containerRef={browser.waterfallRef}
                onWheel={onWaterfallWheel}
                onSelectById={browser.selectById}
                onOpenAssetMenu={chrome.openAssetMenu}
                onPreviewError={markPreviewFailed}
              />
            )
          ) : (
            <div className="detail-empty">
              <p>{importState ? '当前筛选条件下没有可展示的作品。' : '还没有导入任何作品。'}</p>
              <p>{importState ? '可清空搜索、调整筛选条件，或切换左侧目录继续浏览。' : '先添加一个目录，Lightfolio 会为你构建时间轴。'}</p>
            </div>
          )}

          {deleteFeedback ? <p className="feedback-line">{deleteFeedback}</p> : null}
        </section>
      </main>

      <Filmstrip
        isCollapsed={chrome.isFilmstripCollapsed}
        assets={filteredAssets}
        selectedId={browser.selected?.id ?? null}
        failedPreviewIds={failedPreviewIds}
        trackRef={browser.filmstripTrackRef}
        onResizeStart={layout.beginResize('filmstrip')}
        onResizeReset={layout.resetSize('filmstrip')}
        onWheel={browser.onFilmstripWheel}
        onToggle={chrome.toggleFilmstrip}
        onSelectById={browser.selectById}
        onOpenAssetMenu={chrome.openAssetMenu}
        onPreviewError={markPreviewFailed}
      />

      {chrome.contextMenu && contextAsset ? (
        <ContextMenu
          asset={contextAsset}
          x={chrome.contextMenu.x}
          y={chrome.contextMenu.y}
          onReveal={() => void revealInExplorer(contextAsset)}
          onRemoveFromAlbum={() => removeFromAlbum(contextAsset)}
          onDeleteFromDisk={() => requestDeleteFromDisk(contextAsset)}
        />
      ) : null}

      {pendingDeleteAsset ? (
        <DeleteConfirmModal
          asset={pendingDeleteAsset}
          onClose={() => setPendingDeleteAsset(null)}
          onRemoveFromAlbum={() => removeFromAlbum(pendingDeleteAsset)}
          onConfirmDelete={() => void confirmDeleteFromDisk(pendingDeleteAsset)}
        />
      ) : null}

      {chrome.showShortcutHelp ? <ShortcutHelpModal onClose={() => chrome.setShowShortcutHelp(false)} /> : null}

      {toast ? <Toast toast={toast} onDismiss={() => setToast(null)} /> : null}

    </div>
  );
}
