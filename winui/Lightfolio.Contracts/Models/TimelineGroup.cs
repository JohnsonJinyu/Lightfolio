using System.Collections.Generic;

namespace Lightfolio.Contracts.Models;

public sealed class TimelineGroup
{
    public string Id { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;

    public string CoverTitle { get; set; } = string.Empty;

    public List<AssetRecord> Assets { get; set; } = new();
}