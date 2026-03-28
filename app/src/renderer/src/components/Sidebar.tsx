import { Fragment, useMemo } from 'react';
import type React from 'react';

import { useResizableSectionStack } from '../hooks';
import type { WarmupProgress } from '../types/ui';
import { folderLabel } from '../utils/library';

type SidebarSectionKey = 'tags' | 'camera' | 'lens';

interface FolderItem {
  path: string;
  count: number;
}

interface TagItem {
  label: string;
  count: number;
}

interface NamedFilterItem {
  label: string;
  count: number;
}

interface SidebarFilterSection {
  key: SidebarSectionKey;
  title: string;
  subtitle: string;
  content: React.ReactNode;
}

interface SidebarProps {
  isSidebarCollapsed: boolean;
  isFolderListCollapsed: boolean;
  activeFolder: string;
  folderItems: FolderItem[];
  favoriteCount: number;
  featuredCount: number;
  favoriteOnly: boolean;
  featuredOnly: boolean;
  activeTag: string | null;
  tagItems: TagItem[];
  activeCamera: string | null;
  cameraItems: NamedFilterItem[];
  activeLens: string | null;
  lensItems: NamedFilterItem[];
  filteredAssetsCount: number;
  totalAssets: number;
  warmupProgress: WarmupProgress;
  previewFailureCount: number;
  isBusy: boolean;
  sectionHeights: Record<string, number>;
  onSectionHeightsChange: (sizes: Record<string, number>) => void;
  onResizeStart: (event: React.PointerEvent<HTMLElement>) => void;
  onResizeReset: (event: React.MouseEvent<HTMLElement>) => void;
  onToggleSidebar: () => void;
  onSelectAllFolders: () => void;
  onToggleFolderList: () => void;
  onSelectFolder: (path: string) => void;
  onToggleFavoriteOnly: () => void;
  onToggleFeaturedOnly: () => void;
  onSelectTag: (label: string | null) => void;
  onSelectCamera: (label: string | null) => void;
  onSelectLens: (label: string | null) => void;
  onRetryFailedPreviews: () => void;
  onImport: (mode: 'files' | 'directory') => void;
}

export function Sidebar({
  isSidebarCollapsed,
  isFolderListCollapsed,
  activeFolder,
  folderItems,
  favoriteCount,
  featuredCount,
  favoriteOnly,
  featuredOnly,
  activeTag,
  tagItems,
  activeCamera,
  cameraItems,
  activeLens,
  lensItems,
  filteredAssetsCount,
  totalAssets,
  warmupProgress,
  previewFailureCount,
  isBusy,
  sectionHeights,
  onSectionHeightsChange,
  onResizeStart,
  onResizeReset,
  onToggleSidebar,
  onSelectAllFolders,
  onToggleFolderList,
  onSelectFolder,
  onToggleFavoriteOnly,
  onToggleFeaturedOnly,
  onSelectTag,
  onSelectCamera,
  onSelectLens,
  onRetryFailedPreviews,
  onImport
}: SidebarProps) {
  const progressPercent = warmupProgress.total > 0
    ? Math.round((warmupProgress.done / warmupProgress.total) * 100)
    : 0;
  const filterSectionDefaults = useMemo<Record<SidebarSectionKey, number>>(() => ({
    tags: 126,
    camera: 164,
    lens: 156
  }), []);
  const filterSectionStack = useResizableSectionStack(
    filterSectionDefaults,
    84,
    sectionHeights as Partial<Record<SidebarSectionKey, number>>,
    (sizes) => onSectionHeightsChange(sizes as Record<string, number>)
  );
  const filterSections = useMemo<SidebarFilterSection[]>(() => {
    const nextSections: SidebarFilterSection[] = [];

    if (tagItems.length > 0) {
      nextSections.push({
        key: 'tags',
        title: '常用标签',
        subtitle: `${tagItems.length} 个`,
        content: (
          <div className="sidebar-tag-list">
            <button className={`sidebar-tag-filter ${activeTag === null ? 'sidebar-tag-filter-active' : ''}`} onClick={() => onSelectTag(null)}>
              <span>全部标签</span>
            </button>
            {tagItems.map((tag) => (
              <button
                key={tag.label}
                className={`sidebar-tag-filter ${activeTag === tag.label ? 'sidebar-tag-filter-active' : ''}`}
                onClick={() => onSelectTag(activeTag === tag.label ? null : tag.label)}
              >
                <span>{tag.label}</span>
                <em>{tag.count}</em>
              </button>
            ))}
          </div>
        )
      });
    }

    if (cameraItems.length > 0) {
      nextSections.push({
        key: 'camera',
        title: '拍摄设备',
        subtitle: `${cameraItems.length} 台`,
        content: (
          <div className="sidebar-tag-list">
            <button className={`sidebar-tag-filter ${activeCamera === null ? 'sidebar-tag-filter-active' : ''}`} onClick={() => onSelectCamera(null)}>
              <span>全部设备</span>
            </button>
            {cameraItems.map((camera) => (
              <button
                key={camera.label}
                className={`sidebar-tag-filter ${activeCamera === camera.label ? 'sidebar-tag-filter-active' : ''}`}
                onClick={() => onSelectCamera(activeCamera === camera.label ? null : camera.label)}
              >
                <span>{camera.label}</span>
                <em>{camera.count}</em>
              </button>
            ))}
          </div>
        )
      });
    }

    if (lensItems.length > 0) {
      nextSections.push({
        key: 'lens',
        title: '镜头',
        subtitle: `${lensItems.length} 支`,
        content: (
          <div className="sidebar-tag-list">
            <button className={`sidebar-tag-filter ${activeLens === null ? 'sidebar-tag-filter-active' : ''}`} onClick={() => onSelectLens(null)}>
              <span>全部镜头</span>
            </button>
            {lensItems.map((lens) => (
              <button
                key={lens.label}
                className={`sidebar-tag-filter ${activeLens === lens.label ? 'sidebar-tag-filter-active' : ''}`}
                onClick={() => onSelectLens(activeLens === lens.label ? null : lens.label)}
              >
                <span>{lens.label}</span>
                <em>{lens.count}</em>
              </button>
            ))}
          </div>
        )
      });
    }

    return nextSections;
  }, [activeCamera, activeLens, activeTag, cameraItems, lensItems, onSelectCamera, onSelectLens, onSelectTag, tagItems]);

  return (
    <div className="sidebar-shell">
      <button
        className={`edge-toggle sidebar-toggle ${isSidebarCollapsed ? 'sidebar-toggle-collapsed' : ''}`}
        type="button"
        title={isSidebarCollapsed ? '展开目录' : '收起目录'}
        aria-label={isSidebarCollapsed ? '展开目录' : '收起目录'}
        onClick={onToggleSidebar}
      >
        <span className="edge-toggle-icon" aria-hidden="true">{isSidebarCollapsed ? '›' : '‹'}</span>
      </button>
      <aside className={`sidebar ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {!isSidebarCollapsed ? (
          <>
            <div
              className="resize-handle resize-handle-vertical resize-handle-sidebar resize-handle-sidebar-top"
              aria-hidden="true"
              title="拖动调整目录栏宽度，双击恢复默认"
              onPointerDown={onResizeStart}
              onDoubleClick={onResizeReset}
            />
            <div
              className="resize-handle resize-handle-vertical resize-handle-sidebar resize-handle-sidebar-bottom"
              aria-hidden="true"
              title="拖动调整目录栏宽度，双击恢复默认"
              onPointerDown={onResizeStart}
              onDoubleClick={onResizeReset}
            />
          </>
        ) : null}
        <div className="sidebar-panel">
        <div className="sidebar-head">
          <div>
            <h2>照片目录</h2>
            <span>{folderItems.length} 个目录 · {filteredAssetsCount} 个结果</span>
          </div>
          <button className="folder-collapse-toggle" onClick={onToggleFolderList}>
            <span>{isFolderListCollapsed ? '▸' : '▾'}</span>
          </button>
        </div>
        {warmupProgress.total > 0 ? (
          <div className="import-progress">
            <div className="import-progress-head">
              <span>{warmupProgress.running ? '正在建立缩略图缓存' : '缩略图缓存已就绪'}</span>
              <em>{progressPercent}%</em>
            </div>
            <div className="import-progress-track">
              <div className="import-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        ) : null}
        {!isFolderListCollapsed ? (
          <div className="sidebar-scroll">
            <section className="sidebar-tag-section">
              <div className="sidebar-subhead">
                <h3>快捷入口</h3>
                <span>回看与展示</span>
              </div>
              <div className="folder-list">
                <button className={`folder-item ${favoriteOnly ? 'folder-item-active' : ''}`} onClick={onToggleFavoriteOnly}>
                  <span>收藏作品</span>
                  <em>{favoriteCount}</em>
                </button>
                <button className={`folder-item ${featuredOnly ? 'folder-item-active' : ''}`} onClick={onToggleFeaturedOnly}>
                  <span>精选作品</span>
                  <em>{featuredCount}</em>
                </button>
              </div>
            </section>
            <button className={`folder-item ${activeFolder === 'all' ? 'folder-item-active' : ''}`} onClick={onSelectAllFolders}>
              <span>全部照片</span>
              <em>{totalAssets}</em>
            </button>
            <div className="folder-list">
              {folderItems.map((folder) => (
                <button
                  key={folder.path}
                  className={`folder-item ${activeFolder === folder.path ? 'folder-item-active' : ''}`}
                  onClick={() => onSelectFolder(folder.path)}
                  title={folder.path}
                >
                  <span>{folderLabel(folder.path)}</span>
                  <em>{folder.count}</em>
                </button>
              ))}
            </div>
            {filterSections.length > 0 ? (
              <div className={`sidebar-section-stack ${filterSectionStack.isResizing ? 'sidebar-section-stack-resizing' : ''}`}>
                {filterSections.map((section, index) => {
                  const nextSection = filterSections[index + 1] ?? null;
                  const dividerId = nextSection ? `${section.key}-${nextSection.key}` : null;

                  return (
                    <Fragment key={section.key}>
                      <section
                        className="sidebar-tag-section sidebar-tag-section-resizable"
                        style={{ minHeight: `${filterSectionStack.sizes[section.key]}px` }}
                      >
                        <div className="sidebar-subhead">
                          <h3>{section.title}</h3>
                          <span>{section.subtitle}</span>
                        </div>
                        <div className="sidebar-section-body">
                          {section.content}
                        </div>
                      </section>
                      {nextSection ? (
                        <div
                          className={`stack-resize-handle ${filterSectionStack.activeDivider === dividerId ? 'stack-resize-handle-active' : ''}`}
                          aria-hidden="true"
                          title="拖动调整上下区块高度，双击恢复默认"
                          onPointerDown={filterSectionStack.beginResize(section.key, nextSection.key)}
                          onDoubleClick={filterSectionStack.resetSizes}
                        />
                      ) : null}
                    </Fragment>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        {previewFailureCount > 0 ? (
          <div className="hint-actions">
            <p className="hint-line">有 {previewFailureCount} 个文件暂时无法预览，可能是格式或权限问题。</p>
            <button className="button button-ghost button-inline" onClick={onRetryFailedPreviews}>重新尝试</button>
          </div>
        ) : null}
        <div className="sidebar-footer">
          <div className="sidebar-import-actions">
            <button className="button button-primary" onClick={() => onImport('directory')} disabled={isBusy}>添加目录</button>
            <button className="button button-secondary" onClick={() => onImport('files')} disabled={isBusy}>导入照片</button>
          </div>
        </div>
        </div>
      </aside>
    </div>
  );
}