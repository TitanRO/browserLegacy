/**
 * Core/Preferences.ts
 *
 * Modern preferences storage system for ROBrowser
 * Handles localStorage and Chrome App storage with type safety and async/await patterns
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import { Context } from './Context';

// Chrome storage API types
declare global {
  interface Window {
    chrome?: {
      storage?: {
        local?: {
          get(key: string, callback: (result: any) => void): void;
          set(data: Record<string, any>, callback?: () => void): void;
          remove(key: string, callback?: () => void): void;
          clear(callback?: () => void): void;
        };
      };
      runtime?: {
        lastError?: { message: string };
      };
    };
  }
}

declare const chrome: {
  runtime: {
    lastError?: { message: string };
  };
};

/**
 * Preference data interface
 */
interface PreferenceData<T = any> extends Record<string, any> {
  _key?: string;
  _version?: number;
  save?: () => Promise<void>;
}

/**
 * Storage interface for consistent API
 */
interface StorageAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Chrome App storage adapter
 */
class ChromeStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<any> {
    return new Promise((resolve) => {
      if (window.chrome?.storage?.local) {
        window.chrome.storage.local.get(key, (result) => {
          resolve(result[key]);
        });
      } else {
        resolve(null);
      }
    });
  }

  async set(key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.chrome?.storage?.local) {
        const data = { [key]: value };
        window.chrome.storage.local.set(data, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error('Chrome storage not available'));
      }
    });
  }

  async remove(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.chrome?.storage?.local) {
        window.chrome.storage.local.remove(key, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error('Chrome storage not available'));
      }
    });
  }

  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.chrome?.storage?.local) {
        window.chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error('Chrome storage not available'));
      }
    });
  }
}

/**
 * Local storage adapter
 */
class LocalStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<any> {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Failed to get from localStorage: ${key}`, error);
      return null;
    }
  }

  async set(key: string, value: any): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to set localStorage: ${key}`, error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove from localStorage: ${key}`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage', error);
      throw error;
    }
  }
}

/**
 * Modern preferences management class
 */
export class Preferences {
  private static storage: StorageAdapter = Context.Is.APP 
    ? new ChromeStorageAdapter() 
    : new LocalStorageAdapter();

  /**
   * Get preferences with type safety and versioning
   *
   * @param key - Preference key
   * @param defaultValue - Default value if not found
   * @param version - Data version for migration
   * @returns Preference object with save method
   */
  static async get<T extends Record<string, any>>(
    key: string, 
    defaultValue: T, 
    version = 1.0
  ): Promise<PreferenceData<T>> {
    try {
      const storedValue = await this.storage.get(key);
      
      // If no stored value or version mismatch, use default
      if (!storedValue || storedValue._version !== version) {
        const data = { ...defaultValue, _key: key, _version: version };
        await this.save(data);
        return this.createPreferenceObject(data);
      }

      // Merge stored data with defaults (for new properties)
      const mergedData = { ...defaultValue, ...storedValue };
      mergedData._key = key;
      mergedData._version = version;

      return this.createPreferenceObject(mergedData);
    } catch (error) {
      console.error(`Failed to get preferences for key: ${key}`, error);
      // Return default on error
      const data = { ...defaultValue, _key: key, _version: version };
      return this.createPreferenceObject(data);
    }
  }

  /**
   * Save preferences to storage
   *
   * @param data - Preference data to save
   */
  static async save<T extends PreferenceData>(data: T): Promise<void> {
    if (!data._key) {
      throw new Error('Cannot save preference data without _key');
    }

    try {
      // Create clean copy without internal properties
      const cleanData = { ...data };
      const key = cleanData._key;
      delete cleanData._key;
      delete cleanData.save;

      await this.storage.set(key, cleanData);
      
      // Restore internal properties
      data._key = key;
      data.save = () => this.save(data);
    } catch (error) {
      console.error(`Failed to save preferences for key: ${data._key || 'unknown'}`, error);
      throw error;
    }
  }

  /**
   * Remove preferences from storage
   *
   * @param key - Preference key to remove
   */
  static async remove(key: string): Promise<void> {
    try {
      await this.storage.remove(key);
    } catch (error) {
      console.error(`Failed to remove preferences for key: ${key}`, error);
      throw error;
    }
  }

  /**
   * Clear all preferences
   */
  static async clear(): Promise<void> {
    try {
      await this.storage.clear();
    } catch (error) {
      console.error('Failed to clear all preferences', error);
      throw error;
    }
  }

  /**
   * Check if a preference exists
   *
   * @param key - Preference key to check
   * @returns True if preference exists
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const value = await this.storage.get(key);
      return value !== null && value !== undefined;
    } catch (error) {
      console.error(`Failed to check existence of key: ${key}`, error);
      return false;
    }
  }

  /**
   * Get all preference keys (localStorage only)
   * Note: Chrome storage doesn't support listing all keys
   */
  static async getAllKeys(): Promise<string[]> {
    if (this.storage instanceof LocalStorageAdapter) {
      try {
        return Object.keys(localStorage);
      } catch (error) {
        console.error('Failed to get all keys from localStorage', error);
        return [];
      }
    } else {
      console.warn('getAllKeys is not supported with Chrome storage');
      return [];
    }
  }

  /**
   * Export all preferences as JSON (localStorage only)
   */
  static async exportPreferences(): Promise<Record<string, any>> {
    if (this.storage instanceof LocalStorageAdapter) {
      try {
        const keys = await this.getAllKeys();
        const preferences: Record<string, any> = {};
        
        for (const key of keys) {
          preferences[key] = await this.storage.get(key);
        }
        
        return preferences;
      } catch (error) {
        console.error('Failed to export preferences', error);
        return {};
      }
    } else {
      console.warn('exportPreferences is not supported with Chrome storage');
      return {};
    }
  }

  /**
   * Import preferences from JSON object
   */
  static async importPreferences(preferences: Record<string, any>): Promise<void> {
    try {
      const promises = Object.entries(preferences).map(([key, value]) =>
        this.storage.set(key, value)
      );
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to import preferences', error);
      throw error;
    }
  }

  /**
   * Create preference object with save method
   */
  private static createPreferenceObject<T extends Record<string, any>>(
    data: T & PreferenceData
  ): PreferenceData<T> {
    return {
      ...data,
      save: async () => {
        await this.save(data);
      },
    };
  }

  /**
   * Change storage adapter (for testing or different environments)
   */
  static setStorageAdapter(adapter: StorageAdapter): void {
    this.storage = adapter;
  }
}

// Legacy synchronous interface for backward compatibility
export class LegacyPreferences {
  /**
   * Legacy get method (synchronous, less reliable)
   * @deprecated Use Preferences.get() with async/await instead
   */
  static get<T extends Record<string, any>>(
    key: string, 
    defaultValue: T, 
    version = 1.0
  ): T & PreferenceData {
    console.warn('LegacyPreferences.get() is deprecated. Use async Preferences.get() instead.');
    
    const data = { ...defaultValue, _key: key, _version: version };
    
    // Try to get from localStorage synchronously (won't work with Chrome storage)
    if (!Context.Is.APP) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed._version === version) {
            Object.assign(data, parsed);
          }
        }
      } catch (error) {
        console.error('Failed to get legacy preferences:', error);
      }
    }
    
    (data as any).save = function() {
      LegacyPreferences.save(this);
    };
    
    return data as T & PreferenceData;
  }

  /**
   * Legacy save method (synchronous, less reliable)
   * @deprecated Use Preferences.save() with async/await instead
   */
  static save<T extends PreferenceData>(data: T): void {
    console.warn('LegacyPreferences.save() is deprecated. Use async Preferences.save() instead.');
    
    if (!data._key) {
      console.error('Cannot save preference data without _key');
      return;
    }

    try {
      const cleanData = { ...data };
      const key = cleanData._key;
      delete cleanData._key;
      delete cleanData.save;

             if (!Context.Is.APP && key) {
         localStorage.setItem(key, JSON.stringify(cleanData));
       }
      
      // Restore properties
      data._key = key;
      (data as any).save = function() {
        LegacyPreferences.save(this);
      };
    } catch (error) {
      console.error('Failed to save legacy preferences:', error);
    }
  }
}

// Backward compatibility exports
export const { get, save } = LegacyPreferences;

// Default export
export default Preferences;