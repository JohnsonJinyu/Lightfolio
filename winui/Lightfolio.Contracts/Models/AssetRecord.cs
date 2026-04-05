using System.Collections.Generic;

namespace Lightfolio.Contracts.Models;

public sealed class AssetRecord
{
    public string Id { get; set; } = string.Empty;

    public string Kind { get; set; } = "image";

    public string Source { get; set; } = "files";

    public string FilePath { get; set; } = string.Empty;

    public string FileName { get; set; } = string.Empty;

    public int? PixelWidth { get; set; }

    public int? PixelHeight { get; set; }

    public string CapturedAt { get; set; } = string.Empty;

    public string ImportedAt { get; set; } = string.Empty;

    public string? CameraModel { get; set; }

    public string? LensModel { get; set; }

    public double? Aperture { get; set; }

    public double? ShutterSpeed { get; set; }

    public double? Iso { get; set; }

    public AssetLocation? Location { get; set; }

    public List<AssetTag> Tags { get; set; } = new();

    public AssetCaption? Caption { get; set; }

    public bool IsFavorite { get; set; }

    public bool IsFeatured { get; set; }
}