/**
 * Core/Client.ts
 *
 * Modern Client Resource Manager for ROBrowser
 * Manages client files, loads GRFs, DATA.INI, extracts files from GRFs with modern patterns
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Executable from '../Utils/Executable';
import Texture from '../Utils/Texture';
import WebGL from '../Utils/WebGL';
import { Configs } from './Configs';
import { Thread } from './Thread';
import Memory from './MemoryManager';
import PACKETVER from '../Network/PacketVerManager';

// Extended Navigator interface for temporary storage
declare global {
  interface Navigator {
    temporaryStorage?: {
      queryUsageAndQuota(callback: (used: number, remaining: number) => void): void;
    };
    webkitTemporaryStorage?: {
      queryUsageAndQuota(callback: (used: number, remaining: number) => void): void;
    };
  }
}

/**
 * Client file interface
 */
interface ClientFile {
  file: File;
  path: string;
}

/**
 * Progress data interface
 */
interface ProgressData {
  total: {
    perc: number;
  };
}

/**
 * Storage quota interface
 */
interface StorageQuota {
  used: number;
  remaining: number;
}

/**
 * Sprite frame interface
 */
interface SpriteFrame {
  texture?: WebGLTexture;
  type: number;
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Sprite data interface
 */
interface SpriteData {
  frames: SpriteFrame[];
  rgba_index: number;
  texture?: WebGLTexture;
  palette?: Uint8Array;
}

/**
 * STR layer interface
 */
interface StrLayer {
  texcnt: number;
  texname: string[];
  materials: WebGLTexture[];
}

/**
 * STR data interface
 */
interface StrData {
  layernum: number;
  layers: StrLayer[];
}

/**
 * Palette data interface
 */
interface PaletteData {
  palette: Uint8Array;
  texture: WebGLTexture;
}

/**
 * Modern client resource manager
 */
export class Client {
  private static _initialized = false;
  private static _loadingProgress: HTMLDivElement | null = null;
  private static _loadingInfo: HTMLDivElement | null = null;

  /**
   * Callback function called when files are loaded
   */
  static onFilesLoaded: () => void = () => {};

  /**
   * Initialize Client and load necessary files
   *
   * @param files - FileList to load
   */
  static async init(files: FileList | File[]): Promise<void> {
    if (this._initialized) {
      console.warn('Client already initialized');
      return;
    }

    try {
      const fileArray = Array.from(files);
      const packetver = Configs.get('packetver');
      const remoteClient = Configs.getString('remoteClient', '');

      // Find executable and set packet version
      if (!packetver || String(packetver).match(/^executable$/i)) {
        await this.detectPacketVersionFromExecutable(fileArray);
      } else if (typeof packetver === 'number') {
        PACKETVER.value = packetver;
      }

      // Configure GRF host
      if (remoteClient) {
        Thread.send('SET_HOST', remoteClient);
      }

      // Save client files
      await this.saveClientFiles(fileArray);
      this._initialized = true;
    } catch (error) {
      console.error('Failed to initialize client:', error);
      throw error;
    }
  }

  /**
   * Detect packet version from executable file
   */
  private static async detectPacketVersionFromExecutable(files: File[]): Promise<void> {
    for (const file of files) {
      if (Executable.isROExec(file)) {
        try {
          const date = await Executable.getDateAsync(file);
          if (date > 20000000) {
            PACKETVER.value = date;
          }
          break;
        } catch (error) {
          console.warn('Failed to get date from executable:', error);
        }
      }
    }
  }

  /**
   * Save client files to filesystem with progress tracking
   */
  private static async saveClientFiles(files: File[]): Promise<void> {
    if (files.length === 0) {
      return;
    }

    this.createProgressUI();
    this.setupProgressHandlers();

    try {
      // Prepare file list for worker thread
      const fileList: ClientFile[] = files.map(file => ({
        file,
        path: (file as any).fullPath || 
              (file as any).relativePath || 
              (file as any).webkitRelativePath || 
              file.name
      }));

      // Get storage quota information
      const quota = await this.getStorageQuota();

      // Initialize client files in worker thread
      await Thread.sendAsync('CLIENT_INIT', {
        files: fileList,
        grfList: Configs.getString('grfList', 'DATA.INI'),
        save: Configs.getBoolean('saveFiles', false),
        quota
      });

      this.onFilesLoaded();
    } catch (error) {
      console.error('Failed to save client files:', error);
      throw error;
    } finally {
      this.removeProgressUI();
    }
  }

  /**
   * Create progress UI elements
   */
  private static createProgressUI(): void {
    // Progress bar
    this._loadingProgress = document.createElement('div');
    Object.assign(this._loadingProgress.style, {
      position: 'fixed',
      zIndex: '2147483647',
      top: '0px',
      left: '0px',
      backgroundColor: 'rgb(180,0,0)',
      transition: 'width 500ms linear',
      width: '0px',
      height: '3px'
    });

    // Progress info
    this._loadingInfo = document.createElement('div');
    this._loadingInfo.textContent = 'Saving fullclient... (0.00 %)';
    Object.assign(this._loadingInfo.style, {
      position: 'absolute',
      left: '20px',
      top: '0px',
      whiteSpace: 'nowrap',
      zIndex: '2147483646',
      height: '12px',
      padding: '5px',
      background: 'linear-gradient(rgb(180,0,0), rgb(136,0,0) 30%)',
      color: 'white',
      textShadow: '1px 1px black',
      borderBottomLeftRadius: '5px',
      borderBottomRightRadius: '5px',
      textAlign: 'center',
      width: '160px',
      display: 'none'
    });

    // Add hover interactions
    this._loadingProgress.addEventListener('mouseenter', () => {
      if (this._loadingInfo) {
        this._loadingInfo.style.display = 'block';
      }
    });

    this._loadingProgress.addEventListener('mouseleave', () => {
      if (this._loadingInfo) {
        this._loadingInfo.style.display = 'none';
      }
    });

    document.body.appendChild(this._loadingProgress);
    document.body.appendChild(this._loadingInfo);
  }

  /**
   * Setup progress event handlers
   */
  private static setupProgressHandlers(): void {
    let lastUpdate = Date.now();

    Thread.hook('CLIENT_SAVE_PROGRESS', (data: ProgressData) => {
      const now = Date.now();
      if (lastUpdate + 400 < now && this._loadingProgress && this._loadingInfo) {
        this._loadingProgress.style.width = `${data.total.perc}%`;
        this._loadingInfo.textContent = `Saving fullclient... (${data.total.perc}%)`;
        lastUpdate = now;
      }
    });

    Thread.hook('CLIENT_SAVE_COMPLETE', () => {
      this.removeProgressUI();
    });
  }

  /**
   * Remove progress UI elements
   */
  private static removeProgressUI(): void {
    if (this._loadingProgress?.parentNode) {
      document.body.removeChild(this._loadingProgress);
      this._loadingProgress = null;
    }
    if (this._loadingInfo?.parentNode) {
      document.body.removeChild(this._loadingInfo);
      this._loadingInfo = null;
    }
  }

  /**
   * Get storage quota information
   */
  private static async getStorageQuota(): Promise<StorageQuota> {
    return new Promise((resolve) => {
      const storage = navigator.temporaryStorage || 
                     (navigator as any).webkitTemporaryStorage || {
        queryUsageAndQuota: (callback: (used: number, remaining: number) => void) => {
          callback(0, 0);
        }
      };

      storage.queryUsageAndQuota((used: number, remaining: number) => {
        resolve({ used, remaining });
      });
    });
  }

  /**
   * Get a file from game data with modern async patterns
   */
  static async getFile(filename: string, args?: any[]): Promise<any> {
    if (!Memory.exist(filename)) {
      try {
        const data = await Thread.sendAsync('GET_FILE', {
          filename,
          args: args || null
        });
        Memory.set(filename, data.data, data.error);
      } catch (error) {
        console.error(`Failed to get file ${filename}:`, error);
        Memory.set(filename, null, error);
      }
    }

    return new Promise((resolve, reject) => {
      Memory.get(filename, resolve, reject);
    });
  }

  /**
   * Get multiple files concurrently
   */
  static async getFiles(filenames: string[]): Promise<any[]> {
    try {
      const promises = filenames.map(filename => this.getFile(filename));
      return await Promise.all(promises);
    } catch (error) {
      console.error('Failed to get multiple files:', error);
      throw error;
    }
  }

  /**
   * Load and process a file with format-specific handling
   */
  static async loadFile(filename: string, args: any = {}): Promise<any> {
    if (!Memory.exist(filename)) {
      try {
        const response = await Thread.sendAsync('LOAD_FILE', {
          filename,
          args: args || null
        });

        const processedData = await this.processFileData(filename, response.data);
        Memory.set(filename, processedData, response.error);
      } catch (error) {
        console.error(`Failed to load file ${filename}:`, error);
        Memory.set(filename, null, error);
      }
    }

    return new Promise((resolve, reject) => {
      Memory.get(filename, resolve, reject);
    });
  }

  /**
   * Process file data based on file extension
   */
  private static async processFileData(filename: string, data: any): Promise<any> {
    if (!data) return data;

    const extension = filename.slice(-3).toLowerCase();

    switch (extension) {
      case 'bmp':
        return this.processBitmapFile(data);
      
      case 'str':
        return this.processStrFile(data);
      
      case 'spr':
        return this.processSpriteFile(data);
      
      case 'pal':
        return this.processPaletteFile(data);
      
      default:
        return data;
    }
  }

  /**
   * Process bitmap file (remove magenta)
   */
  private static async processBitmapFile(data: any): Promise<string> {
    return new Promise((resolve) => {
      Texture.load(data, function(this: HTMLCanvasElement) {
        resolve(this.toDataURL());
      });
    });
  }

  /**
   * Process STR file (load textures)
   */
  private static async processStrFile(data: StrData): Promise<StrData> {
    const gl = WebGL.getContext();
    
    for (let i = 0; i < data.layernum; i++) {
      const layer = data.layers[i];
      layer.materials = new Array(layer.texcnt);

      // Load textures for this layer
      const texturePromises = layer.texname.map(async (texName, j) => {
        try {
          const textureUrl = await this.loadFile(texName);
          const texture = await WebGL.createTextureFromUrl(gl, textureUrl);
          layer.materials[j] = texture;
        } catch (error) {
          console.error(`Failed to load texture ${texName}:`, error);
        }
      });

      await Promise.all(texturePromises);
    }

    return data;
  }

  /**
   * Process sprite file (send to GPU)
   */
  private static async processSpriteFile(data: SpriteData): Promise<SpriteData> {
    const gl = WebGL.getContext();
    
    // Process sprite frames
    for (const frame of data.frames) {
      frame.texture = gl.createTexture();
      const precision = frame.type ? gl.LINEAR : gl.NEAREST;
      const format = frame.type ? gl.RGBA : gl.LUMINANCE;
      
      gl.bindTexture(gl.TEXTURE_2D, frame.texture);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, format, 
        frame.width, frame.height, 0, 
        format, gl.UNSIGNED_BYTE, frame.data
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, precision);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, precision);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // Process palette if present
    if (data.rgba_index !== 0) {
      data.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, data.texture);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, 
        256, 1, 0, 
        gl.RGBA, gl.UNSIGNED_BYTE, data.palette
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    }

    return data;
  }

  /**
   * Process palette file
   */
  private static async processPaletteFile(data: any): Promise<PaletteData> {
    const gl = WebGL.getContext();
    const texture = gl.createTexture();
    const palette = new Uint8Array(data);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 
      256, 1, 0, 
      gl.RGBA, gl.UNSIGNED_BYTE, palette
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);

    return { palette, texture };
  }

  /**
   * Load multiple files concurrently
   */
  static async loadFiles(filenames: string[]): Promise<any[]> {
    try {
      const promises = filenames.map(filename => this.loadFile(filename));
      return await Promise.all(promises);
    } catch (error) {
      console.error('Failed to load multiple files:', error);
      throw error;
    }
  }

  /**
   * Search for files using regex pattern
   */
  static async search(regex: RegExp): Promise<string[]> {
    try {
      return await Thread.sendAsync('SEARCH_FILE', regex);
    } catch (error) {
      console.error('Failed to search files:', error);
      throw error;
    }
  }

  /**
   * Check if client is initialized
   */
  static isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Reset client state (for testing or reinitialization)
   */
  static reset(): void {
    this._initialized = false;
    this.removeProgressUI();
    Memory.clear();
  }

  /**
   * Get client initialization status and stats
   */
  static getStatus(): {
    initialized: boolean;
    memoryUsage: number;
    cachedFiles: number;
  } {
    return {
      initialized: this._initialized,
      memoryUsage: Memory.getUsage(),
      cachedFiles: Memory.getCachedCount(),
    };
  }
}

// Backward compatibility exports
export const { init, getFile, getFiles, loadFile, loadFiles, search } = Client;

// Default export
export default Client;