/**
 * Utils/BinaryReader.ts
 *
 * Modern Binary Data Reader for ROBrowser
 * Helper to load/parse binary data from sockets, files, and other sources
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

// import Struct from './Struct'; // TODO: Modernize Struct.js first

/**
 * Temporary Struct interface for compatibility
 */
interface Struct {
  getFieldList(): Record<string, { count: number; func: string }>;
}

/**
 * Seek constants for cursor positioning
 */
export const SEEK_CUR = 1;
export const SEEK_SET = 2;
export const SEEK_END = 3;

/**
 * Position data type
 */
export type Position = [number, number, number]; // [x, y, direction]

/**
 * Extended position data type for movement
 */
export type Position2 = [number, number, number, number, number, number]; // [from_x, from_y, to_x, to_y, subx, suby]

/**
 * Supported buffer input types
 */
export type BufferInput = string | ArrayBuffer | Uint8Array;

/**
 * Modern binary data reader with comprehensive type safety
 */
export class BinaryReader {
  private buffer: ArrayBuffer;
  private view: DataView;
  private _offset = 0;
  private _length: number;

  // Static buffers for position reading (performance optimization)
  private static readonly positionBuffer = new ArrayBuffer(4);
  private static readonly positionByteArray = new Int8Array(BinaryReader.positionBuffer);
  private static readonly positionIntArray = new Int32Array(BinaryReader.positionBuffer);

  /**
   * Create a new BinaryReader instance
   *
   * @param input - Buffer data (string, ArrayBuffer, or Uint8Array)
   * @param start - Start offset (optional)
   * @param end - End offset (optional)
   */
  constructor(input: BufferInput, start = 0, end?: number) {
    this.buffer = this.normalizeBuffer(input);
    const actualEnd = end ?? this.buffer.byteLength;
    this._length = actualEnd - start;
    
    this.view = new DataView(this.buffer, start, this._length);
    this._offset = 0;
  }

  /**
   * Normalize input to ArrayBuffer
   */
  private normalizeBuffer(input: BufferInput): ArrayBuffer {
    if (typeof input === 'string') {
      const length = input.length;
      const buffer = new ArrayBuffer(length);
      const uint8 = new Uint8Array(buffer);

      for (let i = 0; i < length; i++) {
        uint8[i] = input.charCodeAt(i) & 0xff;
      }

      return buffer;
    }

    if (input instanceof ArrayBuffer) {
      return input;
    }

    if (input instanceof Uint8Array) {
      return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    }

    throw new Error('BinaryReader: Unsupported buffer type');
  }

  /**
   * Get current offset position
   */
  get offset(): number {
    return this._offset;
  }

  /**
   * Get total buffer length
   */
  get length(): number {
    return this._length;
  }

  /**
   * Get remaining bytes count
   */
  get remaining(): number {
    return this._length - this._offset;
  }

  /**
   * Check if we've reached the end of buffer
   */
  get isEOF(): boolean {
    return this._offset >= this._length;
  }

  /**
   * Read signed 8-bit integer
   */
  getInt8(): number {
    this.checkBounds(1);
    return this.view.getInt8(this._offset++);
  }

  readChar(): number {
    return this.getInt8();
  }

  readByte(): number {
    return this.getInt8();
  }

  /**
   * Read unsigned 8-bit integer
   */
  getUint8(): number {
    this.checkBounds(1);
    return this.view.getUint8(this._offset++);
  }

  readUChar(): number {
    return this.getUint8();
  }

  readUByte(): number {
    return this.getUint8();
  }

  /**
   * Read signed 16-bit integer (little-endian)
   */
  getInt16(): number;
  readShort(): number;
  getInt16(): number {
    this.checkBounds(2);
    const data = this.view.getInt16(this._offset, true);
    this._offset += 2;
    return data;
  }

  readShort = this.getInt16;

  /**
   * Read unsigned 16-bit integer (little-endian)
   */
  getUint16(): number;
  readUShort(): number;
  getUint16(): number {
    this.checkBounds(2);
    const data = this.view.getUint16(this._offset, true);
    this._offset += 2;
    return data;
  }

  readUShort = this.getUint16;

  /**
   * Read signed 32-bit integer (little-endian)
   */
  getInt32(): number;
  readInt(): number;
  readLong(): number;
  getInt32(): number {
    this.checkBounds(4);
    const data = this.view.getInt32(this._offset, true);
    this._offset += 4;
    return data;
  }

  readInt = this.getInt32;
  readLong = this.getInt32;

  /**
   * Read unsigned 32-bit integer (little-endian)
   */
  getUint32(): number;
  readUInt(): number;
  readULong(): number;
  getUint32(): number {
    this.checkBounds(4);
    const data = this.view.getUint32(this._offset, true);
    this._offset += 4;
    return data;
  }

  readUInt = this.getUint32;
  readULong = this.getUint32;

  /**
   * Read 32-bit float (little-endian)
   */
  getFloat32(): number;
  readFloat(): number;
  getFloat32(): number {
    this.checkBounds(4);
    const data = this.view.getFloat32(this._offset, true);
    this._offset += 4;
    return data;
  }

  readFloat = this.getFloat32;

  /**
   * Read 64-bit float (little-endian)
   */
  getFloat64(): number;
  readDouble(): number;
  getFloat64(): number {
    this.checkBounds(8);
    const data = this.view.getFloat64(this._offset, true);
    this._offset += 8;
    return data;
  }

  readDouble = this.getFloat64;

  /**
   * Read unsigned 64-bit integer (little-endian)
   * Note: JavaScript's Number precision limitation applies
   */
  getUint64(): number;
  readUInt64(): number;
  getUint64(): number {
    this.checkBounds(8);
    
    // Split 64-bit number into two 32-bit parts (little-endian)
    const left = this.view.getUint32(this._offset, true);
    const right = this.view.getUint32(this._offset + 4, true);
    
    // Combine the two 32-bit values
    const combined = left + 2 ** 32 * right;
    
    if (!Number.isSafeInteger(combined)) {
      console.warn(`Value ${combined} exceeds MAX_SAFE_INTEGER. Precision may be lost`);
    }
    
    this._offset += 8;
    return combined;
  }

  readUInt64 = this.getUint64;

  /**
   * Get current buffer position
   */
  tell(): number {
    return this._offset;
  }

  /**
   * Read UTF-8 string of specified length
   */
  getString(length: number): string;
  readString(length: number): string;
  getString(length: number): string {
    this.checkBounds(length);
    
    const startOffset = this._offset;
    const data = new Uint8Array(length);
    let actualLength = 0;

    for (let i = 0; i < length; i++) {
      const byte = this.getUint8();
      if (byte === 0) {
        break;
      }
      data[i] = byte;
      actualLength++;
    }

    this._offset = startOffset + length;

    // Use TextDecoder for proper UTF-8 decoding
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      return decoder.decode(data.subarray(0, actualLength));
    } catch (error) {
      // Fallback to binary string if UTF-8 decoding fails
      console.warn('Failed to decode as UTF-8, falling back to binary string');
      return this.decodeBinaryString(data.subarray(0, actualLength));
    }
  }

  readString = this.getString;

  /**
   * Read binary string (raw bytes as characters)
   */
  getBinaryString(length: number): string;
  readBinaryString(length: number): string;
  getBinaryString(length: number): string {
    this.checkBounds(length);
    
    const startOffset = this._offset;
    const bytes = new Uint8Array(length);
    let actualLength = 0;

    for (let i = 0; i < length; i++) {
      const byte = this.getUint8();
      if (byte === 0) {
        break;
      }
      bytes[i] = byte;
      actualLength++;
    }

    this._offset = startOffset + length;
    return this.decodeBinaryString(bytes.subarray(0, actualLength));
  }

  readBinaryString = this.getBinaryString;

  /**
   * Decode binary data as string
   */
  private decodeBinaryString(data: Uint8Array): string {
    let result = '';
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(data[i]);
    }
    return result;
  }

  /**
   * Read structured data using Struct definition
   */
  getStruct<T = any>(struct: Struct): T;
  readStruct<T = any>(struct: Struct): T;
  getStruct<T = any>(struct: Struct): T {
    if (!(struct instanceof Struct)) {
      throw new Error('BinaryReader.getStruct: Invalid struct argument');
    }

    const list = struct.getFieldList();
    const result: any = {};

    for (const [name, field] of Object.entries(list)) {
      if (field.count > 1) {
        result[name] = new Array(field.count);
        for (let i = 0; i < field.count; i++) {
          result[name][i] = (this as any)[field.func]();
        }
      } else {
        result[name] = (this as any)[field.func]();
      }
    }

    return result as T;
  }

  readStruct = this.getStruct;

  /**
   * Move cursor to specified position
   */
  seek(offset: number, whence = SEEK_SET): void {
    switch (whence) {
      case SEEK_CUR:
        this._offset += offset;
        break;
      case SEEK_END:
        this._offset = this._length + offset;
        break;
      case SEEK_SET:
      default:
        this._offset = offset;
        break;
    }

    // Clamp to valid range
    this._offset = Math.max(0, Math.min(this._offset, this._length));
  }

  /**
   * Read position data (3 bytes -> x, y, direction)
   */
  getPos(): Position;
  readPos(): Position;
  getPos(): Position {
    this.checkBounds(3);
    
    const { positionByteArray, positionIntArray } = BinaryReader;
    
    positionByteArray[2] = this.getUint8();
    positionByteArray[1] = this.getUint8();
    positionByteArray[0] = this.getUint8();
    positionByteArray[3] = 0;

    let packed = positionIntArray[0];
    const dir = packed & 0x0f;
    packed >>= 4;

    const y = packed & 0x03ff;
    packed >>= 10;

    const x = packed & 0x03ff;

    return [x, y, dir];
  }

  readPos = this.getPos;

  /**
   * Read movement position data (6 bytes -> from_x, from_y, to_x, to_y, subx, suby)
   */
  getPos2(): Position2;
  readPos2(): Position2;
  getPos2(): Position2 {
    this.checkBounds(6);
    
    const a = this.getInt8();
    const b = this.getInt8();
    const c = this.getInt8();
    const d = this.getInt8();
    const e = this.getInt8();
    const f = this.getInt8();

    return [
      ((a & 0xff) << 2) | ((b & 0xc0) >> 6), // from_x
      ((b & 0x3f) << 4) | ((c & 0xf0) >> 4), // from_y
      ((d & 0xfc) >> 2) | ((c & 0x0f) << 6), // to_x
      ((d & 0x03) << 8) | (e & 0xff),        // to_y
      (f & 0xf0) >> 4,                       // sub_x
      f & 0x0f,                              // sub_y
    ];
  }

  readPos2 = this.getPos2;

  /**
   * Read array of bytes
   */
  getBytes(length: number): Uint8Array {
    this.checkBounds(length);
    
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = this.getUint8();
    }
    
    return bytes;
  }

  /**
   * Skip specified number of bytes
   */
  skip(count: number): void {
    this.seek(count, SEEK_CUR);
  }

  /**
   * Create a slice of the current buffer
   */
  slice(length?: number): BinaryReader {
    const actualLength = length ?? this.remaining;
    this.checkBounds(actualLength);
    
    const start = this._offset;
    this._offset += actualLength;
    
    return new BinaryReader(this.buffer, start, start + actualLength);
  }

  /**
   * Check if we have enough bytes to read
   */
  private checkBounds(bytesNeeded: number): void {
    if (this._offset + bytesNeeded > this._length) {
      throw new Error(
        `BinaryReader: Attempted to read ${bytesNeeded} bytes at offset ${this._offset}, ` +
        `but only ${this.remaining} bytes remaining`
      );
    }
  }

  /**
   * Get a copy of the underlying buffer
   */
  getBuffer(): ArrayBuffer {
    return this.buffer.slice(0);
  }

  /**
   * Reset reader to beginning
   */
  reset(): void {
    this._offset = 0;
  }

  /**
   * Create a new reader from current position
   */
  fork(): BinaryReader {
    return new BinaryReader(this.buffer, this._offset);
  }

  /**
   * Read all remaining data as Uint8Array
   */
  readRemainingBytes(): Uint8Array {
    return this.getBytes(this.remaining);
  }
}

// Export constants to global scope for backward compatibility
if (typeof globalThis !== 'undefined') {
  (globalThis as any).SEEK_CUR = SEEK_CUR;
  (globalThis as any).SEEK_SET = SEEK_SET;
  (globalThis as any).SEEK_END = SEEK_END;
}

// Default export
export default BinaryReader;