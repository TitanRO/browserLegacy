/**
 * Utils/Texture.ts
 *
 * WebGL Helper functions for texture management
 *
 * Modernized texture loading and processing utilities for ROBrowser.
 *
 * @author Vincent Thibault
 */

import { Targa } from '../Loaders/Targa.ts';

export interface TextureLoadOptions {
  removeMagenta?: boolean;
  powerOfTwo?: boolean;
}

export type TextureLoadCallback = (success: boolean, ...args: unknown[]) => void;

/**
 * Texture loading and processing utilities
 */
export class TextureUtils {
  /**
   * Load a texture from various sources (URL, ArrayBuffer, Blob)
   * 
   * @param data - Image URL, ArrayBuffer (TGA), or Blob
   * @param options - Loading options
   * @returns Promise that resolves to HTMLCanvasElement or null
   */
  static async load(
    data: string | ArrayBuffer | null,
    options: TextureLoadOptions = {}
  ): Promise<HTMLCanvasElement | null> {
    const { removeMagenta = true, powerOfTwo = false } = options;

    // Handle missing textures
    if (!data) {
      return null;
    }

    try {
      // TGA Support (ArrayBuffer)
      if (data instanceof ArrayBuffer) {
        return this.loadTGA(data);
      }

      // Regular images (URL/Blob)
      return await this.loadImage(data as string, { removeMagenta, powerOfTwo });
    } catch (error) {
      console.error('Texture loading failed:', error);
      return null;
    }
  }

  /**
   * Legacy callback-based load for backward compatibility
   * 
   * @param data - Image source
   * @param callback - Completion callback
   * @param args - Additional arguments passed to callback
   */
  static loadLegacy(
    data: string | ArrayBuffer | null,
    callback: TextureLoadCallback,
    ...args: unknown[]
  ): void {
    this.load(data)
      .then(canvas => {
        if (canvas) {
          args.unshift(true);
          callback.apply(canvas, args);
        } else {
          args.unshift(false);
          callback.apply(null, args);
        }
      })
      .catch(() => {
        args.unshift(false);
        callback.apply(null, args);
      });
  }

  /**
   * Load TGA format from ArrayBuffer
   * 
   * @param data - TGA file data
   * @returns Canvas with loaded image
   */
  private static loadTGA(data: ArrayBuffer): HTMLCanvasElement | null {
    try {
      const tga = new Targa();
      tga.load(new Uint8Array(data));
      return tga.getCanvas();
    } catch (error) {
      console.error('TGA loading failed:', error);
      return null;
    }
  }

  /**
   * Load regular image formats (PNG, JPG, etc.)
   * 
   * @param url - Image URL or Blob URL
   * @param options - Processing options
   * @returns Promise resolving to canvas
   */
  private static async loadImage(
    url: string,
    options: TextureLoadOptions
  ): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          // Clean up blob URLs
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to get 2D context'));
            return;
          }

          // Set canvas size (optionally power of two)
          canvas.width = options.powerOfTwo ? this.toPowerOfTwo(img.width) : img.width;
          canvas.height = options.powerOfTwo ? this.toPowerOfTwo(img.height) : img.height;

          // Draw image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Remove magenta if requested
          if (options.removeMagenta) {
            this.removeMagenta(canvas);
          }

          resolve(canvas);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${url}`));
      };

      img.src = url;
    });
  }

  /**
   * Remove magenta (transparency) pixels from canvas
   * Magenta (255, 0, 255) is used as transparency in RO sprites
   * 
   * @param canvas - Canvas to process
   */
  static removeMagenta(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Process all pixels
    for (let i = 0; i < data.length; i += 4) {
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];

      // Check for magenta color (with tolerance)
      if (red > 230 && green < 20 && blue > 230) {
        // Make pixel transparent
        data[i] = 0;     // Red
        data[i + 1] = 0; // Green
        data[i + 2] = 0; // Blue
        data[i + 3] = 0; // Alpha
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Convert number to nearest power of two (required for some WebGL operations)
   * 
   * @param num - Input number
   * @returns Nearest power of two >= num
   */
  static toPowerOfTwo(num: number): number {
    return Math.pow(2, Math.ceil(Math.log(num) / Math.log(2)));
  }

  /**
   * Check if a number is a power of two
   * 
   * @param num - Number to check
   * @returns True if power of two
   */
  static isPowerOfTwo(num: number): boolean {
    return (num & (num - 1)) === 0;
  }
}

// Export individual functions for convenience
export const { load, loadLegacy, removeMagenta, toPowerOfTwo, isPowerOfTwo } = TextureUtils;

// Default export for backward compatibility
export default TextureUtils;