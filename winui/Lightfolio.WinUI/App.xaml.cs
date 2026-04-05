using Microsoft.UI.Xaml;
using Lightfolio.WinUI.Services;
using Lightfolio.WinUI.ViewModels;
using WinRT.Interop;

namespace Lightfolio.WinUI;

public partial class App : Application
{
    private Window? _window;

    public static Window? MainAppWindow { get; private set; }

    public static nint MainWindowHandle => MainAppWindow is null ? 0 : WindowNative.GetWindowHandle(MainAppWindow);

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        ILibrarySnapshotService librarySnapshotService = new LibrarySnapshotService();
        var shellViewModel = new ShellViewModel(librarySnapshotService);

        _window = new MainWindow(shellViewModel);
        MainAppWindow = _window;
        _window.Activate();
    }
}
