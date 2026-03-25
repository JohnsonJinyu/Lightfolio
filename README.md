# Lightfolio

Lightfolio 是一个面向 Windows 首发的摄影作品电子相册项目，定位为适合自己回看和对外展示的本地作品集应用。首版基于 Electron、React、TypeScript 构建，支持导入本地目录，也支持直接添加单张或多张图片文件，并为后续 AI 分析能力预留接口。

## 首版目标

- 导入本地图片目录
- 直接添加单张或多张图片文件
- 按时间轴浏览图片和视频
- 提供精选画册式图文展示入口
- 作品详情页展示 EXIF、作品说明和标签
- 支持基础搜索与筛选
- 为人脸识别、场景分析和地点推断保留扩展点

## 项目结构

- app: Electron 主进程、预加载桥接与 React 界面
- core: 导入、索引、元数据、存储适配层
- shared: 共享类型与跨层协议

## 开发命令

在项目根目录运行：

```bash
npm install
npm run dev
```

其他命令：

```bash
npm run typecheck
npm run build
```

## 当前实现状态

- 已搭建 Electron + React + TypeScript 工作区
- 已提供目录导入与文件导入的主流程入口
- 已提供时间轴、精选画册、详情面板的首版界面
- 已抽出 shared/core 两层，后续可接入真实 EXIF 解析、SQLite、缩略图缓存与 AI provider

## 下一步建议

1. 把目录导入从占位示例切换为真实递归扫描
2. 接入 EXIF 解析与拍摄时间优先排序
3. 引入 SQLite 持久化与缩略图缓存
4. 增加标签编辑、说明编辑和搜索状态管理
5. 再接入 AI 分析 provider