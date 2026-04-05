using Lightfolio.Contracts.Models;

namespace Lightfolio.WinUI.Services;

public sealed record LibrarySnapshotLoadResult(LibrarySnapshot Snapshot, string SourcePath, bool SnapshotFound);