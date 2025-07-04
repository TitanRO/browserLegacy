/**
 * Test setup for ROBrowser
 */

import { vi } from 'vitest';

// Mock global objects that ROBrowser expects
Object.defineProperty(globalThis, 'ROConfig', {
  value: {
    development: true,
    remoteClient: 'http://localhost:8080/',
    servers: [],
    plugins: {},
  },
  writable: true,
});

// Mock WebGL context for tests
const mockWebGLContext = {
  canvas: document.createElement('canvas'),
  getExtension: vi.fn(),
  getParameter: vi.fn(),
  createShader: vi.fn(),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  getShaderParameter: vi.fn(() => true),
  getShaderInfoLog: vi.fn(() => ''),
  createProgram: vi.fn(),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  getProgramParameter: vi.fn(() => true),
  getProgramInfoLog: vi.fn(() => ''),
  getActiveAttrib: vi.fn(),
  getAttribLocation: vi.fn(),
  getActiveUniform: vi.fn(),
  getUniformLocation: vi.fn(),
  createTexture: vi.fn(),
  bindTexture: vi.fn(),
  texImage2D: vi.fn(),
  texParameteri: vi.fn(),
  generateMipmap: vi.fn(),
  deleteShader: vi.fn(),
  deleteProgram: vi.fn(),
  // Add other WebGL methods as needed
};

// Mock HTMLCanvasElement.getContext for WebGL tests
(HTMLCanvasElement.prototype.getContext as any) = vi.fn((contextType: string) => {
  if (contextType === 'webgl' || contextType === 'webgl2') {
    return mockWebGLContext;
  }
  if (contextType === '2d') {
    return {
      canvas: document.createElement('canvas'),
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      })),
      putImageData: vi.fn(),
      createImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      })),
    };
  }
  return null;
});

// Mock fetch for AJAX tests
global.fetch = vi.fn();

// Mock performance API
if (typeof globalThis.performance === 'undefined') {
  globalThis.performance = {
    now: vi.fn(() => Date.now()),
  } as any;
}

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.requestAnimationFrame
globalThis.requestAnimationFrame = vi.fn((callback) => {
  setTimeout(callback, 16);
  return 1;
});

globalThis.cancelAnimationFrame = vi.fn();

// Mock Worker for testing
globalThis.Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

// Mock URL.createObjectURL for blob tests
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
globalThis.URL.revokeObjectURL = vi.fn();

console.log('🧪 Test environment setup complete');