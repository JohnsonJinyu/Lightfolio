import type React from 'react';

import type { AssetRecord } from '@lightfolio/shared';

import type { WaterfallLayoutMetrics } from '../types/ui';
import { WATERFALL_GAP } from '../constants/layout';
import { formatDate, tileVariant } from '../utils/library';
import { ImagePreview } from './ImagePreview';

interface WaterfallGridProps {
  assets: AssetRecord[];
  selectedId: string | null;
  failedPreviewIds: Set<string>;
  layout: WaterfallLayoutMetrics;
  visibleAssets: AssetRecord[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSelectById: (assetId: string) => void;
  onOpenAssetMenu: (event: React.MouseEvent, assetId: string) => void;
  onPreviewError: (assetId: string) => void;
}

export function WaterfallGrid({
  selectedId,
  failedPreviewIds,
  layout,
  visibleAssets,
  containerRef,
  onSelectById,
  onOpenAssetMenu,
  onPreviewError
}: WaterfallGridProps) {
  return (
    <div className="waterfall-grid" ref={containerRef}>
      <div className="waterfall-canvas" style={{ height: layout.totalHeight }}>
        {visibleAssets.map((asset, index) => {
          const absoluteIndex = layout.startIndex + index;
          const row = Math.floor(absoluteIndex / layout.columns);
          const column = absoluteIndex % layout.columns;
          const x = column * (layout.columnWidth + WATERFALL_GAP);
          const y = row * layout.rowHeight;

          return (
            <article
              key={asset.id}
              className={`waterfall-tile ${tileVariant(asset.id)} ${selectedId === asset.id ? 'waterfall-tile-active' : ''}`}
              onClick={() => onSelectById(asset.id)}
              onContextMenu={(event) => onOpenAssetMenu(event, asset.id)}
              style={{
                width: layout.columnWidth,
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
                      onError={() => onPreviewError(asset.id)}
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
  );
}