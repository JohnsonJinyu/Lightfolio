using System.Collections.ObjectModel;
using System.Globalization;
using System.IO;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Lightfolio.Contracts.Models;
using Lightfolio.WinUI.Services;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media.Imaging;
using Windows.Media.Core;

namespace Lightfolio.WinUI.ViewModels;

public sealed partial class ShellViewModel : ObservableObject
{
    private const double ExpandedSidebarWidth = 296;
    private const double CollapsedSidebarWidth = 60;
    private const double ExpandedDetailWidth = 332;
    private const double CollapsedDetailWidth = 60;
    private const double ExpandedFilmstripHeight = 164;
    private const double CollapsedFilmstripHeight = 44;

    private readonly ILibrarySnapshotService _librarySnapshotService;
    private readonly List<AssetItemViewModel> _visibleAssets = new();
    private bool _hasLoaded;
    private LibrarySnapshot? _snapshot;
    private bool _isLoading;
    private bool _isViewerMode;
    private string _libraryStatus = "等待加载本地图库";
    private string _snapshotPath = string.Empty;
    private string _assetCountText = "0";
    private string _visibleAssetCountText = "0";
    private string _favoriteCountText = "0";
    private string _featuredCountText = "0";
    private string _removedCountText = "0";
    private string _monthGroupCountText = "0";
    private string _visibleMonthGroupCountText = "0";
    private string _searchQuery = string.Empty;
    private string _selectedMediaFilter = "all";
    private string _selectedCameraFilter = "all";
    private string _selectedLensFilter = "all";
    private bool _isFavoriteFilterActive;
    private bool _isFeaturedFilterActive;
    private bool _isSidebarCollapsed;
    private bool _isDetailPanelCollapsed;
    private bool _isFilmstripCollapsed;
    private bool _isImporting;
    private string _activeFilterSummary = "当前未启用筛选条件。";
    private string _selectedTitle = "当前没有选中资源";
    private string _selectedSubtitle = "WinUI 3 首屏骨架已接入，接下来迁移时间轴和单图查看。";
    private string _selectedPath = "-";
    private string _selectedTechnicalInfo = "-";
    private string _selectedTags = "-";
    private string _selectedKindText = "-";
    private string _selectedCaptureInfo = "-";
    private string _selectedExposureInfo = "-";
    private string _selectedLocationText = "-";
    private string _selectedImportedAtText = "-";
    private string _selectedStatusSummary = "当前没有选中资源。";
    private string _selectedPositionText = "当前没有可浏览的资源。";
    private string _zoomFactorText = "100%";
    private BitmapImage? _selectedPreviewSource;
    private MediaSource? _selectedVideoSource;
    private string _selectedPreviewFallbackTitle = "当前没有可查看的预览";
    private string _selectedPreviewFallbackDescription = "先在时间轴中选择一项，下一步会继续补齐缩放、平移和视频播放。";
    private AssetItemViewModel? _selectedAsset;

    public ShellViewModel(ILibrarySnapshotService librarySnapshotService)
    {
        _librarySnapshotService = librarySnapshotService;
    }

    public ObservableCollection<AssetItemViewModel> Assets { get; } = new();

    public ObservableCollection<TimelineGroupViewModel> TimelineGroups { get; } = new();

    public ObservableCollection<AssetItemViewModel> FilmstripAssets { get; } = new();

    public ObservableCollection<string> MediaFilterOptions { get; } = new() { "all", "image", "video" };

    public ObservableCollection<string> CameraFilterOptions { get; } = new() { "all" };

    public ObservableCollection<string> LensFilterOptions { get; } = new() { "all" };

    public bool IsViewerMode
    {
        get => _isViewerMode;
        private set
        {
            if (!SetProperty(ref _isViewerMode, value))
            {
                return;
            }

            OnPropertyChanged(nameof(BrowserVisibility));
            OnPropertyChanged(nameof(ViewerVisibility));
            OnPropertyChanged(nameof(ShellModeText));
        }
    }

    public Visibility BrowserVisibility => IsViewerMode ? Visibility.Collapsed : Visibility.Visible;

    public Visibility ViewerVisibility => IsViewerMode ? Visibility.Visible : Visibility.Collapsed;

    public string ShellModeText => IsViewerMode ? "查看模式" : "时间轴浏览";

    public bool IsSidebarCollapsed
    {
        get => _isSidebarCollapsed;
        private set
        {
            if (!SetProperty(ref _isSidebarCollapsed, value))
            {
                return;
            }

            OnPropertyChanged(nameof(SidebarColumnWidth));
            OnPropertyChanged(nameof(SidebarExpandedVisibility));
            OnPropertyChanged(nameof(SidebarCollapsedVisibility));
            OnPropertyChanged(nameof(SidebarToggleGlyph));
        }
    }

    public bool IsDetailPanelCollapsed
    {
        get => _isDetailPanelCollapsed;
        private set
        {
            if (!SetProperty(ref _isDetailPanelCollapsed, value))
            {
                return;
            }

            OnPropertyChanged(nameof(DetailColumnWidth));
            OnPropertyChanged(nameof(DetailExpandedVisibility));
            OnPropertyChanged(nameof(DetailCollapsedVisibility));
            OnPropertyChanged(nameof(DetailToggleGlyph));
        }
    }

    public bool IsFilmstripCollapsed
    {
        get => _isFilmstripCollapsed;
        private set
        {
            if (!SetProperty(ref _isFilmstripCollapsed, value))
            {
                return;
            }

            OnPropertyChanged(nameof(FilmstripRowHeight));
            OnPropertyChanged(nameof(FilmstripExpandedVisibility));
            OnPropertyChanged(nameof(FilmstripCollapsedVisibility));
            OnPropertyChanged(nameof(FilmstripToggleGlyph));
        }
    }

    public GridLength SidebarColumnWidth => new(IsSidebarCollapsed ? CollapsedSidebarWidth : ExpandedSidebarWidth);

    public GridLength DetailColumnWidth => new(IsDetailPanelCollapsed ? CollapsedDetailWidth : ExpandedDetailWidth);

    public GridLength FilmstripRowHeight => new(IsFilmstripCollapsed ? CollapsedFilmstripHeight : ExpandedFilmstripHeight);

    public Visibility SidebarExpandedVisibility => IsSidebarCollapsed ? Visibility.Collapsed : Visibility.Visible;

    public Visibility SidebarCollapsedVisibility => IsSidebarCollapsed ? Visibility.Visible : Visibility.Collapsed;

    public Visibility DetailExpandedVisibility => IsDetailPanelCollapsed ? Visibility.Collapsed : Visibility.Visible;

    public Visibility DetailCollapsedVisibility => IsDetailPanelCollapsed ? Visibility.Visible : Visibility.Collapsed;

    public Visibility FilmstripExpandedVisibility => IsFilmstripCollapsed ? Visibility.Collapsed : Visibility.Visible;

    public Visibility FilmstripCollapsedVisibility => IsFilmstripCollapsed ? Visibility.Visible : Visibility.Collapsed;

    public string SidebarToggleGlyph => IsSidebarCollapsed ? ">" : "<";

    public string DetailToggleGlyph => IsDetailPanelCollapsed ? "<" : ">";

    public string FilmstripToggleGlyph => IsFilmstripCollapsed ? "^" : "v";

    public bool HasSelection => SelectedAsset is not null;

    public bool CanGoPrevious => HasSelection && GetSelectedAssetIndex() > 0;

    public bool CanGoNext
    {
        get
        {
            var currentIndex = GetSelectedAssetIndex();
            return currentIndex >= 0 && currentIndex < _visibleAssets.Count - 1;
        }
    }

    public bool IsLoading
    {
        get => _isLoading;
        private set => SetProperty(ref _isLoading, value);
    }

    public bool IsImporting
    {
        get => _isImporting;
        private set => SetProperty(ref _isImporting, value);
    }

    public string LibraryStatus
    {
        get => _libraryStatus;
        private set => SetProperty(ref _libraryStatus, value);
    }

    public string SnapshotPath
    {
        get => _snapshotPath;
        private set => SetProperty(ref _snapshotPath, value);
    }

    public string AssetCountText
    {
        get => _assetCountText;
        private set => SetProperty(ref _assetCountText, value);
    }

    public string VisibleAssetCountText
    {
        get => _visibleAssetCountText;
        private set => SetProperty(ref _visibleAssetCountText, value);
    }

    public string FavoriteCountText
    {
        get => _favoriteCountText;
        private set => SetProperty(ref _favoriteCountText, value);
    }

    public string FeaturedCountText
    {
        get => _featuredCountText;
        private set => SetProperty(ref _featuredCountText, value);
    }

    public string RemovedCountText
    {
        get => _removedCountText;
        private set => SetProperty(ref _removedCountText, value);
    }

    public string MonthGroupCountText
    {
        get => _monthGroupCountText;
        private set => SetProperty(ref _monthGroupCountText, value);
    }

    public string VisibleMonthGroupCountText
    {
        get => _visibleMonthGroupCountText;
        private set => SetProperty(ref _visibleMonthGroupCountText, value);
    }

    public string SearchQuery
    {
        get => _searchQuery;
        set
        {
            if (!SetProperty(ref _searchQuery, value))
            {
                return;
            }

            RebuildVisibleState();
            _ = PersistSnapshotAsync();
        }
    }

    public string SelectedMediaFilter
    {
        get => _selectedMediaFilter;
        set
        {
            if (!SetProperty(ref _selectedMediaFilter, value))
            {
                return;
            }

            OnPropertyChanged(nameof(SelectedMediaFilterLabel));
            RebuildVisibleState();
            _ = PersistSnapshotAsync();
        }
    }

    public string SelectedCameraFilter
    {
        get => _selectedCameraFilter;
        set
        {
            if (!SetProperty(ref _selectedCameraFilter, value))
            {
                return;
            }

            OnPropertyChanged(nameof(SelectedCameraFilterLabel));
            RebuildVisibleState();
            _ = PersistSnapshotAsync();
        }
    }

    public string SelectedLensFilter
    {
        get => _selectedLensFilter;
        set
        {
            if (!SetProperty(ref _selectedLensFilter, value))
            {
                return;
            }

            OnPropertyChanged(nameof(SelectedLensFilterLabel));
            RebuildVisibleState();
            _ = PersistSnapshotAsync();
        }
    }

    public bool IsFavoriteFilterActive
    {
        get => _isFavoriteFilterActive;
        private set
        {
            if (!SetProperty(ref _isFavoriteFilterActive, value))
            {
                return;
            }

            OnPropertyChanged(nameof(FavoriteFilterButtonText));
        }
    }

    public bool IsFeaturedFilterActive
    {
        get => _isFeaturedFilterActive;
        private set
        {
            if (!SetProperty(ref _isFeaturedFilterActive, value))
            {
                return;
            }

            OnPropertyChanged(nameof(FeaturedFilterButtonText));
        }
    }

    public string FavoriteFilterButtonText => IsFavoriteFilterActive ? "仅收藏: 开" : "仅收藏: 关";

    public string FeaturedFilterButtonText => IsFeaturedFilterActive ? "仅精选: 开" : "仅精选: 关";

    public string SelectedMediaFilterLabel => SelectedMediaFilter switch
    {
        "image" => "仅照片",
        "video" => "仅视频",
        _ => "全部媒体"
    };

    public string SelectedCameraFilterLabel => SelectedCameraFilter == "all" ? "全部设备" : SelectedCameraFilter;

    public string SelectedLensFilterLabel => SelectedLensFilter == "all" ? "全部镜头" : SelectedLensFilter;

    public string ActiveFilterSummary
    {
        get => _activeFilterSummary;
        private set => SetProperty(ref _activeFilterSummary, value);
    }

    public string SelectedTitle
    {
        get => _selectedTitle;
        private set => SetProperty(ref _selectedTitle, value);
    }

    public string SelectedSubtitle
    {
        get => _selectedSubtitle;
        private set => SetProperty(ref _selectedSubtitle, value);
    }

    public string SelectedPath
    {
        get => _selectedPath;
        private set => SetProperty(ref _selectedPath, value);
    }

    public string SelectedTechnicalInfo
    {
        get => _selectedTechnicalInfo;
        private set => SetProperty(ref _selectedTechnicalInfo, value);
    }

    public string SelectedTags
    {
        get => _selectedTags;
        private set => SetProperty(ref _selectedTags, value);
    }

    public string SelectedKindText
    {
        get => _selectedKindText;
        private set => SetProperty(ref _selectedKindText, value);
    }

    public string SelectedCaptureInfo
    {
        get => _selectedCaptureInfo;
        private set => SetProperty(ref _selectedCaptureInfo, value);
    }

    public string SelectedExposureInfo
    {
        get => _selectedExposureInfo;
        private set => SetProperty(ref _selectedExposureInfo, value);
    }

    public string SelectedLocationText
    {
        get => _selectedLocationText;
        private set => SetProperty(ref _selectedLocationText, value);
    }

    public string SelectedImportedAtText
    {
        get => _selectedImportedAtText;
        private set => SetProperty(ref _selectedImportedAtText, value);
    }

    public string SelectedStatusSummary
    {
        get => _selectedStatusSummary;
        private set => SetProperty(ref _selectedStatusSummary, value);
    }

    public string SelectedPositionText
    {
        get => _selectedPositionText;
        private set => SetProperty(ref _selectedPositionText, value);
    }

    public string ZoomFactorText
    {
        get => _zoomFactorText;
        private set => SetProperty(ref _zoomFactorText, value);
    }

    public BitmapImage? SelectedPreviewSource
    {
        get => _selectedPreviewSource;
        private set
        {
            if (!SetProperty(ref _selectedPreviewSource, value))
            {
                return;
            }

            OnPropertyChanged(nameof(PreviewImageVisibility));
            OnPropertyChanged(nameof(PreviewFallbackVisibility));
        }
    }

    public MediaSource? SelectedVideoSource
    {
        get => _selectedVideoSource;
        private set
        {
            if (!SetProperty(ref _selectedVideoSource, value))
            {
                return;
            }

            OnPropertyChanged(nameof(VideoVisibility));
            OnPropertyChanged(nameof(PreviewFallbackVisibility));
        }
    }

    public Visibility PreviewImageVisibility => SelectedPreviewSource is null ? Visibility.Collapsed : Visibility.Visible;

    public Visibility VideoVisibility => SelectedVideoSource is null ? Visibility.Collapsed : Visibility.Visible;

    public Visibility PreviewFallbackVisibility => SelectedPreviewSource is null && SelectedVideoSource is null ? Visibility.Visible : Visibility.Collapsed;

    public string SelectedPreviewFallbackTitle
    {
        get => _selectedPreviewFallbackTitle;
        private set => SetProperty(ref _selectedPreviewFallbackTitle, value);
    }

    public string SelectedPreviewFallbackDescription
    {
        get => _selectedPreviewFallbackDescription;
        private set => SetProperty(ref _selectedPreviewFallbackDescription, value);
    }

    public AssetItemViewModel? SelectedAsset
    {
        get => _selectedAsset;
        set
        {
            if (!SetProperty(ref _selectedAsset, value))
            {
                return;
            }

            UpdateSelectedAssetDetails(value);
            _ = PersistSnapshotAsync();
        }
    }

    public async Task EnsureLoadedAsync()
    {
        if (_hasLoaded)
        {
            return;
        }

        _hasLoaded = true;
        await LoadAsync();
    }

    [RelayCommand]
    private async Task ReloadAsync()
    {
        await LoadAsync();
    }

    [RelayCommand]
    private async Task ImportFilesAsync()
    {
        if (IsImporting || App.MainWindowHandle == 0)
        {
            return;
        }

        IsImporting = true;

        try
        {
            var result = await _librarySnapshotService.ImportFilesAsync(App.MainWindowHandle);
            if (result is null)
            {
                return;
            }

            _snapshot = result.Snapshot;
            await LoadAsync();
        }
        finally
        {
            IsImporting = false;
        }
    }

    [RelayCommand]
    private async Task ImportFolderAsync()
    {
        if (IsImporting || App.MainWindowHandle == 0)
        {
            return;
        }

        IsImporting = true;

        try
        {
            var result = await _librarySnapshotService.ImportFolderAsync(App.MainWindowHandle);
            if (result is null)
            {
                return;
            }

            _snapshot = result.Snapshot;
            await LoadAsync();
        }
        finally
        {
            IsImporting = false;
        }
    }

    [RelayCommand]
    private void ToggleFavoriteFilter()
    {
        IsFavoriteFilterActive = !IsFavoriteFilterActive;
        RebuildVisibleState();
        _ = PersistSnapshotAsync();
    }

    [RelayCommand]
    private void ToggleFeaturedFilter()
    {
        IsFeaturedFilterActive = !IsFeaturedFilterActive;
        RebuildVisibleState();
        _ = PersistSnapshotAsync();
    }

    [RelayCommand]
    private void ToggleSidebar()
    {
        IsSidebarCollapsed = !IsSidebarCollapsed;
        _ = PersistSnapshotAsync();
    }

    [RelayCommand]
    private void ToggleDetailPanel()
    {
        IsDetailPanelCollapsed = !IsDetailPanelCollapsed;
        _ = PersistSnapshotAsync();
    }

    [RelayCommand]
    private void ToggleFilmstrip()
    {
        IsFilmstripCollapsed = !IsFilmstripCollapsed;
        _ = PersistSnapshotAsync();
    }

    [RelayCommand]
    private void ClearFilters()
    {
        SearchQuery = string.Empty;
        SelectedMediaFilter = "all";
        SelectedCameraFilter = "all";
        SelectedLensFilter = "all";
        IsFavoriteFilterActive = false;
        IsFeaturedFilterActive = false;
        RebuildVisibleState();
        _ = PersistSnapshotAsync();
    }

    [RelayCommand]
    private void EnterViewerMode()
    {
        if (SelectedAsset is null)
        {
            return;
        }

        IsViewerMode = true;
        UpdateZoomFactor(1.0f);
        _ = PersistSnapshotAsync();
    }

    [RelayCommand]
    private void ExitViewerMode()
    {
        IsViewerMode = false;
        UpdateZoomFactor(1.0f);
        _ = PersistSnapshotAsync();
    }

    [RelayCommand]
    private void GoToPreviousAsset()
    {
        var currentIndex = GetSelectedAssetIndex();
        if (currentIndex <= 0)
        {
            return;
        }

        SelectedAsset = _visibleAssets[currentIndex - 1];
        IsViewerMode = true;
        UpdateZoomFactor(1.0f);
    }

    [RelayCommand]
    private void GoToNextAsset()
    {
        var currentIndex = GetSelectedAssetIndex();
        if (currentIndex < 0 || currentIndex >= _visibleAssets.Count - 1)
        {
            return;
        }

        SelectedAsset = _visibleAssets[currentIndex + 1];
        IsViewerMode = true;
        UpdateZoomFactor(1.0f);
    }

    public void OpenAsset(AssetItemViewModel asset)
    {
        SelectedAsset = asset;
        IsViewerMode = true;
        UpdateZoomFactor(1.0f);
    }

    public void ShowViewer()
    {
        EnterViewerMode();
    }

    public void HideViewer()
    {
        ExitViewerMode();
    }

    public void SelectPreviousAsset()
    {
        GoToPreviousAsset();
    }

    public void SelectNextAsset()
    {
        GoToNextAsset();
    }

    public void UpdateZoomFactor(float zoomFactor)
    {
        var percentage = Math.Round(zoomFactor * 100);
        ZoomFactorText = $"{percentage:0}%";
    }

    private void UpdateSelectedAssetDetails(AssetItemViewModel? value)
    {
        if (value is null)
        {
            SelectedTitle = "当前没有选中资源";
            SelectedSubtitle = "你可以先导入目录，或者继续把现有 Electron 数据层迁到 C#。";
            SelectedPath = "-";
            SelectedTechnicalInfo = "-";
            SelectedTags = "-";
            SelectedKindText = "-";
            SelectedCaptureInfo = "-";
            SelectedExposureInfo = "-";
            SelectedLocationText = "-";
            SelectedImportedAtText = "-";
            SelectedStatusSummary = "当前没有选中资源。";
            ZoomFactorText = "100%";
            SelectedPreviewSource = null;
            SelectedVideoSource = null;
            SelectedPreviewFallbackTitle = "当前没有可查看的预览";
            SelectedPreviewFallbackDescription = "先在时间轴中选择一项，下一步会继续补齐缩放、平移和视频播放。";
            UpdateSelectionPosition();
            NotifySelectionStateChanged();
            return;
        }

        var asset = value.Asset;
        SelectedTitle = value.Title;
        SelectedSubtitle = string.IsNullOrWhiteSpace(asset.Caption?.Body)
            ? value.Subtitle
            : asset.Caption.Body!;
        SelectedPath = string.IsNullOrWhiteSpace(asset.FilePath) ? "-" : asset.FilePath;
        SelectedTechnicalInfo = BuildTechnicalInfo(asset);
        SelectedTags = asset.Tags.Count == 0
            ? "-"
            : string.Join(" / ", asset.Tags.Select(static tag => tag.Label));
        SelectedKindText = asset.Kind == "video" ? "视频" : "照片";
        SelectedCaptureInfo = BuildCaptureInfo(asset);
        SelectedExposureInfo = BuildExposureInfo(asset);
        SelectedLocationText = BuildLocationInfo(asset);
        SelectedImportedAtText = FormatDateTime(asset.ImportedAt);
        SelectedStatusSummary = BuildStatusSummary(asset);
        UpdateSelectedPreview(asset);
        UpdateSelectionPosition();
        NotifySelectionStateChanged();
    }

    public void HandlePreviewOpened()
    {
        if (SelectedAsset is null)
        {
            return;
        }

        SelectedPreviewFallbackTitle = "预览已就绪";
        SelectedPreviewFallbackDescription = "当前图片已经接入真实位图加载，下一步继续补缩放、平移和渐进式加载。";
    }

    public void HandlePreviewFailed()
    {
        SelectedPreviewSource = null;
        SelectedPreviewFallbackTitle = "图片加载失败";
        SelectedPreviewFallbackDescription = "文件路径已存在于快照中，但 WinUI 当前无法直接打开这张图片。后续会补重试和缓存兜底。";
    }

    public void HandleVideoPlaybackFailed()
    {
        SelectedVideoSource = null;
        SelectedPreviewFallbackTitle = "视频加载失败";
        SelectedPreviewFallbackDescription = "文件路径已存在于快照中，但 WinUI 当前无法直接播放这段视频。后续会补更稳的媒体兜底。";
    }

    private async Task LoadAsync()
    {
        IsLoading = true;

        try
        {
            var result = await _librarySnapshotService.LoadAsync();
            _snapshot = result.Snapshot;

            SnapshotPath = result.SourcePath;
            LibraryStatus = result.SnapshotFound
                ? "已发现现有快照，WinUI 首屏正在复用 Electron 保存的本地状态。"
                : "未发现现有快照，当前显示空库骨架。后续导入链路会直接写入 WinUI 本地库。";

            Assets.Clear();
            TimelineGroups.Clear();

            var assets = result.Snapshot.ImportState?.Assets ?? new List<AssetRecord>();
            foreach (var asset in assets)
            {
                Assets.Add(new AssetItemViewModel(asset));
            }

            _searchQuery = result.Snapshot.UiState.SearchQuery?.Trim() ?? string.Empty;
            _selectedMediaFilter = string.IsNullOrWhiteSpace(result.Snapshot.UiState.MediaFilter) ? "all" : result.Snapshot.UiState.MediaFilter!;
            _selectedCameraFilter = string.IsNullOrWhiteSpace(result.Snapshot.UiState.ActiveCamera) ? "all" : result.Snapshot.UiState.ActiveCamera!;
            _selectedLensFilter = string.IsNullOrWhiteSpace(result.Snapshot.UiState.ActiveLens) ? "all" : result.Snapshot.UiState.ActiveLens!;
            _isFavoriteFilterActive = result.Snapshot.UiState.FavoriteOnly;
            _isFeaturedFilterActive = result.Snapshot.UiState.FeaturedOnly;
            _isSidebarCollapsed = result.Snapshot.UiState.IsSidebarCollapsed;
            _isDetailPanelCollapsed = result.Snapshot.UiState.IsDetailPanelCollapsed;
            _isFilmstripCollapsed = result.Snapshot.UiState.IsFilmstripCollapsed;
            OnPropertyChanged(nameof(SearchQuery));
            OnPropertyChanged(nameof(SelectedMediaFilter));
            OnPropertyChanged(nameof(SelectedMediaFilterLabel));
            OnPropertyChanged(nameof(SelectedCameraFilter));
            OnPropertyChanged(nameof(SelectedCameraFilterLabel));
            OnPropertyChanged(nameof(SelectedLensFilter));
            OnPropertyChanged(nameof(SelectedLensFilterLabel));
            OnPropertyChanged(nameof(IsFavoriteFilterActive));
            OnPropertyChanged(nameof(IsFeaturedFilterActive));
            OnPropertyChanged(nameof(FavoriteFilterButtonText));
            OnPropertyChanged(nameof(FeaturedFilterButtonText));
            OnPropertyChanged(nameof(IsSidebarCollapsed));
            OnPropertyChanged(nameof(SidebarColumnWidth));
            OnPropertyChanged(nameof(SidebarExpandedVisibility));
            OnPropertyChanged(nameof(SidebarCollapsedVisibility));
            OnPropertyChanged(nameof(SidebarToggleGlyph));
            OnPropertyChanged(nameof(IsDetailPanelCollapsed));
            OnPropertyChanged(nameof(DetailColumnWidth));
            OnPropertyChanged(nameof(DetailExpandedVisibility));
            OnPropertyChanged(nameof(DetailCollapsedVisibility));
            OnPropertyChanged(nameof(DetailToggleGlyph));
            OnPropertyChanged(nameof(IsFilmstripCollapsed));
            OnPropertyChanged(nameof(FilmstripRowHeight));
            OnPropertyChanged(nameof(FilmstripExpandedVisibility));
            OnPropertyChanged(nameof(FilmstripCollapsedVisibility));
            OnPropertyChanged(nameof(FilmstripToggleGlyph));

            AssetCountText = assets.Count.ToString();
            FavoriteCountText = assets.Count(static asset => asset.IsFavorite).ToString();
            FeaturedCountText = assets.Count(static asset => asset.IsFeatured).ToString();
            RemovedCountText = result.Snapshot.RemovedFromAlbumIds.Count.ToString();
            MonthGroupCountText = (result.Snapshot.ImportState?.Timeline.Count ?? 0).ToString();
            UpdateFilterOptions(assets);

            RebuildVisibleState();

            IsViewerMode = string.Equals(result.Snapshot.UiState.ViewMode, "single", StringComparison.OrdinalIgnoreCase)
                && SelectedAsset is not null;
            UpdateZoomFactor(1.0f);
        }
        finally
        {
            IsLoading = false;
        }
    }

    private void RebuildVisibleState()
    {
        var visibleGroups = BuildVisibleGroups();

        TimelineGroups.Clear();
        foreach (var group in visibleGroups)
        {
            TimelineGroups.Add(group);
        }

        _visibleAssets.Clear();
        _visibleAssets.AddRange(visibleGroups.SelectMany(static group => group.Assets));

        FilmstripAssets.Clear();
        foreach (var asset in _visibleAssets)
        {
            FilmstripAssets.Add(asset);
        }

        VisibleAssetCountText = _visibleAssets.Count.ToString();
        VisibleMonthGroupCountText = visibleGroups.Count.ToString();
        ActiveFilterSummary = BuildFilterSummary(_visibleAssets.Count, visibleGroups.Count);

        var selectedId = SelectedAsset?.Asset.Id;
        if (string.IsNullOrWhiteSpace(selectedId))
        {
            selectedId = _snapshot?.UiState.SelectedAssetId;
        }

        var nextSelection = string.IsNullOrWhiteSpace(selectedId)
            ? _visibleAssets.FirstOrDefault()
            : _visibleAssets.FirstOrDefault(asset => asset.Asset.Id == selectedId) ?? _visibleAssets.FirstOrDefault();

        if (!ReferenceEquals(SelectedAsset, nextSelection))
        {
            SelectedAsset = nextSelection;
        }

        if (SelectedAsset is null)
        {
            IsViewerMode = false;
            UpdateSelectionPosition();
            NotifySelectionStateChanged();
        }
    }

    private List<TimelineGroupViewModel> BuildVisibleGroups()
    {
        var timeline = _snapshot?.ImportState?.Timeline ?? new List<TimelineGroup>();
        if (timeline.Count == 0)
        {
            return BuildFallbackGroups();
        }

        var groups = new List<TimelineGroupViewModel>();

        foreach (var group in timeline)
        {
            var items = group.Assets
                .Where(MatchesFilter)
                .Select(static asset => new AssetItemViewModel(asset))
                .ToList();

            if (items.Count == 0)
            {
                continue;
            }

            groups.Add(new TimelineGroupViewModel(group.Label, group.CoverTitle, items));
        }

        return groups;
    }

    private List<TimelineGroupViewModel> BuildFallbackGroups()
    {
        return Assets
            .Where(asset => MatchesFilter(asset.Asset))
            .GroupBy(asset => FormatMonthLabel(asset.Asset.CapturedAt))
            .Select(group => new TimelineGroupViewModel(group.Key, group.First().Title, group))
            .ToList();
    }

    private bool MatchesFilter(AssetRecord asset)
    {
        if (!string.Equals(SelectedMediaFilter, "all", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(asset.Kind, SelectedMediaFilter, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!string.Equals(SelectedCameraFilter, "all", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(asset.CameraModel, SelectedCameraFilter, StringComparison.CurrentCultureIgnoreCase))
        {
            return false;
        }

        if (!string.Equals(SelectedLensFilter, "all", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(asset.LensModel, SelectedLensFilter, StringComparison.CurrentCultureIgnoreCase))
        {
            return false;
        }

        if (IsFavoriteFilterActive && !asset.IsFavorite)
        {
            return false;
        }

        if (IsFeaturedFilterActive && !asset.IsFeatured)
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(SearchQuery))
        {
            return true;
        }

        var query = SearchQuery.Trim();

        return Contains(asset.FileName, query)
            || Contains(asset.FilePath, query)
            || Contains(asset.Caption?.Title, query)
            || Contains(asset.Caption?.Body, query)
            || Contains(asset.CameraModel, query)
            || Contains(asset.LensModel, query)
            || asset.Tags.Any(tag => Contains(tag.Label, query));
    }

    private static bool Contains(string? source, string query)
    {
        return !string.IsNullOrWhiteSpace(source)
            && source.Contains(query, StringComparison.CurrentCultureIgnoreCase);
    }

    private string BuildFilterSummary(int visibleAssetCount, int visibleGroupCount)
    {
        var filters = new List<string>();

        if (!string.IsNullOrWhiteSpace(SearchQuery))
        {
            filters.Add($"搜索“{SearchQuery.Trim()}”");
        }

        if (!string.Equals(SelectedMediaFilter, "all", StringComparison.OrdinalIgnoreCase))
        {
            filters.Add(SelectedMediaFilterLabel);
        }

        if (!string.Equals(SelectedCameraFilter, "all", StringComparison.OrdinalIgnoreCase))
        {
            filters.Add($"设备 {SelectedCameraFilter}");
        }

        if (!string.Equals(SelectedLensFilter, "all", StringComparison.OrdinalIgnoreCase))
        {
            filters.Add($"镜头 {SelectedLensFilter}");
        }

        if (IsFavoriteFilterActive)
        {
            filters.Add("仅收藏");
        }

        if (IsFeaturedFilterActive)
        {
            filters.Add("仅精选");
        }

        if (filters.Count == 0)
        {
            return $"当前未启用筛选条件，正在显示 {visibleGroupCount} 个时间分组和 {visibleAssetCount} 个资源。";
        }

        return $"已启用 {string.Join("、", filters)}，当前显示 {visibleGroupCount} 个时间分组和 {visibleAssetCount} 个资源。";
    }

    private string BuildFilterTokenSummary()
    {
        var filters = new List<string>();

        if (!string.IsNullOrWhiteSpace(SearchQuery))
        {
            filters.Add($"搜索“{SearchQuery.Trim()}”");
        }

        if (!string.Equals(SelectedMediaFilter, "all", StringComparison.OrdinalIgnoreCase))
        {
            filters.Add(SelectedMediaFilterLabel);
        }

        if (!string.Equals(SelectedCameraFilter, "all", StringComparison.OrdinalIgnoreCase))
        {
            filters.Add($"设备 {SelectedCameraFilter}");
        }

        if (!string.Equals(SelectedLensFilter, "all", StringComparison.OrdinalIgnoreCase))
        {
            filters.Add($"镜头 {SelectedLensFilter}");
        }

        if (IsFavoriteFilterActive)
        {
            filters.Add("仅收藏");
        }

        if (IsFeaturedFilterActive)
        {
            filters.Add("仅精选");
        }

        return filters.Count == 0 ? "全部内容" : string.Join(" · ", filters);
    }

    private void UpdateFilterOptions(IEnumerable<AssetRecord> assets)
    {
        ReplaceFilterOptions(
            CameraFilterOptions,
            assets.Select(static asset => asset.CameraModel).Where(static value => !string.IsNullOrWhiteSpace(value))!.Select(static value => value!.Trim()));

        ReplaceFilterOptions(
            LensFilterOptions,
            assets.Select(static asset => asset.LensModel).Where(static value => !string.IsNullOrWhiteSpace(value))!.Select(static value => value!.Trim()));

        if (!CameraFilterOptions.Contains(SelectedCameraFilter))
        {
            _selectedCameraFilter = "all";
            OnPropertyChanged(nameof(SelectedCameraFilter));
            OnPropertyChanged(nameof(SelectedCameraFilterLabel));
        }

        if (!LensFilterOptions.Contains(SelectedLensFilter))
        {
            _selectedLensFilter = "all";
            OnPropertyChanged(nameof(SelectedLensFilter));
            OnPropertyChanged(nameof(SelectedLensFilterLabel));
        }
    }

    private static void ReplaceFilterOptions(ObservableCollection<string> target, IEnumerable<string> values)
    {
        target.Clear();
        target.Add("all");

        foreach (var value in values.Distinct(StringComparer.CurrentCultureIgnoreCase).OrderBy(static value => value, StringComparer.CurrentCultureIgnoreCase))
        {
            target.Add(value);
        }
    }

    private async Task PersistSnapshotAsync()
    {
        if (_snapshot is null || IsLoading || IsImporting)
        {
            return;
        }

        _snapshot.UiState = BuildCurrentUiState();
        await _librarySnapshotService.SaveAsync(_snapshot);
    }

    private LibraryViewState BuildCurrentUiState()
    {
        return new LibraryViewState
        {
            SelectedAssetId = SelectedAsset?.Asset.Id,
            ActiveFolder = "all",
            ViewMode = IsViewerMode ? "single" : "waterfall",
            SearchQuery = string.IsNullOrWhiteSpace(SearchQuery) ? null : SearchQuery.Trim(),
            MediaFilter = SelectedMediaFilter,
            ActiveCamera = SelectedCameraFilter,
            ActiveLens = SelectedLensFilter,
            FavoriteOnly = IsFavoriteFilterActive,
            FeaturedOnly = IsFeaturedFilterActive,
            IsSidebarCollapsed = IsSidebarCollapsed,
            IsFolderListCollapsed = false,
            IsDetailPanelCollapsed = IsDetailPanelCollapsed,
            IsFilmstripCollapsed = IsFilmstripCollapsed
        };
    }

    private void UpdateSelectionPosition()
    {
        if (SelectedAsset is null)
        {
            SelectedPositionText = _visibleAssets.Count == 0
                ? "当前没有可浏览的资源。"
                : $"当前共有 {_visibleAssets.Count} 个可浏览资源，但还没有选中项。";
            return;
        }

        var currentIndex = GetSelectedAssetIndex();
        if (currentIndex < 0)
        {
            SelectedPositionText = $"当前资源不在筛选后的结果内，共 {_visibleAssets.Count} 项。";
            return;
        }

        SelectedPositionText = $"第 {currentIndex + 1} / {_visibleAssets.Count} 项 · {BuildFilterTokenSummary()}";
    }

    private int GetSelectedAssetIndex()
    {
        return SelectedAsset is null
            ? -1
            : _visibleAssets.FindIndex(asset => asset.Asset.Id == SelectedAsset.Asset.Id);
    }

    private void NotifySelectionStateChanged()
    {
        OnPropertyChanged(nameof(HasSelection));
        OnPropertyChanged(nameof(CanGoPrevious));
        OnPropertyChanged(nameof(CanGoNext));
    }

    private void UpdateSelectedPreview(AssetRecord asset)
    {
        SelectedPreviewSource = null;
        SelectedVideoSource = null;

        if (!string.Equals(asset.Kind, "image", StringComparison.OrdinalIgnoreCase))
        {
            UpdateSelectedVideoPreview(asset);
            return;
        }

        if (string.IsNullOrWhiteSpace(asset.FilePath))
        {
            SelectedPreviewFallbackTitle = "缺少本地文件路径";
            SelectedPreviewFallbackDescription = "当前快照里没有可用的图片路径，因此无法生成 WinUI 预览。";
            return;
        }

        try
        {
            var fullPath = Path.GetFullPath(asset.FilePath);
            if (!File.Exists(fullPath))
            {
                SelectedPreviewFallbackTitle = "原始文件不存在";
                SelectedPreviewFallbackDescription = "快照记录了这张图，但当前磁盘上没有找到对应文件。";
                return;
            }

            SelectedPreviewFallbackTitle = "正在加载图片";
            SelectedPreviewFallbackDescription = "已切到真实图片源，加载完成后会显示在主查看区。";
            SelectedPreviewSource = new BitmapImage(new Uri(fullPath));
        }
        catch (Exception)
        {
            SelectedPreviewSource = null;
            SelectedPreviewFallbackTitle = "图片路径暂不可用";
            SelectedPreviewFallbackDescription = "当前路径无法转换成 WinUI 可直接加载的图片源，后续会补更稳的路径处理。";
        }
    }

    private void UpdateSelectedVideoPreview(AssetRecord asset)
    {
        if (string.IsNullOrWhiteSpace(asset.FilePath))
        {
            SelectedPreviewFallbackTitle = "缺少本地视频路径";
            SelectedPreviewFallbackDescription = "当前快照里没有可用的视频路径，因此无法生成 WinUI 播放源。";
            return;
        }

        try
        {
            var fullPath = Path.GetFullPath(asset.FilePath);
            if (!File.Exists(fullPath))
            {
                SelectedPreviewFallbackTitle = "原始视频不存在";
                SelectedPreviewFallbackDescription = "快照记录了这段视频，但当前磁盘上没有找到对应文件。";
                return;
            }

            SelectedPreviewFallbackTitle = "视频播放器已就绪";
            SelectedPreviewFallbackDescription = "当前资源已切换到 WinUI 原生播放器，下一步再补自动播放策略和更多媒体控制。";
            SelectedVideoSource = MediaSource.CreateFromUri(new Uri(fullPath));
        }
        catch (Exception)
        {
            SelectedVideoSource = null;
            SelectedPreviewFallbackTitle = "视频路径暂不可用";
            SelectedPreviewFallbackDescription = "当前路径无法转换成 WinUI 可直接播放的媒体源，后续会补更稳的媒体路径处理。";
        }
    }

    private static string FormatMonthLabel(string? capturedAt)
    {
        if (string.IsNullOrWhiteSpace(capturedAt))
        {
            return "未知时间";
        }

        if (DateTimeOffset.TryParse(capturedAt, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var date))
        {
            return $"{date:yyyy 年 M 月}";
        }

        return capturedAt.Length >= 7 ? capturedAt[..7] : capturedAt;
    }

    private static string BuildTechnicalInfo(AssetRecord asset)
    {
        var details = new List<string>();

        if (!string.IsNullOrWhiteSpace(asset.CapturedAt))
        {
            details.Add(FormatDateTime(asset.CapturedAt));
        }

        if (!string.IsNullOrWhiteSpace(asset.CameraModel))
        {
            details.Add(asset.CameraModel!);
        }

        if (!string.IsNullOrWhiteSpace(asset.LensModel))
        {
            details.Add(asset.LensModel!);
        }

        if (asset.PixelWidth is not null && asset.PixelHeight is not null)
        {
            details.Add($"{asset.PixelWidth} × {asset.PixelHeight}");
        }

        return details.Count == 0 ? "-" : string.Join(" · ", details);
    }

    private static string BuildCaptureInfo(AssetRecord asset)
    {
        var details = new List<string>();

        if (!string.IsNullOrWhiteSpace(asset.CapturedAt))
        {
            details.Add(FormatDateTime(asset.CapturedAt));
        }

        if (!string.IsNullOrWhiteSpace(asset.Caption?.Title))
        {
            details.Add(asset.Caption.Title!);
        }

        return details.Count == 0 ? "-" : string.Join(" · ", details);
    }

    private static string BuildExposureInfo(AssetRecord asset)
    {
        var details = new List<string>();

        if (!string.IsNullOrWhiteSpace(asset.CameraModel))
        {
            details.Add(asset.CameraModel!);
        }

        if (!string.IsNullOrWhiteSpace(asset.LensModel))
        {
            details.Add(asset.LensModel!);
        }

        if (asset.Aperture is not null)
        {
            details.Add($"f/{asset.Aperture:0.0}");
        }

        if (asset.ShutterSpeed is not null)
        {
            details.Add(FormatShutterSpeed(asset.ShutterSpeed.Value));
        }

        if (asset.Iso is not null)
        {
            details.Add($"ISO {asset.Iso:0}");
        }

        if (asset.PixelWidth is not null && asset.PixelHeight is not null)
        {
            details.Add($"{asset.PixelWidth} × {asset.PixelHeight}");
        }

        return details.Count == 0 ? "-" : string.Join(" · ", details);
    }

    private static string FormatDateTime(string? rawValue)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return "-";
        }

        return DateTimeOffset.TryParse(rawValue, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var value)
            ? value.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.CurrentCulture)
            : rawValue;
    }

    private static string FormatShutterSpeed(double seconds)
    {
        if (seconds <= 0)
        {
            return "-";
        }

        if (seconds >= 1)
        {
            return $"{seconds:0.###} s";
        }

        var reciprocal = Math.Round(1 / seconds);
        return reciprocal > 1 ? $"1/{reciprocal:0} s" : $"{seconds:0.###} s";
    }

    private static string BuildLocationInfo(AssetRecord asset)
    {
        if (!string.IsNullOrWhiteSpace(asset.Location?.Label))
        {
            return asset.Location.Label!;
        }

        if (asset.Location?.Latitude is not null && asset.Location.Longitude is not null)
        {
            return $"{asset.Location.Latitude:0.####}, {asset.Location.Longitude:0.####}";
        }

        return "-";
    }

    private static string BuildStatusSummary(AssetRecord asset)
    {
        var flags = new List<string>
        {
            asset.Kind == "video" ? "视频" : "照片"
        };

        if (asset.IsFavorite)
        {
            flags.Add("已收藏");
        }

        if (asset.IsFeatured)
        {
            flags.Add("已精选");
        }

        return string.Join(" · ", flags);
    }
}