import { Fragment, useEffect, useMemo, useState } from 'react';
import type React from 'react';

import type { AssetRecord } from '@lightfolio/shared';

import { useResizableSectionStack } from '../hooks';
import type { DetailSectionKey } from '../types/ui';
import { folderFromPath, formatAperture, formatDateTime, formatIso, formatShutterSpeed } from '../utils/library';

interface DetailPanelProps {
  asset: AssetRecord;
  selectedFolderLabel: string;
  detailTags: AssetRecord['tags'];
  isCollapsed: boolean;
  collapsedSections: Record<DetailSectionKey, boolean>;
  sectionHeights: Record<string, number>;
  onSectionHeightsChange: (sizes: Record<string, number>) => void;
  onResizeStart: (event: React.PointerEvent<HTMLElement>) => void;
  onResizeReset: (event: React.MouseEvent<HTMLElement>) => void;
  onTogglePanel: () => void;
  onToggleSection: (section: DetailSectionKey) => void;
  onUpdateCaption: (caption: AssetRecord['caption']) => void;
  onAddTag: (label: string) => void;
  onRemoveTag: (tagId: string) => void;
  onToggleFavorite: () => void;
  onToggleFeatured: () => void;
}

export function DetailPanel({
  asset,
  selectedFolderLabel,
  detailTags,
  isCollapsed,
  collapsedSections,
  sectionHeights,
  onSectionHeightsChange,
  onResizeStart,
  onResizeReset,
  onTogglePanel,
  onToggleSection,
  onUpdateCaption,
  onAddTag,
  onRemoveTag,
  onToggleFavorite,
  onToggleFeatured
}: DetailPanelProps) {
  const [titleInput, setTitleInput] = useState(asset.caption?.title ?? '');
  const [bodyInput, setBodyInput] = useState(asset.caption?.body ?? '');
  const [tagInput, setTagInput] = useState('');
  const detailSectionDefaults = useMemo<Record<DetailSectionKey, number>>(() => ({
    description: 176,
    tags: 154,
    fileInfo: 150
  }), []);
  const detailSectionStack = useResizableSectionStack(
    detailSectionDefaults,
    92,
    sectionHeights as Partial<Record<DetailSectionKey, number>>,
    (sizes) => onSectionHeightsChange(sizes as Record<string, number>)
  );

  useEffect(() => {
    setTitleInput(asset.caption?.title ?? '');
    setBodyInput(asset.caption?.body ?? '');
    setTagInput('');
  }, [asset.caption?.body, asset.caption?.title, asset.id]);

  function commitCaption(nextTitle: string, nextBody: string) {
    const normalizedTitle = nextTitle.trim();
    const normalizedBody = nextBody.trim();

    if ((asset.caption?.title ?? '') === normalizedTitle && (asset.caption?.body ?? '') === normalizedBody) {
      return;
    }

    onUpdateCaption(
      normalizedTitle || normalizedBody
        ? {
            ...(normalizedTitle ? { title: normalizedTitle } : {}),
            ...(normalizedBody ? { body: normalizedBody } : {})
          }
        : undefined
    );
  }

  function handleTitleBlur() {
    commitCaption(titleInput, bodyInput);
  }

  function handleBodyBlur() {
    commitCaption(titleInput, bodyInput);
  }

  function handleTitleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    commitCaption(titleInput, bodyInput);
    event.currentTarget.blur();
  }

  function handleTagSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedLabel = tagInput.trim();

    if (!normalizedLabel) {
      return;
    }

    onAddTag(normalizedLabel);
    setTagInput('');
  }

  function handlePanelWheelCapture(event: React.WheelEvent<HTMLElement>) {
    event.stopPropagation();
  }

  const detailSections = [
    {
      key: 'description' as const,
      collapsed: collapsedSections.description,
      title: '作品说明',
      body: (
        <div className="detail-section-body">
          <textarea
            className="detail-textarea"
            value={bodyInput}
            placeholder="补充这张作品的想法、拍摄背景或后期说明。"
            rows={5}
            aria-label="作品说明"
            onChange={(event) => setBodyInput(event.target.value)}
            onBlur={handleBodyBlur}
          />
          <p className="detail-save-hint">失焦后自动保存。标题留空时会回退显示文件名。</p>
        </div>
      )
    },
    {
      key: 'tags' as const,
      collapsed: collapsedSections.tags,
      title: '标签',
      body: (
        <div className="detail-section-body">
          <div className="detail-tags">
            {detailTags.length > 0 ? detailTags.map((tag) => (
              <button key={tag.id} className="detail-tag detail-tag-button" type="button" onClick={() => onRemoveTag(tag.id)}>
                {tag.label}
                <span aria-hidden="true">×</span>
              </button>
            )) : <span className="detail-tag detail-tag-muted">暂无标签</span>}
          </div>
          <form className="detail-tag-form" onSubmit={handleTagSubmit}>
            <input
              className="detail-tag-input"
              type="text"
              value={tagInput}
              placeholder="输入标签后回车"
              aria-label="添加标签"
              onChange={(event) => setTagInput(event.target.value)}
            />
            <button className="button button-ghost detail-tag-submit" type="submit">添加</button>
          </form>
        </div>
      )
    },
    {
      key: 'fileInfo' as const,
      collapsed: collapsedSections.fileInfo,
      title: '文件信息',
      body: (
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
      )
    }
  ];

  return (
    <aside className={`detail-panel-shell ${isCollapsed ? 'detail-panel-shell-collapsed' : ''}`} onWheelCapture={handlePanelWheelCapture}>
      {!isCollapsed ? (
        <div
          className="resize-handle resize-handle-vertical resize-handle-detail"
          aria-hidden="true"
          title="拖动调整信息栏宽度，双击恢复默认"
          onPointerDown={onResizeStart}
          onDoubleClick={onResizeReset}
        />
      ) : null}
      <button
        className={`edge-toggle detail-panel-toggle ${isCollapsed ? 'detail-panel-toggle-collapsed' : ''}`}
        type="button"
        aria-label={isCollapsed ? '展开信息栏' : '收起信息栏'}
        title={isCollapsed ? '展开信息栏' : '收起信息栏'}
        onClick={onTogglePanel}
      >
        <span className="edge-toggle-icon" aria-hidden="true">{isCollapsed ? '‹' : '›'}</span>
      </button>
      <div className={`detail-panel-content ${isCollapsed ? 'detail-panel-content-hidden' : ''}`} aria-hidden={isCollapsed} onWheelCapture={handlePanelWheelCapture}>
        <div className="detail-panel" onWheelCapture={handlePanelWheelCapture}>
          <div className="detail-panel-header">
            <div>
              <span className="detail-eyebrow">当前作品</span>
              <input
                className="detail-title-input"
                type="text"
                value={titleInput}
                placeholder={asset.fileName.replace(/\.[^.]+$/, '')}
                aria-label="作品标题"
                onChange={(event) => setTitleInput(event.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
              />
            </div>
            <div className="detail-panel-header-actions">
              {asset.isFavorite ? <span className="detail-badge detail-badge-favorite">收藏</span> : null}
              {asset.isFeatured ? <span className="detail-badge">精选</span> : null}
              <button className={`button button-ghost detail-action-button ${asset.isFavorite ? 'detail-action-button-active' : ''}`} type="button" onClick={onToggleFavorite}>
                {asset.isFavorite ? '取消收藏' : '加入收藏'}
              </button>
              <button className={`button button-ghost detail-action-button ${asset.isFeatured ? 'detail-action-button-active' : ''}`} type="button" onClick={onToggleFeatured}>
                {asset.isFeatured ? '取消精选' : '设为精选'}
              </button>
            </div>
          </div>
          <p className="detail-description">支持直接编辑标题、说明和标签，修改会自动保存到本地相册索引。</p>
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
            <div className="detail-card">
              <span>光圈</span>
              <strong>{formatAperture(asset.aperture)}</strong>
            </div>
            <div className="detail-card">
              <span>快门</span>
              <strong>{formatShutterSpeed(asset.shutterSpeed)}</strong>
            </div>
            <div className="detail-card">
              <span>ISO</span>
              <strong>{formatIso(asset.iso)}</strong>
            </div>
          </div>
          <div className={`detail-section-stack ${detailSectionStack.isResizing ? 'detail-section-stack-resizing' : ''}`}>
            {detailSections.map((section, index) => {
              const nextSection = detailSections[index + 1] ?? null;
              const dividerId = nextSection ? `${section.key}-${nextSection.key}` : null;
              const shouldShowDivider = nextSection && !section.collapsed && !nextSection.collapsed;

              return (
                <Fragment key={section.key}>
                  <div
                    className={`detail-section-shell ${section.collapsed ? 'detail-section-shell-collapsed' : ''}`}
                    style={section.collapsed
                      ? { height: '48px' }
                      : { minHeight: `${detailSectionStack.sizes[section.key]}px` }}
                  >
                    <div className={`detail-section ${section.collapsed ? 'detail-section-collapsed' : ''}`}>
                      <button className="detail-section-toggle" onClick={() => onToggleSection(section.key)}>
                        <span className="detail-section-title">{section.title}</span>
                        <span>{section.collapsed ? '展开' : '收起'}</span>
                      </button>
                      {!section.collapsed ? section.body : null}
                    </div>
                  </div>
                  {shouldShowDivider ? (
                    <div
                      className={`stack-resize-handle stack-resize-handle-detail ${detailSectionStack.activeDivider === dividerId ? 'stack-resize-handle-active' : ''}`}
                      aria-hidden="true"
                      title="拖动调整上下区块高度，双击恢复默认"
                      onPointerDown={detailSectionStack.beginResize(section.key, nextSection.key)}
                      onDoubleClick={detailSectionStack.resetSizes}
                    />
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}