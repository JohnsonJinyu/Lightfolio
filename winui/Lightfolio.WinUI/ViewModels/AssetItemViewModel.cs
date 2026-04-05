using System.IO;
using Lightfolio.Contracts.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media.Imaging;

namespace Lightfolio.WinUI.ViewModels;

public sealed class AssetItemViewModel
{
    public AssetItemViewModel(AssetRecord asset)
    {
        Asset = asset;
        Title = string.IsNullOrWhiteSpace(asset.Caption?.Title) ? asset.FileName : asset.Caption.Title!;
        Subtitle = string.IsNullOrWhiteSpace(asset.CapturedAt)
            ? asset.Kind
            : $"{asset.Kind} · {asset.CapturedAt}";
        ThumbnailSource = CreateThumbnailSource(asset);
    }

    public AssetRecord Asset { get; }

    public string Title { get; }

    public string Subtitle { get; }

    public string FilePath => Asset.FilePath;

    public string KindLabel => Asset.Kind == "video" ? "视频" : "照片";

    public string DateLabel => string.IsNullOrWhiteSpace(Asset.CapturedAt)
        ? "未知时间"
        : Asset.CapturedAt.Length > 10
            ? Asset.CapturedAt[..10]
            : Asset.CapturedAt;

    public BitmapImage? ThumbnailSource { get; }

    public Visibility ThumbnailVisibility => ThumbnailSource is null ? Visibility.Collapsed : Visibility.Visible;

    public Visibility ThumbnailFallbackVisibility => ThumbnailSource is null ? Visibility.Visible : Visibility.Collapsed;

    private static BitmapImage? CreateThumbnailSource(AssetRecord asset)
    {
        if (!string.Equals(asset.Kind, "image", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(asset.FilePath))
        {
            return null;
        }

        try
        {
            var fullPath = Path.GetFullPath(asset.FilePath);
            return File.Exists(fullPath) ? new BitmapImage(new Uri(fullPath)) : null;
        }
        catch
        {
            return null;
        }
    }
}