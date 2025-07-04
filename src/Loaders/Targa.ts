/**
 * Loaders/Targa.ts
 *
 * Modern TypeScript loader for .tga image files (Targa Truevision)
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * TGA file format types
 */
export enum TgaType {
  NO_DATA = 0,
  INDEXED = 1,
  RGB = 2,
  GREY = 3,
  RLE_INDEXED = 9,
  RLE_RGB = 10,
  RLE_GREY = 11,
}

/**
 * TGA image origin constants
 */
export enum TgaOrigin {
  BOTTOM_LEFT = 0x00,
  BOTTOM_RIGHT = 0x01,
  TOP_LEFT = 0x02,
  TOP_RIGHT = 0x03,
  SHIFT = 0x04,
  MASK = 0x30,
}

/**
 * TGA file header structure
 */
export interface TgaHeader {
  idLength: number;
  colorMapType: number;
  imageType: number;
  colorMapIndex: number;
  colorMapLength: number;
  colorMapDepth: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  pixelDepth: number;
  flags: number;
  hasEncoding: boolean;
  hasColorMap: boolean;
  isGreyColor: boolean;
}

/**
 * Custom ImageData interface for contexts where DOM isn't available
 */
export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * Type for image data processing functions
 */
type ImageDataProcessor = (
  imageData: Uint8ClampedArray,
  pixels: Uint8Array,
  colormap: Uint8Array | undefined,
  width: number,
  y_start: number,
  y_step: number,
  y_end: number,
  x_start: number,
  x_step: number,
  x_end: number
) => Uint8ClampedArray;

/**
 * Modern TGA loader class
 */
export class Targa {
  public header?: TgaHeader;
  public palette?: Uint8Array;
  public imageData?: Uint8Array;

  /**
   * Validate TGA header for errors
   */
  private static validateHeader(header: TgaHeader): void {
    // Check for empty file
    if (header.imageType === TgaType.NO_DATA) {
      throw new Error('TGA file contains no data');
    }

    // Validate indexed type
    if (header.hasColorMap) {
      if (header.colorMapLength > 256 || header.colorMapDepth !== 24 || header.colorMapType !== 1) {
        throw new Error('Invalid colormap for indexed type');
      }
    } else if (header.colorMapType) {
      throw new Error('Unexpected palette in non-indexed image');
    }

    // Validate image dimensions
    if (header.width <= 0 || header.height <= 0) {
      throw new Error(`Invalid image size: ${header.width}x${header.height}`);
    }

    // Validate pixel depth
    const validDepths = [8, 16, 24, 32];
    if (!validDepths.includes(header.pixelDepth)) {
      throw new Error(`Invalid pixel depth: ${header.pixelDepth} bits`);
    }
  }

  /**
   * Decode RLE (Run Length Encoding) compression
   */
  private static decodeRLE(data: Uint8Array, offset: number, pixelSize: number, outputSize: number): Uint8Array {
    const output = new Uint8Array(outputSize);
    const pixels = new Uint8Array(pixelSize);
    let pos = 0;

    while (pos < outputSize) {
      const c = data[offset++];
      const count = (c & 0x7f) + 1;

      if (c & 0x80) {
        // RLE pixels - repeat the following pixel
        for (let i = 0; i < pixelSize; i++) {
          pixels[i] = data[offset++];
        }

        for (let i = 0; i < count; i++) {
          output.set(pixels, pos);
          pos += pixelSize;
        }
      } else {
        // Raw pixels - copy directly
        const copyCount = count * pixelSize;
        for (let i = 0; i < copyCount; i++) {
          output[pos++] = data[offset++];
        }
      }
    }

    return output;
  }

  /**
   * Process 8-bit indexed color images
   */
  private static processIndexed8Bit: ImageDataProcessor = (
    imageData,
    indexes,
    colormap,
    width,
    y_start,
    y_step,
    y_end,
    x_start,
    x_step,
    x_end
  ) => {
    if (!colormap) throw new Error('Colormap required for indexed images');

    let i = 0;
    for (let y = y_start; y !== y_end; y += y_step) {
      for (let x = x_start; x !== x_end; x += x_step, i++) {
        const color = indexes[i];
        const pos = (x + width * y) * 4;
        imageData[pos + 3] = 255; // Alpha
        imageData[pos + 2] = colormap[color * 3 + 0]; // Blue
        imageData[pos + 1] = colormap[color * 3 + 1]; // Green
        imageData[pos + 0] = colormap[color * 3 + 2]; // Red
      }
    }
    return imageData;
  };

  /**
   * Process 16-bit RGB images
   */
  private static processRGB16Bit: ImageDataProcessor = (
    imageData,
    pixels,
    _colormap,
    width,
    y_start,
    y_step,
    y_end,
    x_start,
    x_step,
    x_end
  ) => {
    let i = 0;
    for (let y = y_start; y !== y_end; y += y_step) {
      for (let x = x_start; x !== x_end; x += x_step, i += 2) {
        const color = pixels[i] | (pixels[i + 1] << 8);
        const pos = (x + width * y) * 4;
        imageData[pos + 0] = (color & 0x7c00) >> 7; // Red
        imageData[pos + 1] = (color & 0x03e0) >> 2; // Green
        imageData[pos + 2] = (color & 0x001f) << 3; // Blue
        imageData[pos + 3] = (color & 0x8000) ? 0 : 255; // Alpha
      }
    }
    return imageData;
  };

  /**
   * Process 24-bit RGB images
   */
  private static processRGB24Bit: ImageDataProcessor = (
    imageData,
    pixels,
    _colormap,
    width,
    y_start,
    y_step,
    y_end,
    x_start,
    x_step,
    x_end
  ) => {
    let i = 0;
    for (let y = y_start; y !== y_end; y += y_step) {
      for (let x = x_start; x !== x_end; x += x_step, i += 3) {
        const pos = (x + width * y) * 4;
        imageData[pos + 3] = 255; // Alpha
        imageData[pos + 2] = pixels[i + 0]; // Blue
        imageData[pos + 1] = pixels[i + 1]; // Green
        imageData[pos + 0] = pixels[i + 2]; // Red
      }
    }
    return imageData;
  };

  /**
   * Process 32-bit RGBA images
   */
  private static processRGB32Bit: ImageDataProcessor = (
    imageData,
    pixels,
    _colormap,
    width,
    y_start,
    y_step,
    y_end,
    x_start,
    x_step,
    x_end
  ) => {
    let i = 0;
    for (let y = y_start; y !== y_end; y += y_step) {
      for (let x = x_start; x !== x_end; x += x_step, i += 4) {
        const pos = (x + width * y) * 4;
        imageData[pos + 2] = pixels[i + 0]; // Blue
        imageData[pos + 1] = pixels[i + 1]; // Green
        imageData[pos + 0] = pixels[i + 2]; // Red
        imageData[pos + 3] = pixels[i + 3]; // Alpha
      }
    }
    return imageData;
  };

  /**
   * Process 8-bit grayscale images
   */
  private static processGrey8Bit: ImageDataProcessor = (
    imageData,
    pixels,
    _colormap,
    width,
    y_start,
    y_step,
    y_end,
    x_start,
    x_step,
    x_end
  ) => {
    let i = 0;
    for (let y = y_start; y !== y_end; y += y_step) {
      for (let x = x_start; x !== x_end; x += x_step, i++) {
        const color = pixels[i];
        const pos = (x + width * y) * 4;
        imageData[pos + 0] = color; // Red
        imageData[pos + 1] = color; // Green
        imageData[pos + 2] = color; // Blue
        imageData[pos + 3] = 255; // Alpha
      }
    }
    return imageData;
  };

  /**
   * Process 16-bit grayscale images
   */
  private static processGrey16Bit: ImageDataProcessor = (
    imageData,
    pixels,
    _colormap,
    width,
    y_start,
    y_step,
    y_end,
    x_start,
    x_step,
    x_end
  ) => {
    let i = 0;
    for (let y = y_start; y !== y_end; y += y_step) {
      for (let x = x_start; x !== x_end; x += x_step, i += 2) {
        const pos = (x + width * y) * 4;
        imageData[pos + 0] = pixels[i]; // Red (luminance)
        imageData[pos + 1] = pixels[i]; // Green (luminance)
        imageData[pos + 2] = pixels[i]; // Blue (luminance)
        imageData[pos + 3] = pixels[i + 1]; // Alpha
      }
    }
    return imageData;
  };

  /**
   * Load TGA file from URL using fetch
   */
  async open(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      this.load(new Uint8Array(arrayBuffer));
    } catch (error) {
      throw new Error(`Failed to load TGA file from ${url}: ${error}`);
    }
  }

  /**
   * Load and parse TGA file from buffer
   */
  load(data: Uint8Array): void {
    if (data.length < 0x12) {
      throw new Error('TGA file too small to contain valid header');
    }

    let offset = 0;

    // Parse TGA header
    this.header = {
      idLength: data[offset++],
      colorMapType: data[offset++],
      imageType: data[offset++],
      colorMapIndex: data[offset++] | (data[offset++] << 8),
      colorMapLength: data[offset++] | (data[offset++] << 8),
      colorMapDepth: data[offset++],
      offsetX: data[offset++] | (data[offset++] << 8),
      offsetY: data[offset++] | (data[offset++] << 8),
      width: data[offset++] | (data[offset++] << 8),
      height: data[offset++] | (data[offset++] << 8),
      pixelDepth: data[offset++],
      flags: data[offset++],
      hasEncoding: false,
      hasColorMap: false,
      isGreyColor: false,
    };

    // Set computed properties
    this.header.hasEncoding = [TgaType.RLE_INDEXED, TgaType.RLE_RGB, TgaType.RLE_GREY].includes(this.header.imageType);
    this.header.hasColorMap = [TgaType.RLE_INDEXED, TgaType.INDEXED].includes(this.header.imageType);
    this.header.isGreyColor = [TgaType.RLE_GREY, TgaType.GREY].includes(this.header.imageType);

    // Validate header
    Targa.validateHeader(this.header);

    // Skip ID field
    offset += this.header.idLength;
    if (offset >= data.length) {
      throw new Error('TGA file truncated - no image data');
    }

    // Read color palette if present
    if (this.header.hasColorMap) {
      const colorMapSize = this.header.colorMapLength * (this.header.colorMapDepth >> 3);
      this.palette = data.subarray(offset, offset + colorMapSize);
      offset += colorMapSize;
    }

    // Calculate image data size
    const pixelSize = this.header.pixelDepth >> 3;
    const imageSize = this.header.width * this.header.height;
    const pixelTotal = imageSize * pixelSize;

    // Decode image data
    if (this.header.hasEncoding) {
      this.imageData = Targa.decodeRLE(data, offset, pixelSize, pixelTotal);
    } else {
      const dataSize = this.header.hasColorMap ? imageSize : pixelTotal;
      this.imageData = data.subarray(offset, offset + dataSize);
    }
  }

  /**
   * Get ImageData object from loaded TGA
   */
  getImageData(providedImageData?: ImageData): ImageDataLike {
    if (!this.header || !this.imageData) {
      throw new Error('No TGA data loaded');
    }

    const { width, height } = this.header;
    
    // Create ImageData if not provided
    let imageData: ImageDataLike;
    if (providedImageData) {
      imageData = providedImageData;
    } else if (typeof document !== 'undefined') {
      imageData = document.createElement('canvas').getContext('2d')!.createImageData(width, height);
    } else {
      // Fallback for worker/non-DOM contexts
      imageData = {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      };
    }

    // Determine scan direction based on origin
    const origin = (this.header.flags & TgaOrigin.MASK) >> TgaOrigin.SHIFT;
    const isTopOrigin = origin === TgaOrigin.TOP_LEFT || origin === TgaOrigin.TOP_RIGHT;
    const isLeftOrigin = origin === TgaOrigin.TOP_LEFT || origin === TgaOrigin.BOTTOM_LEFT;

    const y_start = isTopOrigin ? 0 : height - 1;
    const y_step = isTopOrigin ? 1 : -1;
    const y_end = isTopOrigin ? height : -1;

    const x_start = isLeftOrigin ? 0 : width - 1;
    const x_step = isLeftOrigin ? 1 : -1;
    const x_end = isLeftOrigin ? width : -1;

    // Select appropriate processor
    let processor: ImageDataProcessor;
    
    if (this.header.isGreyColor) {
      processor = this.header.pixelDepth === 8 ? Targa.processGrey8Bit : Targa.processGrey16Bit;
    } else {
      switch (this.header.pixelDepth) {
        case 8:
          processor = Targa.processIndexed8Bit;
          break;
        case 16:
          processor = Targa.processRGB16Bit;
          break;
        case 24:
          processor = Targa.processRGB24Bit;
          break;
        case 32:
          processor = Targa.processRGB32Bit;
          break;
        default:
          throw new Error(`Unsupported pixel depth: ${this.header.pixelDepth}`);
      }
    }

    // Process the image data
    processor(imageData.data, this.imageData, this.palette, width, y_start, y_step, y_end, x_start, x_step, x_end);

    return imageData;
  }

  /**
   * Get HTML Canvas element with loaded TGA
   */
  getCanvas(): HTMLCanvasElement {
    if (typeof document === 'undefined') {
      throw new Error('Canvas not available in this context');
    }

    if (!this.header) {
      throw new Error('No TGA data loaded');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = this.header.width;
    canvas.height = this.header.height;

    const imageData = this.getImageData() as ImageData;
    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }

  /**
   * Get data URL of the loaded TGA
   */
  getDataURL(type = 'image/png'): string {
    return this.getCanvas().toDataURL(type);
  }
}

// Export for backward compatibility
export default Targa;