using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Lightfolio.Contracts.Models;
using MetadataExtractor;
using MetadataExtractor.Formats.Exif;
using MetadataExtractor.Formats.Jpeg;
using Windows.Graphics.Imaging;
using Windows.Storage;
using Windows.Storage.Pickers;
using WinRT.Interop;

namespace Lightfolio.WinUI.Services;

public sealed class LibrarySnapshotService : ILibrarySnapshotService
{
    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".heic", ".bmp"
    };

    private static readonly HashSet<string> VideoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".mov", ".m4v", ".avi", ".webm"
    };

    private static readonly JsonSerializerOptions JsonSerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        WriteIndented = true,
    };

    public async Task<LibrarySnapshotLoadResult> LoadAsync(CancellationToken cancellationToken = default)
    {
        foreach (var candidatePath in GetCandidatePaths())
        {
            if (!File.Exists(candidatePath))
            {
                continue;
            }

            await using var stream = File.OpenRead(candidatePath);
            var snapshot = await JsonSerializer.DeserializeAsync<LibrarySnapshot>(stream, JsonSerializerOptions, cancellationToken);

            return new LibrarySnapshotLoadResult(NormalizeSnapshot(snapshot), candidatePath, true);
        }

        var fallbackPath = GetCandidatePaths().First();
        return new LibrarySnapshotLoadResult(CreateEmptySnapshot(), fallbackPath, false);
    }

    public async Task SaveAsync(LibrarySnapshot snapshot, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeSnapshot(snapshot);
        normalized.UpdatedAt = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture);

        var targetPath = ResolveWritableSnapshotPath();
        var directory = Path.GetDirectoryName(targetPath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            System.IO.Directory.CreateDirectory(directory);
        }

        await using var stream = File.Create(targetPath);
        await JsonSerializer.SerializeAsync(stream, normalized, JsonSerializerOptions, cancellationToken);
    }

    public async Task<LibrarySnapshotLoadResult?> ImportFilesAsync(nint windowHandle, CancellationToken cancellationToken = default)
    {
        var picker = new FileOpenPicker
        {
            SuggestedStartLocation = PickerLocationId.PicturesLibrary,
            ViewMode = PickerViewMode.Thumbnail
        };

        foreach (var fileType in ImageExtensions.Concat(VideoExtensions).OrderBy(static value => value, StringComparer.OrdinalIgnoreCase))
        {
            picker.FileTypeFilter.Add(fileType);
        }

        InitializeWithWindow.Initialize(picker, windowHandle);

        var files = await picker.PickMultipleFilesAsync();
        if (files is null || files.Count == 0)
        {
            return null;
        }

        var filePaths = files.Select(static file => file.Path).Where(static path => !string.IsNullOrWhiteSpace(path)).ToList();
        return await ImportPathsAsync(filePaths, "files", cancellationToken);
    }

    public async Task<LibrarySnapshotLoadResult?> ImportFolderAsync(nint windowHandle, CancellationToken cancellationToken = default)
    {
        var picker = new FolderPicker
        {
            SuggestedStartLocation = PickerLocationId.PicturesLibrary
        };
        picker.FileTypeFilter.Add("*");
        InitializeWithWindow.Initialize(picker, windowHandle);

        var folder = await picker.PickSingleFolderAsync();
        if (folder is null)
        {
            return null;
        }

        var filePaths = await ScanDirectoryForMediaAsync(folder.Path, cancellationToken);
        return await ImportPathsAsync(filePaths, "directory", cancellationToken);
    }

    private async Task<LibrarySnapshotLoadResult> ImportPathsAsync(IReadOnlyCollection<string> importedPaths, string source, CancellationToken cancellationToken)
    {
        var existingResult = await LoadAsync(cancellationToken);
        var snapshot = NormalizeSnapshot(existingResult.Snapshot);

        var assetMap = (snapshot.ImportState?.Assets ?? new List<AssetRecord>())
            .Where(static asset => !string.IsNullOrWhiteSpace(asset.FilePath))
            .GroupBy(static asset => NormalizePath(asset.FilePath))
            .ToDictionary(static group => group.Key, static group => group.First(), StringComparer.OrdinalIgnoreCase);

        foreach (var path in importedPaths)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var normalizedPath = NormalizePath(path);
            if (!IsSupportedMediaPath(normalizedPath) || !File.Exists(normalizedPath))
            {
                continue;
            }

            assetMap[normalizedPath] = await BuildAssetAsync(normalizedPath, source, cancellationToken);
        }

        var mergedAssets = assetMap.Values
            .OrderByDescending(static asset => ParseDateOrMin(asset.CapturedAt))
            .ThenBy(static asset => asset.FileName, StringComparer.CurrentCultureIgnoreCase)
            .ToList();

        snapshot.ImportState = new ImportSummary
        {
            Source = source,
            PickedPaths = importedPaths.Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(static path => path, StringComparer.OrdinalIgnoreCase).ToList(),
            Assets = mergedAssets,
            Timeline = BuildTimeline(mergedAssets),
            Story = snapshot.ImportState?.Story
        };

        snapshot.UiState ??= new LibraryViewState();
        snapshot.UiState.SelectedAssetId ??= mergedAssets.FirstOrDefault()?.Id;

        await SaveAsync(snapshot, cancellationToken);
        return new LibrarySnapshotLoadResult(snapshot, ResolveWritableSnapshotPath(), true);
    }

    private static IEnumerable<string> GetCandidatePaths()
    {
        var roamingAppData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        return new[]
        {
            Path.Combine(roamingAppData, "Lightfolio", "library-state.json"),
            Path.Combine(roamingAppData, "lightfolio", "library-state.json"),
            Path.Combine(localAppData, "Lightfolio", "library-state.json"),
            Path.Combine(localAppData, "lightfolio", "library-state.json"),
        };
    }

    private static string ResolveWritableSnapshotPath()
    {
        return GetCandidatePaths().FirstOrDefault(File.Exists) ?? GetCandidatePaths().First();
    }

    private static async Task<List<string>> ScanDirectoryForMediaAsync(string rootDirectory, CancellationToken cancellationToken)
    {
        var files = new List<string>();
        var directories = new Stack<string>();
        directories.Push(rootDirectory);

        while (directories.Count > 0)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var current = directories.Pop();
            IEnumerable<string> childFiles;
            IEnumerable<string> childDirectories;

            try
            {
                childFiles = System.IO.Directory.EnumerateFiles(current);
                childDirectories = System.IO.Directory.EnumerateDirectories(current);
            }
            catch
            {
                continue;
            }

            foreach (var filePath in childFiles)
            {
                if (IsSupportedMediaPath(filePath))
                {
                    files.Add(filePath);
                }
            }

            foreach (var childDirectory in childDirectories)
            {
                directories.Push(childDirectory);
            }
        }

        return files;
    }

    private static bool IsSupportedMediaPath(string filePath)
    {
        var extension = Path.GetExtension(filePath);
        return ImageExtensions.Contains(extension) || VideoExtensions.Contains(extension);
    }

    private static async Task<AssetRecord> BuildAssetAsync(string filePath, string source, CancellationToken cancellationToken)
    {
        var fullPath = NormalizePath(filePath);
        var fileInfo = new FileInfo(fullPath);
        var isImage = ImageExtensions.Contains(fileInfo.Extension);
        var importedAt = DateTimeOffset.UtcNow;
        var capturedAt = new DateTimeOffset(fileInfo.CreationTimeUtc == DateTime.MinValue ? fileInfo.LastWriteTimeUtc : fileInfo.CreationTimeUtc, TimeSpan.Zero);

        var metadata = isImage
            ? await ReadImageMetadataAsync(fullPath, cancellationToken)
            : await ReadVideoMetadataAsync(fullPath);

        return new AssetRecord
        {
            Id = CreateStableAssetId(fullPath),
            Kind = isImage ? "image" : "video",
            Source = source,
            FilePath = fullPath,
            FileName = fileInfo.Name,
            PixelWidth = metadata.PixelWidth,
            PixelHeight = metadata.PixelHeight,
            CapturedAt = (metadata.CapturedAt ?? capturedAt).ToString("O", CultureInfo.InvariantCulture),
            ImportedAt = importedAt.ToString("O", CultureInfo.InvariantCulture),
            CameraModel = metadata.CameraModel,
            LensModel = metadata.LensModel,
            Aperture = metadata.Aperture,
            ShutterSpeed = metadata.ShutterSpeed,
            Iso = metadata.Iso,
            Location = metadata.Location,
            Tags = new List<AssetTag>(),
            Caption = new AssetCaption
            {
                Title = Path.GetFileNameWithoutExtension(fileInfo.Name),
                Body = null
            },
            IsFavorite = false,
            IsFeatured = false
        };
    }

    private static async Task<ImportedMetadata> ReadImageMetadataAsync(string filePath, CancellationToken cancellationToken)
    {
        var metadata = new ImportedMetadata();

        try
        {
            var storageFile = await StorageFile.GetFileFromPathAsync(filePath);
            using var stream = await storageFile.OpenReadAsync();
            var decoder = await BitmapDecoder.CreateAsync(stream);
            metadata.PixelWidth = (int)decoder.PixelWidth;
            metadata.PixelHeight = (int)decoder.PixelHeight;
        }
        catch
        {
        }

        try
        {
            var directories = ImageMetadataReader.ReadMetadata(filePath);
            var subIfd = directories.OfType<ExifSubIfdDirectory>().FirstOrDefault();
            var ifd0 = directories.OfType<ExifIfd0Directory>().FirstOrDefault();
            var gps = directories.OfType<GpsDirectory>().FirstOrDefault();
            var jpeg = directories.OfType<JpegDirectory>().FirstOrDefault();

            metadata.CapturedAt = TryGetCapturedAt(subIfd);
            metadata.CameraModel = NormalizeText(BuildCameraModel(ifd0));
            metadata.LensModel = NormalizeText(subIfd?.GetDescription(ExifDirectoryBase.TagLensModel));
            metadata.Aperture = TryGetDouble(subIfd, ExifDirectoryBase.TagFNumber) ?? TryGetDouble(subIfd, ExifDirectoryBase.TagAperture);
            metadata.ShutterSpeed = TryGetExposureTime(subIfd);
            metadata.Iso = TryGetDouble(subIfd, ExifDirectoryBase.TagIsoEquivalent);
            metadata.PixelWidth ??= TryGetInt(subIfd, ExifDirectoryBase.TagExifImageWidth) ?? TryGetInt(jpeg, JpegDirectory.TagImageWidth);
            metadata.PixelHeight ??= TryGetInt(subIfd, ExifDirectoryBase.TagExifImageHeight) ?? TryGetInt(jpeg, JpegDirectory.TagImageHeight);

            var geoLocation = gps?.GetGeoLocation();
            if (geoLocation is not null)
            {
                metadata.Location = new AssetLocation
                {
                    Latitude = geoLocation.Latitude,
                    Longitude = geoLocation.Longitude
                };
            }
        }
        catch
        {
        }

        return metadata;
    }

    private static async Task<ImportedMetadata> ReadVideoMetadataAsync(string filePath)
    {
        var metadata = new ImportedMetadata();

        try
        {
            var storageFile = await StorageFile.GetFileFromPathAsync(filePath);
            var properties = await storageFile.Properties.GetVideoPropertiesAsync();
            metadata.PixelWidth = (int)properties.Width;
            metadata.PixelHeight = (int)properties.Height;
        }
        catch
        {
        }

        return metadata;
    }

    private static List<TimelineGroup> BuildTimeline(IEnumerable<AssetRecord> assets)
    {
        return assets
            .GroupBy(static asset => FormatMonthLabel(asset.CapturedAt))
            .OrderByDescending(static group => ParseDateOrMin(group.FirstOrDefault()?.CapturedAt))
            .Select(group => new TimelineGroup
            {
                Id = CreateStableAssetId(group.Key),
                Label = group.Key,
                CoverTitle = group.FirstOrDefault()?.Caption?.Title
                    ?? group.FirstOrDefault()?.FileName
                    ?? "未命名",
                Assets = group
                    .OrderByDescending(static asset => ParseDateOrMin(asset.CapturedAt))
                    .ThenBy(static asset => asset.FileName, StringComparer.CurrentCultureIgnoreCase)
                    .ToList()
            })
            .ToList();
    }

    private static string NormalizePath(string filePath)
    {
        return Path.GetFullPath(filePath.Trim());
    }

    private static string CreateStableAssetId(string seed)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(seed));
        return Convert.ToHexString(bytes[..12]).ToLowerInvariant();
    }

    private static DateTimeOffset ParseDateOrMin(string? value)
    {
        return DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed)
            ? parsed
            : DateTimeOffset.MinValue;
    }

    private static string FormatMonthLabel(string? capturedAt)
    {
        var date = ParseDateOrMin(capturedAt);
        return date == DateTimeOffset.MinValue ? "未知时间" : $"{date:yyyy 年 M 月}";
    }

    private static DateTimeOffset? TryGetCapturedAt(ExifSubIfdDirectory? directory)
    {
        var rawDate = directory?.GetDateTime(ExifDirectoryBase.TagDateTimeOriginal)
            ?? directory?.GetDateTime(ExifDirectoryBase.TagDateTimeDigitized);

        return rawDate is null
            ? null
            : new DateTimeOffset(DateTime.SpecifyKind(rawDate.Value, DateTimeKind.Local)).ToUniversalTime();
    }

    private static string? BuildCameraModel(ExifIfd0Directory? directory)
    {
        var make = NormalizeText(directory?.GetDescription(ExifDirectoryBase.TagMake));
        var model = NormalizeText(directory?.GetDescription(ExifDirectoryBase.TagModel));

        if (string.IsNullOrWhiteSpace(make))
        {
            return model;
        }

        if (string.IsNullOrWhiteSpace(model))
        {
            return make;
        }

        return model.StartsWith(make, StringComparison.OrdinalIgnoreCase) ? model : $"{make} {model}";
    }

    private static string? NormalizeText(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static int? TryGetInt(MetadataExtractor.Directory? directory, int tag)
    {
        try
        {
            return directory?.ContainsTag(tag) == true ? directory.GetInt32(tag) : null;
        }
        catch
        {
            return null;
        }
    }

    private static double? TryGetDouble(MetadataExtractor.Directory? directory, int tag)
    {
        try
        {
            return directory?.ContainsTag(tag) == true ? directory.GetRational(tag).ToDouble() : null;
        }
        catch
        {
            return null;
        }
    }

    private static double? TryGetExposureTime(ExifSubIfdDirectory? directory)
    {
        try
        {
            if (directory?.ContainsTag(ExifDirectoryBase.TagExposureTime) == true)
            {
                return directory.GetRational(ExifDirectoryBase.TagExposureTime).ToDouble();
            }

            if (directory?.ContainsTag(ExifDirectoryBase.TagShutterSpeed) == true)
            {
                var apex = directory.GetRational(ExifDirectoryBase.TagShutterSpeed).ToDouble();
                return Math.Pow(2, -apex);
            }
        }
        catch
        {
        }

        return null;
    }

    private static LibrarySnapshot NormalizeSnapshot(LibrarySnapshot? snapshot)
    {
        snapshot ??= CreateEmptySnapshot();
        snapshot.HiddenAssetIds ??= new List<string>();
        snapshot.RemovedFromAlbumIds ??= new List<string>();
        snapshot.UiState ??= new LibraryViewState();

        if (snapshot.ImportState is null)
        {
            return snapshot;
        }

        snapshot.ImportState.Assets ??= new List<AssetRecord>();
        snapshot.ImportState.PickedPaths ??= new List<string>();
        snapshot.ImportState.Timeline ??= new List<TimelineGroup>();

        foreach (var asset in snapshot.ImportState.Assets)
        {
            asset.Tags ??= new List<AssetTag>();
        }

        return snapshot;
    }

    private static LibrarySnapshot CreateEmptySnapshot()
    {
        return new LibrarySnapshot
        {
            Version = 1,
            ImportState = null,
            HiddenAssetIds = new List<string>(),
            RemovedFromAlbumIds = new List<string>(),
            UiState = new LibraryViewState(),
            UpdatedAt = DateTimeOffset.UnixEpoch.ToString("O", CultureInfo.InvariantCulture),
        };
    }

    private sealed class ImportedMetadata
    {
        public DateTimeOffset? CapturedAt { get; set; }

        public int? PixelWidth { get; set; }

        public int? PixelHeight { get; set; }

        public string? CameraModel { get; set; }

        public string? LensModel { get; set; }

        public double? Aperture { get; set; }

        public double? ShutterSpeed { get; set; }

        public double? Iso { get; set; }

        public AssetLocation? Location { get; set; }
    }
}