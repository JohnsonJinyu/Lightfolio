import path from 'node:path';

export interface ExifSnapshot {
  capturedAt?: string;
  cameraModel?: string;
  lensModel?: string;
}

interface RawExifFields {
  DateTimeOriginal?: Date | string;
  CreateDate?: Date | string;
  Model?: string;
  LensModel?: string;
  LensInfo?: string;
}

const exifExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.bmp']);

let exifrModulePromise: Promise<typeof import('exifr') | null> | null = null;

function normalizeDate(value: Date | string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }

    return value.toISOString();
  }

  const normalized = value.trim().replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');

  if (!normalized) {
    return undefined;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function normalizeText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function loadExifrModule() {
  if (!exifrModulePromise) {
    exifrModulePromise = import('exifr').catch(() => null);
  }

  return exifrModulePromise;
}

export async function readExifSnapshot(filePath: string): Promise<ExifSnapshot> {
  const extension = path.extname(filePath).toLowerCase();

  if (!exifExtensions.has(extension)) {
    return {};
  }

  const exifr = await loadExifrModule();

  if (!exifr) {
    return {};
  }

  try {
    const raw = await exifr.parse(filePath, {
      pick: ['DateTimeOriginal', 'CreateDate', 'Model', 'LensModel', 'LensInfo']
    }) as RawExifFields | null;

    if (!raw) {
      return {};
    }

    return {
      capturedAt: normalizeDate(raw.DateTimeOriginal ?? raw.CreateDate),
      cameraModel: normalizeText(raw.Model),
      lensModel: normalizeText(raw.LensModel ?? raw.LensInfo)
    };
  } catch {
    return {};
  }
}
