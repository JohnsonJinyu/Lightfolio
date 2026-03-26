/// <reference types="vite/client" />

import type { ImportSummary, LibrarySnapshot } from '@lightfolio/shared';

declare global {
  interface Window {
    lightfolio: {
      loadLibrary: () => Promise<LibrarySnapshot>;
      saveLibrary: (snapshot: LibrarySnapshot) => Promise<boolean>;
      pickFiles: () => Promise<ImportSummary | null>;
      pickDirectory: () => Promise<ImportSummary | null>;
      deleteFile: (filePath: string) => Promise<boolean>;
      revealFile: (filePath: string) => Promise<boolean>;
      toFileUrl: (filePath: string) => string;
      toThumbUrl: (filePath: string, width: number, height: number) => string;
    };
  }
}

export {};
