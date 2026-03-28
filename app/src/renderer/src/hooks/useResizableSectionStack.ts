import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

interface ResizeSession<T extends string> {
  upperKey: T;
  lowerKey: T;
  startY: number;
  upperHeight: number;
  lowerHeight: number;
}

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
  onSizesChange?: (sizes: Record<T, number>) => void
) {
  const mergedInitialSizes = {
    ...defaultSizes,
    ...persistedSizes
  } as Record<T, number>;
  const [sizes, setSizes] = useState<Record<T, number>>(mergedInitialSizes);
  const [activeDivider, setActiveDivider] = useState<string | null>(null);
  const sessionRef = useRef<ResizeSession<T> | null>(null);

  useEffect(() => {
    const nextSizes = {
      ...defaultSizes,
      ...persistedSizes
    } as Record<T, number>;

    setSizes((previous) => areSizesEqual(previous, nextSizes) ? previous : nextSizes);
  }, [defaultSizes, persistedSizes]);

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
    setSizes({ ...defaultSizes });
  }, [defaultSizes]);

  useEffect(() => {
    if (!activeDivider) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const session = sessionRef.current;

      if (!session) {
        return;
      }

      const pairTotal = session.upperHeight + session.lowerHeight;
      const nextUpper = clamp(session.upperHeight + (event.clientY - session.startY), minHeight, pairTotal - minHeight);
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
  }, [activeDivider, minHeight]);

  return {
    sizes,
    activeDivider,
    isResizing: activeDivider !== null,
    beginResize,
    resetSizes
  };
}