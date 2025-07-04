/**
 * Core/Configs.ts
 *
 * Modern configuration management for ROBrowser
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Configuration value types
 */
type ConfigValue = string | number | boolean | object | null | undefined;

/**
 * Global configuration object type
 */
interface GlobalConfig {
  [key: string]: ConfigValue;
}

/**
 * Server configuration interface
 */
export interface ServerConfig {
  display?: string;
  desc?: string;
  address?: string;
  port?: number;
  version?: number;
  langtype?: number;
  packetver?: number;
  renewal?: boolean;
  forceUseAddress?: boolean;
  socketProxy?: string;
  packetKeys?: boolean;
  [key: string]: ConfigValue;
}

/**
 * ROBrowser configuration interface
 */
export interface ROConfig extends GlobalConfig {
  development?: boolean;
  remoteClient?: string;
  servers?: ServerConfig[];
  packetDump?: boolean;
  skipServerList?: boolean;
  skipIntro?: boolean;
  clientVersionMode?: string;
  plugins?: { [key: string]: string };
  clientHash?: string | null;
  enableCashShop?: boolean;
  enableBank?: boolean;
  enableMapName?: boolean;
  enableRefineUI?: boolean;
  enableDmgSuffix?: boolean;
  enableCheckAttendance?: boolean;
  CameraMaxZoomOut?: number;
  loadLua?: boolean;
  enableConsole?: boolean;
}

/**
 * Modern configuration management class
 */
export class Configs {
  private static _global: GlobalConfig = {};
  private static _server: ServerConfig = {};

  /**
   * Initialize configuration from global ROConfig
   */
  static {
    this.init();
  }

  /**
   * Initialize configurations from window.ROConfig
   */
  private static init(): void {
    const roConfig = (globalThis as any).ROConfig as ROConfig | undefined;
    
    if (typeof roConfig === 'object' && roConfig !== null) {
      const keys = Object.keys(roConfig);
      
      for (const key of keys) {
        this.set(key, roConfig[key]);
      }
    }
  }

  /**
   * Set a configuration value
   * 
   * @param key - Configuration key
   * @param value - Configuration value
   */
  static set(key: string, value: ConfigValue): void {
    if (typeof key !== 'string') {
      console.warn('Config key must be a string:', key);
      return;
    }
    
    this._global[key] = value;
  }

  /**
   * Get a configuration value with fallback
   * 
   * @param key - Configuration key
   * @param defaultValue - Default value if key not found
   * @returns The configuration value or default
   */
  static get<T = ConfigValue>(key: string, defaultValue?: T): T {
    // Server configs take precedence
    if (key in this._server) {
      return this._server[key] as T;
    }

    // Then global configs
    if (key in this._global) {
      return this._global[key] as T;
    }

    // Return default value
    return defaultValue as T;
  }

  /**
   * Check if a configuration key exists
   * 
   * @param key - Configuration key
   * @returns True if key exists
   */
  static has(key: string): boolean {
    return key in this._server || key in this._global;
  }

  /**
   * Set server configuration
   * 
   * @param server - Server configuration object
   */
  static setServer(server: ServerConfig): void {
    if (typeof server !== 'object' || server === null) {
      console.warn('Server config must be an object:', server);
      return;
    }
    
    this._server = { ...server };
  }

  /**
   * Get current server configuration
   * 
   * @returns Current server configuration
   */
  static getServer(): ServerConfig {
    return { ...this._server };
  }

  /**
   * Get all global configurations
   * 
   * @returns Copy of global configurations
   */
  static getGlobal(): GlobalConfig {
    return { ...this._global };
  }

  /**
   * Clear server configuration
   */
  static clearServer(): void {
    this._server = {};
  }

  /**
   * Reset all configurations
   */
  static reset(): void {
    this._global = {};
    this._server = {};
    this.init();
  }

  /**
   * Get configuration with type validation
   * 
   * @param key - Configuration key
   * @param validator - Type validator function
   * @param defaultValue - Default value
   * @returns Validated configuration value
   */
  static getValidated<T>(
    key: string,
    validator: (value: unknown) => value is T,
    defaultValue: T
  ): T {
    const value = this.get(key);
    return validator(value) ? value : defaultValue;
  }

  /**
   * Type-safe getters for common configuration types
   */
  static getString(key: string, defaultValue = ''): string {
    const value = this.get(key, defaultValue);
    return typeof value === 'string' ? value : String(value);
  }

  static getNumber(key: string, defaultValue = 0): number {
    const value = this.get(key, defaultValue);
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  static getBoolean(key: string, defaultValue = false): boolean {
    const value = this.get(key, defaultValue);
    return Boolean(value);
  }

  static getArray<T>(key: string, defaultValue: T[] = []): T[] {
    const value = this.get(key, defaultValue);
    return Array.isArray(value) ? value : defaultValue;
  }

  static getObject<T extends object>(key: string, defaultValue: T): T {
    const value = this.get(key, defaultValue);
    return (typeof value === 'object' && value !== null) ? value as T : defaultValue;
  }
}

// Backward compatibility exports
export const { get, set, setServer, getServer } = Configs;

// Default export
export default Configs;