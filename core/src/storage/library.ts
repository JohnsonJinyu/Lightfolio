export interface LibraryStorageAdapter {
  initialize(): Promise<void>;
}

export function createStorageAdapter(): LibraryStorageAdapter {
  return {
    async initialize() {
      return Promise.resolve();
    }
  };
}
