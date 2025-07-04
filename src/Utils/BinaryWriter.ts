/**
 * Utils/BinaryWriter.ts
 *
 * BinaryWriter Helper
 *
 * Helper to build binary data (write sockets, files, ...)
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Position interface for 2D coordinates
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Writer configuration interface
 */
export interface BinaryWriterConfig {
  initialSize?: number;
  autoResize?: boolean;
  littleEndian?: boolean;
}

/**
 * Buffer statistics interface
 */
export interface BufferStats {
  size: number;
  used: number;
  remaining: number;
  position: number;
}

/**
 * Extended DataView with additional methods
 */
declare global {
  interface DataView {
    setPos(offset: number, value: [number, number], littleEndian?: boolean): void;
    setString(offset: number, str: string, len?: number): void;
    setBinaryString(offset: number, str: string, len?: number): void;
  }
}

/**
 * Extend DataView to add position encoding
 */
DataView.prototype.setPos = function(
  offset: number,
  value: [number, number],
  littleEndian: boolean = true
): void {
  const [x, y] = value;

  if (littleEndian) {
    this.setInt8(offset + 0, x >> 2);
    this.setInt8(offset + 1, ((x % 4) << 6) | (y >> 4));
    this.setInt8(offset + 2, (y % 16) << 4);
  } else {
    this.setInt8(offset + 2, x >> 2);
    this.setInt8(offset + 1, ((x % 4) << 6) | (y >> 4));
    this.setInt8(offset + 0, (y % 16) << 4);
  }
};

/**
 * Extend DataView to add string encoding
 */
DataView.prototype.setString = function(
  offset: number,
  str: string,
  len?: number
): void {
  const text = len ? String(str).substr(0, len) : str;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  for (let i = 0, count = len || data.length; i < count; ++i) {
    this.setUint8(offset + i, data[i] || 0);
  }
};

/**
 * Extend DataView to add binary string encoding
 */
DataView.prototype.setBinaryString = function(
  offset: number,
  str: string,
  len?: number
): void {
  const text = len ? String(str).substr(0, len) : str;

  for (let i = 0, count = text.length; i < count; ++i) {
    this.setUint8(offset + i, text.charCodeAt(i) & 0xff);
  }
};

/**
 * Modern BinaryWriter implementation
 * Helper to write binary data with automatic buffer management
 */
export class BinaryWriter {
  private _buffer: ArrayBuffer;
  private _view: DataView;
  private _offset: number = 0;
  private _config: Required<BinaryWriterConfig>;

  /**
   * Create a new BinaryWriter
   */
  constructor(length: number = 1024, config: BinaryWriterConfig = {}) {
    this._config = {
      initialSize: length,
      autoResize: true,
      littleEndian: true,
      ...config
    };

    this._buffer = new ArrayBuffer(length);
    this._view = new DataView(this._buffer);
  }

  /**
   * Get current buffer
   */
  get buffer(): ArrayBuffer {
    return this._buffer;
  }

  /**
   * Get current view
   */
  get view(): DataView {
    return this._view;
  }

  /**
   * Get current offset
   */
  get offset(): number {
    return this._offset;
  }

  /**
   * Get buffer statistics
   */
  get stats(): BufferStats {
    return {
      size: this._buffer.byteLength,
      used: this._offset,
      remaining: this._buffer.byteLength - this._offset,
      position: this._offset
    };
  }

  /**
   * Get the used portion of the buffer
   */
  get usedBuffer(): ArrayBuffer {
    return this._buffer.slice(0, this._offset);
  }

  /**
   * Ensure buffer has enough space, resize if needed
   */
  private _ensureCapacity(additionalBytes: number): void {
    const requiredSize = this._offset + additionalBytes;
    
    if (requiredSize > this._buffer.byteLength) {
      if (!this._config.autoResize) {
        throw new Error(`BinaryWriter: Buffer overflow. Required: ${requiredSize}, Available: ${this._buffer.byteLength}`);
      }
      
      // Double the buffer size or use required size, whichever is larger
      const newSize = Math.max(this._buffer.byteLength * 2, requiredSize);
      this._resize(newSize);
    }
  }

  /**
   * Resize buffer to new size
   */
  private _resize(newSize: number): void {
    const newBuffer = new ArrayBuffer(newSize);
    const newView = new DataView(newBuffer);
    
    // Copy existing data
    const oldData = new Uint8Array(this._buffer);
    const newData = new Uint8Array(newBuffer);
    newData.set(oldData);
    
    this._buffer = newBuffer;
    this._view = newView;
  }

  /**
   * Write Int8 to buffer
   */
  writeInt8(value: number): this {
    this._ensureCapacity(1);
    this._view.setInt8(this._offset++, value);
    return this;
  }

  /**
   * Write Uint8 to buffer
   */
  writeUint8(value: number): this {
    this._ensureCapacity(1);
    this._view.setUint8(this._offset++, value);
    return this;
  }

  /**
   * Write Int16 to buffer
   */
  writeInt16(value: number): this {
    this._ensureCapacity(2);
    this._view.setInt16(this._offset, value, this._config.littleEndian);
    this._offset += 2;
    return this;
  }

  /**
   * Write Uint16 to buffer
   */
  writeUint16(value: number): this {
    this._ensureCapacity(2);
    this._view.setUint16(this._offset, value, this._config.littleEndian);
    this._offset += 2;
    return this;
  }

  /**
   * Write Int32 to buffer
   */
  writeInt32(value: number): this {
    this._ensureCapacity(4);
    this._view.setInt32(this._offset, value, this._config.littleEndian);
    this._offset += 4;
    return this;
  }

  /**
   * Write Uint32 to buffer
   */
  writeUint32(value: number): this {
    this._ensureCapacity(4);
    this._view.setUint32(this._offset, value, this._config.littleEndian);
    this._offset += 4;
    return this;
  }

  /**
   * Write Float32 to buffer
   */
  writeFloat32(value: number): this {
    this._ensureCapacity(4);
    this._view.setFloat32(this._offset, value, this._config.littleEndian);
    this._offset += 4;
    return this;
  }

  /**
   * Write Float64 to buffer
   */
  writeFloat64(value: number): this {
    this._ensureCapacity(8);
    this._view.setFloat64(this._offset, value, this._config.littleEndian);
    this._offset += 8;
    return this;
  }

  /**
   * Write String to buffer
   */
  writeString(str: string, length?: number): this {
    const text = length ? String(str).substr(0, length) : str;
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const writeLength = length || data.length;

    this._ensureCapacity(writeLength);

    // Handle potential encoding expansion
    if (!length && data.length > text.length) {
      // Need to resize buffer for UTF-8 expansion
      this._ensureCapacity(data.length - text.length);
      
      // Update packet size if this is a packet (has size at offset 2)
      if (this._offset >= 4) {
        this._view.setInt16(2, this._buffer.byteLength, this._config.littleEndian);
      }
    }

    for (let i = 0; i < writeLength; ++i) {
      this._view.setUint8(this._offset + i, data[i] || 0);
    }

    this._offset += writeLength;
    return this;
  }

  /**
   * Write Binary String to buffer
   */
  writeBinaryString(str: string, length?: number): this {
    const text = length ? String(str).substr(0, length) : str;
    const writeLength = length || text.length;

    this._ensureCapacity(writeLength);

    for (let i = 0; i < writeLength; ++i) {
      this._view.setUint8(this._offset + i, text.charCodeAt(i) & 0xff);
    }

    this._offset += writeLength;
    return this;
  }

  /**
   * Write buffer to buffer
   */
  writeBuffer(buffer: ArrayBuffer | Uint8Array): this {
    const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    
    this._ensureCapacity(data.length);
    
    const targetData = new Uint8Array(this._buffer);
    targetData.set(data, this._offset);
    
    this._offset += data.length;
    return this;
  }

  /**
   * Write position (x, y) to buffer
   */
  writePosition(pos: Position | [number, number]): this {
    const [x, y] = Array.isArray(pos) ? pos : [pos.x, pos.y];
    
    this._ensureCapacity(3);
    
    this._view.setInt8(this._offset++, x >> 2);
    this._view.setInt8(this._offset++, ((x % 4) << 6) | (y >> 4));
    this._view.setInt8(this._offset++, (y % 16) << 4);
    
    return this;
  }

  /**
   * Skip X bytes in buffer
   */
  skip(count: number): this {
    this._ensureCapacity(count);
    this._offset += count;
    return this;
  }

  /**
   * Reset writer to beginning
   */
  reset(): this {
    this._offset = 0;
    return this;
  }

  /**
   * Seek to specific position
   */
  seek(position: number): this {
    if (position < 0 || position > this._buffer.byteLength) {
      throw new Error(`BinaryWriter: Invalid seek position ${position}`);
    }
    this._offset = position;
    return this;
  }

  /**
   * Get Uint8Array view of the used buffer
   */
  toUint8Array(): Uint8Array {
    return new Uint8Array(this._buffer, 0, this._offset);
  }

  /**
   * Get Blob representation of the used buffer
   */
  toBlob(type?: string): Blob {
    return new Blob([this.usedBuffer], { type });
  }

  // Legacy method aliases for backward compatibility
  setInt8 = this.writeInt8;
  writeChar = this.writeInt8;
  writeByte = this.writeInt8;
  
  setUint8 = this.writeUint8;
  writeUChar = this.writeUint8;
  writeUByte = this.writeUint8;
  
  setInt16 = this.writeInt16;
  writeShort = this.writeInt16;
  
  setUint16 = this.writeUint16;
  writeUShort = this.writeUint16;
  
  setInt32 = this.writeInt32;
  writeInt = this.writeInt32;
  writeLong = this.writeInt32;
  
  setUint32 = this.writeUint32;
  writeUInt = this.writeUint32;
  writeULong = this.writeUint32;
  
  setFloat32 = this.writeFloat32;
  writeFloat = this.writeFloat32;
  
  setFloat64 = this.writeFloat64;
  writeDouble = this.writeFloat64;
  
  setString = this.writeString;
  setBinaryString = this.writeBinaryString;
  setBuffer = this.writeBuffer;
  setPos = this.writePosition;
  writePos = this.writePosition;
}

/**
 * Factory function for creating BinaryWriter instances
 */
export function createBinaryWriter(length?: number, config?: BinaryWriterConfig): BinaryWriter {
  return new BinaryWriter(length, config);
}

export default BinaryWriter;