namespace Lightfolio.Contracts.Models;

public sealed class AssetLocation
{
    public string? Label { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }
}