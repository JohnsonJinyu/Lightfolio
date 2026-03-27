import { useCallback, useState } from 'react';

import type { AssetRecord } from '@lightfolio/shared';

import type { WarmupProgress } from '../types/ui';
import { preloadImageTask } from '../utils/media';

const initialProgress: WarmupProgress = { done: 0, total: 0, running: false };

export function useThumbnailWarmup() {
  const [warmupProgress, setWarmupProgress] = useState<WarmupProgress>(initialProgress);

  const warmupThumbnails = useCallback(async (assets: AssetRecord[], maxAssets = 120) => {
    const imageAssets = assets.filter((asset) => asset.kind === 'image').slice(0, maxAssets);
    const total = imageAssets.length;

    if (total === 0) {
      setWarmupProgress(initialProgress);
      return;
    }

    setWarmupProgress({ done: 0, total, running: true });

    const concurrency = 6;
    let pointer = 0;
    let done = 0;
    let lastReportDone = 0;
    let lastReportTs = performance.now();

    async function worker() {
      while (pointer < total) {
        const index = pointer;
        pointer += 1;
        await preloadImageTask(imageAssets[index].filePath, 'thumb', 640);
        done += 1;

        const now = performance.now();
        if (done === total || done - lastReportDone >= 6 || now - lastReportTs >= 120) {
          lastReportDone = done;
          lastReportTs = now;
          setWarmupProgress({ done, total, running: true });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));
    setWarmupProgress({ done: total, total, running: false });
  }, []);

  return {
    warmupProgress,
    setWarmupProgress,
    warmupThumbnails
  };
}