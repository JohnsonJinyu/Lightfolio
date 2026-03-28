import type { WarmupProgress } from '../types/ui';
import { folderLabel } from '../utils/library';

interface FolderItem {
  path: string;
  count: number;
}

interface SidebarProps {
  isSidebarCollapsed: boolean;
  isFolderListCollapsed: boolean;
  activeFolder: string;
  folderItems: FolderItem[];
  filteredAssetsCount: number;
  totalAssets: number;
  warmupProgress: WarmupProgress;
  previewFailureCount: number;
  isBusy: boolean;
  onToggleSidebar: () => void;
  onSelectAllFolders: () => void;
  onToggleFolderList: () => void;
  onSelectFolder: (path: string) => void;
  onRetryFailedPreviews: () => void;
  onImport: (mode: 'files' | 'directory') => void;
}

export function Sidebar({
  isSidebarCollapsed,
  isFolderListCollapsed,
  activeFolder,
  folderItems,
  filteredAssetsCount,
  totalAssets,
  warmupProgress,
  previewFailureCount,
  isBusy,
  onToggleSidebar,
  onSelectAllFolders,
  onToggleFolderList,
  onSelectFolder,
  onRetryFailedPreviews,
  onImport
}: SidebarProps) {
  const progressPercent = warmupProgress.total > 0
    ? Math.round((warmupProgress.done / warmupProgress.total) * 100)
    : 0;

  return (
    <aside className={`sidebar ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <button
        className={`edge-toggle sidebar-toggle ${isSidebarCollapsed ? 'sidebar-toggle-collapsed' : ''}`}
        type="button"
        title={isSidebarCollapsed ? '展开目录' : '收起目录'}
        aria-label={isSidebarCollapsed ? '展开目录' : '收起目录'}
        onClick={onToggleSidebar}
      >
        <span className="edge-toggle-icon" aria-hidden="true">{isSidebarCollapsed ? '›' : '‹'}</span>
      </button>
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
  );
}