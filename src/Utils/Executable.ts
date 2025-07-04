/**
 * Utils/Executable.ts
 *
 * Modern Executable Analysis for ROBrowser
 * Helper to load and analyze PE executables, extract compilation dates and RO-specific information
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import BinaryReader, { SEEK_SET, SEEK_CUR } from './BinaryReader';

/**
 * PE Header information
 */
interface PEHeader {
  signature: string;
  machine: number;
  numberOfSections: number;
  timeDateStamp: number;
  pointerToSymbolTable: number;
  numberOfSymbols: number;
  sizeOfOptionalHeader: number;
  characteristics: number;
}

/**
 * Executable analysis result
 */
export interface ExecutableInfo {
  isValid: boolean;
  compilationDate: number; // YYYYMMDD format
  compilationTimestamp: number; // Unix timestamp
  fileSize: number;
  isROExecutable: boolean;
  error?: string;
}

/**
 * File size constraints for RO executables (in bytes)
 */
const RO_EXECUTABLE_CONSTRAINTS = {
  MIN_SIZE: 3 * 1024 * 1024, // 3MB
  MAX_SIZE: 7 * 1024 * 1024, // 7MB
} as const;

/**
 * Modern executable analysis utility
 */
export class Executable {
  private static reader: BinaryReader | null = null;

  /**
   * Get compilation date from executable file (legacy callback-based API)
   *
   * @param executable - PE executable file
   * @param callback - Callback function with date result
   * @deprecated Use getDateAsync instead
   */
  static getDate(executable: File, callback: (date: number) => void): void {
    console.warn('Executable.getDate is deprecated. Use Executable.getDateAsync instead.');
    
    this.getDateAsync(executable)
      .then(callback)
      .catch((error) => {
        console.error('Failed to get executable date:', error);
        callback(0);
      });
  }

  /**
   * Get compilation date from executable file (modern async API)
   *
   * @param executable - PE executable file
   * @returns Promise resolving to compilation date in YYYYMMDD format
   */
  static async getDateAsync(executable: File): Promise<number> {
    const reader = await this.loadExecutable(executable);
    return this.extractCompilationDate(reader);
  }

  /**
   * Analyze executable file comprehensively
   *
   * @param executable - PE executable file
   * @returns Promise resolving to detailed executable information
   */
  static async analyzeExecutable(executable: File): Promise<ExecutableInfo> {
    try {
      const isROExec = this.isROExec(executable);
      const reader = await this.loadExecutable(executable);
      const compilationTimestamp = this.extractCompilationTimestamp(reader);
      const compilationDate = this.timestampToDateFormat(compilationTimestamp);

      return {
        isValid: true,
        compilationDate,
        compilationTimestamp,
        fileSize: executable.size,
        isROExecutable: isROExec,
      };
    } catch (error) {
      return {
        isValid: false,
        compilationDate: 0,
        compilationTimestamp: 0,
        fileSize: executable.size,
        isROExecutable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Load executable file into BinaryReader
   */
  private static async loadExecutable(executable: File): Promise<BinaryReader> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const result = event.target?.result;
          if (!result) {
            reject(new Error('Failed to read file'));
            return;
          }
          
          this.reader = new BinaryReader(result as ArrayBuffer);
          resolve(this.reader);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read executable file'));
      };

      reader.readAsArrayBuffer(executable);
    });
  }

  /**
   * Extract compilation date from loaded executable
   */
  private static extractCompilationDate(reader: BinaryReader): number {
    const timestamp = this.extractCompilationTimestamp(reader);
    return this.timestampToDateFormat(timestamp);
  }

  /**
   * Extract compilation timestamp from PE header
   */
  private static extractCompilationTimestamp(reader: BinaryReader): number {
    // Jump to PE header offset location
    reader.seek(0x3c, SEEK_SET);
    const peHeaderOffset = reader.getUint32();

    if (peHeaderOffset > reader.length) {
      throw new Error('Invalid PE header offset - file may be corrupted');
    }

    // Jump to PE header
    reader.seek(peHeaderOffset, SEEK_SET);
    
    // Verify PE signature
    const signature = reader.getBinaryString(4);
    if (signature !== 'PE\0\0') {
      throw new Error('Invalid PE signature - not a valid executable');
    }

    // Read COFF header for timestamp
    const header = this.readPEHeader(reader);
    
    if (header.timeDateStamp === 0) {
      throw new Error('No compilation timestamp found in executable');
    }

    return header.timeDateStamp;
  }

  /**
   * Read PE header structure
   */
  private static readPEHeader(reader: BinaryReader): PEHeader {
    return {
      signature: 'PE',
      machine: reader.getUint16(),
      numberOfSections: reader.getUint16(),
      timeDateStamp: reader.getUint32(),
      pointerToSymbolTable: reader.getUint32(),
      numberOfSymbols: reader.getUint32(),
      sizeOfOptionalHeader: reader.getUint16(),
      characteristics: reader.getUint16(),
    };
  }

  /**
   * Convert Unix timestamp to YYYYMMDD format
   */
  private static timestampToDateFormat(timestamp: number): number {
    const date = new Date(timestamp * 1000);
    
    return (
      date.getFullYear() * 10000 +
      (date.getMonth() + 1) * 100 +
      date.getDate()
    );
  }

  /**
   * Check if a file is likely a Ragnarok Online executable
   *
   * @param file - File to check
   * @returns True if file appears to be a RO executable
   */
  static isROExec(file: File): boolean {
    // Check file extension
    if (!file.name.match(/\.exe$/i)) {
      return false;
    }

    // Check file size constraints
    if (file.size < RO_EXECUTABLE_CONSTRAINTS.MIN_SIZE || 
        file.size > RO_EXECUTABLE_CONSTRAINTS.MAX_SIZE) {
      return false;
    }

    return true;
  }

  /**
   * Enhanced RO executable detection with content analysis
   *
   * @param file - File to analyze
   * @returns Promise resolving to detailed detection result
   */
  static async isROExecDetailed(file: File): Promise<{
    isROExecutable: boolean;
    confidence: number;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let confidence = 0;

    // File extension check
    if (file.name.match(/\.exe$/i)) {
      confidence += 20;
      reasons.push('Has .exe extension');
    } else {
      reasons.push('Missing .exe extension');
      return { isROExecutable: false, confidence: 0, reasons };
    }

    // File size check
    if (file.size >= RO_EXECUTABLE_CONSTRAINTS.MIN_SIZE && 
        file.size <= RO_EXECUTABLE_CONSTRAINTS.MAX_SIZE) {
      confidence += 30;
      reasons.push(`File size (${Math.round(file.size / 1024 / 1024)}MB) within RO range`);
    } else {
      reasons.push(`File size (${Math.round(file.size / 1024 / 1024)}MB) outside expected range`);
    }

    // Attempt to analyze as PE executable
    try {
      const info = await this.analyzeExecutable(file);
      if (info.isValid) {
        confidence += 25;
        reasons.push('Valid PE executable structure');
        
        // Check compilation date range (RO was first released in 2003)
        if (info.compilationDate >= 20030101 && info.compilationDate <= 20251231) {
          confidence += 15;
          reasons.push(`Compilation date (${info.compilationDate}) in reasonable range`);
        }
      }
    } catch (error) {
      reasons.push('Failed to analyze as PE executable');
    }

    // TODO: Add more sophisticated content analysis
    // - Check for RO-specific strings
    // - Analyze import tables
    // - Check for known RO signatures

    return {
      isROExecutable: confidence >= 50,
      confidence,
      reasons,
    };
  }

  /**
   * Get current loaded reader (for backward compatibility)
   */
  static getReader(): BinaryReader | null {
    return this.reader;
  }

  /**
   * Clear loaded executable from memory
   */
  static clear(): void {
    this.reader = null;
  }

  /**
   * Validate PE file structure without full analysis
   *
   * @param file - File to validate
   * @returns Promise resolving to validation result
   */
  static async validatePE(file: File): Promise<boolean> {
    try {
      const reader = await this.loadExecutable(file);
      
      // Basic DOS header check
      reader.seek(0, SEEK_SET);
      const dosSignature = reader.getBinaryString(2);
      if (dosSignature !== 'MZ') {
        return false;
      }

      // PE header check
      reader.seek(0x3c, SEEK_SET);
      const peOffset = reader.getUint32();
      
      if (peOffset > reader.length - 4) {
        return false;
      }

      reader.seek(peOffset, SEEK_SET);
      const peSignature = reader.getBinaryString(4);
      
      return peSignature === 'PE\0\0';
    } catch {
      return false;
    }
  }
}

// Backward compatibility exports
export const { getDate, isROExec } = Executable;

// Default export
export default Executable;