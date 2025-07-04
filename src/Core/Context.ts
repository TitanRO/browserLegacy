/**
 * Core/Context.ts
 *
 * Application Context
 *
 * Modernized application context detection and fullscreen management.
 *
 * @author Vincent Thibault
 */

/**
 * Interface for Chrome App API
 */
interface ChromeApp {
  chrome: {
    app: {
      window: {
        current(): {
          isFullscreen(): boolean;
          fullscreen(): void;
          restore(): void;
        };
      };
    };
  };
}

/**
 * Extended Document interface for fullscreen APIs
 */
interface FullscreenDocument extends Document {
  mozFullScreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  cancelFullScreen?(): void;
  mozCancelFullScreen?(): void;
  webkitCancelFullScreen?(): void;
}

/**
 * Extended Element interface for fullscreen APIs
 */
interface FullscreenElement extends Element {
  mozRequestFullScreen?(): void;
  webkitRequestFullscreen?(allowKeyboard?: number): void;
}

/**
 * Application context detection and management
 */
export class Context {
  /**
   * Detect current execution context
   */
  static readonly Is = {
    APP: !!(window as any).chrome?.app?.window,
    POPUP: !!window.opener,
    FRAME: window.top !== window.self,
  };

  /**
   * Check if roBrowser is in FullScreen
   */
  static isFullScreen(): boolean {
    const doc = document as FullscreenDocument;
    return !!(
      doc.fullscreenElement ||
      doc.mozFullScreenElement ||
      doc.webkitFullscreenElement ||
      (Context.Is.APP && (window as any as ChromeApp).chrome.app.window.current().isFullscreen())
    );
  }

  /**
   * Request fullscreen mode
   */
  static async requestFullScreen(): Promise<void> {
    if (Context.Is.APP) {
      (window as any as ChromeApp).chrome.app.window.current().fullscreen();
      return;
    }

    if (!Context.isFullScreen()) {
      const element = document.documentElement as FullscreenElement;

      try {
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else {
          const fullscreenElement = element as FullscreenElement;
          if (fullscreenElement.mozRequestFullScreen) {
            fullscreenElement.mozRequestFullScreen();
          } else if (fullscreenElement.webkitRequestFullscreen) {
            fullscreenElement.webkitRequestFullscreen(1); // Element.ALLOW_KEYBOARD_INPUT
          }
        }
      } catch (error) {
        console.warn('Failed to enter fullscreen:', error);
      }
    }
  }

  /**
   * Cancel fullscreen mode
   */
  static cancelFullScreen(): void {
    if (Context.Is.APP) {
      (window as any as ChromeApp).chrome.app.window.current().restore();
      return;
    }

    const doc = document as FullscreenDocument;
    
    try {
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.cancelFullScreen) {
        doc.cancelFullScreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.webkitCancelFullScreen) {
        doc.webkitCancelFullScreen();
      }
    } catch (error) {
      console.warn('Failed to exit fullscreen:', error);
    }
  }

  /**
   * Check browser API support for ROBrowser requirements
   * 
   * @throws Error with descriptive message if unsupported
   */
  static checkSupport(): void {
    const checks = [
      {
        name: 'Drag and Drop',
        test: () => {
          const div = document.createElement('div');
          return 'draggable' in div || ('ondragstart' in div && 'ondrop' in div);
        },
        error: 'Your web browser does not support Drag & Drop features.',
      },
      {
        name: 'Canvas 2D',
        test: () => {
          const canvas = document.createElement('canvas');
          return !!canvas.getContext?.('2d');
        },
        error: 'Your web browser does not support <canvas> element.',
      },
      {
        name: 'WebGL',
        test: () => {
          if (!window.WebGLRenderingContext) return false;
          
          const canvas = document.createElement('canvas');
          let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
          
          try {
            gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          } catch (error) {
            // Ignore context creation errors
          }
          
          return !!gl;
        },
        error: 'Your browser or graphics card does not support WebGL. Check <a href="http://get.webgl.org/" target="_blank">get.webgl.org</a> for more information.',
      },
      {
        name: 'Web Workers',
        test: () => !!window.Worker,
        error: 'Your web browser does not support Web Workers (multi-threading).',
      },
      {
        name: 'File API',
        test: () => !!(window.File && window.FileList && window.FileReader),
        error: 'Your web browser does not support File API.',
      },
      {
        name: 'DataView',
        test: () => !!(window.DataView && DataView.prototype.getFloat64),
        error: 'Your web browser does not support DataView API.',
      },
    ];

    for (const check of checks) {
      if (!check.test()) {
        throw new Error(`${check.name} not supported: ${check.error}`);
      }
    }
  }

  /**
   * Get browser and feature information
   */
  static getBrowserInfo(): {
    userAgent: string;
    webGLVendor?: string;
    webGLRenderer?: string;
    supports: {
      webGL2: boolean;
      webAssembly: boolean;
      serviceWorker: boolean;
      indexedDB: boolean;
    };
  } {
    const canvas = document.createElement('canvas');
    let gl: WebGLRenderingContext | null = null;
    
    try {
      gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext;
    } catch (error) {
      // Ignore
    }

    const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
    
    return {
      userAgent: navigator.userAgent,
      webGLVendor: debugInfo ? gl!.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : undefined,
      webGLRenderer: debugInfo ? gl!.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : undefined,
      supports: {
        webGL2: !!document.createElement('canvas').getContext?.('webgl2'),
        webAssembly: typeof WebAssembly === 'object',
        serviceWorker: 'serviceWorker' in navigator,
        indexedDB: 'indexedDB' in window,
      },
    };
  }
}

// Export for backward compatibility
export default Context;