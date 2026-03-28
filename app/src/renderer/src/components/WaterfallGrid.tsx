import type React from 'react';

import type { WaterfallLayoutMetrics, WaterfallVisibleItem } from '../types/ui';
import { ImagePreview } from './ImagePreview';

interface WaterfallGridProps {
  selectedId: string | null;
  failedPreviewIds: Set<string>;
  layout: WaterfallLayoutMetrics;
  visibleItems: WaterfallVisibleItem[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  onWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  onSelectById: (assetId: string) => void;
  onOpenAssetMenu: (event: React.MouseEvent, assetId: string) => void;
  onPreviewError: (assetId: string) => void;
}

export function WaterfallGrid({
  selectedId,
  failedPreviewIds,
  layout,
  visibleItems,
  containerRef,
  onWheel,
  onSelectById,
  onOpenAssetMenu,
  onPreviewError
}: WaterfallGridProps) {
  return (
    <div className="waterfall-grid" ref={containerRef} onWheel={onWheel}>
      <div className="waterfall-canvas" style={{ height: layout.totalHeight }}>
        {visibleItems.map(({ asset, tile }) => {
          return (
            <article
              key={asset.id}
              className={`waterfall-tile ${selectedId === asset.id ? 'waterfall-tile-active' : ''}`}
              onClick={() => onSelectById(asset.id)}
              onContextMenu={(event) => onOpenAssetMenu(event, asset.id)}
              style={{
                width: tile.width,
                height: tile.height,
                transform: `translate(${tile.x}px, ${tile.y}px)`
              }}
              aria-label={asset.caption?.title ?? asset.fileName}
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
            </article>
          );
        })}
      </div>
    </div>
  );
}