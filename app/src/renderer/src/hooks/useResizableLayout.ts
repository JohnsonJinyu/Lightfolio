import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

import {
  DEFAULT_DETAIL_PANEL_WIDTH,
  DEFAULT_FILMSTRIP_HEIGHT,
  DEFAULT_SIDEBAR_WIDTH,
  DETAIL_PANEL_MAX_WIDTH,
  DETAIL_PANEL_MIN_WIDTH,
  FILMSTRIP_MAX_HEIGHT,
  FILMSTRIP_MIN_HEIGHT,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH
} from '../constants/layout';

export interface LayoutSizes {
  sidebarWidth: number;
  detailPanelWidth: number;
  filmstripHeight: number;
}

type ResizeHandleKey = 'sidebar' | 'detail' | 'filmstrip';

interface ResizeSession {
  handle: ResizeHandleKey;
  startX: number;
  startY: number;
  startSize: number;
}

const DEFAULT_LAYOUT_SIZES: LayoutSizes = {
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  detailPanelWidth: DEFAULT_DETAIL_PANEL_WIDTH,
  filmstripHeight: DEFAULT_FILMSTRIP_HEIGHT
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampLayoutSizes(layout: LayoutSizes, viewportWidth = window.innerWidth, viewportHeight = window.innerHeight): LayoutSizes {
  return {
    sidebarWidth: clamp(layout.sidebarWidth, SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.floor(viewportWidth * 0.38)))),
    detailPanelWidth: clamp(layout.detailPanelWidth, DETAIL_PANEL_MIN_WIDTH, Math.min(DETAIL_PANEL_MAX_WIDTH, Math.max(DETAIL_PANEL_MIN_WIDTH, Math.floor(viewportWidth * 0.42)))),
    filmstripHeight: clamp(layout.filmstripHeight, FILMSTRIP_MIN_HEIGHT, Math.min(FILMSTRIP_MAX_HEIGHT, Math.max(FILMSTRIP_MIN_HEIGHT, Math.floor(viewportHeight * 0.34))))
  };
}

export function useResizableLayout() {
  const [layoutSizes, setLayoutSizes] = useState<LayoutSizes>(() => clampLayoutSizes(DEFAULT_LAYOUT_SIZES));
  const [activeHandle, setActiveHandle] = useState<ResizeHandleKey | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);

  const updateLayoutSizes = useCallback((next: Partial<LayoutSizes> | ((previous: LayoutSizes) => LayoutSizes)) => {
    setLayoutSizes((previous) => {
      const candidate = typeof next === 'function'
        ? next(previous)
        : {
            ...previous,
            ...(next.sidebarWidth === undefined ? {} : { sidebarWidth: next.sidebarWidth }),
            ...(next.detailPanelWidth === undefined ? {} : { detailPanelWidth: next.detailPanelWidth }),
            ...(next.filmstripHeight === undefined ? {} : { filmstripHeight: next.filmstripHeight })
          };

      return clampLayoutSizes(candidate);
    });
  }, []);

  const beginResize = useCallback((handle: ResizeHandleKey) => (event: React.PointerEvent<HTMLElement>) => {
    const currentSize = handle === 'sidebar'
      ? layoutSizes.sidebarWidth
      : handle === 'detail'
        ? layoutSizes.detailPanelWidth
        : layoutSizes.filmstripHeight;

    event.preventDefault();
    resizeSessionRef.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startSize: currentSize
    };
    setActiveHandle(handle);
  }, [layoutSizes.detailPanelWidth, layoutSizes.filmstripHeight, layoutSizes.sidebarWidth]);

  const resetSize = useCallback((handle: ResizeHandleKey) => (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();

    if (handle === 'sidebar') {
      updateLayoutSizes({ sidebarWidth: DEFAULT_SIDEBAR_WIDTH });
      return;
    }

    if (handle === 'detail') {
      updateLayoutSizes({ detailPanelWidth: DEFAULT_DETAIL_PANEL_WIDTH });
      return;
    }

    updateLayoutSizes({ filmstripHeight: DEFAULT_FILMSTRIP_HEIGHT });
  }, [updateLayoutSizes]);

  useEffect(() => {
    if (!activeHandle) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const session = resizeSessionRef.current;

      if (!session) {
        return;
      }

      if (session.handle === 'sidebar') {
        updateLayoutSizes({
          sidebarWidth: session.startSize + (event.clientX - session.startX)
        });
        return;
      }

      if (session.handle === 'detail') {
        updateLayoutSizes({
          detailPanelWidth: session.startSize + (session.startX - event.clientX)
        });
        return;
      }

      updateLayoutSizes({
        filmstripHeight: session.startSize + (session.startY - event.clientY)
      });
    }

    function endResize() {
      resizeSessionRef.current = null;
      setActiveHandle(null);
    }

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = activeHandle === 'filmstrip' ? 'row-resize' : 'col-resize';

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
  }, [activeHandle, updateLayoutSizes]);

  useEffect(() => {
    function handleViewportResize() {
      setLayoutSizes((previous) => clampLayoutSizes(previous));
    }

    window.addEventListener('resize', handleViewportResize);

    return () => {
      window.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  return {
    layoutSizes,
    activeHandle,
    isResizing: activeHandle !== null,
    setLayoutSizes: updateLayoutSizes,
    beginResize,
    resetSize
  };
}