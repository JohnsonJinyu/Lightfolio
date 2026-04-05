using Lightfolio.Contracts.Models;

namespace Lightfolio.WinUI.Services;

public interface ILibrarySnapshotService
{
    Task<LibrarySnapshotLoadResult> LoadAsync(CancellationToken cancellationToken = default);

    Task SaveAsync(LibrarySnapshot snapshot, CancellationToken cancellationToken = default);

    Task<LibrarySnapshotLoadResult?> ImportFilesAsync(nint windowHandle, CancellationToken cancellationToken = default);

    Task<LibrarySnapshotLoadResult?> ImportFolderAsync(nint windowHandle, CancellationToken cancellationToken = default);
}