import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  AssetCaption,
  AssetKind,
  AssetRecord,
  ImportSourceKind,
  TimelineGroup
} from '@lightfolio/shared';

import { readExifSnapshot } from '../metadata/exif.js';

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.bmp']);
const videoExtensions = new Set(['.mp4', '.mov', '.m4v', '.avi', '.webm']);

const defaultCaptions: AssetCaption[] = [
  {
    title: '光线入场',
    body: '为每一次按下快门留下时间与心境的注脚。'
  },
  {
    title: '旅途余温',
    body: '把零散素材重新编排成适合回看的作品页。'
  },
  {
    title: '慢速观看',
    body: '让精选作品以更安静的节奏呈现，而不是淹没在文件夹里。'
  }
];

function resolveKind(filePath: string): AssetKind | null {
  const extension = path.extname(filePath).toLowerCase();

  if (imageExtensions.has(extension)) {
    return 'image';
  }

  if (videoExtensions.has(extension)) {
    return 'video';
  }

  return null;
}

function titleFromName(fileName: string): string {
  return fileName.replace(path.extname(fileName), '').replace(/[\-_]+/g, ' ').trim();
}

async function resolveCapturedAt(filePath: string, exifCapturedAt: string | undefined, importedAt: string) {
  if (exifCapturedAt) {
    return exifCapturedAt;
  }

  try {
    const stats = await fs.stat(filePath);

    if (!Number.isNaN(stats.mtimeMs)) {
      return new Date(stats.mtimeMs).toISOString();
    }
  } catch {
    return importedAt;
  }

  return importedAt;
}

export async function createImportSummary(paths: string[], source: ImportSourceKind) {
  const importedAt = new Date().toISOString();
  const seenPaths = new Set<string>();
  const uniquePaths = paths.filter((filePath) => {
    const normalized = path.normalize(filePath).toLowerCase();

    if (seenPaths.has(normalized)) {
      return false;
    }

    seenPaths.add(normalized);
    return true;
  });

  const importedAssets = await Promise.all(uniquePaths.map<Promise<AssetRecord | null>>(async (filePath, index) => {
      const kind = resolveKind(filePath);

      if (!kind) {
        return null;
      }

      const fileName = path.basename(filePath);
      const exif = kind === 'image' ? await readExifSnapshot(filePath) : {};
      const capturedAt = await resolveCapturedAt(filePath, exif.capturedAt, importedAt);

      return {
        id: `${source}-${index}-${fileName}`,
        kind,
        source,
        filePath,
        fileName,
        capturedAt,
        importedAt,
        cameraModel: exif.cameraModel,
        lensModel: exif.lensModel,
        location: {
          label: '待手动标记地点'
        },
        tags: [
          { id: `${index}-tag-timeline`, label: '时间轴' },
          { id: `${index}-tag-featured`, label: index < 3 ? '精选' : '归档' }
        ],
        caption: defaultCaptions[index % defaultCaptions.length],
        isFeatured: index < 4
      } satisfies AssetRecord;
    }));

  const assets: AssetRecord[] = importedAssets.filter((asset): asset is AssetRecord => asset !== null);

  const timeline = groupAssetsByMonth(assets);
  const story = createCuratedStory(assets);

  return {
    source,
    pickedPaths: uniquePaths,
    assets,
    timeline,
    story
  };
}

export function groupAssetsByMonth(assets: AssetRecord[]): TimelineGroup[] {
  const grouped = new Map<string, AssetRecord[]>();

  for (const asset of assets) {
    const key = asset.capturedAt.slice(0, 7);
    const collection = grouped.get(key) ?? [];
    collection.push(asset);
    grouped.set(key, collection);
  }

  return Array.from(grouped.entries())
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([key, groupAssets]) => ({
      id: key,
      label: key.replace('-', ' / '),
      coverTitle: titleFromName(groupAssets[0]?.fileName ?? '未命名作品'),
      assets: groupAssets.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))
    }));
}

export function createCuratedStory(assets: AssetRecord[]) {
  const featured = assets.filter((asset) => asset.isFeatured).slice(0, 3);

  return {
    id: 'story-featured',
    title: '本期精选画册',
    summary: '把导入的作品重新编排为适合安静观看的一段视觉章节。',
    blocks: featured.map((asset, index) => ({
      id: asset.id,
      eyebrow: `章节 ${String(index + 1).padStart(2, '0')}`,
      title: asset.caption?.title ?? titleFromName(asset.fileName),
      body: asset.caption?.body ?? '为图片、视频和文字保留共同出现的位置。'
    }))
  };
}
