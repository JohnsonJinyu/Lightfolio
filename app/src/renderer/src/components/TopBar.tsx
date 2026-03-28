import type { BrowserFilters, MediaFilter, ViewMode } from '../types/ui';

interface TopBarProps {
  activeSource: string;
  totalAssets: number;
  filteredAssetsCount: number;
  viewMode: ViewMode;
  waterfallTileSize: 'small' | 'medium' | 'large';
  filters: BrowserFilters;
  hasActiveFilters: boolean;
  onShowShortcutHelp: () => void;
  onClearFilters: () => void;
  onSearchQueryChange: (value: string) => void;
  onMediaFilterChange: (value: MediaFilter) => void;
  onFavoriteOnlyChange: (value: boolean) => void;
  onFeaturedOnlyChange: (value: boolean) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onWaterfallTileSizeChange: (size: 'small' | 'medium' | 'large') => void;
}

export function TopBar({
  activeSource,
  totalAssets,
  filteredAssetsCount,
  viewMode,
  waterfallTileSize,
  filters,
  hasActiveFilters,
  onShowShortcutHelp,
  onClearFilters,
  onSearchQueryChange,
  onMediaFilterChange,
  onFavoriteOnlyChange,
  onFeaturedOnlyChange,
  onViewModeChange,
  onWaterfallTileSizeChange
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <h1>Lightfolio</h1>
        <p>{activeSource} · {filteredAssetsCount}/{totalAssets} 个资源</p>
      </div>
      <div className="topbar-actions">
        <div className="topbar-search-shell">
          <input
            className="topbar-search-input"
            type="search"
            value={filters.searchQuery}
            placeholder="搜索标题、说明、标签、设备..."
            aria-label="搜索作品"
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </div>
        <div className="view-switch" role="group" aria-label="媒体类型筛选">
          <button className={`button button-tab ${filters.mediaFilter === 'all' ? 'button-tab-active' : ''}`} onClick={() => onMediaFilterChange('all')}>
            全部
          </button>
          <button className={`button button-tab ${filters.mediaFilter === 'image' ? 'button-tab-active' : ''}`} onClick={() => onMediaFilterChange('image')}>
            照片
          </button>
          <button className={`button button-tab ${filters.mediaFilter === 'video' ? 'button-tab-active' : ''}`} onClick={() => onMediaFilterChange('video')}>
            视频
          </button>
        </div>
        <button className={`button button-ghost ${filters.favoriteOnly ? 'button-tab-active' : ''}`} onClick={() => onFavoriteOnlyChange(!filters.favoriteOnly)}>
          {filters.favoriteOnly ? '仅看收藏中' : '仅看收藏'}
        </button>
        <button className={`button button-ghost ${filters.featuredOnly ? 'button-tab-active' : ''}`} onClick={() => onFeaturedOnlyChange(!filters.featuredOnly)}>
          {filters.featuredOnly ? '仅看精选中' : '仅看精选'}
        </button>
        {hasActiveFilters ? (
          <button className="button button-ghost" onClick={onClearFilters}>清空筛选</button>
        ) : null}
        {viewMode === 'waterfall' ? (
          <div className="topbar-size-switch view-switch" role="group" aria-label="瀑布流照片大小">
            <span className="topbar-size-switch-label">照片大小</span>
            <button className={`button button-tab ${waterfallTileSize === 'small' ? 'button-tab-active' : ''}`} onClick={() => onWaterfallTileSizeChange('small')}>
              紧凑
            </button>
            <button className={`button button-tab ${waterfallTileSize === 'medium' ? 'button-tab-active' : ''}`} onClick={() => onWaterfallTileSizeChange('medium')}>
              标准
            </button>
            <button className={`button button-tab ${waterfallTileSize === 'large' ? 'button-tab-active' : ''}`} onClick={() => onWaterfallTileSizeChange('large')}>
              放大
            </button>
            <span className="topbar-size-switch-hint">Ctrl + 滚轮</span>
          </div>
        ) : null}
        <button className="button button-ghost" onClick={onShowShortcutHelp}>快捷键</button>
        <div className="view-switch">
          <button className={`button button-tab ${viewMode === 'single' ? 'button-tab-active' : ''}`} onClick={() => onViewModeChange('single')}>
            单图
          </button>
          <button className={`button button-tab ${viewMode === 'waterfall' ? 'button-tab-active' : ''}`} onClick={() => onViewModeChange('waterfall')}>
            瀑布流
          </button>
        </div>
      </div>
    </header>
  );
}