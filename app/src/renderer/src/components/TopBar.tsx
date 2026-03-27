import type { ViewMode } from '../types/ui';

interface TopBarProps {
  activeSource: string;
  totalAssets: number;
  viewMode: ViewMode;
  removedAssetsCount: number;
  isBusy: boolean;
  onShowShortcutHelp: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onRestoreAll: () => void;
}

export function TopBar({
  activeSource,
  totalAssets,
  viewMode,
  removedAssetsCount,
  isBusy,
  onShowShortcutHelp,
  onViewModeChange,
  onRestoreAll
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <h1>Lightfolio</h1>
        <p>{activeSource} · {totalAssets} 个资源</p>
      </div>
      <div className="topbar-actions">
        <button className="button button-ghost" onClick={onShowShortcutHelp}>快捷键</button>
        <div className="view-switch">
          <button className={`button button-tab ${viewMode === 'single' ? 'button-tab-active' : ''}`} onClick={() => onViewModeChange('single')}>
            单图
          </button>
          <button className={`button button-tab ${viewMode === 'waterfall' ? 'button-tab-active' : ''}`} onClick={() => onViewModeChange('waterfall')}>
            瀑布流
          </button>
        </div>
        {removedAssetsCount > 0 ? (
          <button className="button button-ghost" onClick={onRestoreAll} disabled={isBusy}>恢复已移除 {removedAssetsCount}</button>
        ) : null}
      </div>
    </header>
  );
}