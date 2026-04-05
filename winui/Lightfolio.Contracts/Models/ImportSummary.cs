using System.Collections.Generic;

namespace Lightfolio.Contracts.Models;

public sealed class ImportSummary
{
    public string Source { get; set; } = "files";

    public List<string> PickedPaths { get; set; } = new();

    public List<AssetRecord> Assets { get; set; } = new();

    public List<TimelineGroup> Timeline { get; set; } = new();

    public CuratedStory? Story { get; set; }
}