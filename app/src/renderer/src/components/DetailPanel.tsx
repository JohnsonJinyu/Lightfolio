import type { AssetRecord } from '@lightfolio/shared';

import type { DetailSectionKey } from '../types/ui';
import { folderFromPath, formatDateTime } from '../utils/library';

interface DetailPanelProps {
  asset: AssetRecord;
  selectedFolderLabel: string;
  detailTags: AssetRecord['tags'];
  isCollapsed: boolean;
  collapsedSections: Record<DetailSectionKey, boolean>;
  onTogglePanel: () => void;
  onToggleSection: (section: DetailSectionKey) => void;
  onWheel: (event: React.WheelEvent) => void;
}

export function DetailPanel({
  asset,
  selectedFolderLabel,
  detailTags,
  isCollapsed,
  collapsedSections,
  onTogglePanel,
  onToggleSection,
  onWheel
}: DetailPanelProps) {
  return (
    <aside className={`detail-panel-shell ${isCollapsed ? 'detail-panel-shell-collapsed' : ''}`} onWheel={onWheel}>
      <button
        className={`detail-panel-toggle ${isCollapsed ? 'detail-panel-toggle-collapsed' : ''}`}
        type="button"
        aria-label={isCollapsed ? '展开信息栏' : '收起信息栏'}
        title={isCollapsed ? '展开信息栏' : '收起信息栏'}
        onClick={onTogglePanel}
      >
        <span aria-hidden="true">{isCollapsed ? '‹' : '›'}</span>
      </button>
      <div className={`detail-panel-content ${isCollapsed ? 'detail-panel-content-hidden' : ''}`} aria-hidden={isCollapsed}>
        <div className="detail-panel">
          <div className="detail-panel-header">
            <div>
              <span className="detail-eyebrow">当前作品</span>
              <h3>{asset.caption?.title ?? asset.fileName}</h3>
            </div>
            <div className="detail-panel-header-actions">
              {asset.isFeatured ? <span className="detail-badge">精选</span> : null}
            </div>
          </div>
          <p className="detail-description">{asset.caption?.body ?? '右键主图或下方胶卷缩略图，可执行打开、移除和删除操作。'}</p>
          <div className="detail-grid">
            <div className="detail-card">
              <span>拍摄时间</span>
              <strong>{formatDateTime(asset.capturedAt)}</strong>
            </div>
            <div className="detail-card">
              <span>所在目录</span>
              <strong title={folderFromPath(asset.filePath)}>{selectedFolderLabel}</strong>
            </div>
            <div className="detail-card">
              <span>设备</span>
              <strong>{asset.cameraModel ?? '未读取到相机信息'}</strong>
            </div>
            <div className="detail-card">
              <span>镜头</span>
              <strong>{asset.lensModel ?? '未读取到镜头信息'}</strong>
            </div>
          </div>
          <div className={`detail-section ${collapsedSections.description ? 'detail-section-collapsed' : ''}`}>
            <button className="detail-section-toggle" onClick={() => onToggleSection('description')}>
              <span className="detail-section-title">作品说明</span>
              <span>{collapsedSections.description ? '展开' : '收起'}</span>
            </button>
            {!collapsedSections.description ? (
              <div className="detail-section-body">
                <p>{asset.caption?.body ?? '这张作品还没有补充说明。'}</p>
              </div>
            ) : null}
          </div>
          <div className={`detail-section ${collapsedSections.tags ? 'detail-section-collapsed' : ''}`}>
            <button className="detail-section-toggle" onClick={() => onToggleSection('tags')}>
              <span className="detail-section-title">标签</span>
              <span>{collapsedSections.tags ? '展开' : '收起'}</span>
            </button>
            {!collapsedSections.tags ? (
              <div className="detail-section-body">
                <div className="detail-tags">
                  {detailTags.length > 0 ? detailTags.map((tag) => (
                    <span key={tag.id} className="detail-tag">{tag.label}</span>
                  )) : <span className="detail-tag detail-tag-muted">暂无标签</span>}
                </div>
              </div>
            ) : null}
          </div>
          <div className={`detail-section ${collapsedSections.fileInfo ? 'detail-section-collapsed' : ''}`}>
            <button className="detail-section-toggle" onClick={() => onToggleSection('fileInfo')}>
              <span className="detail-section-title">文件信息</span>
              <span>{collapsedSections.fileInfo ? '展开' : '收起'}</span>
            </button>
            {!collapsedSections.fileInfo ? (
              <div className="detail-section-body">
                <dl className="detail-list">
                  <div>
                    <dt>文件名</dt>
                    <dd>{asset.fileName}</dd>
                  </div>
                  <div>
                    <dt>导入时间</dt>
                    <dd>{formatDateTime(asset.importedAt)}</dd>
                  </div>
                  <div>
                    <dt>尺寸</dt>
                    <dd>{asset.pixelWidth && asset.pixelHeight ? `${asset.pixelWidth} × ${asset.pixelHeight}` : '待补充'}</dd>
                  </div>
                  <div>
                    <dt>地点</dt>
                    <dd>{asset.location?.label ?? '待手动标记地点'}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}