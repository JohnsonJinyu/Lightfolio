using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Lightfolio.WinUI.ViewModels;
using Lightfolio.WinUI.Views;
using Windows.Graphics;

namespace Lightfolio.WinUI;

public sealed partial class MainWindow : Window
{
    private const int PreferredLaunchWidth = 1680;
    private const int PreferredLaunchHeight = 1020;
    private const int MinimumWorkspaceWidth = 1380;
    private const int MinimumWorkspaceHeight = 860;

    public MainWindow(ShellViewModel shellViewModel)
    {
        InitializeComponent();

        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);

        RootContentPresenter.Content = new ShellPage(shellViewModel);
        AppWindow.SetIcon("Assets/AppIcon.ico");
        ConfigureLaunchWindow();
    }

    private void ConfigureLaunchWindow()
    {
        var displayArea = DisplayArea.GetFromWindowId(AppWindow.Id, DisplayAreaFallback.Primary);
        var workArea = displayArea.WorkArea;
        var launchWidth = ResolveLaunchDimension(workArea.Width, PreferredLaunchWidth, MinimumWorkspaceWidth);
        var launchHeight = ResolveLaunchDimension(workArea.Height, PreferredLaunchHeight, MinimumWorkspaceHeight);
        var x = workArea.X + Math.Max(0, (workArea.Width - launchWidth) / 2);
        var y = workArea.Y + Math.Max(0, (workArea.Height - launchHeight) / 2);

        AppWindow.MoveAndResize(new RectInt32(x, y, launchWidth, launchHeight));
        AppWindow.Changed += OnAppWindowChanged;
    }

    private void OnAppWindowChanged(AppWindow sender, AppWindowChangedEventArgs args)
    {
        if (!args.DidSizeChange)
        {
            return;
        }

        var currentSize = sender.Size;
        var constrainedWidth = Math.Max(currentSize.Width, MinimumWorkspaceWidth);
        var constrainedHeight = Math.Max(currentSize.Height, MinimumWorkspaceHeight);

        if (constrainedWidth == currentSize.Width && constrainedHeight == currentSize.Height)
        {
            return;
        }

        sender.Resize(new SizeInt32(constrainedWidth, constrainedHeight));
    }

    private static int ResolveLaunchDimension(int available, int preferred, int minimum)
    {
        if (available >= preferred)
        {
            return preferred;
        }

        if (available >= minimum)
        {
            return Math.Max(minimum, (int)Math.Round(available * 0.92));
        }

        return Math.Max(available - 32, (int)Math.Round(available * 0.95));
    }
}
