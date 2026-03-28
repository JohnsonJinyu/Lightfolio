import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

interface ResizeSession<T extends string> {
  upperKey: T;
  lowerKey: T;
  startY: number;
  upperHeight: number;
  lowerHeight: number;
}

const minimumPairResizeSlack = 24;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function areSizesEqual<T extends string>(left: Record<T, number>, right: Record<T, number>) {
  return Object.keys(left).every((key) => left[key as T] === right[key as T]);
}

export function useResizableSectionStack<T extends string>(
  defaultSizes: Record<T, number>,
  minHeight = 88,
  persistedSizes?: Partial<Record<T, number>>,
  minimumSizes?: Partial<Record<T, number>>,
  onSizesChange?: (sizes: Record<T, number>) => void
) {
  function resolveMinimumSize(key: T) {
    return Math.max(minHeight, minimumSizes?.[key] ?? 0);
  }

  const mergedInitialSizes = {
    ...defaultSizes,
    ...persistedSizes
  } as Record<T, number>;
  const [sizes, setSizes] = useState<Record<T, number>>(() => Object.fromEntries(
    Object.entries(mergedInitialSizes).map(([key, value]) => [key, Math.max(value as number, resolveMinimumSize(key as T))])
  ) as Record<T, number>);
  const [activeDivider, setActiveDivider] = useState<string | null>(null);
  const sessionRef = useRef<ResizeSession<T> | null>(null);

  useEffect(() => {
    const nextSizes = {
      ...defaultSizes,
      ...persistedSizes
    } as Record<T, number>;

    const clampedSizes = Object.fromEntries(
      Object.entries(nextSizes).map(([key, value]) => [key, Math.max(value as number, resolveMinimumSize(key as T))])
    ) as Record<T, number>;

    setSizes((previous) => areSizesEqual(previous, clampedSizes) ? previous : clampedSizes);
  }, [defaultSizes, minimumSizes, persistedSizes]);

  useEffect(() => {
    if (activeDivider !== null) {
      return;
    }

    onSizesChange?.(sizes);
  }, [activeDivider, onSizesChange, sizes]);

  const beginResize = useCallback((upperKey: T, lowerKey: T) => (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();

    sessionRef.current = {
      upperKey,
      lowerKey,
      startY: event.clientY,
      upperHeight: sizes[upperKey],
      lowerHeight: sizes[lowerKey]
    };
    setActiveDivider(`${upperKey}-${lowerKey}`);
  }, [sizes]);

  const resetSizes = useCallback(() => {
    setSizes(Object.fromEntries(
      Object.entries(defaultSizes).map(([key, value]) => [key, Math.max(value as number, resolveMinimumSize(key as T))])
    ) as Record<T, number>);
  }, [defaultSizes, minimumSizes]);

  useEffect(() => {
    if (!activeDivider) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const session = sessionRef.current;

      if (!session) {
        return;
      }

      const upperMin = resolveMinimumSize(session.upperKey);
      const lowerMin = resolveMinimumSize(session.lowerKey);
      const pairTotal = Math.max(
        session.upperHeight + session.lowerHeight,
        upperMin + lowerMin + minimumPairResizeSlack
      );
      const nextUpper = clamp(session.upperHeight + (event.clientY - session.startY), upperMin, pairTotal - lowerMin);
      const nextLower = pairTotal - nextUpper;

      setSizes((previous) => ({
        ...previous,
        [session.upperKey]: nextUpper,
        [session.lowerKey]: nextLower
      }));
    }

    function endResize() {
      sessionRef.current = null;
      setActiveDivider(null);
    }

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', endResize);
    window.addEventListener('pointercancel', endResize);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', endResize);
      window.removeEventListener('pointercancel', endResize);
    };
  }, [activeDivider, minHeight, minimumSizes]);

  return {
    sizes,
    activeDivider,
    isResizing: activeDivider !== null,
    beginResize,
    resetSizes
  };
}