/**
 * Utils/BinaryReader.ts
 *
 * BinaryReader Helper
 *
 * Helper to load/parse Binary data (sockets, files)
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Struct from './Struct';

/**
 * Binary seek constants
 */
export const SEEK_CUR = 1;
export const SEEK_SET = 2;
export const SEEK_END = 3;

/**
 * Seek mode type
 */
export type SeekMode = typeof SEEK_CUR | typeof SEEK_SET | typeof SEEK_END;

/**
 * Text encoding options
 */
export interface TextEncodingOptions {
    /** Text encoding (default: 'utf-8') */
    encoding?: string;
    /** Whether to handle null-terminated strings */
    nullTerminated?: boolean;
    /** Whether to trim whitespace */
    trim?: boolean;
}

/**
 * Position data structure
 */
export interface Position {
    x: number;
    y: number;
    direction: number;
}

/**
 * Position2 data structure (movement)
 */
export interface Position2 {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    subX: number;
    subY: number;
}

/**
 * BinaryReader statistics
 */
export interface BinaryReaderStats {
    /** Total buffer size */
    totalSize: number;
    /** Current position */
    position: number;
    /** Remaining bytes */
    remaining: number;
    /** Bytes read */
    bytesRead: number;
}

/**
 * Modern BinaryReader with comprehensive type safety and advanced features
 */
export class BinaryReader {
    /** Underlying ArrayBuffer */
    public readonly buffer: ArrayBuffer;
    
    /** DataView for efficient binary operations */
    public readonly view: DataView;
    
    /** Current read offset */
    public offset: number = 0;
    
    /** Total length of the buffer */
    public readonly length: number;
    
    /** Text decoder for string operations */
    private _textDecoder: TextDecoder;
    
    /** Temporary buffer for position operations */
    private static _tempBuffer = new ArrayBuffer(4);
    private static _tempInt8Array = new Int8Array(BinaryReader._tempBuffer);
    private static _tempInt32Array = new Int32Array(BinaryReader._tempBuffer);

    /**
     * Create a new BinaryReader
     * 
     * @param source - Source data (string, ArrayBuffer, or Uint8Array)
     * @param start - Start offset (optional)
     * @param end - End offset (optional)
     * @throws {Error} If source type is not supported
     */
    constructor(source: string | ArrayBuffer | Uint8Array, start?: number, end?: number) {
        let buffer: ArrayBuffer;

        if (typeof source === 'string') {
            buffer = this._stringToArrayBuffer(source);
        } else if (source instanceof ArrayBuffer) {
            buffer = source;
        } else if (source instanceof Uint8Array) {
            buffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
        } else {
            throw new Error('BinaryReader() - Unsupported source type');
        }

        this.buffer = buffer;
        this.length = (end || buffer.byteLength) - (start || 0);
        this.view = new DataView(buffer, start || 0, this.length);
        this._textDecoder = new TextDecoder('utf-8');
    }

    /**
     * Convert string to ArrayBuffer
     * 
     * @param str - Input string
     * @returns ArrayBuffer representation
     */
    private _stringToArrayBuffer(str: string): ArrayBuffer {
        const buffer = new ArrayBuffer(str.length);
        const uint8Array = new Uint8Array(buffer);
        
        for (let i = 0; i < str.length; i++) {
            uint8Array[i] = str.charCodeAt(i) & 0xff;
        }
        
        return buffer;
    }

    /**
     * Read Int8 from buffer
     * 
     * @returns Int8 value
     */
    public getInt8(): number {
        this._checkBounds(1);
        return this.view.getInt8(this.offset++);
    }

    public readChar(): number {
        return this.getInt8();
    }

    public readByte(): number {
        return this.getInt8();
    }

    /**
     * Read Uint8 from buffer
     * 
     * @returns Uint8 value
     */
    public getUint8(): number {
        this._checkBounds(1);
        return this.view.getUint8(this.offset++);
    }

    public readUChar(): number {
        return this.getUint8();
    }

    public readUByte(): number {
        return this.getUint8();
    }

    /**
     * Read Int16 from buffer (little-endian)
     * 
     * @returns Int16 value
     */
    public getInt16(): number {
        this._checkBounds(2);
        const value = this.view.getInt16(this.offset, true);
        this.offset += 2;
        return value;
    }

    public readShort(): number {
        return this.getInt16();
    }

    /**
     * Read Uint16 from buffer (little-endian)
     * 
     * @returns Uint16 value
     */
    public getUint16(): number {
        this._checkBounds(2);
        const value = this.view.getUint16(this.offset, true);
        this.offset += 2;
        return value;
    }

    public readUShort(): number {
        return this.getUint16();
    }

    /**
     * Read Int32 from buffer (little-endian)
     * 
     * @returns Int32 value
     */
    public getInt32(): number {
        this._checkBounds(4);
        const value = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }

    public readInt(): number {
        return this.getInt32();
    }

    public readLong(): number {
        return this.getInt32();
    }

    /**
     * Read Uint32 from buffer (little-endian)
     * 
     * @returns Uint32 value
     */
    public getUint32(): number {
        this._checkBounds(4);
        const value = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }

    public readUInt(): number {
        return this.getUint32();
    }

    public readULong(): number {
        return this.getUint32();
    }

    /**
     * Read Float32 from buffer (little-endian)
     * 
     * @returns Float32 value
     */
    public getFloat32(): number {
        this._checkBounds(4);
        const value = this.view.getFloat32(this.offset, true);
        this.offset += 4;
        return value;
    }

    public readFloat(): number {
        return this.getFloat32();
    }

    /**
     * Read Float64 from buffer (little-endian)
     * 
     * @returns Float64 value
     */
    public getFloat64(): number {
        this._checkBounds(8);
        const value = this.view.getFloat64(this.offset, true);
        this.offset += 8;
        return value;
    }

    public readDouble(): number {
        return this.getFloat64();
    }

    /**
     * Read UInt64 from buffer (little-endian)
     * Note: JavaScript numbers lose precision beyond 2^53
     * 
     * @returns UInt64 value (may lose precision)
     */
    public getUInt64(): number {
        this._checkBounds(8);
        
        // Split 64-bit number into two 32-bit parts
        const left = this.view.getUint32(this.offset, true);
        const right = this.view.getUint32(this.offset + 4, true);
        
        // Combine the two 32-bit values (little-endian)
        const combined = left + (2 ** 32) * right;
        
        if (!Number.isSafeInteger(combined)) {
            console.warn(`UInt64 value ${combined} exceeds MAX_SAFE_INTEGER. Precision may be lost.`);
        }
        
        this.offset += 8;
        return combined;
    }

    public readUInt64(): number {
        return this.getUInt64();
    }

    /**
     * Read BigUInt64 from buffer (little-endian)
     * Uses BigInt for full precision
     * 
     * @returns BigUInt64 value
     */
    public getBigUint64(): bigint {
        this._checkBounds(8);
        const value = this.view.getBigUint64(this.offset, true);
        this.offset += 8;
        return value;
    }

    /**
     * Get current buffer position
     * 
     * @returns Current offset
     */
    public tell(): number {
        return this.offset;
    }

    /**
     * Read string from buffer with modern text decoding
     * 
     * @param length - String length in bytes
     * @param options - Text encoding options
     * @returns Decoded string
     */
    public getString(length: number, options: TextEncodingOptions = {}): string {
        this._checkBounds(length);
        
        const { encoding = 'utf-8', nullTerminated = true, trim = false } = options;
        const startOffset = this.offset;
        
        // Find actual string length if null-terminated
        let actualLength = length;
        if (nullTerminated) {
            for (let i = 0; i < length; i++) {
                if (this.view.getUint8(this.offset + i) === 0) {
                    actualLength = i;
                    break;
                }
            }
        }
        
        // Create view for the string data
        const stringData = new Uint8Array(this.buffer, this.view.byteOffset + this.offset, actualLength);
        
        // Decode the string
        let result: string;
        try {
            const decoder = new TextDecoder(encoding);
            result = decoder.decode(stringData);
        } catch {
            // Fallback to manual decoding for compatibility
            result = this._manualStringDecode(stringData);
        }
        
        // Update offset
        this.offset = startOffset + length;
        
        return trim ? result.trim() : result;
    }

    public readString(length: number, options?: TextEncodingOptions): string {
        return this.getString(length, options);
    }

    /**
     * Read binary string from buffer (legacy compatibility)
     * 
     * @param length - String length
     * @returns Binary string
     */
    public getBinaryString(length: number): string {
        this._checkBounds(length);
        
        const startOffset = this.offset;
        let result = '';
        
        for (let i = 0; i < length; i++) {
            const byte = this.view.getUint8(this.offset + i);
            if (byte === 0) break;
            result += String.fromCharCode(byte);
        }
        
        this.offset = startOffset + length;
        return result;
    }

    public readBinaryString(length: number): string {
        return this.getBinaryString(length);
    }

    /**
     * Read structured data using Struct definition
     * 
     * @param struct - Struct definition
     * @returns Parsed structured data
     */
    public getStruct<T = any>(struct: Struct): T {
        if (!(struct instanceof Struct)) {
            throw new Error('BinaryReader::getStruct() - Invalid struct argument');
        }

        const result: any = {};
        const fieldNames = struct.getFieldNames();

        for (const fieldName of fieldNames) {
            const field = struct.getField(fieldName)!;
            
            if (field.count > 1) {
                // Array field
                result[fieldName] = [];
                for (let i = 0; i < field.count; i++) {
                    result[fieldName].push((this as any)[field.func]());
                }
            } else {
                // Single field
                result[fieldName] = (this as any)[field.func]();
            }
        }

        return result as T;
    }

    public readStruct<T = any>(struct: Struct): T {
        return this.getStruct<T>(struct);
    }

    /**
     * Move cursor to another offset
     * 
     * @param offset - Offset value
     * @param mode - Seek mode (SEEK_SET, SEEK_CUR, SEEK_END)
     */
    public seek(offset: number, mode: SeekMode = SEEK_SET): void {
        let newOffset: number;
        
        switch (mode) {
            case SEEK_CUR:
                newOffset = this.offset + offset;
                break;
            case SEEK_END:
                newOffset = this.length + offset;
                break;
            case SEEK_SET:
            default:
                newOffset = offset;
                break;
        }
        
        if (newOffset < 0 || newOffset > this.length) {
            throw new Error(`BinaryReader::seek() - Invalid offset: ${newOffset}`);
        }
        
        this.offset = newOffset;
    }

    /**
     * Read position from buffer (legacy RO format)
     * 
     * @returns Position data
     */
    public getPos(): Position {
        this._checkBounds(3);
        
        const tempArray = BinaryReader._tempInt8Array;
        const tempInt32 = BinaryReader._tempInt32Array;
        
        tempArray[2] = this.getUint8();
        tempArray[1] = this.getUint8();
        tempArray[0] = this.getUint8();
        tempArray[3] = 0;
        
        let packed = tempInt32[0];
        const direction = packed & 0x0f;
        packed >>= 4;
        
        const y = packed & 0x03ff;
        packed >>= 10;
        
        const x = packed & 0x03ff;
        
        return { x, y, direction };
    }

    public readPos(): Position {
        return this.getPos();
    }

    /**
     * Read position2 from buffer (movement data)
     * 
     * @returns Position2 data
     */
    public getPos2(): Position2 {
        this._checkBounds(6);
        
        const bytes = [
            this.getInt8(),
            this.getInt8(),
            this.getInt8(),
            this.getInt8(),
            this.getInt8(),
            this.getInt8()
        ];
        
        return {
            fromX: ((bytes[0] & 0xFF) << 2) | ((bytes[1] & 0xC0) >> 6),
            fromY: ((bytes[1] & 0x3F) << 4) | ((bytes[2] & 0xF0) >> 4),
            toX: ((bytes[3] & 0xFC) >> 2) | ((bytes[2] & 0x0F) << 6),
            toY: ((bytes[3] & 0x03) << 8) | (bytes[4] & 0xFF),
            subX: (bytes[5] & 0xF0) >> 4,
            subY: bytes[5] & 0xF
        };
    }

    public readPos2(): Position2 {
        return this.getPos2();
    }

    /**
     * Read raw bytes from buffer
     * 
     * @param length - Number of bytes to read
     * @returns Uint8Array with the bytes
     */
    public getBytes(length: number): Uint8Array {
        this._checkBounds(length);
        
        const bytes = new Uint8Array(this.buffer, this.view.byteOffset + this.offset, length);
        this.offset += length;
        
        return bytes;
    }

    /**
     * Skip bytes in the buffer
     * 
     * @param count - Number of bytes to skip
     */
    public skip(count: number): void {
        this._checkBounds(count);
        this.offset += count;
    }

    /**
     * Check if there are enough bytes remaining
     * 
     * @param count - Number of bytes needed
     * @returns True if enough bytes are available
     */
    public hasBytes(count: number): boolean {
        return this.offset + count <= this.length;
    }

    /**
     * Get remaining bytes count
     * 
     * @returns Number of remaining bytes
     */
    public remaining(): number {
        return this.length - this.offset;
    }

    /**
     * Check if at end of buffer
     * 
     * @returns True if at end of buffer
     */
    public isEOF(): boolean {
        return this.offset >= this.length;
    }

    /**
     * Get reader statistics
     * 
     * @returns Current statistics
     */
    public getStats(): BinaryReaderStats {
        return {
            totalSize: this.length,
            position: this.offset,
            remaining: this.remaining(),
            bytesRead: this.offset
        };
    }

    /**
     * Create a sub-reader for a portion of the buffer
     * 
     * @param length - Length of the sub-buffer
     * @returns New BinaryReader instance
     */
    public createSubReader(length: number): BinaryReader {
        this._checkBounds(length);
        
        const subReader = new BinaryReader(
            this.buffer,
            this.view.byteOffset + this.offset,
            this.view.byteOffset + this.offset + length
        );
        
        this.offset += length;
        return subReader;
    }

    /**
     * Reset reader to beginning
     */
    public reset(): void {
        this.offset = 0;
    }

    /**
     * Check bounds before reading
     * 
     * @param bytesNeeded - Number of bytes needed
     * @throws {Error} If not enough bytes available
     */
    private _checkBounds(bytesNeeded: number): void {
        if (this.offset + bytesNeeded > this.length) {
            throw new Error(
                `BinaryReader: Not enough bytes available. ` +
                `Needed: ${bytesNeeded}, Available: ${this.length - this.offset}`
            );
        }
    }

    /**
     * Manual string decoding fallback
     * 
     * @param data - Uint8Array data
     * @returns Decoded string
     */
    private _manualStringDecode(data: Uint8Array): string {
        let result = '';
        for (let i = 0; i < data.length; i++) {
            result += String.fromCharCode(data[i]);
        }
        return result;
    }
}

/**
 * Export the BinaryReader class as default
 */
export default BinaryReader;