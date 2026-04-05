using System.Collections.Generic;

namespace Lightfolio.Contracts.Models;

public sealed class LibrarySnapshot
{
    public int Version { get; set; } = 1;

    public ImportSummary? ImportState { get; set; }

    public List<string> HiddenAssetIds { get; set; } = new();

    public List<string> RemovedFromAlbumIds { get; set; } = new();

    public LibraryViewState UiState { get; set; } = new();

    public string UpdatedAt { get; set; } = string.Empty;
}