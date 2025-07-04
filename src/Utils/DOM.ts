/**
 * Utils/DOM.ts
 *
 * Modern DOM manipulation utilities to replace jQuery
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

/**
 * Event listener options
 */
interface EventOptions {
  once?: boolean;
  passive?: boolean;
  capture?: boolean;
}

/**
 * Animation options
 */
interface AnimationOptions {
  duration?: number;
  easing?: string;
  fill?: FillMode;
}

/**
 * Position information
 */
interface Position {
  left: number;
  top: number;
}

/**
 * Size information
 */
interface Size {
  width: number;
  height: number;
}

/**
 * Modern DOM manipulation utilities
 */
export class DOM {
  /**
   * Select elements using CSS selectors
   */
  static $(selector: string, context: Element | Document = document): Element[] {
    return Array.from(context.querySelectorAll(selector));
  }

  /**
   * Select single element
   */
  static $1(selector: string, context: Element | Document = document): Element | null {
    return context.querySelector(selector);
  }

  /**
   * Create element with optional attributes and content
   */
  static create<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    attributes: Record<string, string> = {},
    content?: string
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);
    
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    
    if (content !== undefined) {
      element.textContent = content;
    }
    
    return element;
  }

  /**
   * Add event listener with modern options
   */
  static on(
    element: Element | Element[] | Window | Document,
    event: string,
    handler: EventListener,
    options?: EventOptions
  ): void {
    const elements = Array.isArray(element) ? element : [element];
    
    elements.forEach(el => {
      el.addEventListener(event, handler, options);
    });
  }

  /**
   * Remove event listener
   */
  static off(
    element: Element | Element[] | Window | Document,
    event: string,
    handler: EventListener
  ): void {
    const elements = Array.isArray(element) ? element : [element];
    
    elements.forEach(el => {
      el.removeEventListener(event, handler);
    });
  }

  /**
   * Trigger custom event
   */
  static trigger(element: Element, eventName: string, detail?: any): void {
    const event = new CustomEvent(eventName, { detail, bubbles: true });
    element.dispatchEvent(event);
  }

  /**
   * Add CSS class
   */
  static addClass(element: Element | Element[], className: string): void {
    const elements = Array.isArray(element) ? element : [element];
    elements.forEach(el => el.classList.add(className));
  }

  /**
   * Remove CSS class
   */
  static removeClass(element: Element | Element[], className: string): void {
    const elements = Array.isArray(element) ? element : [element];
    elements.forEach(el => el.classList.remove(className));
  }

  /**
   * Toggle CSS class
   */
  static toggleClass(element: Element | Element[], className: string): void {
    const elements = Array.isArray(element) ? element : [element];
    elements.forEach(el => el.classList.toggle(className));
  }

  /**
   * Check if element has CSS class
   */
  static hasClass(element: Element, className: string): boolean {
    return element.classList.contains(className);
  }

  /**
   * Set CSS styles
   */
  static css(element: Element | Element[], styles: Partial<CSSStyleDeclaration>): void {
    const elements = Array.isArray(element) ? element : [element];
    
    elements.forEach(el => {
      Object.assign((el as HTMLElement).style, styles);
    });
  }

  /**
   * Get computed style
   */
  static getStyle(element: Element, property: string): string {
    return window.getComputedStyle(element).getPropertyValue(property);
  }

  /**
   * Set/get attributes
   */
  static attr(element: Element, name: string, value?: string): string | void {
    if (value === undefined) {
      return element.getAttribute(name) || '';
    }
    element.setAttribute(name, value);
  }

  /**
   * Remove attribute
   */
  static removeAttr(element: Element, name: string): void {
    element.removeAttribute(name);
  }

  /**
   * Get/set element content
   */
  static html(element: Element, content?: string): string | void {
    if (content === undefined) {
      return element.innerHTML;
    }
    element.innerHTML = content;
  }

  /**
   * Get/set text content
   */
  static text(element: Element, content?: string): string | void {
    if (content === undefined) {
      return element.textContent || '';
    }
    element.textContent = content;
  }

  /**
   * Append element or HTML string
   */
  static append(parent: Element, child: Element | string): void {
    if (typeof child === 'string') {
      parent.insertAdjacentHTML('beforeend', child);
    } else {
      parent.appendChild(child);
    }
  }

  /**
   * Prepend element or HTML string
   */
  static prepend(parent: Element, child: Element | string): void {
    if (typeof child === 'string') {
      parent.insertAdjacentHTML('afterbegin', child);
    } else {
      parent.insertBefore(child, parent.firstChild);
    }
  }

  /**
   * Remove element from DOM
   */
  static remove(element: Element | Element[]): void {
    const elements = Array.isArray(element) ? element : [element];
    elements.forEach(el => el.remove());
  }

  /**
   * Get element position relative to document
   */
  static offset(element: Element): Position {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
    };
  }

  /**
   * Get element position relative to parent
   */
  static position(element: Element): Position {
    const htmlElement = element as HTMLElement;
    return {
      left: htmlElement.offsetLeft,
      top: htmlElement.offsetTop,
    };
  }

  /**
   * Get element size
   */
  static size(element: Element): Size {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  }

  /**
   * Animate element using Web Animations API
   */
  static animate(
    element: Element,
    keyframes: Keyframe[],
    options: AnimationOptions = {}
  ): Animation {
    const defaultOptions: KeyframeAnimationOptions = {
      duration: options.duration || 300,
      easing: options.easing || 'ease',
      fill: options.fill || 'forwards',
    };

    return element.animate(keyframes, defaultOptions);
  }

  /**
   * Fade in element
   */
  static fadeIn(element: Element, duration = 300): Promise<void> {
    return new Promise(resolve => {
      const animation = this.animate(element, [
        { opacity: '0' },
        { opacity: '1' },
      ], { duration });

      animation.addEventListener('finish', () => resolve());
    });
  }

  /**
   * Fade out element
   */
  static fadeOut(element: Element, duration = 300): Promise<void> {
    return new Promise(resolve => {
      const animation = this.animate(element, [
        { opacity: '1' },
        { opacity: '0' },
      ], { duration });

      animation.addEventListener('finish', () => resolve());
    });
  }

  /**
   * Slide up element
   */
  static slideUp(element: Element, duration = 300): Promise<void> {
    return new Promise(resolve => {
      const height = element.getBoundingClientRect().height;
      
      const animation = this.animate(element, [
        { height: `${height}px`, opacity: '1' },
        { height: '0px', opacity: '0' },
      ], { duration });

      animation.addEventListener('finish', () => {
        this.css(element, { display: 'none' });
        resolve();
      });
    });
  }

  /**
   * Slide down element
   */
  static slideDown(element: Element, duration = 300): Promise<void> {
    return new Promise(resolve => {
      this.css(element, { display: 'block', height: '0px' });
      
      // Get natural height
      const naturalHeight = element.scrollHeight;
      
      const animation = this.animate(element, [
        { height: '0px', opacity: '0' },
        { height: `${naturalHeight}px`, opacity: '1' },
      ], { duration });

      animation.addEventListener('finish', () => {
        this.css(element, { height: 'auto' });
        resolve();
      });
    });
  }

  /**
   * Check if element is visible
   */
  static isVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  /**
   * Wait for DOM content to be loaded
   */
  static ready(callback: () => void): void {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  /**
   * Fetch API wrapper for AJAX replacement
   */
  static async ajax(url: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    
    return response.text();
  }

  /**
   * Modern drag and drop implementation
   */
  static makeDraggable(
    element: Element,
    options: {
      handle?: Element;
      containment?: Element;
      onStart?: (event: MouseEvent) => void;
      onDrag?: (event: MouseEvent, position: Position) => void;
      onStop?: (event: MouseEvent, position: Position) => void;
    } = {}
  ): void {
    const handle = options.handle || element;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMouseDown = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      isDragging = true;
      startX = mouseEvent.clientX;
      startY = mouseEvent.clientY;
      
      const rect = (element as HTMLElement).getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      options.onStart?.(mouseEvent);

      DOM.on(document, 'mousemove', onMouseMove);
      DOM.on(document, 'mouseup', onMouseUp);
      
      e.preventDefault();
    };

    const onMouseMove = (e: Event) => {
      if (!isDragging) return;

      const mouseEvent = e as MouseEvent;
      const deltaX = mouseEvent.clientX - startX;
      const deltaY = mouseEvent.clientY - startY;
      
      const newLeft = startLeft + deltaX;
      const newTop = startTop + deltaY;

      DOM.css(element, {
        left: `${newLeft}px`,
        top: `${newTop}px`,
        position: 'absolute',
      });

      options.onDrag?.(mouseEvent, { left: newLeft, top: newTop });
    };

    const onMouseUp = (e: Event) => {
      if (!isDragging) return;
      
      const mouseEvent = e as MouseEvent;
      isDragging = false;
      
      const rect = (element as HTMLElement).getBoundingClientRect();
      options.onStop?.(mouseEvent, { left: rect.left, top: rect.top });

      DOM.off(document, 'mousemove', onMouseMove);
      DOM.off(document, 'mouseup', onMouseUp);
    };

    DOM.on(handle, 'mousedown', onMouseDown);
  }
}

// Convenience exports for common operations
export const { $, $1, create, on, off, addClass, removeClass, css, html, text, append, remove } = DOM;

// Default export
export default DOM;