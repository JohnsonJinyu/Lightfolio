import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

import type { AssetRecord } from '@lightfolio/shared';

import type { DetailSectionKey, NavDirection } from '../types/ui';
import { formatDate } from '../utils/library';
import { DetailPanel } from './DetailPanel';
import { ProgressiveSingleImage } from './ProgressiveSingleImage';

interface SingleViewerProps {
  asset: AssetRecord;
  navDirection: NavDirection;
  selectedFolderLabel: string;
  detailTags: AssetRecord['tags'];
  failedPreviewIds: Set<string>;
  isDetailPanelCollapsed: boolean;
  isChromeAnimating: boolean;
  collapsedDetailSections: Record<DetailSectionKey, boolean>;
  onStartDetailResize: (event: React.PointerEvent<HTMLElement>) => void;
  onResetDetailSize: (event: React.MouseEvent<HTMLElement>) => void;
  onWheel: (event: React.WheelEvent) => void;
  onOpenAssetMenu: (event: React.MouseEvent, assetId: string) => void;
  onToggleDetailPanel: () => void;
  onToggleDetailSection: (section: DetailSectionKey) => void;
  onUpdateCaption: (caption: AssetRecord['caption']) => void;
  onAddTag: (label: string) => void;
  onRemoveTag: (tagId: string) => void;
  onToggleFavorite: () => void;
  onToggleFeatured: () => void;
  onPreviewError: (assetId: string) => void;
}

export function SingleViewer({
  asset,
  navDirection,
  selectedFolderLabel,
  detailTags,
  failedPreviewIds,
  isDetailPanelCollapsed,
  isChromeAnimating,
  collapsedDetailSections,
  onStartDetailResize,
  onResetDetailSize,
  onWheel,
  onOpenAssetMenu,
  onToggleDetailPanel,
  onToggleDetailSection,
  onUpdateCaption,
  onAddTag,
  onRemoveTag,
  onToggleFavorite,
  onToggleFeatured,
  onPreviewError
}: SingleViewerProps) {
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(async () => {
    const element = fullscreenRef.current;

    if (!element) {
      return;
    }

    if (document.fullscreenElement === element) {
      await document.exitFullscreen();
      return;
    }

    await element.requestFullscreen();
  }, []);

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
    }

    document.addEventListener('fullscreenchange', syncFullscreenState);
    syncFullscreenState();

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isEditable = target?.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA';

      if (isEditable) {
        return;
      }

      if (event.key === 'f' || event.key === 'F' || event.key === 'F11') {
        event.preventDefault();
        void toggleFullscreen();
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [toggleFullscreen]);

  return (
    <article
      className={`viewer-single ${isDetailPanelCollapsed ? 'viewer-single-detail-collapsed' : ''} ${isChromeAnimating ? 'viewer-single-chrome-animating' : ''}`}
      onWheel={onWheel}
    >
      <div
        className={`viewer-stage ${isDetailPanelCollapsed ? 'viewer-stage-detail-collapsed' : 'viewer-stage-detail-open'} ${isChromeAnimating ? 'viewer-stage-chrome-animating' : ''}`}
      >
        <div ref={fullscreenRef} className={`viewer-stage-main ${isFullscreen ? 'viewer-stage-main-fullscreen' : ''}`} onContextMenu={(event) => onOpenAssetMenu(event, asset.id)}>
          <div className={`viewer-media viewer-media-${asset.kind} media-${navDirection}`}>
            {!failedPreviewIds.has(asset.id) ? (
              asset.kind === 'image' ? (
                <ProgressiveSingleImage
                  asset={asset}
                  onError={() => onPreviewError(asset.id)}
                />
              ) : (
                <div className="video-placeholder detail-media" />
              )
            ) : null}
          </div>
          <button
            className={`viewer-fullscreen-button ${isFullscreen ? 'viewer-fullscreen-button-active' : ''}`}
            type="button"
            aria-label={isFullscreen ? '退出全屏' : '全屏查看'}
            onClick={() => void toggleFullscreen()}
          >
            <span aria-hidden="true">{isFullscreen ? '⤡' : '⤢'}</span>
          </button>
          <div className="viewer-overlay-meta">
            <span>{formatDate(asset.capturedAt)}</span>
            <strong>{asset.caption?.title ?? asset.fileName}</strong>
            <em>{asset.kind === 'video' ? '视频' : '照片'} · {selectedFolderLabel}</em>
          </div>
        </div>
        <DetailPanel
          asset={asset}
          selectedFolderLabel={selectedFolderLabel}
          detailTags={detailTags}
          isCollapsed={isDetailPanelCollapsed}
          collapsedSections={collapsedDetailSections}
          onResizeStart={onStartDetailResize}
          onResizeReset={onResetDetailSize}
          onTogglePanel={onToggleDetailPanel}
          onToggleSection={onToggleDetailSection}
          onUpdateCaption={onUpdateCaption}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          onToggleFavorite={onToggleFavorite}
          onToggleFeatured={onToggleFeatured}
        />
      </div>
    </article>
  );
}