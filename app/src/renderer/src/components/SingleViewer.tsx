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
  return (
    <article
      className={`viewer-single ${isDetailPanelCollapsed ? 'viewer-single-detail-collapsed' : ''} ${isChromeAnimating ? 'viewer-single-chrome-animating' : ''}`}
      onWheel={onWheel}
    >
      <div
        className={`viewer-stage ${isDetailPanelCollapsed ? 'viewer-stage-detail-collapsed' : 'viewer-stage-detail-open'} ${isChromeAnimating ? 'viewer-stage-chrome-animating' : ''}`}
      >
        <div className="viewer-stage-main" onContextMenu={(event) => onOpenAssetMenu(event, asset.id)}>
          <div className={`viewer-media viewer-media-${asset.kind} media-${navDirection}`}>
            {!failedPreviewIds.has(asset.id) ? (
              asset.kind === 'image' ? (
                <ProgressiveSingleImage asset={asset} onError={() => onPreviewError(asset.id)} />
              ) : (
                <div className="video-placeholder detail-media" />
              )
            ) : null}
          </div>
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