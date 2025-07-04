/**
 * Core/MemoryManager.ts
 *
 * Memory Manager
 *
 * Set up a cache context to avoid re-loading/parsing files each time, files are removed automatically if not used
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import MemoryItem from './MemoryItem';

/**
 * Supported file extensions for GPU resource cleanup
 */
type GPUResourceExtension = '.spr' | '.pal';

/**
 * File extension types
 */
type FileExtension = GPUResourceExtension | '.wav' | '.mp3' | '.ogg' | '.txt' | '.lua' | '.lub' | string;

/**
 * WebGL context interface for GPU resource cleanup
 */
interface WebGLContextLike {
    isTexture(texture: WebGLTexture | null): boolean;
    deleteTexture(texture: WebGLTexture | null): void;
}

/**
 * Sprite file structure for GPU cleanup
 */
interface SpriteFile {
    frames?: Array<{
        texture?: WebGLTexture;
    }>;
    texture?: WebGLTexture;
}

/**
 * Palette file structure for GPU cleanup
 */
interface PaletteFile {
    texture?: WebGLTexture;
}

/**
 * Memory management configuration
 */
interface MemoryManagerConfig {
    /** Time to remember files in milliseconds (default: 2 minutes) */
    rememberTime: number;
    /** Cleanup interval in milliseconds (default: 30 seconds) */
    cleanUpInterval: number;
    /** Enable debug logging */
    debug: boolean;
    /** Maximum cache size (number of items) */
    maxCacheSize: number;
}

/**
 * Memory usage statistics
 */
interface MemoryStats {
    /** Total number of cached items */
    totalItems: number;
    /** Number of completed items */
    completedItems: number;
    /** Number of pending items */
    pendingItems: number;
    /** Memory usage estimation in bytes */
    estimatedMemoryUsage: number;
    /** Last cleanup time */
    lastCleanup: number;
}

/**
 * Memory Manager class for efficient file caching and resource management
 */
class MemoryManager {
    /** Cache storage for memory items */
    private _memory: Map<string, MemoryItem> = new Map();
    
    /** Configuration options */
    private _config: MemoryManagerConfig;
    
    /** Last cleanup check timestamp */
    private _lastCheckTick: number = 0;
    
    /** Statistics tracking */
    private _stats: MemoryStats = {
        totalItems: 0,
        completedItems: 0,
        pendingItems: 0,
        estimatedMemoryUsage: 0,
        lastCleanup: 0
    };

    /**
     * Create a new Memory Manager instance
     * 
     * @param config - Configuration options
     */
    constructor(config: Partial<MemoryManagerConfig> = {}) {
        this._config = {
            rememberTime: 2 * 60 * 1000, // 2 minutes
            cleanUpInterval: 30 * 1000,  // 30 seconds
            debug: false,
            maxCacheSize: 1000,
            ...config
        };
    }

    /**
     * Get data from memory with optional callbacks
     * 
     * @param filename - File name to retrieve
     * @param onload - Optional load callback
     * @param onerror - Optional error callback
     * @returns The memory item data or null if not loaded
     */
    public get<T = any>(
        filename: string, 
        onload?: (data: T) => void, 
        onerror?: (error: string) => void
    ): T | null {
        // Get or create memory item
        let item = this._memory.get(filename);
        if (!item) {
            item = new MemoryItem<T>();
            this._memory.set(filename, item);
            this._updateStats();
        }

        // Add event listeners if provided
        if (onload) {
            item.addEventListener('load', onload);
        }
        if (onerror) {
            item.addEventListener('error', onerror);
        }

        return item.data as T | null;
    }

    /**
     * Get a memory item as a Promise
     * 
     * @param filename - File name to retrieve
     * @returns Promise that resolves with the data
     */
    public getAsync<T = any>(filename: string): Promise<T> {
        let item = this._memory.get(filename);
        if (!item) {
            item = new MemoryItem<T>();
            this._memory.set(filename, item);
            this._updateStats();
        }

        return item.toPromise() as Promise<T>;
    }

    /**
     * Check if a file exists in memory
     * 
     * @param filename - File name to check
     * @returns True if the file exists in memory
     */
    public exist(filename: string): boolean {
        return this._memory.has(filename);
    }

    /**
     * Check if a file is loaded in memory
     * 
     * @param filename - File name to check
     * @returns True if the file is loaded
     */
    public isLoaded(filename: string): boolean {
        const item = this._memory.get(filename);
        return item ? item.complete && item.hasData : false;
    }

    /**
     * Store data in memory
     * 
     * @param filename - File name
     * @param data - Data to store
     * @param error - Optional error message
     */
    public set<T = any>(filename: string, data: T | null, error?: string): void {
        // Get or create memory item
        let item = this._memory.get(filename);
        if (!item) {
            item = new MemoryItem<T>();
            this._memory.set(filename, item);
        }

        // Set data or error
        if (error || !data) {
            item.onerror(error || 'Unknown error');
        } else {
            item.onload(data);
        }

        this._updateStats();
    }

    /**
     * Clean up unused data from memory
     * 
     * @param gl - WebGL context for GPU resource cleanup
     * @param now - Current timestamp
     */
    public clean(gl: WebGLContextLike | null, now: number): void {
        if (this._lastCheckTick + this._config.cleanUpInterval > now) {
            return;
        }

        const expiredItems: string[] = [];
        const cutoffTime = now - this._config.rememberTime;

        // Find expired items
        for (const [filename, item] of this._memory) {
            if (item.complete && item.lastTimeUsed < cutoffTime) {
                this._removeItem(gl, filename, item);
                expiredItems.push(filename);
            }
        }

        // Remove expired items from memory
        for (const filename of expiredItems) {
            this._memory.delete(filename);
        }

        // Log cleanup results
        if (expiredItems.length > 0 && this._config.debug) {
            console.log(
                `%c[MemoryManager] - Removed ${expiredItems.length} unused elements from memory.`,
                'color:#d35111',
                expiredItems
            );
        }

        this._lastCheckTick = now;
        this._stats.lastCleanup = now;
        this._updateStats();
    }

    /**
     * Remove specific item from memory
     * 
     * @param gl - WebGL context for GPU resource cleanup
     * @param filename - File name to remove
     * @returns True if the item was removed
     */
    public remove(gl: WebGLContextLike | null, filename: string): boolean {
        const item = this._memory.get(filename);
        if (!item) {
            return false;
        }

        this._removeItem(gl, filename, item);
        const removed = this._memory.delete(filename);
        
        if (removed) {
            this._updateStats();
        }

        return removed;
    }

    /**
     * Search files in memory based on a regex
     * 
     * @param regex - Regular expression to match filenames
     * @returns Array of matching filenames
     */
    public search(regex: RegExp): string[] {
        const matches: string[] = [];
        
        for (const filename of this._memory.keys()) {
            if (regex.test(filename)) {
                matches.push(filename);
            }
        }

        return matches;
    }

    /**
     * Get memory usage statistics
     * 
     * @returns Current memory statistics
     */
    public getStats(): Readonly<MemoryStats> {
        return { ...this._stats };
    }

    /**
     * Clear all memory items
     * 
     * @param gl - WebGL context for GPU resource cleanup
     */
    public clear(gl: WebGLContextLike | null): void {
        for (const [filename, item] of this._memory) {
            this._removeItem(gl, filename, item);
        }
        
        this._memory.clear();
        this._updateStats();
        
        if (this._config.debug) {
            console.log('%c[MemoryManager] - Cleared all memory items.', 'color:#d35111');
        }
    }

    /**
     * Update memory configuration
     * 
     * @param newConfig - New configuration options
     */
    public updateConfig(newConfig: Partial<MemoryManagerConfig>): void {
        this._config = { ...this._config, ...newConfig };
    }

    /**
     * Get current configuration
     * 
     * @returns Current configuration
     */
    public getConfig(): Readonly<MemoryManagerConfig> {
        return { ...this._config };
    }

    /**
     * Remove a specific memory item and clean up resources
     * 
     * @param gl - WebGL context
     * @param filename - File name
     * @param item - Memory item
     */
    private _removeItem(gl: WebGLContextLike | null, filename: string, item: MemoryItem): void {
        const file = item.data;
        if (!file) {
            return;
        }

        const ext = this._getFileExtension(filename);
        this._cleanupResourceByType(gl, file, ext);
    }

    /**
     * Get file extension from filename
     * 
     * @param filename - File name
     * @returns File extension or empty string
     */
    private _getFileExtension(filename: string): FileExtension {
        const match = filename.match(/\.[^.]+$/);
        return match ? match[0].toLowerCase() as FileExtension : '';
    }

    /**
     * Clean up resources based on file type
     * 
     * @param gl - WebGL context
     * @param file - File data
     * @param ext - File extension
     */
    private _cleanupResourceByType(gl: WebGLContextLike | null, file: any, ext: FileExtension): void {
        if (!gl) return;

        switch (ext) {
            case '.spr':
                this._cleanupSpriteResources(gl, file as SpriteFile);
                break;

            case '.pal':
                this._cleanupPaletteResources(gl, file as PaletteFile);
                break;

            default:
                this._cleanupBlobResources(file);
                break;
        }
    }

    /**
     * Clean up sprite GPU resources
     * 
     * @param gl - WebGL context
     * @param sprite - Sprite file data
     */
    private _cleanupSpriteResources(gl: WebGLContextLike, sprite: SpriteFile): void {
        // Clean up frame textures
        if (sprite.frames) {
            for (const frame of sprite.frames) {
                if (frame.texture && gl.isTexture(frame.texture)) {
                    gl.deleteTexture(frame.texture);
                }
            }
        }

        // Clean up main texture
        if (sprite.texture && gl.isTexture(sprite.texture)) {
            gl.deleteTexture(sprite.texture);
        }
    }

    /**
     * Clean up palette GPU resources
     * 
     * @param gl - WebGL context
     * @param palette - Palette file data
     */
    private _cleanupPaletteResources(gl: WebGLContextLike, palette: PaletteFile): void {
        if (palette.texture && gl.isTexture(palette.texture)) {
            gl.deleteTexture(palette.texture);
        }
    }

    /**
     * Clean up blob resources
     * 
     * @param file - File data
     */
    private _cleanupBlobResources(file: any): void {
        if (typeof file === 'string' && file.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(file);
            } catch (error) {
                console.warn('Failed to revoke blob URL:', error);
            }
        }
    }

    /**
     * Update internal statistics
     */
    private _updateStats(): void {
        let completedItems = 0;
        let pendingItems = 0;
        let estimatedMemoryUsage = 0;

        for (const item of this._memory.values()) {
            if (item.complete) {
                completedItems++;
                // Rough estimation - actual memory usage would be much more complex
                if (item.hasData) {
                    estimatedMemoryUsage += this._estimateItemSize(item.data);
                }
            } else {
                pendingItems++;
            }
        }

        this._stats = {
            totalItems: this._memory.size,
            completedItems,
            pendingItems,
            estimatedMemoryUsage,
            lastCleanup: this._stats.lastCleanup
        };
    }

    /**
     * Estimate memory usage of an item (rough approximation)
     * 
     * @param data - Item data
     * @returns Estimated size in bytes
     */
    private _estimateItemSize(data: any): number {
        if (!data) return 0;
        
        if (typeof data === 'string') {
            return data.length * 2; // UTF-16 encoding
        }
        
        if (data instanceof ArrayBuffer) {
            return data.byteLength;
        }
        
        if (data instanceof Uint8Array) {
            return data.byteLength;
        }
        
        // For objects, provide a rough estimate
        try {
            return JSON.stringify(data).length * 2;
        } catch {
            return 1024; // Default estimate
        }
    }
}

/**
 * Default memory manager instance
 */
const memoryManager = new MemoryManager();

/**
 * Export individual functions for backward compatibility
 */
export const get = memoryManager.get.bind(memoryManager);
export const set = memoryManager.set.bind(memoryManager);
export const clean = memoryManager.clean.bind(memoryManager);
export const remove = memoryManager.remove.bind(memoryManager);
export const exist = memoryManager.exist.bind(memoryManager);
export const search = memoryManager.search.bind(memoryManager);

/**
 * Export the MemoryManager class and default instance
 */
export { MemoryManager };
export default memoryManager;