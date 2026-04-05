using Microsoft.UI.Xaml;
using Lightfolio.WinUI.ViewModels;
using Lightfolio.WinUI.Views;

namespace Lightfolio.WinUI;

public sealed partial class MainWindow : Window
{
    public MainWindow(ShellViewModel shellViewModel)
    {
        InitializeComponent();

        ExtendsContentIntoTitleBar = true;
        SetTitleBar(AppTitleBar);

        RootContentPresenter.Content = new ShellPage(shellViewModel);
        AppWindow.SetIcon("Assets/AppIcon.ico");
    }
}
