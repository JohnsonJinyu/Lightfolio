import { useEffect, useMemo, useRef, useState } from 'react';

import type { AssetRecord } from '@lightfolio/shared';

import { getFileUrlCached } from '../utils/media';

export function ProgressiveSingleImage({ asset, onError }: { asset: AssetRecord; onError: () => void }) {
  const fullSource = useMemo(() => getFileUrlCached(asset.filePath, 'full'), [asset.filePath]);
  const [displayedImage, setDisplayedImage] = useState<{ src: string; alt: string } | null>(null);
  const displayedImageRef = useRef<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    displayedImageRef.current = displayedImage;
  }, [displayedImage]);

  useEffect(() => {
    if (!fullSource) {
      setDisplayedImage(null);
      return;
    }

    let cancelled = false;
    let resolved = false;
    const image = new Image();
    image.decoding = 'async';
    image.src = fullSource;

    const markReady = () => {
      if (cancelled || resolved) {
        return;
      }

      resolved = true;

      const nextImage = {
        src: fullSource,
        alt: asset.caption?.title ?? asset.fileName
      };
      const currentImage = displayedImageRef.current;

      if (currentImage?.src === nextImage.src && currentImage.alt === nextImage.alt) {
        return;
      }

      setDisplayedImage(nextImage);
    };

    image.onload = markReady;
    image.onerror = () => {
      if (!cancelled) {
        onError();
      }
    };

    void image.decode().then(markReady).catch(() => {
      if (image.complete && image.naturalWidth > 0) {
        markReady();
        return;
      }

      if (!cancelled) {
        onError();
      }
    });

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [asset.caption?.title, asset.fileName, fullSource, onError]);

  return (
    <div className="progressive-stage">
      <div className="progressive-stage-ambient" aria-hidden="true" />
      {displayedImage ? (
        <img
          className="detail-media detail-media-full detail-media-layer-current"
          src={displayedImage.src}
          alt={displayedImage.alt}
          decoding="async"
          onError={onError}
        />
      ) : null}
    </div>
  );
}