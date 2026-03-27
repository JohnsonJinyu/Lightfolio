import { useCallback, useEffect, useRef, useState } from 'react';

import { CHROME_ANIMATION_DURATION_MS } from '../constants/layout';
import { clampContextMenuPosition } from '../utils/media';
import type { ContextMenuState, DetailSectionKey } from '../types/ui';

export function useViewerChrome(selectById: (assetId: string) => void) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFolderListCollapsed, setIsFolderListCollapsed] = useState(false);
  const [isDetailPanelCollapsed, setIsDetailPanelCollapsed] = useState(false);
  const [isFilmstripCollapsed, setIsFilmstripCollapsed] = useState(false);
  const [collapsedDetailSections, setCollapsedDetailSections] = useState<Record<DetailSectionKey, boolean>>({
    description: false,
    tags: false,
    fileInfo: false
  });
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [isChromeAnimating, setIsChromeAnimating] = useState(false);
  const chromeAnimationTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (chromeAnimationTimerRef.current) {
      window.clearTimeout(chromeAnimationTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    function closeMenu() {
      setContextMenu(null);
    }

    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [contextMenu]);

  const toggleDetailSection = useCallback((section: DetailSectionKey) => {
    setCollapsedDetailSections((previous) => ({
      ...previous,
      [section]: !previous[section]
    }));
  }, []);

  const pulseChromeAnimation = useCallback(() => {
    if (chromeAnimationTimerRef.current) {
      window.clearTimeout(chromeAnimationTimerRef.current);
    }

    setIsChromeAnimating(true);
    chromeAnimationTimerRef.current = window.setTimeout(() => {
      setIsChromeAnimating(false);
      chromeAnimationTimerRef.current = null;
    }, CHROME_ANIMATION_DURATION_MS);
  }, []);

  const toggleDetailPanel = useCallback(() => {
    pulseChromeAnimation();
    setIsDetailPanelCollapsed((previous) => !previous);
  }, [pulseChromeAnimation]);

  const toggleFilmstrip = useCallback(() => {
    pulseChromeAnimation();
    setIsFilmstripCollapsed((previous) => !previous);
  }, [pulseChromeAnimation]);

  const openAssetMenu = useCallback((event: React.MouseEvent, assetId: string) => {
    event.preventDefault();
    const position = clampContextMenuPosition(event.clientX, event.clientY);

    setContextMenu({
      x: position.x,
      y: position.y,
      assetId
    });
    selectById(assetId);
  }, [selectById]);

  return {
    contextMenu,
    setContextMenu,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isFolderListCollapsed,
    setIsFolderListCollapsed,
    isDetailPanelCollapsed,
    setIsDetailPanelCollapsed,
    isFilmstripCollapsed,
    setIsFilmstripCollapsed,
    collapsedDetailSections,
    toggleDetailSection,
    showShortcutHelp,
    setShowShortcutHelp,
    isChromeAnimating,
    toggleDetailPanel,
    toggleFilmstrip,
    openAssetMenu
  };
}