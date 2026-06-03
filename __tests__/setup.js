// Global Chrome API mocks for Jest
global.chrome = {
  runtime: {
    onInstalled: { addListener: jest.fn() },
    onMessage: { addListener: jest.fn() },
    sendMessage: jest.fn(),
    getURL: jest.fn((path) => `chrome-extension://test-id/${path}`),
    id: "test-extension-id",
    openOptionsPage: jest.fn(),
  },
  contextMenus: {
    create: jest.fn(),
    onClicked: { addListener: jest.fn() },
  },
  action: {
    onClicked: { addListener: jest.fn() },
  },
  commands: {
    onCommand: { addListener: jest.fn() },
  },
  tabs: {
    create: jest.fn(),
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
  scripting: {
    executeScript: jest.fn(),
  },
  storage: {
    sync: {
      get: jest.fn((keys, cb) => {
        if (typeof cb === "function") cb({});
        return Promise.resolve({});
      }),
      set: jest.fn((data, cb) => {
        if (typeof cb === "function") cb();
      }),
    },
    onChanged: { addListener: jest.fn() },
  },
};
