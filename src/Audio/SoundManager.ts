/**
 * Audio/SoundManager.ts
 *
 * Sound Manager
 *
 * Manage sound effects with modern Web Audio API support
 * All browsers support .wav files (with HTML5), so no flash callback needed
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Client from '../Core/Client';
import MemoryManager from '../Core/MemoryManager';

// TODO: These modules need to be modernized
declare const AudioPreferences: any;
declare const vec2: any;
declare const SessionStorage: any;

/**
 * Sound configuration constants
 */
const CONFIG = {
    /** Maximum sound instances playing simultaneously */
    MAX_SOUND_INSTANCES: 10,
    /** Maximum cached sound instances */
    MAX_CACHED_SOUND_INSTANCES: 30,
    /** Maximum media players in DOM */
    MAX_MEDIA_PLAYERS: 800,
    /** Delay between same sound replays (ms) */
    SAME_SOUND_DELAY: 100,
    /** Cache cleanup interval (ms) */
    CACHE_CLEANUP_TIME: 30000
} as const;

/**
 * Sound instance interface
 */
interface SoundInstance extends HTMLAudioElement {
    filename: string;
    _volume: number;
    cleanupHandle?: NodeJS.Timeout;
}

/**
 * Sound cache entry
 */
interface SoundCacheEntry {
    instances: SoundInstance[];
    lastTick: number;
}

/**
 * Sound cache
 */
interface SoundCache {
    [filename: string]: {
        instances: SoundInstance[];
    };
}

/**
 * Position interface for 3D audio
 */
interface Position {
    x: number;
    y: number;
}

/**
 * Audio configuration
 */
interface AudioConfig {
    /** Master volume (0.0 - 1.0) */
    volume: number;
    /** Whether sound is enabled */
    enabled: boolean;
    /** Use positional audio */
    positional: boolean;
    /** Audio context for advanced features */
    useAudioContext: boolean;
}

/**
 * Modern Sound Manager with advanced audio features
 */
class SoundManager {
    /** Currently playing sounds */
    private _sounds: { [filename: string]: SoundCacheEntry } = {};
    
    /** Reusable sound cache */
    private _cache: SoundCache = {};
    
    /** Number of HTML media players in DOM */
    private _mediaPlayerCount: number = 0;
    
    /** Audio configuration */
    private _config: AudioConfig;
    
    /** Web Audio Context for advanced features */
    private _audioContext?: AudioContext;
    
    /** Master gain node */
    private _masterGain?: GainNode;

    /**
     * Create a new Sound Manager
     */
    constructor() {
        this._config = {
            volume: AudioPreferences.Sound?.volume || 1.0,
            enabled: AudioPreferences.Sound?.play !== false,
            positional: true,
            useAudioContext: false
        };

        this._initializeAudioContext();
    }

    /**
     * Initialize Web Audio Context for advanced features
     */
    private _initializeAudioContext(): void {
        if (!this._config.useAudioContext) {
            return;
        }

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this._audioContext = new AudioContextClass();
                this._masterGain = this._audioContext.createGain();
                this._masterGain.connect(this._audioContext.destination);
                this._masterGain.gain.value = this._config.volume;
            }
        } catch (error) {
            console.warn('Failed to initialize Audio Context:', error);
            this._config.useAudioContext = false;
        }
    }

    /**
     * Get current volume
     * 
     * @returns Current volume (0.0 - 1.0)
     */
    public get volume(): number {
        return this._config.volume;
    }

    /**
     * Set master volume
     * 
     * @param volume - Volume level (0.0 - 1.0)
     */
    public set volume(volume: number) {
        this._config.volume = Math.max(0, Math.min(1, volume));
        
        // Update preferences
        if (AudioPreferences.Sound) {
            AudioPreferences.Sound.volume = this._config.volume;
            AudioPreferences.save();
        }

        // Update master gain
        if (this._masterGain) {
            this._masterGain.gain.value = this._config.volume;
        }

        // Update all currently playing sounds
        this._updateAllSoundVolumes();
    }

    /**
     * Play a sound file
     * 
     * @param filename - Sound filename (without path)
     * @param volume - Optional volume override (0.0 - 1.0)
     * @returns Promise that resolves when sound starts playing
     */
    public async play(filename: string, volume?: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const effectiveVolume = volume !== undefined ? volume * this._config.volume : this._config.volume;

            // Don't play if volume is zero or sound is disabled
            if (effectiveVolume <= 0 || !this._config.enabled) {
                resolve();
                return;
            }

            // Initialize sound entry if needed
            if (!this._sounds[filename]) {
                this._sounds[filename] = {
                    instances: [],
                    lastTick: 0
                };
            }

            const soundEntry = this._sounds[filename];

            // Try to get cached sound first
            const cachedSound = this._getSoundFromCache(filename);
            if (cachedSound) {
                this._playCachedSound(cachedSound, effectiveVolume, soundEntry);
                resolve();
                return;
            }

            // Check rate limiting and instance limits
            if (this._shouldSkipSound(soundEntry)) {
                resolve();
                return;
            }

            // Load and play new sound
            this._loadAndPlaySound(filename, effectiveVolume, soundEntry)
                .then(() => resolve())
                .catch(reject);
        });
    }

    /**
     * Play sound with positional audio
     * 
     * @param filename - Sound filename
     * @param sourcePosition - 3D position of sound source
     * @param volume - Optional volume override
     */
    public async playPosition(filename: string, sourcePosition: Position, volume?: number): Promise<void> {
        if (!this._config.positional || !SessionStorage.Entity?.position) {
            return this.play(filename, volume);
        }

        // Calculate distance-based volume
        const distance = Math.floor(vec2.dist(sourcePosition, SessionStorage.Entity.position));
        const distanceVolume = Math.max(0.1, 1 - Math.abs((distance - 1) * (1 - 0.01) / (25 - 1) + 0.01));
        
        const finalVolume = volume !== undefined ? volume * distanceVolume : distanceVolume;
        return this.play(filename, finalVolume);
    }

    /**
     * Stop specific sound or all sounds
     * 
     * @param filename - Optional filename to stop (stops all if not provided)
     */
    public stop(filename?: string): void {
        if (filename) {
            this._stopSound(filename);
        } else {
            this._stopAllSounds();
        }
    }

    /**
     * Set volume for all sounds
     * 
     * @param volume - New volume level (0.0 - 1.0)
     */
    public setVolume(volume: number): void {
        this.volume = volume;
    }

    /**
     * Enable or disable sound
     * 
     * @param enabled - Whether sound should be enabled
     */
    public setEnabled(enabled: boolean): void {
        this._config.enabled = enabled;
        
        if (AudioPreferences.Sound) {
            AudioPreferences.Sound.play = enabled;
            AudioPreferences.save();
        }

        if (!enabled) {
            this._stopAllSounds();
        }
    }

    /**
     * Get current configuration
     * 
     * @returns Current audio configuration
     */
    public getConfig(): Readonly<AudioConfig> {
        return { ...this._config };
    }

    /**
     * Get sound statistics
     * 
     * @returns Sound system statistics
     */
    public getStats(): {
        activeInstances: number;
        cachedInstances: number;
        mediaPlayerCount: number;
        memoryUsage: string;
    } {
        let activeInstances = 0;
        let cachedInstances = 0;

        Object.values(this._sounds).forEach(entry => {
            activeInstances += entry.instances.length;
        });

        Object.values(this._cache).forEach(entry => {
            cachedInstances += entry.instances.length;
        });

        return {
            activeInstances,
            cachedInstances,
            mediaPlayerCount: this._mediaPlayerCount,
            memoryUsage: `${Math.round((activeInstances + cachedInstances) * 0.1)} MB (estimated)`
        };
    }

    /**
     * Clean up resources and stop all sounds
     */
    public destroy(): void {
        this._stopAllSounds();
        this._clearCache();
        
        if (this._audioContext) {
            this._audioContext.close();
        }
    }

    /**
     * Play a cached sound instance
     */
    private _playCachedSound(sound: SoundInstance, volume: number, soundEntry: SoundCacheEntry): void {
        sound.volume = Math.min(volume, 1.0);
        sound._volume = volume;
        
        try {
            sound.play();
            soundEntry.instances.push(sound);
            soundEntry.lastTick = Date.now();
        } catch (error) {
            console.warn('Failed to play cached sound:', error);
        }
    }

    /**
     * Check if sound should be skipped due to rate limiting
     */
    private _shouldSkipSound(soundEntry: SoundCacheEntry): boolean {
        const now = Date.now();
        const timeSinceLastPlay = now - soundEntry.lastTick;
        const maxInstances = this._getBalancedMax(CONFIG.MAX_SOUND_INSTANCES);

        return timeSinceLastPlay < CONFIG.SAME_SOUND_DELAY || 
               soundEntry.instances.length > maxInstances;
    }

    /**
     * Load and play a new sound
     */
    private async _loadAndPlaySound(filename: string, volume: number, soundEntry: SoundCacheEntry): Promise<void> {
        return new Promise((resolve, reject) => {
            Client.loadFile(`data/wav/${filename}`, (url: string) => {
                if (!this._sounds[filename]) {
                    resolve();
                    return;
                }

                // Check limits again after async load
                if (this._shouldSkipSound(soundEntry)) {
                    resolve();
                    return;
                }

                try {
                    const sound = this._createSoundElement(filename, url, volume);
                    
                    sound.addEventListener('error', () => {
                        this._onSoundError(sound);
                        reject(new Error(`Failed to load sound: ${filename}`));
                    });
                    
                    sound.addEventListener('ended', () => this._onSoundEnded(sound));
                    
                    sound.play()
                        .then(() => {
                            soundEntry.instances.push(sound);
                            soundEntry.lastTick = Date.now();
                            resolve();
                        })
                        .catch(reject);
                        
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Create a new sound element
     */
    private _createSoundElement(filename: string, url: string, volume: number): SoundInstance {
        const sound = document.createElement('audio') as SoundInstance;
        
        this._mediaPlayerCount++;
        sound.filename = filename;
        sound.src = url;
        sound.volume = Math.min(volume, 1.0);
        sound._volume = volume;
        
        return sound;
    }

    /**
     * Handle sound ended event
     */
    private _onSoundEnded(sound: SoundInstance): void {
        const soundEntry = this._sounds[sound.filename];
        if (soundEntry) {
            const index = soundEntry.instances.indexOf(sound);
            if (index !== -1) {
                soundEntry.instances.splice(index, 1);
                
                // Clean up empty entries
                if (soundEntry.instances.length === 0) {
                    delete this._sounds[sound.filename];
                }
            }
        }

        this._addSoundToCache(sound);
    }

    /**
     * Handle sound error event
     */
    private _onSoundError(sound: SoundInstance): void {
        const soundEntry = this._sounds[sound.filename];
        if (soundEntry) {
            const index = soundEntry.instances.indexOf(sound);
            if (index !== -1) {
                soundEntry.instances.splice(index, 1);
                
                if (soundEntry.instances.length === 0) {
                    delete this._sounds[sound.filename];
                }
            }
        }

        this._removeSoundElement(sound);
    }

    /**
     * Add sound to cache for reuse
     */
    private _addSoundToCache(sound: SoundInstance): void {
        if (!sound.filename) return;

        if (!this._cache[sound.filename]) {
            this._cache[sound.filename] = { instances: [] };
        }

        const maxCached = this._getBalancedMax(CONFIG.MAX_CACHED_SOUND_INSTANCES);
        if (this._cache[sound.filename].instances.length < maxCached) {
            sound.currentTime = 0; // Reset to start
            sound.cleanupHandle = setTimeout(() => this._cleanupCachedSound(sound), CONFIG.CACHE_CLEANUP_TIME);
            this._cache[sound.filename].instances.push(sound);
        } else {
            this._removeSoundElement(sound);
        }
    }

    /**
     * Get sound from cache
     */
    private _getSoundFromCache(filename: string): SoundInstance | null {
        const cacheEntry = this._cache[filename];
        if (!cacheEntry || cacheEntry.instances.length === 0) {
            return null;
        }

        const sound = cacheEntry.instances.pop()!;
        if (sound.cleanupHandle) {
            clearTimeout(sound.cleanupHandle);
            delete sound.cleanupHandle;
        }

        return sound;
    }

    /**
     * Clean up cached sound after timeout
     */
    private _cleanupCachedSound(sound: SoundInstance): void {
        if (!sound.filename || !this._cache[sound.filename]) {
            return;
        }

        const cacheEntry = this._cache[sound.filename];
        const index = cacheEntry.instances.indexOf(sound);
        
        if (index !== -1) {
            cacheEntry.instances.splice(index, 1);
            this._removeSoundElement(sound);
        }
    }

    /**
     * Remove sound element from DOM
     */
    private _removeSoundElement(sound: SoundInstance): void {
        try {
            sound.pause();
            sound.remove();
            this._mediaPlayerCount--;
        } catch (error) {
            console.warn('Error removing sound element:', error);
        }
    }

    /**
     * Stop specific sound
     */
    private _stopSound(filename: string): void {
        const soundEntry = this._sounds[filename];
        if (!soundEntry) return;

        while (soundEntry.instances.length > 0) {
            const sound = soundEntry.instances.shift()!;
            this._removeSoundElement(sound);
        }

        delete this._sounds[filename];
    }

    /**
     * Stop all sounds
     */
    private _stopAllSounds(): void {
        Object.keys(this._sounds).forEach(filename => {
            this._stopSound(filename);
        });

        // Clear memory cache
        const cachedSounds = MemoryManager.search(/\.wav$/);
        cachedSounds.forEach(filename => {
            MemoryManager.remove(null, filename);
        });
    }

    /**
     * Clear sound cache
     */
    private _clearCache(): void {
        Object.values(this._cache).forEach(entry => {
            entry.instances.forEach(sound => {
                if (sound.cleanupHandle) {
                    clearTimeout(sound.cleanupHandle);
                }
                this._removeSoundElement(sound);
            });
        });

        this._cache = {};
    }

    /**
     * Update volume for all playing sounds
     */
    private _updateAllSoundVolumes(): void {
        Object.values(this._sounds).forEach(entry => {
            entry.instances.forEach(sound => {
                sound.volume = Math.min(sound._volume * this._config.volume, 1.0);
            });
        });
    }

    /**
     * Get balanced maximum based on current media player count
     */
    private _getBalancedMax(baseMax: number): number {
        return Math.ceil(baseMax * (1 - this._mediaPlayerCount / CONFIG.MAX_MEDIA_PLAYERS));
    }
}

/**
 * Default sound manager instance
 */
const soundManager = new SoundManager();

/**
 * Export the SoundManager class and default instance
 */
export { SoundManager, type AudioConfig, type Position };
export default soundManager;