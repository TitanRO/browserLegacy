/**
 * Utils/WebGL.ts
 *
 * Modern WebGL helper functions and utilities
 *
 * Modernized WebGL context creation, shader compilation, and texture loading.
 *
 * @author Vincent Thibault
 */

import { TextureUtils } from './Texture.ts';

/**
 * WebGL context creation options
 */
export interface WebGLContextOptions {
  alpha?: boolean;
  depth?: boolean;
  stencil?: boolean;
  antialias?: boolean;
  premultipliedAlpha?: boolean;
  preserveDrawingBuffer?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
  failIfMajorPerformanceCaveat?: boolean;
}

/**
 * Shader program with typed attributes and uniforms
 */
export interface ShaderProgram extends WebGLProgram {
  attribute: Record<string, number>;
  uniform: Record<string, WebGLUniformLocation | null>;
}

/**
 * WebGL utility functions
 */
export class WebGLUtils {
  /**
   * Get WebGL context with modern fallback support
   * 
   * @param canvas - Canvas element
   * @param options - WebGL context options
   * @returns WebGL rendering context
   */
  static getContext(canvas: HTMLCanvasElement, options?: WebGLContextOptions): WebGL2RenderingContext | WebGLRenderingContext {
    // Default options optimized for game rendering
    const defaultOptions: WebGLContextOptions = {
      alpha: false,
      depth: true,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
      ...options,
    };

    // Try WebGL2 first, then fallback to WebGL1
    const contextTypes = ['webgl2', 'webgl'] as const;
    
    for (const contextType of contextTypes) {
      try {
        const gl = canvas.getContext(contextType, defaultOptions);
        if (gl) {
          console.log(`WebGL context created: ${contextType}`);
          return gl as WebGL2RenderingContext | WebGLRenderingContext;
        }
      } catch (error) {
        console.warn(`Failed to create ${contextType} context:`, error);
      }
    }

    throw new Error('WebGL is not supported or failed to create context');
  }

  /**
   * Compile a WebGL shader with error handling
   * 
   * @param gl - WebGL context
   * @param source - Shader source code
   * @param type - Shader type (VERTEX_SHADER or FRAGMENT_SHADER)
   * @returns Compiled shader
   */
  static compileShader(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    source: string,
    type: number
  ): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader object');
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    // Check compilation status
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      
      const shaderType = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
      throw new Error(`Failed to compile ${shaderType} shader: ${error}`);
    }

    return shader;
  }

  /**
   * Create and link a shader program
   * 
   * @param gl - WebGL context
   * @param vertexSource - Vertex shader source
   * @param fragmentSource - Fragment shader source
   * @returns Linked shader program with attribute/uniform mappings
   */
  static createShaderProgram(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string
  ): ShaderProgram {
    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create shader program');
    }

    try {
      // Compile shaders
      const vertexShader = this.compileShader(gl, vertexSource, gl.VERTEX_SHADER);
      const fragmentShader = this.compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);

      // Attach and link
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      // Check linking status
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const error = gl.getProgramInfoLog(program);
        throw new Error(`Failed to link shader program: ${error}`);
      }

      // Clean up shaders (they're now part of the program)
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      // Get attribute and uniform locations
      const shaderProgram = program as ShaderProgram;
      shaderProgram.attribute = this.getAttributeLocations(gl, program);
      shaderProgram.uniform = this.getUniformLocations(gl, program);

      return shaderProgram;
    } catch (error) {
      gl.deleteProgram(program);
      throw error;
    }
  }

  /**
   * Get all attribute locations from a program
   */
  private static getAttributeLocations(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    program: WebGLProgram
  ): Record<string, number> {
    const attributes: Record<string, number> = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

    for (let i = 0; i < count; i++) {
      const attribute = gl.getActiveAttrib(program, i);
      if (attribute) {
        attributes[attribute.name] = gl.getAttribLocation(program, attribute.name);
      }
    }

    return attributes;
  }

  /**
   * Get all uniform locations from a program
   */
  private static getUniformLocations(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    program: WebGLProgram
  ): Record<string, WebGLUniformLocation | null> {
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

    for (let i = 0; i < count; i++) {
      const uniform = gl.getActiveUniform(program, i);
      if (uniform) {
        uniforms[uniform.name] = gl.getUniformLocation(program, uniform.name);
      }
    }

    return uniforms;
  }

  /**
   * Convert number to nearest power of two (required for some WebGL operations)
   * 
   * @param num - Input number
   * @returns Nearest power of two >= num
   */
  static toPowerOfTwo(num: number): number {
    return Math.pow(2, Math.ceil(Math.log(num) / Math.log(2)));
  }

  /**
   * Check if a number is a power of two
   * 
   * @param num - Number to check
   * @returns True if power of two
   */
  static isPowerOfTwo(num: number): boolean {
    return (num & (num - 1)) === 0;
  }

  /**
   * Load an image as WebGL texture (modern async version)
   * 
   * @param gl - WebGL context
   * @param url - Image URL or data
   * @param options - Texture loading options
   * @returns Promise resolving to WebGL texture
   */
  static async createTexture(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    url: string | ArrayBuffer,
    options: {
      powerOfTwo?: boolean;
      generateMipmaps?: boolean;
      wrapS?: number;
      wrapT?: number;
      magFilter?: number;
      minFilter?: number;
    } = {}
  ): Promise<WebGLTexture> {
    const {
      powerOfTwo = true,
      generateMipmaps = true,
      wrapS = gl.CLAMP_TO_EDGE,
      wrapT = gl.CLAMP_TO_EDGE,
      magFilter = gl.LINEAR,
      minFilter = gl.LINEAR,
    } = options;

    // Load the image
    const canvas = await TextureUtils.load(url, { powerOfTwo });
    if (!canvas) {
      throw new Error('Failed to load texture image');
    }

    // Create WebGL texture
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create WebGL texture');
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);

    // Generate mipmaps if requested and size is power of two
    if (generateMipmaps && this.isPowerOfTwo(canvas.width) && this.isPowerOfTwo(canvas.height)) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    return texture;
  }

  /**
   * Legacy callback-based texture loading for backward compatibility
   * 
   * @param gl - WebGL context
   * @param url - Image URL
   * @param callback - Completion callback
   * @param args - Additional arguments passed to callback
   */
  static createTextureLegacy(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    url: string | ArrayBuffer,
    callback: (texture: WebGLTexture | null, ...args: unknown[]) => void,
    ...args: unknown[]
  ): void {
    this.createTexture(gl, url)
      .then(texture => {
        args.unshift(texture);
        callback.apply(null, args);
      })
      .catch(error => {
        console.error('Texture loading failed:', error);
        args.unshift(null);
        callback.apply(null, args);
      });
  }

  /**
   * Create a framebuffer with color and depth attachments
   * 
   * @param gl - WebGL context
   * @param width - Framebuffer width
   * @param height - Framebuffer height
   * @param options - Framebuffer options
   * @returns Framebuffer object
   */
  static createFramebuffer(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    width: number,
    height: number,
    options: {
      colorFormat?: number;
      depthFormat?: number;
      stencilFormat?: number;
    } = {}
  ): {
    framebuffer: WebGLFramebuffer;
    colorTexture?: WebGLTexture;
    depthTexture?: WebGLTexture;
    width: number;
    height: number;
  } {
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error('Failed to create framebuffer');
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    const result = { framebuffer, width, height } as any;

    // Create color attachment
    if (options.colorFormat !== null) {
      const colorTexture = gl.createTexture();
      if (!colorTexture) {
        throw new Error('Failed to create color texture');
      }

      gl.bindTexture(gl.TEXTURE_2D, colorTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        options.colorFormat || gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0);

      result.colorTexture = colorTexture;
    }

    // Create depth attachment
    if (options.depthFormat !== null) {
      const depthTexture = gl.createTexture();
      if (!depthTexture) {
        throw new Error('Failed to create depth texture');
      }

      gl.bindTexture(gl.TEXTURE_2D, depthTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.DEPTH_COMPONENT,
        width,
        height,
        0,
        gl.DEPTH_COMPONENT,
        gl.UNSIGNED_SHORT,
        null
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);

      result.depthTexture = depthTexture;
    }

    // Check framebuffer completeness
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(framebuffer);
      throw new Error(`Framebuffer is incomplete: ${status}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return result;
  }

  /**
   * Get WebGL error string for debugging
   * 
   * @param gl - WebGL context
   * @param error - WebGL error code
   * @returns Human-readable error string
   */
  static getErrorString(gl: WebGLRenderingContext | WebGL2RenderingContext, error: number): string {
    switch (error) {
      case gl.NO_ERROR:
        return 'NO_ERROR';
      case gl.INVALID_ENUM:
        return 'INVALID_ENUM';
      case gl.INVALID_VALUE:
        return 'INVALID_VALUE';
      case gl.INVALID_OPERATION:
        return 'INVALID_OPERATION';
      case gl.OUT_OF_MEMORY:
        return 'OUT_OF_MEMORY';
      case gl.CONTEXT_LOST_WEBGL:
        return 'CONTEXT_LOST_WEBGL';
      default:
        return `UNKNOWN_ERROR (${error})`;
    }
  }

  /**
   * Check for WebGL errors and throw if found
   * 
   * @param gl - WebGL context
   * @param operation - Operation description for error reporting
   */
  static checkError(gl: WebGLRenderingContext | WebGL2RenderingContext, operation?: string): void {
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      const errorStr = this.getErrorString(gl, error);
      const message = operation ? `WebGL error in ${operation}: ${errorStr}` : `WebGL error: ${errorStr}`;
      throw new Error(message);
    }
  }
}

// Export individual functions for convenience and backward compatibility
export const {
  getContext,
  createShaderProgram,
  toPowerOfTwo,
  isPowerOfTwo,
  createTexture,
  createTextureLegacy,
  createFramebuffer,
  checkError,
} = WebGLUtils;

// Legacy export for backward compatibility
export default {
  getContext,
  createShaderProgram,
  toPowerOfTwo,
  texture: createTextureLegacy, // Legacy name
};