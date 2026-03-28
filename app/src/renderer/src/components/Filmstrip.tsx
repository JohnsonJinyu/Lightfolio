import type React from 'react';

import type { AssetRecord } from '@lightfolio/shared';

import { FILMSTRIP_THUMB_HEIGHT } from '../constants/layout';
import { filmstripThumbWidth } from '../utils/library';
import { ImagePreview } from './ImagePreview';

interface FilmstripProps {
  isCollapsed: boolean;
  assets: AssetRecord[];
  selectedId: string | null;
  failedPreviewIds: Set<string>;
  trackRef: React.RefObject<HTMLDivElement | null>;
  onResizeStart: (event: React.PointerEvent<HTMLElement>) => void;
  onResizeReset: (event: React.MouseEvent<HTMLElement>) => void;
  onWheel: (event: React.WheelEvent) => void;
  onToggle: () => void;
  onSelectById: (assetId: string) => void;
  onOpenAssetMenu: (event: React.MouseEvent, assetId: string) => void;
  onPreviewError: (assetId: string) => void;
}

export function Filmstrip({
  isCollapsed,
  assets,
  selectedId,
  failedPreviewIds,
  trackRef,
  onResizeStart,
  onResizeReset,
  onWheel,
  onToggle,
  onSelectById,
  onOpenAssetMenu,
  onPreviewError
}: FilmstripProps) {
  return (
    <section className={`filmstrip ${isCollapsed ? 'filmstrip-collapsed' : ''}`}>
      {!isCollapsed ? (
        <div
          className="resize-handle resize-handle-horizontal resize-handle-filmstrip"
          aria-hidden="true"
          title="拖动调整胶卷栏高度，双击恢复默认"
          onPointerDown={onResizeStart}
          onDoubleClick={onResizeReset}
        />
      ) : null}
      <button
        className={`edge-toggle filmstrip-toggle ${isCollapsed ? 'filmstrip-toggle-collapsed' : ''}`}
        type="button"
        aria-label={isCollapsed ? '展开胶卷栏' : '收起胶卷栏'}
        title={isCollapsed ? '展开胶卷栏' : '收起胶卷栏'}
        onClick={onToggle}
      >
        <span className="edge-toggle-icon" aria-hidden="true">{isCollapsed ? '‹' : '›'}</span>
      </button>
      <div className={`filmstrip-body ${isCollapsed ? 'filmstrip-body-collapsed' : ''}`} aria-hidden={isCollapsed}>
        <div className="filmstrip-head">
          <div>
            <h2>胶卷</h2>
            <span>{assets.length} 张</span>
          </div>
        </div>
        <div className="filmstrip-track" ref={trackRef} onWheel={onWheel}>
          {assets.map((asset) => (
            <button
              key={asset.id}
              className={`film-thumb ${selectedId === asset.id ? 'film-thumb-active' : ''}`}
              onClick={() => onSelectById(asset.id)}
              onContextMenu={(event) => onOpenAssetMenu(event, asset.id)}
              data-asset-id={asset.id}
              style={{ width: `${filmstripThumbWidth(asset)}px`, height: `${FILMSTRIP_THUMB_HEIGHT}px` }}
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
                      onError={() => onPreviewError(asset.id)}
                    />
                  ) : (
                    <div className="video-placeholder" />
                  )
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}