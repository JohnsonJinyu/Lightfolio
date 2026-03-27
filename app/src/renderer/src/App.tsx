import { useEffect, useMemo, useState } from 'react';

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
import { useAssetBrowser, useThumbnailWarmup, useViewerChrome } from './hooks';
import type { ToastState } from './types';
import { collectAssetMap, filterTimeline, folderFromPath, folderLabel, mergeImportSummaries, preloadImage } from './utils';

export function App() {
  const [importState, setImportState] = useState<ImportSummary | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isLibraryReady, setIsLibraryReady] = useState(false);
  const [hiddenAssetIds, setHiddenAssetIds] = useState<Set<string>>(new Set());
  const [removedFromAlbumIds, setRemovedFromAlbumIds] = useState<string[]>([]);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [failedPreviewIds, setFailedPreviewIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingDeleteAsset, setPendingDeleteAsset] = useState<AssetRecord | null>(null);
  const { warmupProgress, setWarmupProgress, warmupThumbnails } = useThumbnailWarmup();

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
  const removedAssets = useMemo(
    () => removedFromAlbumIds.map((assetId) => assetMap.get(assetId)).filter((asset): asset is AssetRecord => Boolean(asset)),
    [assetMap, removedFromAlbumIds]
  );
  const previewFailureCount = failedPreviewIds.size;
  const totalAssets = visibleAssets.length;
  const activeSource = importState?.source === 'directory' ? '目录导入' : importState?.source === 'files' ? '文件导入' : '示例内容';
  const browser = useAssetBrowser({
    importState,
    isLibraryReady,
    folderItems,
    visibleAssets,
    failedPreviewIds
  });
  const chrome = useViewerChrome(browser.selectById);
  const filteredAssets = browser.filteredAssets;

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
  }, [browser, chrome, warmupThumbnails]);

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
        isSidebarCollapsed: chrome.isSidebarCollapsed,
        isFolderListCollapsed: chrome.isFolderListCollapsed,
        isDetailPanelCollapsed: chrome.isDetailPanelCollapsed,
        isFilmstripCollapsed: chrome.isFilmstripCollapsed
      },
      updatedAt: new Date().toISOString()
    };

    void window.lightfolio.saveLibrary(snapshot);
  }, [browser.activeFolder, browser.selectedAssetId, browser.viewMode, chrome.isDetailPanelCollapsed, chrome.isFilmstripCollapsed, chrome.isFolderListCollapsed, chrome.isSidebarCollapsed, hiddenAssetIds, importState, isLibraryReady, removedFromAlbumIds]);

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
  }, [chrome, pendingDeleteAsset]);

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

  const contextMenuAssetId = chrome.contextMenu?.assetId ?? null;
  const contextAsset = contextMenuAssetId ? filteredAssets.find((asset) => asset.id === contextMenuAssetId) ?? null : null;

  return (
    <div className={`shell ${chrome.isSidebarCollapsed ? 'shell-sidebar-collapsed' : ''}`}>
      <TopBar
        activeSource={activeSource}
        totalAssets={totalAssets}
        viewMode={browser.viewMode}
        removedAssetsCount={removedAssets.length}
        isBusy={isBusy}
        onShowShortcutHelp={() => chrome.setShowShortcutHelp(true)}
        onViewModeChange={browser.setViewMode}
        onRestoreAll={restoreAllFromAlbum}
      />

      <Sidebar
        isSidebarCollapsed={chrome.isSidebarCollapsed}
        isFolderListCollapsed={chrome.isFolderListCollapsed}
        activeFolder={browser.activeFolder}
        folderItems={folderItems}
        filteredAssetsCount={filteredAssets.length}
        totalAssets={totalAssets}
        warmupProgress={warmupProgress}
        previewFailureCount={previewFailureCount}
        isBusy={isBusy}
        onToggleSidebar={() => chrome.setIsSidebarCollapsed((previous) => !previous)}
        onSelectAllFolders={() => {
          browser.setNavDirection('none');
          browser.setActiveFolder('all');
        }}
        onCycleFolder={browser.cycleFolder}
        onToggleFolderList={() => chrome.setIsFolderListCollapsed((previous) => !previous)}
        onSelectFolder={(path) => {
          browser.setNavDirection('none');
          browser.setActiveFolder(path);
        }}
        onRetryFailedPreviews={retryFailedPreviews}
        onImport={runImport}
      />

      <main className={`content ${chrome.isFilmstripCollapsed ? 'content-filmstrip-collapsed' : ''}`}>
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
                onWheel={browser.onSingleWheel}
                onOpenAssetMenu={chrome.openAssetMenu}
                onToggleDetailPanel={chrome.toggleDetailPanel}
                onToggleDetailSection={chrome.toggleDetailSection}
                onPreviewError={markPreviewFailed}
              />
            ) : (
              <WaterfallGrid
                assets={filteredAssets}
                selectedId={browser.selected?.id ?? null}
                failedPreviewIds={failedPreviewIds}
                layout={browser.waterfallLayout}
                visibleAssets={browser.waterfallVisible}
                containerRef={browser.waterfallRef}
                onSelectById={browser.selectById}
                onOpenAssetMenu={chrome.openAssetMenu}
                onPreviewError={markPreviewFailed}
              />
            )
          ) : (
            <div className="detail-empty">
              <p>{importState ? '当前目录没有可展示的作品。' : '还没有导入任何作品。'}</p>
              <p>{importState ? '可切换左侧目录，或恢复已移除资源。' : '先添加一个目录，Lightfolio 会为你构建时间轴。'}</p>
            </div>
          )}

          {deleteFeedback ? <p className="feedback-line">{deleteFeedback}</p> : null}
        </section>

        <Filmstrip
          isCollapsed={chrome.isFilmstripCollapsed}
          assets={filteredAssets}
          selectedId={browser.selected?.id ?? null}
          failedPreviewIds={failedPreviewIds}
          trackRef={browser.filmstripTrackRef}
          onWheel={browser.onFilmstripWheel}
          onToggle={chrome.toggleFilmstrip}
          onSelectById={browser.selectById}
          onOpenAssetMenu={chrome.openAssetMenu}
          onPreviewError={markPreviewFailed}
        />
      </main>

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
