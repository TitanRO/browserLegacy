/**
 * Utils/CRC32.ts
 *
 * This is a plugin for BinaryReader which implements CRC-32 in JS.
 * Adapted from zlib and from link below.
 * https://github.com/santihbc/azure-reader/blob/master/node_modules/express/node_modules/buffer-crc32/index.js
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Liam Mitchell
 */

import { BinaryReader } from './BinaryReader';

/**
 * CRC-32 lookup table for fast computation
 */
const CRC_TABLE = new Uint32Array([
  0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419,
  0x706af48f, 0xe963a535, 0x9e6495a3, 0x0edb8832, 0x79dcb8a4,
  0xe0d5e91e, 0x97d2d988, 0x09b64c2b, 0x7eb17cbd, 0xe7b82d07,
  0x90bf1d91, 0x1db71064, 0x6ab020f2, 0xf3b97148, 0x84be41de,
  0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7, 0x136c9856,
  0x646ba8c0, 0xfd62f97a, 0x8a65c9ec, 0x14015c4f, 0x63066cd9,
  0xfa0f3d63, 0x8d080df5, 0x3b6e20c8, 0x4c69105e, 0xd56041e4,
  0xa2677172, 0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b,
  0x35b5a8fa, 0x42b2986c, 0xdbbbc9d6, 0xacbcf940, 0x32d86ce3,
  0x45df5c75, 0xdcd60dcf, 0xabd13d59, 0x26d930ac, 0x51de003a,
  0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423, 0xcfba9599,
  0xb8bda50f, 0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924,
  0x2f6f7c87, 0x58684c11, 0xc1611dab, 0xb6662d3d, 0x76dc4190,
  0x01db7106, 0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f,
  0x9fbfe4a5, 0xe8b8d433, 0x7807c9a2, 0x0f00f934, 0x9609a88e,
  0xe10e9818, 0x7f6a0dbb, 0x086d3d2d, 0x91646c97, 0xe6635c01,
  0x6b6b51f4, 0x1c6c6162, 0x856530d8, 0xf262004e, 0x6c0695ed,
  0x1b01a57b, 0x8208f4c1, 0xf50fc457, 0x65b0d9c6, 0x12b7e950,
  0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3,
  0xfbd44c65, 0x4db26158, 0x3ab551ce, 0xa3bc0074, 0xd4bb30e2,
  0x4adfa541, 0x3dd895d7, 0xa4d1c46d, 0xd3d6f4fb, 0x4369e96a,
  0x346ed9fc, 0xad678846, 0xda60b8d0, 0x44042d73, 0x33031de5,
  0xaa0a4c5f, 0xdd0d7cc9, 0x5005713c, 0x270241aa, 0xbe0b1010,
  0xc90c2086, 0x5768b525, 0x206f85b3, 0xb966d409, 0xce61e49f,
  0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17,
  0x2eb40d81, 0xb7bd5c3b, 0xc0ba6cad, 0xedb88320, 0x9abfb3b6,
  0x03b6e20c, 0x74b1d29a, 0xe3b88324, 0x94bfb3b2, 0x0dbe8208,
  0x7ab9b29e, 0xe3b0e324, 0x94b7d3b2, 0x03b0820c, 0x74b7b29a,
  0xead18739, 0x9dd6b7af, 0x04df0615, 0x73d83683, 0xe3672b12,
  0x94601b84, 0x0d694a3e, 0x7a6e7aa8, 0xe40ae10b, 0x930dd19d,
  0x0a048027, 0x7d03b0b1, 0xf00bbfa4, 0x870c8f32, 0x1e05de88,
  0x6902ef1e, 0xf7667abd, 0x80614a2b, 0x19681b91, 0x6e6f2b07,
  0xfed41e96, 0x89d32e00, 0x10da7fb6, 0x67dd4f20, 0xf9b9d283,
  0x8eb6e215, 0x17bfb3af, 0x60b88339, 0xd6deae2c, 0xa1d99eb2,
  0x38d0cf08, 0x4fd7ff9e, 0xd1bb6a3d, 0xa6bc5aa3, 0x3fb50b19,
  0x48b23b8f, 0xd80d261e, 0xaf0a1688, 0x36034732, 0x410477a4,
  0xdf60e207, 0xa867d291, 0x316e832b, 0x4669b3bd, 0xcb61bca0,
  0xbc668c36, 0x256fdc8c, 0x5268ec1a, 0xc2d7f18b, 0xb5d0c11d,
  0x2cd990a7, 0x5bdeae31, 0xc4d1ff8b, 0xb3d6cf1d
]);

/**
 * CRC32 calculation options
 */
export interface CRC32Options {
  start?: number;
  end?: number;
  previous?: number;
}

/**
 * CRC32 calculation result
 */
export interface CRC32Result {
  crc: number;
  start: number;
  end: number;
  length: number;
}

/**
 * Standalone CRC32 calculator class
 */
export class CRC32Calculator {
  private _table: Uint32Array;

  constructor(customTable?: Uint32Array) {
    this._table = customTable || CRC_TABLE;
  }

  /**
   * Calculate CRC32 for a buffer
   */
  calculate(
    buffer: ArrayBuffer | Uint8Array | DataView,
    options: CRC32Options = {}
  ): number {
    const { start = 0, end, previous = 0 } = options;
    
    let data: Uint8Array;
    if (buffer instanceof ArrayBuffer) {
      data = new Uint8Array(buffer);
    } else if (buffer instanceof DataView) {
      data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else {
      data = buffer;
    }

    const endPos = end ?? data.length;
    let crc = (~~previous) ^ -1;

    for (let i = start; i < endPos; i++) {
      crc = this._table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ -1) >>> 0;
  }

  /**
   * Calculate CRC32 with detailed result
   */
  calculateDetailed(
    buffer: ArrayBuffer | Uint8Array | DataView,
    options: CRC32Options = {}
  ): CRC32Result {
    const { start = 0, end } = options;
         const endPos = end ?? (buffer instanceof ArrayBuffer ? buffer.byteLength : 
                       buffer instanceof DataView ? buffer.byteLength : buffer.length);
    
    return {
      crc: this.calculate(buffer, options),
      start,
      end: endPos,
      length: endPos - start
    };
  }

  /**
   * Calculate CRC32 for a string
   */
  calculateString(str: string, encoding: 'utf8' | 'latin1' = 'utf8'): number {
    const encoder = encoding === 'utf8' ? new TextEncoder() : null;
    const data = encoder ? encoder.encode(str) : new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
    return this.calculate(data);
  }

  /**
   * Verify CRC32 checksum
   */
  verify(
    buffer: ArrayBuffer | Uint8Array | DataView,
    expectedCrc: number,
    options: CRC32Options = {}
  ): boolean {
    return this.calculate(buffer, options) === expectedCrc;
  }
}

/**
 * Global CRC32 calculator instance
 */
export const crc32Calculator = new CRC32Calculator();

/**
 * Standalone CRC32 calculation function
 */
export function calculateCRC32(
  buffer: ArrayBuffer | Uint8Array | DataView,
  options: CRC32Options = {}
): number {
  return crc32Calculator.calculate(buffer, options);
}

/**
 * Calculate CRC32 for string
 */
export function calculateCRC32String(str: string, encoding: 'utf8' | 'latin1' = 'utf8'): number {
  return crc32Calculator.calculateString(str, encoding);
}

/**
 * Verify CRC32 checksum
 */
export function verifyCRC32(
  buffer: ArrayBuffer | Uint8Array | DataView,
  expectedCrc: number,
  options: CRC32Options = {}
): boolean {
  return crc32Calculator.verify(buffer, expectedCrc, options);
}

 /**
  * BinaryReader CRC32 method implementation
  */
 function CRC32(this: BinaryReader, start?: number, end?: number, previous?: number): number {
   const startPos = start ?? this.tell();
   const endPos = end ?? this.length;
   const prevCrc = previous ?? 0;
 
   let crc = (~~prevCrc) ^ -1;
   for (let n = startPos; n < endPos; n++) {
     crc = CRC_TABLE[(crc ^ this.buffer[n]) & 0xff] ^ (crc >>> 8);
   }
 
   return (crc ^ -1) >>> 0;
 }

/**
 * Extend BinaryReader with CRC32 method
 */
declare module './BinaryReader' {
  interface BinaryReader {
    CRC32(start?: number, end?: number, previous?: number): number;
  }
}

/**
 * Add CRC32 method to BinaryReader prototype
 */
if (typeof BinaryReader !== 'undefined' && BinaryReader.prototype) {
  BinaryReader.prototype.CRC32 = CRC32;
}

export default CRC32Calculator;