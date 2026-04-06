# Lightfolio UI 优化重点

这份清单不是泛化的设计建议，而是基于当前 Electron 工作台和 WinUI 工作台的实际结构整理出来的优先级。

## 1. 先压低顶部工具条的认知负担

当前顶栏同时承载了品牌、搜索、媒体筛选、收藏筛选、精选筛选、导入、视图切换、帮助等多个层级的信息。它功能全，但第一眼负担偏重。

建议：

- 顶栏只保留全局动作：品牌、搜索、导入、视图切换、快捷帮助。
- 将媒体类型、收藏、精选这类持续性筛选统一收进左栏，顶部只保留当前筛选结果的摘要标签。
- 用一排可关闭的筛选胶囊展示当前激活条件，例如“照片”“Sony A7C II”“仅收藏”。

为什么优先做这一项：

- 这是当前最直接影响第一次上手感受的地方。
- 这项调整不需要推翻现有架构，只是重排信息层级。
- Electron 端的 TopBar 和 WinUI 的 Shell 顶栏都存在相同问题，优化后两端都能受益。

落点文件：

- app/src/renderer/src/components/TopBar.tsx
- app/src/renderer/src/styles/global.css
- winui/Lightfolio.WinUI/Views/ShellPage.xaml

## 2. 提高浏览页的扫图效率，而不是继续堆信息

Lightfolio 的核心不是“设置很多”，而是“快速挑片、回看、决定保留什么”。所以浏览页应该优先强化视觉扫描，而不是元信息密度。

建议：

- 强化当前选中态：缩略图选中后应有更明确的描边、亮度抬升和投影，不只依赖轻微底色差异。
- 月份分组标题改成 sticky header，滚动时保持当前时间段可见。
- 缩略图底部文字减少到两行以内，更多信息交给 hover 或右侧详情。
- 为照片和视频建立更明显的视觉区分，例如视频时长角标、视频专属蒙层。

为什么优先做这一项：

- 浏览页是停留时间最长的界面。
- 如果扫图速度不够快，后续 EXIF、标签、精选等能力价值都会被稀释。

落点文件：

- app/src/renderer/src/components/WaterfallGrid.tsx
- app/src/renderer/src/styles/global.css
- winui/Lightfolio.WinUI/Views/ShellPage.xaml

## 3. 让查看器更像“看作品”，而不是“看管理后台”

当前查看器已经具备缩放、拖拽、胶卷和详情，但还有进一步聚焦作品本身的空间。

建议：

- 进入查看态后默认减弱顶层 chrome 的存在感，让主图成为最亮区域。
- 详情栏默认展示“最重要的第一屏”，例如标题、拍摄时间、设备、收藏/精选，其余信息折叠。
- 胶卷在鼠标离开或进入全屏时可以变成 peek 状态，只保留一条轻量提示带。
- 全屏态下保留最少量控制，仅在移动鼠标时唤起。

为什么优先做这一项：

- 现在的功能已经够用，下一步差异化主要来自观看感受。
- 这是最能直接拉开和系统照片应用差异的部分。

落点文件：

- app/src/renderer/src/components/SingleViewer.tsx
- app/src/renderer/src/components/DetailPanel.tsx
- winui/Lightfolio.WinUI/Views/ShellPage.xaml
- winui/Lightfolio.WinUI/Views/ShellPage.xaml.cs

## 4. 把导入、失败和空状态做得更明确

当前你已经补齐了导入、筛选、EXIF 和缩放链路，但状态反馈还可以更“产品化”。

建议：

- 导入中明确区分“扫描中”“读取元数据中”“完成”三个阶段。
- 空库状态要给出明确下一步，只显示按钮还不够，最好带一句解释性文案。
- 预览失败不能只报失败数量，最好能标出失败资源，并提供快速重试或在资源管理器打开。
- 首次导入完成后，给一个轻量结果总结，例如导入数量、去重数量、覆盖时间范围。

为什么优先做这一项：

- 这是最容易影响“程序是否可靠”的部分。
- 用户对失败和等待的容忍度，往往比对视觉样式更低。

落点文件：

- app/src/renderer/src/App.tsx
- app/src/renderer/src/components/Sidebar.tsx
- winui/Lightfolio.WinUI/ViewModels/ShellViewModel.cs
- winui/Lightfolio.WinUI/Views/ShellPage.xaml

## 5. 统一 Electron 和 WinUI 的设计令牌

现在两端已经在往同一种工作台气质靠拢，但配色、间距、圆角、动画时长还没有形成一份统一规范。

建议：

- 建立一份最小设计令牌表：颜色、文字层级、圆角、阴影、边框透明度、动画时长。
- 先不追求复杂设计系统，优先保证两端的视觉判断一致。
- 把“主背景、面板背景、悬浮层、选中态、危险动作态”定义清楚，避免后面继续漂移。

建议的视觉基线：

- 主色方向继续沿用深海军蓝加冷白高光，不要切回系统灰白默认气质。
- 圆角以 12、16、20 为主，不要在同一屏里混太多等级。
- 动画时长集中在 160ms、240ms、420ms 三档，避免每个组件各自定义。

落点文件：

- app/src/renderer/src/styles/theme.css
- app/src/renderer/src/styles/global.css
- winui/Lightfolio.WinUI/Views/ShellPage.xaml
- winui/Lightfolio.WinUI/App.xaml

## 图标方向和 UI 应该如何统一

这次图标建议采用的不是传统相机快门，而是“发光的相片页”语言：

- 左侧竖向光带代表 Light。
- 底部横向光带和三枚页签代表 Folio。
- 深色玻璃背景和冷白高光与当前工作台 UI 保持统一。

这样做的好处是：

- 比“相机快门”更不容易落入素材管理软件的通用感。
- 和你现在已经建立起来的工作台 UI 语气一致。
- 在 WinUI 的任务栏、开始菜单和启动页上都更容易形成统一识别。

## 最值得先动手的三项

如果只做三项，我建议按这个顺序：

1. 顶栏减负，把持续性筛选收回左栏。
2. 浏览页选中态和分组标题强化，提升扫图效率。
3. 查看态 chrome 降噪，让主图、胶卷、详情形成更清楚的主次。