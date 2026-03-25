import { useEffect, useState } from 'react';

import type { AssetRecord, ImportSummary, TimelineGroup } from '@lightfolio/shared';

const bootTimeline: TimelineGroup[] = [
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
        location: { label: '待手动标记地点' },
        tags: [
          { id: 'tag-01', label: '精选' },
          { id: 'tag-02', label: '街头' }
        ],
        caption: {
          title: '夜色与余温',
          body: '用时间轴快速回看一整个拍摄阶段，也为精选作品保留更舒展的叙述空间。'
        },
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
        tags: [{ id: 'tag-03', label: '旅途' }],
        location: { label: '待手动标记地点' },
        caption: {
          title: '旅途片段',
          body: '视频资源在同一条时间线上展示，后续也可继续扩展封面帧与片段预览。'
        },
        isFeatured: false
      }
    ]
  }
];

const bootStory = {
  title: '本期精选画册',
  summary: '把图片、视频与作品说明组合成更适合回看的章节，而不是散落在文件夹里。',
  blocks: [
    {
      id: 'story-01',
      eyebrow: '章节 01',
      title: '从归档到观看',
      body: '先用目录导入搭起完整时间线，再把单张图片直接补进作品集。'
    },
    {
      id: 'story-02',
      eyebrow: '章节 02',
      title: '保留作品说明',
      body: '让一段文字和一张图一起出现，避免成品只剩下日期和文件名。'
    },
    {
      id: 'story-03',
      eyebrow: '章节 03',
      title: '为 AI 预留位置',
      body: '先把结构搭好，后续再接入人脸识别、场景分析与地点推断。'
    }
  ]
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
}

function latestAsset(groups: TimelineGroup[]): AssetRecord | null {
  return groups.flatMap((group) => group.assets)[0] ?? null;
}

function filterTimeline(groups: TimelineGroup[], hiddenAssetIds: Set<string>): TimelineGroup[] {
  return groups
    .map((group) => ({
      ...group,
      assets: group.assets.filter((asset) => !hiddenAssetIds.has(asset.id))
    }))
    .filter((group) => group.assets.length > 0);
}

function collectAssetMap(groups: TimelineGroup[]) {
  const map = new Map<string, AssetRecord>();

  for (const group of groups) {
    for (const asset of group.assets) {
      map.set(asset.id, asset);
    }
  }

  return map;
}

function ImagePreview({
  asset,
  className,
  onError
}: {
  asset: AssetRecord;
  className: string;
  onError: () => void;
}) {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    window.lightfolio.loadImageDataUrl(asset.filePath)
      .then((dataUrl) => {
        if (cancelled) {
          return;
        }

        if (!dataUrl) {
          onError();
          return;
        }

        setSource(dataUrl);
      })
      .catch(() => {
        if (!cancelled) {
          onError();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [asset.filePath]);

  if (!source) {
    return null;
  }

  return (
    <img
      className={className}
      src={source}
      alt={asset.caption?.title ?? asset.fileName}
    />
  );
}

export function App() {
  const [importState, setImportState] = useState<ImportSummary | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [hiddenAssetIds, setHiddenAssetIds] = useState<Set<string>>(new Set());
  const [removedFromAlbumIds, setRemovedFromAlbumIds] = useState<string[]>([]);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);
  const [failedPreviewIds, setFailedPreviewIds] = useState<Set<string>>(new Set());

  const sourceTimeline = importState?.timeline ?? bootTimeline;
  const assetMap = collectAssetMap(sourceTimeline);
  const timeline = filterTimeline(sourceTimeline, hiddenAssetIds);
  const story = importState?.story ?? bootStory;
  const selected = selectedAssetId
    ? timeline.flatMap((group) => group.assets).find((asset) => asset.id === selectedAssetId) ?? latestAsset(timeline)
    : latestAsset(timeline);
  const removedAssets = removedFromAlbumIds
    .map((assetId) => assetMap.get(assetId))
    .filter((asset): asset is AssetRecord => Boolean(asset));
  const previewFailureCount = failedPreviewIds.size;
  const totalAssets = timeline.reduce((total, group) => total + group.assets.length, 0);
  const activeSource = importState?.source === 'directory' ? '目录导入' : importState?.source === 'files' ? '文件导入' : '示例内容';
  const activeGroupCount = timeline.length;
  const latestCapturedAt = timeline[0]?.assets[0]?.capturedAt;
  const overviewCards = [
    {
      id: 'overview-source',
      label: '当前导入',
      value: activeSource,
      detail: `已载入 ${totalAssets} 个资源`
    },
    {
      id: 'overview-groups',
      label: '时间范围',
      value: latestCapturedAt ? formatDate(latestCapturedAt) : '尚未导入',
      detail: `${activeGroupCount} 个时间分组`
    },
    {
      id: 'overview-selected',
      label: '当前选中',
      value: selected?.caption?.title ?? selected?.fileName ?? '未选择作品',
      detail: selected?.cameraModel ?? '可在右侧查看详细信息'
    }
  ];

  async function runImport(mode: 'files' | 'directory') {
    setIsBusy(true);
    setDeleteFeedback(null);

    try {
      const summary = mode === 'files'
        ? await window.lightfolio.pickFiles()
        : await window.lightfolio.pickDirectory();

      if (summary) {
        setImportState(summary);
        setHiddenAssetIds(new Set());
        setRemovedFromAlbumIds([]);
        setSelectedAssetId(summary.assets[0]?.id ?? null);
        setFailedPreviewIds(new Set());
      }
    } finally {
      setIsBusy(false);
    }
  }

  function markPreviewFailed(assetId: string) {
    setFailedPreviewIds((previous) => {
      if (previous.has(assetId)) {
        return previous;
      }

      const next = new Set(previous);
      next.add(assetId);
      return next;
    });
  }

  function removeFromAlbum(asset: AssetRecord) {
    setHiddenAssetIds((previous) => {
      const next = new Set(previous);
      next.add(asset.id);
      return next;
    });

    setRemovedFromAlbumIds((previous) => {
      if (previous.includes(asset.id)) {
        return previous;
      }

      return [asset.id, ...previous];
    });

    setSelectedAssetId(null);
    setDeleteFeedback(`已从相册隐藏 ${asset.fileName}，原文件仍保留在磁盘中。`);
  }

  async function deleteFromDisk(asset: AssetRecord) {
    const approved = window.confirm(`将 ${asset.fileName} 移动到系统回收站？该操作会影响磁盘源文件。`);

    if (!approved) {
      return;
    }

    setIsBusy(true);
    setDeleteFeedback(null);

    try {
      const deleted = await window.lightfolio.deleteFile(asset.filePath);

      if (deleted) {
        setHiddenAssetIds((previous) => {
          const next = new Set(previous);
          next.add(asset.id);
          return next;
        });

        setRemovedFromAlbumIds((previous) => previous.filter((item) => item !== asset.id));
        setSelectedAssetId(null);
        setDeleteFeedback(`已将 ${asset.fileName} 移动到系统回收站。`);
      } else {
        setDeleteFeedback(`删除失败：无法处理 ${asset.fileName}。`);
      }
    } finally {
      setIsBusy(false);
    }
  }

  function restoreAsset(assetId: string) {
    setHiddenAssetIds((previous) => {
      const next = new Set(previous);
      next.delete(assetId);
      return next;
    });

    setRemovedFromAlbumIds((previous) => previous.filter((item) => item !== assetId));
    setSelectedAssetId(assetId);
    setDeleteFeedback(null);
  }

  function restoreAllFromAlbum() {
    if (removedFromAlbumIds.length === 0) {
      return;
    }

    setHiddenAssetIds((previous) => {
      const next = new Set(previous);

      for (const assetId of removedFromAlbumIds) {
        next.delete(assetId);
      }

      return next;
    });

    setRemovedFromAlbumIds([]);
    setDeleteFeedback(null);
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div>
            <p className="brand-kicker">Photography Archive</p>
            <h1>Lightfolio</h1>
            <p className="brand-copy">
              为作品建立一条适合回看的时间轴，再把精选内容编排成静态画册。
            </p>
          </div>

          <div className="actions">
            <button className="button button-primary" onClick={() => runImport('directory')} disabled={isBusy}>
              添加目录
            </button>
            <button className="button button-secondary" onClick={() => runImport('files')} disabled={isBusy}>
              直接添加图片
            </button>
          </div>

          {previewFailureCount > 0 ? (
            <p className="hint-line">有 {previewFailureCount} 个文件暂时无法预览，可能是格式不支持或路径权限问题。</p>
          ) : null}
        </div>

        <div className="sidebar-bottom">
          <dl className="stats">
            <div>
              <dt>资源数量</dt>
              <dd>{timeline.reduce((total, group) => total + group.assets.length, 0)}</dd>
            </div>
            <div>
              <dt>导入方式</dt>
              <dd>{importState?.source === 'directory' ? '目录' : importState?.source === 'files' ? '文件' : '示例'}</dd>
            </div>
            <div>
              <dt>AI 扩展</dt>
              <dd>已预留接口</dd>
            </div>
            <div>
              <dt>已移除（相册）</dt>
              <dd>{removedAssets.length}</dd>
            </div>
          </dl>

          {removedAssets.length > 0 ? (
            <div className="restore-panel">
              <div className="restore-head">
                <p>已从相册移除</p>
                <button className="button button-ghost" onClick={restoreAllFromAlbum} disabled={isBusy}>恢复全部</button>
              </div>
              <div className="restore-list">
                {removedAssets.slice(0, 6).map((asset) => (
                  <button key={asset.id} className="restore-item" onClick={() => restoreAsset(asset.id)} disabled={isBusy}>
                    {asset.fileName}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="content">
        <section className="hero-card">
          <div className="hero-copy">
            <p className="section-kicker">Lightfolio Workspace</p>
            <h2>把照片整理成适合浏览的摄影时间轴</h2>
            <p>
              当前界面以时间轴为主视图，右侧保留单张作品的沉浸式查看区。导入之后先快速筛图，再逐张查看与整理。
            </p>
            <div className="hero-pill-row">
              <span className="hero-pill">{totalAssets} 个资源</span>
              <span className="hero-pill">{activeGroupCount} 个分组</span>
              <span className="hero-pill">{removedAssets.length} 个已隐藏</span>
            </div>
          </div>

          <div className="story-grid">
            {overviewCards.map((card) => (
              <article className="story-card" key={card.id}>
                <p>{card.label}</p>
                <h3>{card.value}</h3>
                <span>{card.detail}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="workspace-grid">
          <div className="timeline-panel">
            <div className="panel-head panel-head-timeline">
              <div>
                <p className="section-kicker">时间轴</p>
                <h2>按拍摄阶段浏览作品</h2>
              </div>
              <div className="panel-summary">
                <span>{activeSource}</span>
                <span>{totalAssets} 项资源</span>
              </div>
            </div>

            <div className="timeline-list">
              {timeline.map((group) => (
                <section className="timeline-group" key={group.id}>
                  <div className="timeline-header">
                    <div>
                      <p>{group.label}</p>
                      <h3>{group.coverTitle}</h3>
                    </div>
                    <span>{group.assets.length} 项</span>
                  </div>

                  <div className="asset-grid">
                    {group.assets.map((asset) => (
                      <article
                        className={`asset-card ${selected?.id === asset.id ? 'asset-card-selected' : ''}`}
                        key={asset.id}
                        onClick={() => setSelectedAssetId(asset.id)}
                      >
                        <div className={`asset-preview asset-preview-${asset.kind}`}>
                          {!failedPreviewIds.has(asset.id) ? (
                            asset.kind === 'image' ? (
                              <ImagePreview asset={asset} className="asset-media" onError={() => markPreviewFailed(asset.id)} />
                            ) : (
                              <div className="video-placeholder" />
                            )
                          ) : null}
                          <span>{asset.kind === 'image' ? 'IMAGE' : 'VIDEO'}</span>
                        </div>
                        <div className="asset-meta">
                          <h4>{asset.caption?.title ?? asset.fileName}</h4>
                          <p>{formatDate(asset.capturedAt)}</p>
                          <div className="chip-row">
                            {asset.tags.map((tag) => (
                              <span className="chip" key={tag.id}>{tag.label}</span>
                            ))}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="detail-rail">
            <div className="detail-panel">
              <div className="panel-head panel-head-detail">
                <div>
                  <p className="section-kicker">详情</p>
                  <h2>{selected?.fileName ?? '作品信息'}</h2>
                </div>
              </div>

              {selected ? (
                <div className="detail-card">
                <div className={`detail-preview detail-preview-${selected.kind}`}>
                  {!failedPreviewIds.has(selected.id) ? (
                    selected.kind === 'image' ? (
                      <ImagePreview asset={selected} className="detail-media" onError={() => markPreviewFailed(selected.id)} />
                    ) : (
                      <div className="video-placeholder detail-media" />
                    )
                  ) : null}
                  <span>{selected.kind === 'image' ? '精选图片' : '视频资源'}</span>
                </div>
                <div className="detail-copy">
                  <h3>{selected.caption?.title ?? selected.fileName}</h3>
                  <p>{selected.caption?.body ?? '在这里为作品补充文字、地点和标签。'}</p>
                </div>
                <dl className="meta-list">
                  <div>
                    <dt>拍摄时间</dt>
                    <dd>{formatDate(selected.capturedAt)}</dd>
                  </div>
                  <div>
                    <dt>设备</dt>
                    <dd>{selected.cameraModel ?? '待接入 EXIF 解析'}</dd>
                  </div>
                  <div>
                    <dt>镜头</dt>
                    <dd>{selected.lensModel ?? '待接入镜头信息'}</dd>
                  </div>
                  <div>
                    <dt>地点</dt>
                    <dd>{selected.location?.label ?? '未标记'}</dd>
                  </div>
                </dl>
                <div className="detail-actions">
                  <button className="button button-secondary" onClick={() => removeFromAlbum(selected)} disabled={isBusy}>
                    从相册移除（不删原文件）
                  </button>
                  <button className="button button-danger" onClick={() => deleteFromDisk(selected)} disabled={isBusy}>
                    删除磁盘文件（回收站）
                  </button>
                </div>
                  {deleteFeedback ? <p className="feedback-line">{deleteFeedback}</p> : null}
                </div>
              ) : (
                <div className="detail-empty">
                  <p>当前没有可展示的作品。</p>
                  {removedAssets.length > 0 ? (
                    <button className="button button-secondary" onClick={restoreAllFromAlbum} disabled={isBusy}>恢复已移除作品</button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
