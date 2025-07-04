/**
 * Utils/partyColors.ts
 *
 * Generate pastel colors for party members based on account ID
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

/**
 * Color result interface
 */
export interface ColorResult {
  red: number;
  green: number;
  blue: number;
  style: string;
}

/**
 * Generate a pastel color based on a seed value
 * 
 * @param seed - Seed value for color generation
 * @returns RGB color object
 */
const generatePastelColor = (seed: number): { red: number; green: number; blue: number } => {
  const baseRed = 0;
  const baseGreen = 0;
  const baseBlue = 0;

  // Generate pseudo-random values using the seed
  const rand1 = Math.abs(Math.sin(seed++) * 10000) % 256;
  const rand2 = Math.abs(Math.sin(seed++) * 10000) % 256;
  const rand3 = Math.abs(Math.sin(seed++) * 10000) % 256;

  // Build pastel color by averaging with base colors
  const red = Math.round((rand1 + baseRed) / 2);
  const green = Math.round((rand2 + baseGreen) / 2);
  const blue = Math.round((rand3 + baseBlue) / 2);

  return { red, green, blue };
};

/**
 * Generate a party color based on account ID
 * 
 * @param aid - Account ID used as seed
 * @returns Color object with RGB values and CSS style string
 */
export const getPartyColor = (aid: number): ColorResult => {
  const color = generatePastelColor(aid);
  
  return {
    ...color,
    style: `rgb(${color.red}, ${color.green}, ${color.blue})`,
  };
};

/**
 * Generate party color as CSS string only
 * 
 * @param aid - Account ID used as seed
 * @returns CSS color string
 */
export const getPartyColorString = (aid: number): string => {
  const color = generatePastelColor(aid);
  return `rgb(${color.red}, ${color.green}, ${color.blue})`;
};

/**
 * Generate party color as hex string
 * 
 * @param aid - Account ID used as seed
 * @returns Hex color string
 */
export const getPartyColorHex = (aid: number): string => {
  const color = generatePastelColor(aid);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(color.red)}${toHex(color.green)}${toHex(color.blue)}`;
};

/**
 * Generate multiple party colors for a list of account IDs
 * 
 * @param aids - Array of account IDs
 * @returns Array of color results
 */
export const getPartyColors = (aids: number[]): ColorResult[] => {
  return aids.map(aid => getPartyColor(aid));
};

// Default export for backward compatibility
export default getPartyColor;