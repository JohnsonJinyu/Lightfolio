import type { TimelineGroup } from '@lightfolio/shared';

export const bootTimeline: TimelineGroup[] = [
  {
    id: '2026-03',
    label: '2026 / 03',
    coverTitle: '夜色与余温',
    assets: [
      {
        id: 'boot-01',
        kind: 'image',
        source: 'files',
        filePath: 'samples/night-street.jpg',
        fileName: 'night-street.jpg',
        capturedAt: '2026-03-11T18:30:00.000Z',
        importedAt: '2026-03-25T11:30:00.000Z',
        cameraModel: 'Sony A7C II',
        lensModel: '35mm F1.8',
        aperture: 1.8,
        shutterSpeed: 0.008,
        iso: 400,
        location: { label: '待手动标记地点' },
        tags: [
          { id: 'tag-01', label: '精选' },
          { id: 'tag-02', label: '街头' }
        ],
        caption: {
          title: '夜色与余温',
          body: '用时间轴快速回看一整个拍摄阶段，也为精选作品保留更舒展的叙述空间。'
        },
        isFavorite: true,
        isFeatured: true
      },
      {
        id: 'boot-02',
        kind: 'video',
        source: 'files',
        filePath: 'samples/travel-notes.mov',
        fileName: 'travel-notes.mov',
        capturedAt: '2026-03-06T08:00:00.000Z',
        importedAt: '2026-03-25T11:30:00.000Z',
        cameraModel: 'Sony ZV-E1',
        lensModel: '24-70mm F2.8',
        tags: [{ id: 'tag-03', label: '旅途' }],
        location: { label: '待手动标记地点' },
        caption: {
          title: '旅途片段',
          body: '视频资源在同一条时间线上展示，后续也可继续扩展封面帧与片段预览。'
        },
        isFavorite: false,
        isFeatured: false
      }
    ]
  }
];