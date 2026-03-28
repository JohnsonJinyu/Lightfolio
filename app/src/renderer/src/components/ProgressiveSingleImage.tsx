import { useEffect, useMemo, useRef, useState } from 'react';

import type { AssetRecord } from '@lightfolio/shared';

import { getFileUrlCached } from '../utils/media';

const ZOOM_MAX = 400;
const ZOOM_STEP = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ProgressiveSingleImage({
  asset,
  onError,
  onZoomAnimationChange
}: {
  asset: AssetRecord;
  onError: () => void;
  onZoomAnimationChange?: (isAnimating: boolean) => void;
}) {
  const fullSource = useMemo(() => getFileUrlCached(asset.filePath, 'full'), [asset.filePath]);
  const [displayedImage, setDisplayedImage] = useState<{ src: string; alt: string; width: number; height: number } | null>(null);
  const displayedImageRef = useRef<{ src: string; alt: string; width: number; height: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number | null; startX: number; startY: number; originX: number; originY: number }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoomPercent, setZoomPercent] = useState<number | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isZoomAnimating, setIsZoomAnimating] = useState(false);
  const zoomAnimationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    displayedImageRef.current = displayedImage;
  }, [displayedImage]);

  useEffect(() => {
    onZoomAnimationChange?.(isZoomAnimating);
  }, [isZoomAnimating, onZoomAnimationChange]);

  useEffect(() => {
    const element = stageRef.current;

    if (!element) {
      return;
    }

    const update = () => {
      setContainerSize({
        width: element.clientWidth,
        height: element.clientHeight
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    setZoomPercent(null);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
    setIsZoomAnimating(false);
    dragStateRef.current.pointerId = null;

    if (zoomAnimationTimerRef.current) {
      window.clearTimeout(zoomAnimationTimerRef.current);
      zoomAnimationTimerRef.current = null;
    }
  }, [asset.id]);

  useEffect(() => {
    return () => {
      if (zoomAnimationTimerRef.current) {
        window.clearTimeout(zoomAnimationTimerRef.current);
      }
    };
  }, []);

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
        alt: asset.caption?.title ?? asset.fileName,
        width: image.naturalWidth,
        height: image.naturalHeight
      };
      const currentImage = displayedImageRef.current;

      if (
        currentImage?.src === nextImage.src
        && currentImage.alt === nextImage.alt
        && currentImage.width === nextImage.width
        && currentImage.height === nextImage.height
      ) {
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

  const fitZoomPercent = useMemo(() => {
    if (!displayedImage || containerSize.width <= 0 || containerSize.height <= 0) {
      return 100;
    }

    return Math.min(containerSize.width / displayedImage.width, containerSize.height / displayedImage.height) * 100;
  }, [containerSize.height, containerSize.width, displayedImage]);

  const minZoomPercent = useMemo(() => {
    return Math.max(10, Math.min(fitZoomPercent, 100));
  }, [fitZoomPercent]);

  const currentZoomPercent = zoomPercent ?? fitZoomPercent;
  const renderedWidth = displayedImage ? displayedImage.width * (currentZoomPercent / 100) : 0;
  const renderedHeight = displayedImage ? displayedImage.height * (currentZoomPercent / 100) : 0;
  const maxPanX = Math.max(0, (renderedWidth - containerSize.width) / 2);
  const maxPanY = Math.max(0, (renderedHeight - containerSize.height) / 2);
  const canPan = maxPanX > 0 || maxPanY > 0;

  useEffect(() => {
    setPan((previous) => ({
      x: clamp(previous.x, -maxPanX, maxPanX),
      y: clamp(previous.y, -maxPanY, maxPanY)
    }));
  }, [maxPanX, maxPanY]);

  function applyZoom(nextZoomPercent: number | null, options?: { anchorClientX?: number; anchorClientY?: number; animate?: boolean }) {
    if (!displayedImage || !stageRef.current) {
      return;
    }

    const { anchorClientX, anchorClientY, animate = false } = options ?? {};

    const nextZoom = nextZoomPercent === null ? fitZoomPercent : clamp(nextZoomPercent, minZoomPercent, ZOOM_MAX);
    const rect = stageRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const nextRenderedWidth = displayedImage.width * (nextZoom / 100);
    const nextRenderedHeight = displayedImage.height * (nextZoom / 100);
    const previousRenderedWidth = displayedImage.width * (currentZoomPercent / 100);
    const previousRenderedHeight = displayedImage.height * (currentZoomPercent / 100);

    let nextPanX = pan.x;
    let nextPanY = pan.y;

    if (anchorClientX !== undefined && anchorClientY !== undefined && previousRenderedWidth > 0 && previousRenderedHeight > 0) {
      const localX = anchorClientX - rect.left - centerX - pan.x;
      const localY = anchorClientY - rect.top - centerY - pan.y;
      const imageRatioX = localX / previousRenderedWidth;
      const imageRatioY = localY / previousRenderedHeight;

      nextPanX = anchorClientX - rect.left - centerX - imageRatioX * nextRenderedWidth;
      nextPanY = anchorClientY - rect.top - centerY - imageRatioY * nextRenderedHeight;
    } else if (previousRenderedWidth > 0 && previousRenderedHeight > 0) {
      nextPanX = pan.x * (nextRenderedWidth / previousRenderedWidth);
      nextPanY = pan.y * (nextRenderedHeight / previousRenderedHeight);
    }

    const nextMaxPanX = Math.max(0, (nextRenderedWidth - rect.width) / 2);
    const nextMaxPanY = Math.max(0, (nextRenderedHeight - rect.height) / 2);

    if (zoomAnimationTimerRef.current) {
      window.clearTimeout(zoomAnimationTimerRef.current);
      zoomAnimationTimerRef.current = null;
    }

    setIsZoomAnimating(animate);

    if (animate) {
      zoomAnimationTimerRef.current = window.setTimeout(() => {
        setIsZoomAnimating(false);
        zoomAnimationTimerRef.current = null;
      }, 380);
    }

    setZoomPercent(nextZoomPercent === null ? null : nextZoom);
    setPan({
      x: clamp(nextPanX, -nextMaxPanX, nextMaxPanX),
      y: clamp(nextPanY, -nextMaxPanY, nextMaxPanY)
    });
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const delta = -event.deltaY;
    const direction = delta === 0 ? 0 : delta > 0 ? 1 : -1;

    if (direction === 0) {
      return;
    }

    const nextZoom = clamp(currentZoomPercent + direction * ZOOM_STEP, minZoomPercent, ZOOM_MAX);
    applyZoom(nextZoom, { anchorClientX: event.clientX, anchorClientY: event.clientY });
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (Math.abs(currentZoomPercent - 100) > 1) {
      applyZoom(100, { anchorClientX: event.clientX, anchorClientY: event.clientY, animate: true });
      return;
    }

    applyZoom(null, { animate: true });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!canPan) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setIsZoomAnimating(false);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const deltaX = event.clientX - dragStateRef.current.startX;
    const deltaY = event.clientY - dragStateRef.current.startY;
    setPan({
      x: clamp(dragStateRef.current.originX + deltaX, -maxPanX, maxPanX),
      y: clamp(dragStateRef.current.originY + deltaY, -maxPanY, maxPanY)
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current.pointerId = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const zoomLabel = `${Math.round(currentZoomPercent)}%`;

  return (
    <div
      ref={stageRef}
      className={`progressive-stage ${canPan ? 'progressive-stage-pannable' : ''} ${isDragging ? 'progressive-stage-dragging' : ''}`}
      onWheelCapture={handleWheel}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title="双击切换 100% 缩放，按住 Ctrl + 滚轮可连续缩放"
    >
      <div className="progressive-stage-ambient" aria-hidden="true" />
      {displayedImage ? (
        <img
          className={`detail-media detail-media-full detail-media-layer-current ${currentZoomPercent > fitZoomPercent + 1 ? 'detail-media-zoomed' : ''} ${isZoomAnimating ? 'detail-media-zoom-animating' : ''}`}
          src={displayedImage.src}
          alt={displayedImage.alt}
          decoding="async"
          onError={onError}
          draggable={false}
          style={{
            width: `${renderedWidth}px`,
            height: `${renderedHeight}px`,
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`
          }}
        />
      ) : null}
      <div className="viewer-zoom-controls" onPointerDown={(event) => event.stopPropagation()}>
        <button className="viewer-zoom-button" type="button" onClick={() => applyZoom(currentZoomPercent - 10, { animate: true })} aria-label="缩小">-</button>
        <input
          className="viewer-zoom-slider"
          type="range"
          min={Math.floor(minZoomPercent)}
          max={ZOOM_MAX}
          step={ZOOM_STEP}
          value={Math.round(currentZoomPercent)}
          onChange={(event) => applyZoom(Number(event.target.value), { animate: true })}
          aria-label="缩放比例"
        />
        <button className="viewer-zoom-button" type="button" onClick={() => applyZoom(currentZoomPercent + 10, { animate: true })} aria-label="放大">+</button>
        <button className="viewer-zoom-value" type="button" onClick={() => applyZoom(null, { animate: true })} title="恢复适应窗口">{zoomLabel}</button>
      </div>
    </div>
  );
}