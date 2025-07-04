/**
 * Core/MemoryItem.ts
 *
 * Cache Item into memory
 * Used to manage each object in cache, manage callbacks etc.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Event types for memory items
 */
export type MemoryItemEvent = 'load' | 'error';

/**
 * Callback function for load events
 */
export type LoadCallback<T = any> = (data: T) => void;

/**
 * Callback function for error events
 */
export type ErrorCallback = (error: string) => void;

/**
 * Generic callback function
 */
export type MemoryItemCallback<T = any> = LoadCallback<T> | ErrorCallback;

/**
 * Memory item status
 */
export interface MemoryItemStatus {
    /** Whether the item is loaded */
    complete: boolean;
    /** Whether the item has data */
    hasData: boolean;
    /** Whether the item has an error */
    hasError: boolean;
    /** Last time the item was accessed */
    lastTimeUsed: number;
    /** Number of load callbacks */
    loadCallbackCount: number;
    /** Number of error callbacks */
    errorCallbackCount: number;
}

/**
 * Object stored in cache with modern event handling and type safety
 */
export class MemoryItem<T = any> {
    /** Data stored in the memory item */
    private _data: T | null = null;
    
    /** Error information */
    private _error: string = '';
    
    /** Load event callbacks */
    private _onload: LoadCallback<T>[] = [];
    
    /** Error event callbacks */
    private _onerror: ErrorCallback[] = [];
    
    /** Whether the item is loaded */
    public complete: boolean = false;
    
    /** Last time the item was accessed */
    public lastTimeUsed: number = 0;

    /**
     * Create a new memory item
     * 
     * @param onload - Optional load callback
     * @param onerror - Optional error callback
     */
    constructor(onload?: LoadCallback<T>, onerror?: ErrorCallback) {
        if (onload) {
            this.addEventListener('load', onload);
        }

        if (onerror) {
            this.addEventListener('error', onerror);
        }
    }

    /**
     * Get data from the memory item
     * Updates the last access time
     * 
     * @returns The stored data or null if not loaded
     */
    public get data(): T | null {
        this.lastTimeUsed = Date.now();
        return this._data;
    }

    /**
     * Get error information
     * 
     * @returns Error string or empty string if no error
     */
    public get error(): string {
        return this._error;
    }

    /**
     * Check if the item has data
     * 
     * @returns True if the item has data
     */
    public get hasData(): boolean {
        return this._data !== null;
    }

    /**
     * Check if the item has an error
     * 
     * @returns True if the item has an error
     */
    public get hasError(): boolean {
        return this._error !== '';
    }

    /**
     * Get the current status of the memory item
     * 
     * @returns Status information
     */
    public get status(): MemoryItemStatus {
        return {
            complete: this.complete,
            hasData: this.hasData,
            hasError: this.hasError,
            lastTimeUsed: this.lastTimeUsed,
            loadCallbackCount: this._onload.length,
            errorCallbackCount: this._onerror.length
        };
    }

    /**
     * Add an event listener for load or error events
     * 
     * @param event - Event type ('load' or 'error')
     * @param callback - Callback function
     * @throws {Error} If callback is not a function or event type is invalid
     */
    public addEventListener(event: 'load', callback: LoadCallback<T>): void;
    public addEventListener(event: 'error', callback: ErrorCallback): void;
    public addEventListener(event: MemoryItemEvent, callback: MemoryItemCallback<T>): void {
        if (typeof callback !== 'function') {
            throw new Error('MemoryItem::addEventListener() - callback must be a function!');
        }

        switch (event.toLowerCase()) {
            case 'load':
                // If already loaded with data, call immediately
                if (this.complete && this.hasData) {
                    (callback as LoadCallback<T>)(this._data!);
                    return;
                }
                this._onload.push(callback as LoadCallback<T>);
                break;

            case 'error':
                // If already completed with error, call immediately
                if (this.complete && this.hasError) {
                    (callback as ErrorCallback)(this._error);
                    return;
                }
                this._onerror.push(callback as ErrorCallback);
                break;

            default:
                throw new Error(`MemoryItem::addEventListener() - Invalid event "${event}" used.`);
        }
    }

    /**
     * Remove an event listener
     * 
     * @param event - Event type ('load' or 'error')
     * @param callback - Callback function to remove
     * @returns True if the callback was found and removed
     */
    public removeEventListener(event: 'load', callback: LoadCallback<T>): boolean;
    public removeEventListener(event: 'error', callback: ErrorCallback): boolean;
    public removeEventListener(event: MemoryItemEvent, callback: MemoryItemCallback<T>): boolean {
        switch (event.toLowerCase()) {
            case 'load':
                const loadIndex = this._onload.indexOf(callback as LoadCallback<T>);
                if (loadIndex !== -1) {
                    this._onload.splice(loadIndex, 1);
                    return true;
                }
                break;

            case 'error':
                const errorIndex = this._onerror.indexOf(callback as ErrorCallback);
                if (errorIndex !== -1) {
                    this._onerror.splice(errorIndex, 1);
                    return true;
                }
                break;

            default:
                throw new Error(`MemoryItem::removeEventListener() - Invalid event "${event}" used.`);
        }
        return false;
    }

    /**
     * Mark the item as loaded with data
     * Executes all load callbacks and clears callback arrays
     * 
     * @param data - The loaded data
     */
    public onload(data: T): void {
        this._data = data;
        this.complete = true;
        this.lastTimeUsed = Date.now();

        // Execute all load callbacks
        const callbacks = [...this._onload]; // Copy to avoid issues if callbacks modify the array
        for (const callback of callbacks) {
            try {
                callback(data);
            } catch (error) {
                console.error('MemoryItem load callback error:', error);
            }
        }

        // Clear all callbacks
        this._onload.length = 0;
        this._onerror.length = 0;
    }

    /**
     * Mark the item as failed with an error
     * Executes all error callbacks and clears callback arrays
     * 
     * @param error - Error message
     */
    public onerror(error: string = 'Unknown error'): void {
        this._error = error;
        this.complete = true;
        this.lastTimeUsed = Date.now();

        // Execute all error callbacks
        const callbacks = [...this._onerror]; // Copy to avoid issues if callbacks modify the array
        for (const callback of callbacks) {
            try {
                callback(error);
            } catch (callbackError) {
                console.error('MemoryItem error callback error:', callbackError);
            }
        }

        // Clear all callbacks
        this._onload.length = 0;
        this._onerror.length = 0;
    }

    /**
     * Reset the memory item to its initial state
     * Clears data, error, and completion status
     */
    public reset(): void {
        this._data = null;
        this._error = '';
        this.complete = false;
        this.lastTimeUsed = 0;
        this._onload.length = 0;
        this._onerror.length = 0;
    }

    /**
     * Create a Promise that resolves when the item is loaded
     * 
     * @returns Promise that resolves with the data or rejects with the error
     */
    public toPromise(): Promise<T> {
        return new Promise((resolve, reject) => {
            if (this.complete) {
                if (this.hasData) {
                    resolve(this._data!);
                } else {
                    reject(new Error(this._error));
                }
                return;
            }

            this.addEventListener('load', resolve);
            this.addEventListener('error', (error) => reject(new Error(error)));
        });
    }

    /**
     * Get a human-readable string representation of the memory item
     * 
     * @returns String representation
     */
    public toString(): string {
        const status = this.complete ? 
            (this.hasData ? 'loaded' : 'error') : 
            'pending';
        
        return `MemoryItem { status: ${status}, lastUsed: ${this.lastTimeUsed} }`;
    }
}

/**
 * Export the MemoryItem class as default
 */
export default MemoryItem;