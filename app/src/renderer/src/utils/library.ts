import type { AssetRecord, ImportSummary, TimelineGroup } from '@lightfolio/shared';

import { FILMSTRIP_THUMB_HEIGHT } from '../constants/layout';

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function mergeImportSummaries(current: ImportSummary | null, incoming: ImportSummary) {
  if (!current) {
    return incoming;
  }

  const assetMap = new Map<string, AssetRecord>();

  for (const asset of current.assets) {
    assetMap.set(asset.id, asset);
  }

  for (const asset of incoming.assets) {
    assetMap.set(asset.id, asset);
  }

  const assets = Array.from(assetMap.values()).sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));
  const grouped = new Map<string, AssetRecord[]>();

  for (const asset of assets) {
    const key = asset.capturedAt.slice(0, 7);
    const collection = grouped.get(key) ?? [];
    collection.push(asset);
    grouped.set(key, collection);
  }

  const timeline = Array.from(grouped.entries())
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([key, groupAssets]) => ({
      id: key,
      label: key.replace('-', ' / '),
      coverTitle: (groupAssets[0]?.caption?.title ?? groupAssets[0]?.fileName ?? '未命名作品').replace(/\.[^.]+$/, ''),
      assets: groupAssets.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))
    }));

  const featured = assets.filter((asset) => asset.isFeatured).slice(0, 3);

  return {
    source: incoming.source,
    pickedPaths: Array.from(new Set([...current.pickedPaths, ...incoming.pickedPaths])),
    assets,
    timeline,
    story: {
      id: 'story-featured',
      title: '本期精选画册',
      summary: '把导入的作品重新编排为适合安静观看的一段视觉章节。',
      blocks: featured.map((asset, index) => ({
        id: asset.id,
        eyebrow: `章节 ${String(index + 1).padStart(2, '0')}`,
        title: asset.caption?.title ?? asset.fileName.replace(/\.[^.]+$/, ''),
        body: asset.caption?.body ?? '为图片、视频和文字保留共同出现的位置。'
      }))
    }
  } satisfies ImportSummary;
}

export function filterTimeline(groups: TimelineGroup[], hiddenAssetIds: Set<string>): TimelineGroup[] {
  return groups
    .map((group) => ({
      ...group,
      assets: group.assets.filter((asset) => !hiddenAssetIds.has(asset.id))
    }))
    .filter((group) => group.assets.length > 0);
}

export function collectAssetMap(groups: TimelineGroup[]) {
  const map = new Map<string, AssetRecord>();

  for (const group of groups) {
    for (const asset of group.assets) {
      map.set(asset.id, asset);
    }
  }

  return map;
}

export function folderFromPath(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : '未分类目录';
}

export function folderLabel(folder: string) {
  const normalized = folder.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? folder;
}

export function tileVariant(assetId: string) {
  const seed = assetId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const bucket = seed % 5;

  if (bucket === 0) {
    return 'tile-wide';
  }

  if (bucket === 1) {
    return 'tile-tall';
  }

  return 'tile-normal';
}

export function assetAspectRatio(asset: AssetRecord) {
  if (asset.pixelWidth && asset.pixelHeight) {
    return asset.pixelWidth / asset.pixelHeight;
  }

  return 1;
}

export function filmstripThumbWidth(asset: AssetRecord) {
  return Math.max(88, Math.min(260, Math.round(FILMSTRIP_THUMB_HEIGHT * assetAspectRatio(asset))));
}