namespace Lightfolio.Contracts.Models;

public sealed class LibraryViewState
{
    public string? SelectedAssetId { get; set; }

    public string ActiveFolder { get; set; } = "all";

    public string ViewMode { get; set; } = "single";

    public string? SearchQuery { get; set; }

    public string? MediaFilter { get; set; }

    public string? ActiveTag { get; set; }

    public string? ActiveCamera { get; set; }

    public string? ActiveLens { get; set; }

    public bool FavoriteOnly { get; set; }

    public bool FeaturedOnly { get; set; }

    public double? SidebarWidth { get; set; }

    public double? DetailPanelWidth { get; set; }

    public double? FilmstripHeight { get; set; }

    public bool IsSidebarCollapsed { get; set; }

    public bool IsFolderListCollapsed { get; set; }

    public bool IsDetailPanelCollapsed { get; set; }

    public bool IsFilmstripCollapsed { get; set; }
}