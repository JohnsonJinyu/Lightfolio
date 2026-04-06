using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media.Animation;
using Microsoft.UI.Input;
using Microsoft.UI.Xaml.Media.Imaging;
using Lightfolio.WinUI.ViewModels;
using Windows.Foundation;
using Windows.System;
using Windows.UI.Core;
using System.ComponentModel;

namespace Lightfolio.WinUI.Views;

public sealed partial class ShellPage : Page
{
    private const double ExpandedSidebarWidth = 256;
    private const double CollapsedSidebarWidth = 60;
    private const double MinSidebarWidth = 216;
    private const double MaxSidebarWidth = 360;
    private const double ExpandedDetailWidth = 292;
    private const double CollapsedDetailWidth = 60;
    private const double MinDetailWidth = 252;
    private const double MaxDetailWidth = 380;
    private const double ExpandedFilmstripHeight = 132;
    private const double CollapsedFilmstripHeight = 44;
    private const double MinFilmstripHeight = 96;
    private const double MaxFilmstripHeight = 200;
    private const int PanelAnimationDurationMs = 220;
    private const float MinZoomFactor = 0.25f;
    private const float MaxZoomFactor = 4.0f;
    private const float ZoomStep = 0.2f;
    private const float DoubleTapZoomFactor = 2.0f;
    private bool _isDraggingPreview;
    private Point _lastDragPoint;
    private bool _isResizingSidebar;
    private bool _isResizingDetail;
    private bool _isResizingFilmstrip;
    private double _sidebarExpandedWidth = ExpandedSidebarWidth;
    private double _detailExpandedWidth = ExpandedDetailWidth;
    private double _filmstripExpandedHeight = ExpandedFilmstripHeight;

    public ShellPage(ShellViewModel viewModel)
    {
        ViewModel = viewModel;
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        KeyDown += OnPageKeyDown;
        ViewModel.PropertyChanged += OnViewModelPropertyChanged;
    }

    public ShellViewModel ViewModel { get; }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        Loaded -= OnLoaded;
        await ViewModel.EnsureLoadedAsync();
        ApplyPanelSizes(immediate: true);
        SyncViewerMediaSource();
        Focus(FocusState.Programmatic);
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        Unloaded -= OnUnloaded;
        ViewModel.PropertyChanged -= OnViewModelPropertyChanged;
    }

    private void OnTimelineAssetClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is AssetItemViewModel asset)
        {
            ViewModel.OpenAsset(asset);
        }
    }

    private void OnFilmstripAssetClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is not AssetItemViewModel asset)
        {
            return;
        }

        ViewModel.OpenAsset(asset);
        ResetZoom();
    }

    private void OnFilmstripSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (FilmstripListView.SelectedItem is not AssetItemViewModel asset)
        {
            return;
        }

        FilmstripListView.ScrollIntoView(asset);
    }

    private void OnViewerImageOpened(object sender, RoutedEventArgs e)
    {
        ViewModel.HandlePreviewOpened();
        ResetZoom();
    }

    private void OnViewerImageFailed(object sender, ExceptionRoutedEventArgs e)
    {
        ViewModel.HandlePreviewFailed();
    }

    private void OnViewModelPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName is nameof(ShellViewModel.SelectedVideoSource))
        {
            SyncViewerMediaSource();
            return;
        }

        if (e.PropertyName is nameof(ShellViewModel.IsSidebarCollapsed)
            or nameof(ShellViewModel.IsDetailPanelCollapsed)
            or nameof(ShellViewModel.IsFilmstripCollapsed))
        {
            ApplyPanelSizes(immediate: false);
        }
    }

    private void ApplyPanelSizes(bool immediate)
    {
        AnimateWidth(
            SidebarHost,
            ViewModel.IsSidebarCollapsed ? CollapsedSidebarWidth : _sidebarExpandedWidth,
            immediate);

        AnimateWidth(
            DetailHost,
            ViewModel.IsDetailPanelCollapsed ? CollapsedDetailWidth : _detailExpandedWidth,
            immediate);

        AnimateHeight(
            FilmstripHost,
            ViewModel.IsFilmstripCollapsed ? CollapsedFilmstripHeight : _filmstripExpandedHeight,
            immediate);
    }

    private static void AnimateWidth(FrameworkElement element, double targetWidth, bool immediate)
    {
        if (immediate)
        {
            element.Width = targetWidth;
            return;
        }

        var fromWidth = double.IsNaN(element.Width) || element.Width <= 0
            ? targetWidth
            : element.Width;

        var storyboard = new Storyboard();
        var animation = new DoubleAnimation
        {
            From = fromWidth,
            To = targetWidth,
            Duration = new Duration(TimeSpan.FromMilliseconds(PanelAnimationDurationMs)),
            EnableDependentAnimation = true,
            EasingFunction = new CubicEase { EasingMode = EasingMode.EaseInOut }
        };

        Storyboard.SetTarget(animation, element);
        Storyboard.SetTargetProperty(animation, nameof(FrameworkElement.Width));
        storyboard.Children.Add(animation);

        storyboard.Completed += (_, _) => element.Width = targetWidth;
        storyboard.Begin();
    }

    private static void AnimateHeight(FrameworkElement element, double targetHeight, bool immediate)
    {
        if (immediate)
        {
            element.Height = targetHeight;
            return;
        }

        var fromHeight = double.IsNaN(element.Height) || element.Height <= 0
            ? targetHeight
            : element.Height;

        var storyboard = new Storyboard();
        var animation = new DoubleAnimation
        {
            From = fromHeight,
            To = targetHeight,
            Duration = new Duration(TimeSpan.FromMilliseconds(PanelAnimationDurationMs)),
            EnableDependentAnimation = true,
            EasingFunction = new CubicEase { EasingMode = EasingMode.EaseInOut }
        };

        Storyboard.SetTarget(animation, element);
        Storyboard.SetTargetProperty(animation, nameof(FrameworkElement.Height));
        storyboard.Children.Add(animation);

        storyboard.Completed += (_, _) => element.Height = targetHeight;
        storyboard.Begin();
    }

    private void OnSidebarResizePressed(object sender, PointerRoutedEventArgs e)
    {
        if (ViewModel.IsSidebarCollapsed || sender is not UIElement handle)
        {
            return;
        }

        _isResizingSidebar = true;
        _lastDragPoint = e.GetCurrentPoint(this).Position;
        handle.CapturePointer(e.Pointer);
        e.Handled = true;
    }

    private void OnSidebarResizeMoved(object sender, PointerRoutedEventArgs e)
    {
        if (!_isResizingSidebar)
        {
            return;
        }

        var currentPoint = e.GetCurrentPoint(this).Position;
        var delta = currentPoint.X - _lastDragPoint.X;
        _lastDragPoint = currentPoint;

        _sidebarExpandedWidth = Math.Clamp(SidebarHost.Width + delta, MinSidebarWidth, MaxSidebarWidth);
        SidebarHost.Width = _sidebarExpandedWidth;
        e.Handled = true;
    }

    private void OnSidebarResizeReleased(object sender, PointerRoutedEventArgs e)
    {
        if (!_isResizingSidebar || sender is not UIElement handle)
        {
            return;
        }

        _isResizingSidebar = false;
        handle.ReleasePointerCapture(e.Pointer);
        e.Handled = true;
    }

    private void OnSidebarResizeCanceled(object sender, PointerRoutedEventArgs e)
    {
        if (!_isResizingSidebar || sender is not UIElement handle)
        {
            return;
        }

        _isResizingSidebar = false;
        handle.ReleasePointerCaptures();
        e.Handled = true;
    }

    private void OnDetailResizePressed(object sender, PointerRoutedEventArgs e)
    {
        if (ViewModel.IsDetailPanelCollapsed || sender is not UIElement handle)
        {
            return;
        }

        _isResizingDetail = true;
        _lastDragPoint = e.GetCurrentPoint(this).Position;
        handle.CapturePointer(e.Pointer);
        e.Handled = true;
    }

    private void OnDetailResizeMoved(object sender, PointerRoutedEventArgs e)
    {
        if (!_isResizingDetail)
        {
            return;
        }

        var currentPoint = e.GetCurrentPoint(this).Position;
        var delta = _lastDragPoint.X - currentPoint.X;
        _lastDragPoint = currentPoint;

        _detailExpandedWidth = Math.Clamp(DetailHost.Width + delta, MinDetailWidth, MaxDetailWidth);
        DetailHost.Width = _detailExpandedWidth;
        e.Handled = true;
    }

    private void OnDetailResizeReleased(object sender, PointerRoutedEventArgs e)
    {
        if (!_isResizingDetail || sender is not UIElement handle)
        {
            return;
        }

        _isResizingDetail = false;
        handle.ReleasePointerCapture(e.Pointer);
        e.Handled = true;
    }

    private void OnDetailResizeCanceled(object sender, PointerRoutedEventArgs e)
    {
        if (!_isResizingDetail || sender is not UIElement handle)
        {
            return;
        }

        _isResizingDetail = false;
        handle.ReleasePointerCaptures();
        e.Handled = true;
    }

    private void OnFilmstripResizePressed(object sender, PointerRoutedEventArgs e)
    {
        if (ViewModel.IsFilmstripCollapsed || sender is not UIElement handle)
        {
            return;
        }

        _isResizingFilmstrip = true;
        _lastDragPoint = e.GetCurrentPoint(this).Position;
        handle.CapturePointer(e.Pointer);
        e.Handled = true;
    }

    private void OnFilmstripResizeMoved(object sender, PointerRoutedEventArgs e)
    {
        if (!_isResizingFilmstrip)
        {
            return;
        }

        var currentPoint = e.GetCurrentPoint(this).Position;
        var delta = _lastDragPoint.Y - currentPoint.Y;
        _lastDragPoint = currentPoint;

        _filmstripExpandedHeight = Math.Clamp(FilmstripHost.Height + delta, MinFilmstripHeight, MaxFilmstripHeight);
        FilmstripHost.Height = _filmstripExpandedHeight;
        e.Handled = true;
    }

    private void OnFilmstripResizeReleased(object sender, PointerRoutedEventArgs e)
    {
        if (!_isResizingFilmstrip || sender is not UIElement handle)
        {
            return;
        }

        _isResizingFilmstrip = false;
        handle.ReleasePointerCapture(e.Pointer);
        e.Handled = true;
    }

    private void OnFilmstripResizeCanceled(object sender, PointerRoutedEventArgs e)
    {
        if (!_isResizingFilmstrip || sender is not UIElement handle)
        {
            return;
        }

        _isResizingFilmstrip = false;
        handle.ReleasePointerCaptures();
        e.Handled = true;
    }

    private void SyncViewerMediaSource()
    {
        ViewerMediaHost.Source = ViewModel.SelectedVideoSource;
    }

    private void OnPageKeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (!ViewModel.IsViewerMode)
        {
            return;
        }

        switch (e.Key)
        {
            case VirtualKey.Left:
                ViewModel.SelectPreviousAsset();
                ResetZoom();
                e.Handled = true;
                break;

            case VirtualKey.Right:
                ViewModel.SelectNextAsset();
                ResetZoom();
                e.Handled = true;
                break;

            case VirtualKey.Escape:
                ViewModel.HideViewer();
                ResetZoom();
                e.Handled = true;
                break;

            case VirtualKey.Add:
            case (VirtualKey)187:
                StepZoom(ZoomStep);
                e.Handled = true;
                break;

            case VirtualKey.Subtract:
            case (VirtualKey)189:
                StepZoom(-ZoomStep);
                e.Handled = true;
                break;

            case VirtualKey.Number0:
            case VirtualKey.NumberPad0:
                ResetZoom();
                e.Handled = true;
                break;
        }
    }

    private void OnZoomInClick(object sender, RoutedEventArgs e)
    {
        StepZoom(ZoomStep);
    }

    private void OnZoomOutClick(object sender, RoutedEventArgs e)
    {
        StepZoom(-ZoomStep);
    }

    private void OnZoomResetClick(object sender, RoutedEventArgs e)
    {
        ResetZoom();
    }

    private void OnViewerScrollChanged(object sender, ScrollViewerViewChangedEventArgs e)
    {
        ViewModel.UpdateZoomFactor(ViewerScrollHost.ZoomFactor);
    }

    private void OnViewerPointerWheelChanged(object sender, PointerRoutedEventArgs e)
    {
        var ctrlState = InputKeyboardSource.GetKeyStateForCurrentThread(VirtualKey.Control);
        if (!ctrlState.HasFlag(CoreVirtualKeyStates.Down))
        {
            return;
        }

        var delta = e.GetCurrentPoint(ViewerScrollHost).Properties.MouseWheelDelta;
        if (delta == 0)
        {
            return;
        }

        var anchorPoint = e.GetCurrentPoint(ViewerScrollHost).Position;
        StepZoom(delta > 0 ? ZoomStep : -ZoomStep, anchorPoint);
        e.Handled = true;
    }

    private void OnViewerPointerPressed(object sender, PointerRoutedEventArgs e)
    {
        if (ViewerScrollHost.ZoomFactor <= 1.0f || !e.GetCurrentPoint(ViewerScrollHost).Properties.IsLeftButtonPressed)
        {
            return;
        }

        _isDraggingPreview = true;
        _lastDragPoint = e.GetCurrentPoint(ViewerScrollHost).Position;
        ViewerScrollHost.CapturePointer(e.Pointer);
        e.Handled = true;
    }

    private void OnViewerPointerMoved(object sender, PointerRoutedEventArgs e)
    {
        if (!_isDraggingPreview)
        {
            return;
        }

        var currentPoint = e.GetCurrentPoint(ViewerScrollHost).Position;
        var deltaX = currentPoint.X - _lastDragPoint.X;
        var deltaY = currentPoint.Y - _lastDragPoint.Y;
        _lastDragPoint = currentPoint;

        ViewerScrollHost.ChangeView(
            ViewerScrollHost.HorizontalOffset - deltaX,
            ViewerScrollHost.VerticalOffset - deltaY,
            null,
            disableAnimation: true);

        e.Handled = true;
    }

    private void OnViewerPointerReleased(object sender, PointerRoutedEventArgs e)
    {
        if (!_isDraggingPreview)
        {
            return;
        }

        _isDraggingPreview = false;
        ViewerScrollHost.ReleasePointerCapture(e.Pointer);
        e.Handled = true;
    }

    private void OnViewerPointerCanceled(object sender, PointerRoutedEventArgs e)
    {
        if (!_isDraggingPreview)
        {
            return;
        }

        _isDraggingPreview = false;
        ViewerScrollHost.ReleasePointerCaptures();
        e.Handled = true;
    }

    private void OnViewerDoubleTapped(object sender, DoubleTappedRoutedEventArgs e)
    {
        if (ViewerScrollHost.ZoomFactor > 1.05f)
        {
            ResetZoom();
            e.Handled = true;
            return;
        }

        var targetZoom = Math.Clamp(DoubleTapZoomFactor, MinZoomFactor, MaxZoomFactor);
        ApplyZoom(targetZoom, e.GetPosition(ViewerScrollHost));
        ViewModel.UpdateZoomFactor(targetZoom);
        e.Handled = true;
    }

    private void StepZoom(float delta, Point? anchorPoint = null)
    {
        var nextZoom = Math.Clamp(ViewerScrollHost.ZoomFactor + delta, MinZoomFactor, MaxZoomFactor);
        ApplyZoom(nextZoom, anchorPoint);
        ViewModel.UpdateZoomFactor(nextZoom);
    }

    private void ApplyZoom(float targetZoom, Point? anchorPoint)
    {
        var currentZoom = ViewerScrollHost.ZoomFactor;

        if (Math.Abs(currentZoom - targetZoom) < 0.001f)
        {
            return;
        }

        var point = anchorPoint ?? new Point(ViewerScrollHost.ActualWidth / 2, ViewerScrollHost.ActualHeight / 2);
        var contentX = (ViewerScrollHost.HorizontalOffset + point.X) / currentZoom;
        var contentY = (ViewerScrollHost.VerticalOffset + point.Y) / currentZoom;
        var nextHorizontalOffset = contentX * targetZoom - point.X;
        var nextVerticalOffset = contentY * targetZoom - point.Y;

        ViewerScrollHost.ChangeView(nextHorizontalOffset, nextVerticalOffset, targetZoom, disableAnimation: false);
    }

    private void ResetZoom()
    {
        var fitZoom = CalculateFitZoomFactor();
        ViewerScrollHost.ChangeView(0, 0, fitZoom, disableAnimation: false);
        ViewModel.UpdateZoomFactor(fitZoom);
        _isDraggingPreview = false;
    }

    private float CalculateFitZoomFactor()
    {
        var source = ViewModel.SelectedPreviewSource;
        if (source is null)
        {
            return 1.0f;
        }

        var pixelWidth = source.PixelWidth > 0 ? source.PixelWidth : (int)Math.Round(ViewerImage.ActualWidth);
        var pixelHeight = source.PixelHeight > 0 ? source.PixelHeight : (int)Math.Round(ViewerImage.ActualHeight);
        var viewportWidth = ViewerScrollHost.ActualWidth;
        var viewportHeight = ViewerScrollHost.ActualHeight;

        if (pixelWidth <= 0 || pixelHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0)
        {
            return 1.0f;
        }

        var horizontalZoom = viewportWidth / pixelWidth;
        var verticalZoom = viewportHeight / pixelHeight;
        var fitZoom = Math.Min(horizontalZoom, verticalZoom);

        return (float)Math.Clamp(fitZoom, MinZoomFactor, 1.0);
    }
}