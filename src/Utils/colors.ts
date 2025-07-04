/**
 * Color utility functions for the game client.
 * Converts color formats commonly used in Ragnarok Online.
 */

/**
 * Convert a uint32 color value from BGR format to RGB format.
 * 
 * @param color - The color value in BGR format as a uint32.
 * @returns The color value in CSS 'rgb' format.
 */
export const uint32ToRGB = (color: number): string => {
  const red = color & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = (color >> 16) & 0xff;
  return `rgb(${red},${green},${blue})`;
};

/**
 * Convert a uint32 color value from BGR format to RGBA format.
 * 
 * @param color - The color value in BGR format as a uint32.
 * @param alpha - Alpha value (0-1), defaults to 1.
 * @returns The color value in CSS 'rgba' format.
 */
export const uint32ToRGBA = (color: number, alpha: number = 1): string => {
  const red = color & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = (color >> 16) & 0xff;
  return `rgba(${red},${green},${blue},${alpha})`;
};

/**
 * Convert RGB values to uint32 BGR format.
 * 
 * @param red - Red component (0-255)
 * @param green - Green component (0-255)  
 * @param blue - Blue component (0-255)
 * @returns The color value in BGR format as a uint32.
 */
export const rgbToUint32 = (red: number, green: number, blue: number): number => {
  return (blue << 16) | (green << 8) | red;
};

/**
 * Convert a hex color string to uint32 BGR format.
 * 
 * @param hex - Hex color string (e.g., "#ff0000" or "ff0000")
 * @returns The color value in BGR format as a uint32.
 */
export const hexToUint32 = (hex: string): number => {
  const cleanHex = hex.replace('#', '');
  const red = parseInt(cleanHex.slice(0, 2), 16);
  const green = parseInt(cleanHex.slice(2, 4), 16);
  const blue = parseInt(cleanHex.slice(4, 6), 16);
  return rgbToUint32(red, green, blue);
};

/**
 * Convert uint32 BGR to hex string.
 * 
 * @param color - The color value in BGR format as a uint32.
 * @returns Hex color string with # prefix.
 */
export const uint32ToHex = (color: number): string => {
  const red = color & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = (color >> 16) & 0xff;
  
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

// Default export for backward compatibility
export default uint32ToRGB;