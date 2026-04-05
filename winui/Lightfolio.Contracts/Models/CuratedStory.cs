using System.Collections.Generic;

namespace Lightfolio.Contracts.Models;

public sealed class CuratedStory
{
    public string Id { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public List<CuratedStoryBlock> Blocks { get; set; } = new();
}