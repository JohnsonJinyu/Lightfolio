import path from 'node:path';

export interface ExifSnapshot {
  capturedAt?: string;
  cameraModel?: string;
  lensModel?: string;
  aperture?: number;
  shutterSpeed?: number;
  iso?: number;
}

interface RawExifFields {
  DateTimeOriginal?: Date | string;
  CreateDate?: Date | string;
  Make?: string;
  Model?: string;
  LensModel?: string;
  LensInfo?: string;
  FNumber?: number | string;
  ExposureTime?: number | string;
  ISO?: number | string;
  PhotographicSensitivity?: number | string;
}

const exifExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.bmp']);

interface ExifrReader {
  parse(input: string, options?: unknown): Promise<RawExifFields | null>;
}

let exifrModulePromise: Promise<ExifrReader | null> | null = null;

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

function normalizeNumeric(value: number | string | undefined): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes('/')) {
    const [numeratorRaw, denominatorRaw] = trimmed.split('/');
    const numerator = Number(numeratorRaw);
    const denominator = Number(denominatorRaw);

    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return undefined;
    }

    return numerator / denominator;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeCameraModel(make: string | undefined, model: string | undefined) {
  const normalizedMake = normalizeText(make);
  const normalizedModel = normalizeText(model);

  if (!normalizedMake) {
    return normalizedModel;
  }

  if (!normalizedModel) {
    return normalizedMake;
  }

  if (normalizedModel.toLowerCase().startsWith(normalizedMake.toLowerCase())) {
    return normalizedModel;
  }

  return `${normalizedMake} ${normalizedModel}`;
}

async function loadExifrModule() {
  if (!exifrModulePromise) {
    exifrModulePromise = import('exifr')
      .then((module) => {
        if (typeof module.parse === 'function') {
          return module as ExifrReader;
        }

        if (typeof module.default?.parse === 'function') {
          return module.default as ExifrReader;
        }

        return null;
      })
      .catch(() => null);
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
      pick: ['DateTimeOriginal', 'CreateDate', 'Make', 'Model', 'LensModel', 'LensInfo', 'FNumber', 'ExposureTime', 'ISO', 'PhotographicSensitivity']
    });

    if (!raw) {
      return {};
    }

    return {
      capturedAt: normalizeDate(raw.DateTimeOriginal ?? raw.CreateDate),
      cameraModel: normalizeCameraModel(raw.Make, raw.Model),
      lensModel: normalizeText(raw.LensModel ?? raw.LensInfo),
      aperture: normalizeNumeric(raw.FNumber),
      shutterSpeed: normalizeNumeric(raw.ExposureTime),
      iso: normalizeNumeric(raw.ISO ?? raw.PhotographicSensitivity)
    };
  } catch {
    return {};
  }
}
