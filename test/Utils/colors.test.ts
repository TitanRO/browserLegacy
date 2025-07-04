/**
 * Test suite for Utils/colors.ts
 */

import { describe, it, expect } from 'vitest';
import { 
  uint32ToRGB, 
  uint32ToRGBA, 
  rgbToUint32, 
  hexToUint32, 
  uint32ToHex
} from '../../src/Utils/colors';

describe('Colors Utility', () => {
  describe('uint32ToRGB', () => {
    it('should convert uint32 BGR to RGB CSS string', () => {
      expect(uint32ToRGB(0x0000FF)).toBe('rgb(255,0,0)'); // Red in BGR
      expect(uint32ToRGB(0x00FF00)).toBe('rgb(0,255,0)'); // Green in BGR
      expect(uint32ToRGB(0xFF0000)).toBe('rgb(0,0,255)'); // Blue in BGR
      expect(uint32ToRGB(0xFFFFFF)).toBe('rgb(255,255,255)'); // White
      expect(uint32ToRGB(0x000000)).toBe('rgb(0,0,0)'); // Black
    });

    it('should handle mid-range values', () => {
      expect(uint32ToRGB(0x808080)).toBe('rgb(128,128,128)'); // Gray
    });
  });

  describe('uint32ToRGBA', () => {
    it('should convert uint32 BGR to RGBA CSS string with alpha', () => {
      expect(uint32ToRGBA(0x0000FF, 0.5)).toBe('rgba(255,0,0,0.5)'); // Red with 50% alpha
      expect(uint32ToRGBA(0x00FF00, 1)).toBe('rgba(0,255,0,1)'); // Green with full alpha
      expect(uint32ToRGBA(0xFF0000)).toBe('rgba(0,0,255,1)'); // Blue with default alpha
    });
  });

  describe('rgbToUint32', () => {
    it('should convert RGB to uint32 BGR correctly', () => {
      expect(rgbToUint32(255, 0, 0)).toBe(0x0000FF); // Red to BGR
      expect(rgbToUint32(0, 255, 0)).toBe(0x00FF00); // Green to BGR
      expect(rgbToUint32(0, 0, 255)).toBe(0xFF0000); // Blue to BGR
      expect(rgbToUint32(255, 255, 255)).toBe(0xFFFFFF); // White
      expect(rgbToUint32(0, 0, 0)).toBe(0x000000); // Black
    });

    it('should handle mid-range values', () => {
      expect(rgbToUint32(128, 128, 128)).toBe(0x808080); // Gray
    });
  });

  describe('hexToUint32', () => {
    it('should convert hex to uint32 BGR correctly', () => {
      expect(hexToUint32('#FF0000')).toBe(0x0000FF); // Red hex to BGR
      expect(hexToUint32('#00FF00')).toBe(0x00FF00); // Green hex to BGR
      expect(hexToUint32('#0000FF')).toBe(0xFF0000); // Blue hex to BGR
      expect(hexToUint32('#FFFFFF')).toBe(0xFFFFFF); // White
      expect(hexToUint32('#000000')).toBe(0x000000); // Black
    });

    it('should handle hex without # prefix', () => {
      expect(hexToUint32('FF0000')).toBe(0x0000FF); // Red without #
      expect(hexToUint32('00FF00')).toBe(0x00FF00); // Green without #
    });
  });

  describe('uint32ToHex', () => {
    it('should convert uint32 BGR to hex string', () => {
      expect(uint32ToHex(0x0000FF)).toBe('#ff0000'); // BGR red to hex
      expect(uint32ToHex(0x00FF00)).toBe('#00ff00'); // BGR green to hex
      expect(uint32ToHex(0xFF0000)).toBe('#0000ff'); // BGR blue to hex
      expect(uint32ToHex(0xFFFFFF)).toBe('#ffffff'); // White
      expect(uint32ToHex(0x000000)).toBe('#000000'); // Black
    });

    it('should handle mid-range values', () => {
      expect(uint32ToHex(0x808080)).toBe('#808080'); // Gray
    });
  });

  
  // Integration tests showing round-trip conversions
  describe('Integration tests', () => {
    it('should round-trip convert colors correctly', () => {
      const testColors = [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
        { r: 128, g: 128, b: 128 },
      ];

      testColors.forEach(({ r, g, b }) => {
        const uint32 = rgbToUint32(r, g, b);
        const rgb = uint32ToRGB(uint32);
        expect(rgb).toBe(`rgb(${r},${g},${b})`);
      });
    });

    it('should handle hex to uint32 to hex conversion', () => {
      const testHexes = ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#000000'];
      
      testHexes.forEach(hex => {
        const uint32 = hexToUint32(hex);
        const backToHex = uint32ToHex(uint32);
        expect(backToHex).toBe(hex.toLowerCase());
      });
    });
  });
});