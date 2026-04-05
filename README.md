# Lightfolio

Lightfolio 是一个面向个人摄影作品管理、回看与展示的本地电子相册应用，当前以 Windows 桌面体验为优先。项目基于 Electron、React 和 TypeScript 构建，采用 monorepo 结构拆分为 app、core、shared 三层。

它不是云相册，也不是素材管理系统的大而全替代品。当前方向更明确：

- 让本地文件夹可以直接成为相册来源
- 让个人摄影作品具备更舒服的浏览、整理与挑选体验
- 在不过度打扰用户的前提下，保留后续 AI 整理与内容策展的扩展空间

## 当前能力

### 导入与索引

- 支持导入单张或多张图片、视频文件
- 支持选择目录后递归扫描媒体文件
- 支持导入去重，避免同一资源重复进入时间轴
- 拍摄时间支持回退策略：EXIF 时间 -> 文件修改时间 -> 导入时间

### 浏览与整理

- 支持时间轴浏览、单图查看与底部横向胶卷栏
- 支持搜索与多维筛选
- 支持媒体类型筛选、仅收藏、仅精选、标签筛选、相机筛选、镜头筛选
- 支持收藏与精选两套语义

### 作品信息

- 支持读取并展示 EXIF 基础信息
- 支持显示相机、镜头、光圈、快门、ISO 等拍摄参数
- 支持编辑标题、说明、标签、精选状态
- 标题在未手动填写时默认以文件名兜底

### 查看器交互

- 支持双击主图放大到 100%，再次双击恢复适配视图
- 支持 Ctrl + 滚轮连续缩放
- 支持拖拽平移查看放大后的细节
- 支持缩放比例显示、缩放按钮与滑杆
- 支持主图区域全屏查看
- 支持 F / F11 快捷键切换主图全屏

### 文件安全策略

- 支持从相册移除资源，但不删除磁盘原文件
- 支持将磁盘文件移动到系统回收站
- 默认不提供常驻“恢复已移除”入口，优先保持界面简洁；需要重新纳入时，可重新导入原目录

## 项目结构

- app: Electron 主进程、preload 桥接、React renderer
- core: 导入、索引、EXIF 解析、存储逻辑
- shared: 共享类型、协议与公共数据结构
- winui: WinUI 3 + C# 迁移中的原生 Windows 版本骨架
- docs: 需求、阶段计划与开发日志

## 开发环境

- Node.js 20 或更高版本
- npm workspaces
- Windows 为当前主要验证环境

## 开发命令

在项目根目录运行：

```bash
npm install
npm run dev
```

常用命令：

```bash
npm run typecheck
npm run build
```

说明：

- `npm run dev` 会启动 app 包的 Electron 开发环境
- `npm run typecheck` 会先构建 shared，再校验 core 和 app
- `npm run build` 会顺序构建 shared、core 和 app

## 当前实现重点

当前这版已经从“原型骨架”进入“可持续迭代的本地相册工具”阶段，最近一轮主要完成了：

- 元数据编辑与收藏/精选语义补齐
- 搜索、标签、相机、镜头等多维筛选
- EXIF 读取链路修复与拍摄参数展示增强
- 更稳定的三栏布局与全宽底部胶卷栏
- 主图缩放、拖拽平移、全屏查看等查看器能力

## 当前仍在继续打磨的部分

- 极端尺寸图片下的缩放与平移边界手感
- 预览失败、导入异常等状态的反馈与恢复路径
- 更适合摄影整理的结构化字段，例如地点、人物、项目
- 更自然的精选故事流与展示编排

## 文档

- 开发日志见 [docs/development-log.md](docs/development-log.md)
- 需求记录见 [docs/requirements.md](docs/requirements.md)
- Windows 版本规划见 [docs/lightfolio-win11-photos-plan.md](docs/lightfolio-win11-photos-plan.md)
- WinUI 3 迁移方案见 [docs/lightfolio-winui3-migration-plan.md](docs/lightfolio-winui3-migration-plan.md)

## WinUI 3 迁移状态

仓库内已经新增第一批 WinUI 3 骨架代码，当前目标是并行迁移，而不是立刻删除 Electron 版本。

当前已完成：

- 新增 `winui/Lightfolio.WinUI` 与 `winui/Lightfolio.Contracts`
- 新增 WinUI 3 主窗口与首屏 Shell 页面
- 已将 `LibrarySnapshot`、`AssetRecord` 等基础模型迁移为 C# 契约模型
- WinUI 首屏已能读取本地图库快照候选路径并展示基础资产列表
- WinUI 浏览骨架已支持按月份分组的时间轴视图
- WinUI 左侧已接入搜索、仅收藏、仅精选三类基础筛选入口
- WinUI 已接入浏览态与查看态切换，以及上一张/下一张导航骨架
- WinUI 查看态已补齐更完整的作品详情结构，等待下一步接入真实位图与缩放交互
- WinUI 查看态现已能直接尝试加载本地图片，并对视频、缺文件和加载失败场景提供占位兜底
- WinUI 查看器现已支持基础缩放按钮、倍率显示，以及左右方向键、Esc、加减号、0 等查看态快捷操作
- WinUI 查看器现已支持 Ctrl + 滚轮缩放，以及放大后的鼠标拖拽平移浏览
- WinUI 查看器现已支持双击在放大查看和适配视图之间切换
- WinUI 查看态现已接入底部胶片带，可直接在当前筛选结果中横向切换资源
- WinUI 胶片带现已优先显示真实图片缩略图，视频和不可用文件会回退到占位卡片
- WinUI 胶片带现在会在当前资源切换时自动滚动到对应位置，连续浏览更连贯
- WinUI 查看态现已为视频资源接入原生播放控件，主查看区不再停留在文字占位

当前可验证命令：

```powershell
cd winui/Lightfolio.WinUI
dotnet build -c Debug -p:Platform=x64
```

当前本地启动说明：

- 该 WinUI 工程在这台机器上已禁用 `WindowsAppSdkDeploymentManagerInitialize`，以绕过本地 `DeploymentManager` COM 未注册导致的启动崩溃
- 该 WinUI 工程的 `Debug` 配置已切换为 `WindowsPackageType=None` 并显式启用 `WindowsAppSdkBootstrapInitialize`，以便在 VS Code 下按 unpackaged 桌面应用方式启动
- 构建产物可直接运行：`winui/Lightfolio.WinUI/bin/x64/Debug/net10.0-windows10.0.26100.0/Lightfolio.WinUI.exe`
- 不要对 `MainWindow.xaml.cs` 或其他单个 C# 文件使用 VS Code 的“运行当前文件”；WinUI 3 是项目型桌面应用，应通过工作区级启动配置或直接运行构建产物来启动
- 当前工作区已补充 `.vscode/tasks.json` 和 `.vscode/launch.json`，可直接在 VS Code 的“运行和调试”里选择 `Lightfolio WinUI`
- VS Code 里 `App.xaml.cs`、`MainWindow.xaml.cs`、`ShellPage.xaml.cs` 上出现的 `InitializeComponent`、`ViewerScrollHost`、`FilmstripListView` 等红线，当前属于 WinUI/XAML 生成代码的设计期假阳性；以 `dotnet build -c Debug -p:Platform=x64` 是否通过为准