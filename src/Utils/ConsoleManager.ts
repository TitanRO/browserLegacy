/**
 * Utils/ConsoleManager.ts
 *
 * Console Manager
 *
 * Enables/Disables console with modern configuration management
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import { Configs } from '../Core/Configs';

/**
 * Console configuration interface
 */
export interface ConsoleConfig {
  development?: boolean;
  enableConsole?: boolean;
  disableConsole?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  customPrefix?: string;
}

/**
 * Console method names
 */
type ConsoleMethod = keyof Console;

/**
 * Console statistics interface
 */
export interface ConsoleStats {
  enabled: boolean;
  callCount: number;
  lastToggle: number;
  logLevel: string;
}

/**
 * Modern Console Manager implementation
 */
export class ConsoleManager {
  private static _instance: ConsoleManager;
  private _originalConsole: Console;
  private _isEnabled: boolean = false;
  private _stats: ConsoleStats;
  private _config: ConsoleConfig = {};

  /**
   * Dummy console methods for disabled state
   */
  private readonly _dummyMethods: Record<ConsoleMethod, () => void> = {
    assert: () => {},
    clear: () => {},
    count: () => {},
    countReset: () => {},
    debug: () => {},
    dir: () => {},
    dirxml: () => {},
    error: () => {},
    group: () => {},
    groupCollapsed: () => {},
    groupEnd: () => {},
    info: () => {},
    log: () => {},
    profile: () => {},
    profileEnd: () => {},
    table: () => {},
    time: () => {},
    timeEnd: () => {},
    timeLog: () => {},
    timeStamp: () => {},
    trace: () => {},
    warn: () => {},
  } as any;

  /**
   * Create console manager instance
   */
  private constructor() {
    this._originalConsole = { ...console };
    this._stats = {
      enabled: false,
      callCount: 0,
      lastToggle: Date.now(),
      logLevel: 'info'
    };
    this._initialize();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConsoleManager {
    if (!ConsoleManager._instance) {
      ConsoleManager._instance = new ConsoleManager();
    }
    return ConsoleManager._instance;
  }

  /**
   * Initialize console manager
   */
  private _initialize(): void {
    this._updateConfig();
    this._toggle();
  }

  /**
   * Update configuration from Configs
   */
  private _updateConfig(): void {
    this._config = {
      development: Configs.get('development', false),
      enableConsole: Configs.get('enableConsole', false),
      disableConsole: Configs.get('disableConsole', false),
      logLevel: Configs.get('logLevel', 'info'),
      customPrefix: Configs.get('consolePrefix', '[ROBrowser]')
    };
  }

  /**
   * Check if console should be enabled
   */
  private _shouldEnable(): boolean {
    const { development, enableConsole, disableConsole } = this._config;
    return !disableConsole && (development || enableConsole);
  }

  /**
   * Toggle console state
   */
  private _toggle(): void {
    const shouldEnable = this._shouldEnable();
    
    if (shouldEnable === this._isEnabled) {
      return; // No change needed
    }

    this._isEnabled = shouldEnable;
    this._stats.enabled = shouldEnable;
    this._stats.lastToggle = Date.now();

    if (shouldEnable) {
      this._enableConsole();
    } else {
      this._disableConsole();
    }
  }

  /**
   * Enable console output
   */
  private _enableConsole(): void {
    // Restore original console methods
    Object.assign(console, this._originalConsole);
    
    // Add custom formatting if prefix is configured
    if (this._config.customPrefix) {
      this._addCustomFormatting();
    }

    this._originalConsole.log(
      `%c${this._config.customPrefix} %cOutput to console is %cENABLED`,
      'color:#3344EE',
      'color:inherit',
      'color:#007000'
    );
  }

  /**
   * Disable console output
   */
  private _disableConsole(): void {
    this._originalConsole.log(
      `%c${this._config.customPrefix} %cOutput to console is %cDISABLED`,
      'color:#3344EE',
      'color:inherit',
      'color:#700000'
    );

    // Replace console methods with dummy functions
    Object.assign(console, this._dummyMethods);
  }

  /**
   * Add custom formatting to console methods
   */
  private _addCustomFormatting(): void {
    const prefix = this._config.customPrefix;
    const originalLog = this._originalConsole.log;
    const originalWarn = this._originalConsole.warn;
    const originalError = this._originalConsole.error;

    console.log = (...args: any[]) => {
      this._stats.callCount++;
      originalLog.call(console, `%c${prefix}`, 'color:#3344EE', ...args);
    };

    console.warn = (...args: any[]) => {
      this._stats.callCount++;
      originalWarn.call(console, `%c${prefix}`, 'color:#FF8800', ...args);
    };

    console.error = (...args: any[]) => {
      this._stats.callCount++;
      originalError.call(console, `%c${prefix}`, 'color:#FF0000', ...args);
    };
  }

  /**
   * Manually toggle console state
   */
  toggle(): void {
    this._updateConfig();
    this._toggle();
  }

  /**
   * Force enable console
   */
  enable(): void {
    this._config.enableConsole = true;
    this._config.disableConsole = false;
    this._toggle();
  }

  /**
   * Force disable console
   */
  disable(): void {
    this._config.enableConsole = false;
    this._config.disableConsole = true;
    this._toggle();
  }

  /**
   * Get console statistics
   */
  get stats(): Readonly<ConsoleStats> {
    return { ...this._stats };
  }

  /**
   * Get current configuration
   */
  get config(): Readonly<ConsoleConfig> {
    return { ...this._config };
  }

  /**
   * Check if console is enabled
   */
  get isEnabled(): boolean {
    return this._isEnabled;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ConsoleConfig>): void {
    this._config = { ...this._config, ...config };
    this._toggle();
  }

  /**
   * Reset console to original state
   */
  reset(): void {
    Object.assign(console, this._originalConsole);
    this._isEnabled = false;
    this._stats.enabled = false;
    this._stats.callCount = 0;
    this._stats.lastToggle = Date.now();
  }
}

/**
 * Global console manager instance
 */
export const consoleManager = ConsoleManager.getInstance();

/**
 * Initialize console manager
 */
export function initConsole(): void {
  consoleManager.toggle();
}

/**
 * Toggle console state
 */
export function toggleConsole(): void {
  consoleManager.toggle();
}

/**
 * Enable console output
 */
export function enableConsole(): void {
  consoleManager.enable();
}

/**
 * Disable console output
 */
export function disableConsole(): void {
  consoleManager.disable();
}

/**
 * Get console statistics
 */
export function getConsoleStats(): Readonly<ConsoleStats> {
  return consoleManager.stats;
}

/**
 * Legacy export for backward compatibility
 */
export default {
  init: initConsole,
  toggle: toggleConsole,
  enable: enableConsole,
  disable: disableConsole,
  stats: getConsoleStats
};