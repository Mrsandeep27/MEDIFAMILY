import "@testing-library/jest-dom/vitest";

// Mock Web Crypto API for PIN tests
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      subtle: {
        digest: async (_algo: string, data: ArrayBuffer) => {
          // Simple mock hash for testing
          const arr = new Uint8Array(data);
          const hash = new Uint8Array(32);
          for (let i = 0; i < arr.length; i++) {
            hash[i % 32] ^= arr[i];
          }
          return hash.buffer;
        },
      },
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
    },
  });
}

// Mock localStorage
const store: Record<string, string> = {};
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  },
});

// Mock window.navigator for share tests
Object.defineProperty(globalThis, "navigator", {
  value: {
    ...globalThis.navigator,
    clipboard: {
      writeText: async () => {},
    },
    share: undefined,
    onLine: true,
  },
  writable: true,
});
