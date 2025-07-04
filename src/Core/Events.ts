/**
 * Core/Events.ts
 *
 * Modern event management system for ROBrowser
 * Provides timeout functionality integrated with the rendering loop for better performance
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Event object interface
 */
interface GameEvent {
  callback: () => void;
  tick: number;
  uid: number;
}

/**
 * Event manager class for game loop integration
 */
export class Events {
  private static _events: GameEvent[] = [];
  private static _tick = 0;
  private static _uid = 0;

  /**
   * Alias for setTimeout using the rendering loop for better performance
   * than native setTimeout which can cause performance issues
   *
   * @param callback - Function to execute after delay
   * @param delay - Delay in milliseconds
   * @returns Event unique identifier for cancellation
   */
  static setTimeout(callback: () => void, delay: number): number {
    const tick = this._tick + delay;
    const event: GameEvent = { 
      callback, 
      tick, 
      uid: this._uid++ 
    };

    // Insert event in sorted order by tick time
    let insertIndex = this._events.findIndex(e => tick < e.tick);
    
    if (insertIndex === -1) {
      // No event found with later tick, append to end
      this._events.push(event);
    } else {
      // Insert at the correct position to maintain sort order
      this._events.splice(insertIndex, 0, event);
    }

    return event.uid;
  }

  /**
   * Alias for clearTimeout - removes a pre-registered event
   *
   * @param uid - Event unique identifier returned by setTimeout
   */
  static clearTimeout(uid: number): void {
    const index = this._events.findIndex(event => event.uid === uid);
    
    if (index !== -1) {
      this._events.splice(index, 1);
    }
  }

  /**
   * Process events at each rendering loop
   * This should be called from the main game loop
   *
   * @param tick - Current game tick/timestamp
   */
  static process(tick: number): void {
    // Execute all events that are due
    while (this._events.length > 0 && this._events[0].tick <= tick) {
      const event = this._events.shift()!;
      try {
        event.callback();
      } catch (error) {
        console.error('Error executing scheduled event:', error);
      }
    }

    this._tick = tick;
  }

  /**
   * Set immediate execution (next frame)
   *
   * @param callback - Function to execute on next frame
   * @returns Event unique identifier
   */
  static setImmediate(callback: () => void): number {
    return this.setTimeout(callback, 0);
  }

  /**
   * Set interval execution
   *
   * @param callback - Function to execute repeatedly
   * @param delay - Delay between executions in milliseconds
   * @returns Event unique identifier of the first execution
   */
  static setInterval(callback: () => void, delay: number): number {
    const intervalCallback = () => {
      try {
        callback();
        // Schedule next execution
        this.setTimeout(intervalCallback, delay);
      } catch (error) {
        console.error('Error in interval callback:', error);
      }
    };

    return this.setTimeout(intervalCallback, delay);
  }

  /**
   * Clear all pending events
   */
  static free(): void {
    this._events.length = 0;
  }

  /**
   * Get current tick
   */
  static getCurrentTick(): number {
    return this._tick;
  }

  /**
   * Get number of pending events
   */
  static getPendingCount(): number {
    return this._events.length;
  }

  /**
   * Get all pending events (for debugging)
   */
  static getPendingEvents(): readonly GameEvent[] {
    return Object.freeze([...this._events]);
  }

  /**
   * Check if an event exists
   *
   * @param uid - Event unique identifier
   * @returns True if event exists
   */
  static hasEvent(uid: number): boolean {
    return this._events.some(event => event.uid === uid);
  }

  /**
   * Clear all events with a specific callback
   * Useful for cleanup when a module is unloaded
   *
   * @param callback - Callback function to match
   */
  static clearByCallback(callback: () => void): number {
    const initialLength = this._events.length;
    this._events = this._events.filter(event => event.callback !== callback);
    return initialLength - this._events.length;
  }
}

// Backward compatibility exports
export const { setTimeout, clearTimeout, process, free } = Events;

// Default export
export default Events;