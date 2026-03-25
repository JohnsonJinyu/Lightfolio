/// <reference types="vite/client" />

import type { ImportSummary } from '@lightfolio/shared';

declare global {
  interface Window {
    lightfolio: {
      pickFiles: () => Promise<ImportSummary | null>;
      pickDirectory: () => Promise<ImportSummary | null>;
      deleteFile: (filePath: string) => Promise<boolean>;
      toFileUrl: (filePath: string) => string;
      loadImageDataUrl: (filePath: string) => Promise<string | null>;
    };
  }
}

export {};
