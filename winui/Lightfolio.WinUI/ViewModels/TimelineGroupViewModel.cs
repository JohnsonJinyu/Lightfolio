using System.Collections.ObjectModel;

namespace Lightfolio.WinUI.ViewModels;

public sealed class TimelineGroupViewModel
{
    public TimelineGroupViewModel(string label, string coverTitle, IEnumerable<AssetItemViewModel> assets)
    {
        Label = label;
        CoverTitle = coverTitle;
        Assets = new ObservableCollection<AssetItemViewModel>(assets);
    }

    public string Label { get; }

    public string CoverTitle { get; }

    public ObservableCollection<AssetItemViewModel> Assets { get; }
}