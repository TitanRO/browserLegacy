/**
 * Core/Preferences.ts
 *
 * Store informations in local storage (window position, noctrl, etc.)
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Context from './Context';

/**
 * Chrome extension API types
 */
declare global {
    const chrome: {
        storage?: {
            local?: {
                get(key: string, callback: (result: any) => void): void;
                set(items: Record<string, any>, callback?: () => void): void;
            };
        };
    };
}

/**
 * Storage interface for different environments
 */
interface StorageInterface {
    get<T = any>(key: string, callback: (result: { [key: string]: T | null }) => void): void;
    set(items: { [key: string]: any }, callback?: () => void): void;
}

/**
 * Preference value types
 */
type PreferenceValue = string | number | boolean | object | null;

/**
 * Preference configuration
 */
interface PreferenceConfig<T = PreferenceValue> {
    /** Default value */
    defaultValue: T;
    /** Version for migration */
    version?: number;
    /** Validation function */
    validate?: (value: any) => value is T;
    /** Transform function for loading */
    transform?: (value: any) => T;
    /** Serialization function */
    serialize?: (value: T) => string;
    /** Deserialization function */
    deserialize?: (value: string) => T;
}

/**
 * Preference item with metadata
 */
interface PreferenceItem<T = PreferenceValue> {
    _key: string;
    _version: number;
    save(): void;
    [key: string]: any;
}

/**
 * Storage factory for different environments
 */
class StorageFactory {
    /**
     * Create appropriate storage instance based on context
     * 
     * @returns Storage interface
     */
    static create(): StorageInterface {
        if (Context.Is.APP && typeof chrome !== 'undefined' && chrome.storage) {
            return new ChromeStorageAdapter();
        } else {
            return new LocalStorageAdapter();
        }
    }
}

/**
 * Chrome extension storage adapter
 */
class ChromeStorageAdapter implements StorageInterface {
    get<T = any>(key: string, callback: (result: { [key: string]: T | null }) => void): void {
        if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(key, callback);
        } else {
            callback({ [key]: null });
        }
    }

    set(items: { [key: string]: any }, callback?: () => void): void {
        if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set(items, callback);
        } else if (callback) {
            callback();
        }
    }
}

/**
 * Local storage adapter
 */
class LocalStorageAdapter implements StorageInterface {
    get<T = any>(key: string, callback: (result: { [key: string]: T | null }) => void): void {
        try {
            const value = localStorage.getItem(key);
            const result = { [key]: value };
            callback(result as { [key: string]: T | null });
        } catch (error) {
            console.warn('LocalStorage get failed:', error);
            callback({ [key]: null });
        }
    }

    set(items: { [key: string]: any }, callback?: () => void): void {
        try {
            for (const [key, value] of Object.entries(items)) {
                localStorage.setItem(key, value);
            }
            if (callback) {
                callback();
            }
        } catch (error) {
            console.warn('LocalStorage set failed:', error);
            if (callback) {
                callback();
            }
        }
    }
}

/**
 * Modern preferences management system
 */
class PreferencesManager {
    /** Storage interface */
    private storage: StorageInterface;
    
    /** Registered preference configurations */
    private configs: Map<string, PreferenceConfig> = new Map();
    
    /** Cache for loaded preferences */
    private cache: Map<string, any> = new Map();

    /**
     * Create a new preferences manager
     */
    constructor() {
        this.storage = StorageFactory.create();
    }

    /**
     * Register a preference configuration
     * 
     * @param key - Preference key
     * @param config - Preference configuration
     */
    public register(key: string, config: PreferenceConfig): void {
        this.configs.set(key, config);
    }

    /**
     * Get preference value with type safety
     * 
     * @param key - Preference key
     * @param defaultValue - Default value if not found
     * @param version - Version for migration
     * @returns Preference object with save method
     */
    public get<T extends Record<string, any>>(
        key: string, 
        defaultValue: T, 
        version: number = 0
    ): T & PreferenceItem<T> {
        // Check cache first
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        // Load from storage
        this.storage.get(key, (result) => {
            const storedValue = result[key];
            let finalValue: T;

                         // Handle missing or version mismatch
             if (!storedValue) {
                 finalValue = this.createPreferenceItem(key, defaultValue, version);
                 this.save(finalValue as any);
                 return;
             }

             try {
                 const parsed = JSON.parse(storedValue);
                 
                 // Version mismatch - use default and save
                 if (parsed._version !== version) {
                     finalValue = this.createPreferenceItem(key, defaultValue, version);
                     this.save(finalValue as any);
                     return;
                 }

                 // Merge with default to ensure all properties exist
                 finalValue = this.mergeWithDefault(parsed, defaultValue, key, version);
                 
             } catch (error) {
                 console.warn(`Failed to parse preference ${key}:`, error);
                 finalValue = this.createPreferenceItem(key, defaultValue, version);
                 this.save(finalValue as any);
                 return;
             }

            // Cache the result
            this.cache.set(key, finalValue);
        });

        // Return default while loading asynchronously
        const item = this.createPreferenceItem(key, defaultValue, version);
        this.cache.set(key, item);
        return item;
    }

    /**
     * Get preference value asynchronously
     * 
     * @param key - Preference key
     * @param defaultValue - Default value if not found
     * @param version - Version for migration
     * @returns Promise resolving to preference object
     */
    public async getAsync<T extends Record<string, any>>(
        key: string, 
        defaultValue: T, 
        version: number = 0
    ): Promise<T & PreferenceItem<T>> {
        return new Promise((resolve) => {
            this.storage.get(key, (result) => {
                const storedValue = result[key];
                let finalValue: T;

                                 if (!storedValue) {
                     finalValue = this.createPreferenceItem(key, defaultValue, version);
                     this.save(finalValue as any);
                     resolve(finalValue);
                     return;
                 }

                 try {
                     const parsed = JSON.parse(storedValue);
                     
                     if (parsed._version !== version) {
                         finalValue = this.createPreferenceItem(key, defaultValue, version);
                         this.save(finalValue as any);
                         resolve(finalValue);
                         return;
                     }

                     finalValue = this.mergeWithDefault(parsed, defaultValue, key, version);
                     this.cache.set(key, finalValue);
                     resolve(finalValue);
                     
                 } catch (error) {
                     console.warn(`Failed to parse preference ${key}:`, error);
                     finalValue = this.createPreferenceItem(key, defaultValue, version);
                     this.save(finalValue as any);
                     resolve(finalValue);
                 }
            });
        });
    }

    /**
     * Save preference data
     * 
     * @param data - Preference data to save
     */
    public save<T extends PreferenceItem>(data: T): void {
        const key = data._key;
        
        // Create a clean copy without methods
        const cleanData = this.createCleanCopy(data);
        
        // Store in cache
        this.cache.set(key, data);
        
        // Save to storage
        const storeData = { [key]: JSON.stringify(cleanData) };
        this.storage.set(storeData, () => {
            // Re-add methods after saving
            data._key = key;
            data.save = () => this.save(data);
        });
    }

    /**
     * Remove a preference
     * 
     * @param key - Preference key
     */
    public remove(key: string): void {
        this.cache.delete(key);
        
        // For localStorage, we need to remove the item
        if (this.storage instanceof LocalStorageAdapter) {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.warn(`Failed to remove preference ${key}:`, error);
            }
        }
    }

    /**
     * Clear all preferences
     */
    public clear(): void {
        this.cache.clear();
        
        if (this.storage instanceof LocalStorageAdapter) {
            try {
                localStorage.clear();
            } catch (error) {
                console.warn('Failed to clear localStorage:', error);
            }
        }
    }

    /**
     * Get all cached preference keys
     * 
     * @returns Array of cached keys
     */
    public getCachedKeys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Check if a preference is cached
     * 
     * @param key - Preference key
     * @returns True if cached
     */
    public isCached(key: string): boolean {
        return this.cache.has(key);
    }

    /**
     * Create a preference item with metadata
     * 
     * @param key - Preference key
     * @param defaultValue - Default value
     * @param version - Version number
     * @returns Preference item
     */
    private createPreferenceItem<T extends Record<string, any>>(
        key: string, 
        defaultValue: T, 
        version: number
    ): T & PreferenceItem<T> {
        const item = { ...defaultValue } as T & PreferenceItem<T>;
        item._key = key;
        item._version = version;
        item.save = () => this.save(item);
        return item;
    }

    /**
     * Merge stored data with default values
     * 
     * @param stored - Stored data
     * @param defaultValue - Default values
     * @param key - Preference key
     * @param version - Version number
     * @returns Merged preference item
     */
    private mergeWithDefault<T extends Record<string, any>>(
        stored: any, 
        defaultValue: T, 
        key: string, 
        version: number
    ): T & PreferenceItem<T> {
        const merged = { ...defaultValue, ...stored } as T & PreferenceItem<T>;
        merged._key = key;
        merged._version = version;
        merged.save = () => this.save(merged);
        return merged;
    }

    /**
     * Create a clean copy without methods for serialization
     * 
     * @param data - Data to clean
     * @returns Clean data object
     */
    private createCleanCopy<T extends PreferenceItem>(data: T): any {
        const clean: any = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (typeof value !== 'function') {
                clean[key] = value;
            }
        }
        
        return clean;
    }
}

/**
 * Default preferences manager instance
 */
const preferencesManager = new PreferencesManager();

/**
 * Legacy compatibility functions
 */

/**
 * Get preference value (legacy API)
 * 
 * @param key - Preference key
 * @param defaultValue - Default value
 * @param version - Version number
 * @returns Preference object
 */
export function get<T extends Record<string, any>>(
    key: string, 
    defaultValue: T, 
    version?: number
): T & PreferenceItem<T> {
    return preferencesManager.get(key, defaultValue, version);
}

/**
 * Save preference data (legacy API)
 * 
 * @param data - Preference data
 */
export function save<T extends PreferenceItem>(data: T): void {
    preferencesManager.save(data);
}

/**
 * Export the preferences manager and utility functions
 */
export { PreferencesManager, StorageFactory, type PreferenceConfig, type PreferenceItem };
export default preferencesManager;