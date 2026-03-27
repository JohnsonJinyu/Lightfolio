import { useMemo } from 'react';

import type { AssetRecord } from '@lightfolio/shared';

import { getFileUrlCached } from '../utils/media';

interface ImagePreviewProps {
  asset: AssetRecord;
  className: string;
  mode: 'full' | 'thumb';
  size?: number;
  shouldLoad: boolean;
  onError: () => void;
}

export function ImagePreview({ asset, className, mode, size, shouldLoad, onError }: ImagePreviewProps) {
  const source = useMemo(() => {
    if (!shouldLoad) {
      return null;
    }

    return getFileUrlCached(asset.filePath, mode, size);
  }, [asset.filePath, mode, shouldLoad, size]);

  if (!source) {
    return null;
  }

  return (
    <img
      className={className}
      src={source}
      alt={asset.caption?.title ?? asset.fileName}
      loading="lazy"
      decoding="async"
      onError={onError}
    />
  );
}