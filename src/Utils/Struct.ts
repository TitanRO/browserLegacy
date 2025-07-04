/**
 * Utils/Struct.ts
 *
 * Modern C-like structure implementation in TypeScript
 * 
 * Example usage:
 * ```typescript
 * const auth = new Struct(
 *   "unsigned char username[24]",
 *   "unsigned char password[24]", 
 *   "bool stay_connect",
 *   "float version",
 *   "int tick"
 * );
 * 
 * const data = reader.readStruct(auth);
 * ```
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Supported C data types
 */
export type CDataType = 'bool' | 'char' | 'short' | 'int' | 'long' | 'float' | 'double';

/**
 * Struct field definition
 */
export interface StructField {
  func: string;
  count: number;
  size: number;
  unsigned: boolean;
  type: CDataType;
}

/**
 * Parsed field information
 */
interface ParsedField {
  unsigned: boolean;
  type: CDataType;
  name: string;
  count: number;
}

/**
 * Type mapping configuration
 */
interface TypeConfig {
  size: number;
  func: string;
}

/**
 * Modern C-like structure implementation with comprehensive type safety
 */
export class Struct {
  private _fields: Record<string, StructField> = {};
  private _totalSize = 0;

  /**
   * Type configuration mapping
   */
  private static readonly TYPE_CONFIG: Record<CDataType, TypeConfig> = {
    bool: { size: 1, func: 'int8' },
    char: { size: 1, func: 'int8' },
    short: { size: 2, func: 'int16' },
    int: { size: 4, func: 'int32' },
    long: { size: 4, func: 'int32' },
    float: { size: 4, func: 'float32' },
    double: { size: 8, func: 'float64' },
  };

  /**
   * Regular expression for parsing C-style field declarations
   */
  private static readonly FIELD_PATTERN = 
    /(unsigned\s)?(bool|char|short|int|long|float|double)\s+([a-zA-Z_][a-zA-Z0-9_-]*)(\[(\d+)\])?;?/;

  /**
   * Create a new Struct with field definitions
   *
   * @param fieldDefinitions - C-style field definitions
   */
  constructor(...fieldDefinitions: string[]) {
    this.parseFields(fieldDefinitions);
  }

  /**
   * Parse field definitions from C-style strings
   */
  private parseFields(definitions: string[]): void {
    for (const definition of definitions) {
      const field = this.parseFieldDefinition(definition);
      this.addField(field);
    }
  }

  /**
   * Parse a single field definition
   */
  private parseFieldDefinition(definition: string): ParsedField {
    const trimmed = definition.trim();
    const match = trimmed.match(Struct.FIELD_PATTERN);

    if (!match) {
      throw new Error(`Invalid struct field definition: "${definition}"`);
    }

    const [, unsignedModifier, type, name, , arraySize] = match;

    return {
      unsigned: !!unsignedModifier,
      type: type as CDataType,
      name: name,
      count: arraySize ? parseInt(arraySize, 10) : 1,
    };
  }

  /**
   * Add a parsed field to the struct
   */
  private addField(parsed: ParsedField): void {
    const typeConfig = Struct.TYPE_CONFIG[parsed.type];
    
    if (!typeConfig) {
      throw new Error(`Unsupported struct field type: "${parsed.type}"`);
    }

    // Validate field name
    if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(parsed.name)) {
      throw new Error(`Invalid field name: "${parsed.name}"`);
    }

    // Check for duplicate field names
    if (parsed.name in this._fields) {
      throw new Error(`Duplicate field name: "${parsed.name}"`);
    }

    // Validate array count
    if (parsed.count < 1) {
      throw new Error(`Invalid array size for field "${parsed.name}": ${parsed.count}`);
    }

    // Generate appropriate reader function name
    const baseFunctionName = typeConfig.func;
    const functionName = this.generateFunctionName(baseFunctionName, parsed.unsigned);

    const field: StructField = {
      func: functionName,
      count: parsed.count,
      size: typeConfig.size,
      unsigned: parsed.unsigned,
      type: parsed.type,
    };

    this._fields[parsed.name] = field;
    this._totalSize += typeConfig.size * parsed.count;
  }

  /**
   * Generate the appropriate function name for reading this field type
   */
  private generateFunctionName(baseFunc: string, unsigned: boolean): string {
    if (unsigned && baseFunc !== 'float32' && baseFunc !== 'float64') {
      // Convert "int8" to "getUint8", "int16" to "getUint16", etc.
      return `getU${baseFunc.charAt(0).toUpperCase()}${baseFunc.slice(1)}`;
    } else {
      // Convert "int8" to "getInt8", "float32" to "getFloat32", etc.
      return `get${baseFunc.charAt(0).toUpperCase()}${baseFunc.slice(1)}`;
    }
  }

  /**
   * Get the field list for use by BinaryReader
   */
  getFieldList(): Record<string, { func: string; count: number }> {
    const result: Record<string, { func: string; count: number }> = {};
    
    for (const [name, field] of Object.entries(this._fields)) {
      result[name] = {
        func: field.func,
        count: field.count,
      };
    }
    
    return result;
  }

  /**
   * Get detailed field information
   */
  getFields(): Record<string, StructField> {
    return { ...this._fields };
  }

  /**
   * Get field names in definition order
   */
  getFieldNames(): string[] {
    return Object.keys(this._fields);
  }

  /**
   * Get a specific field definition
   */
  getField(name: string): StructField | undefined {
    return this._fields[name];
  }

  /**
   * Check if a field exists
   */
  hasField(name: string): boolean {
    return name in this._fields;
  }

  /**
   * Get the total size in bytes of this struct
   */
  get size(): number {
    return this._totalSize;
  }

  /**
   * Get the number of fields in this struct
   */
  get fieldCount(): number {
    return Object.keys(this._fields).length;
  }

  /**
   * Create a copy of this struct
   */
  clone(): Struct {
    const clone = Object.create(Struct.prototype) as Struct;
    clone._fields = { ...this._fields };
    clone._totalSize = this._totalSize;
    return clone;
  }

  /**
   * Add a field dynamically
   */
  addDynamicField(definition: string): void {
    const field = this.parseFieldDefinition(definition);
    this.addField(field);
  }

  /**
   * Remove a field
   */
  removeField(name: string): boolean {
    if (!(name in this._fields)) {
      return false;
    }

    const field = this._fields[name];
    this._totalSize -= field.size * field.count;
    delete this._fields[name];
    
    return true;
  }

  /**
   * Get struct information as a string
   */
  toString(): string {
    const fields = Object.entries(this._fields)
      .map(([name, field]) => {
        const unsignedPrefix = field.unsigned ? 'unsigned ' : '';
        const arrayPart = field.count > 1 ? `[${field.count}]` : '';
        return `  ${unsignedPrefix}${field.type} ${name}${arrayPart};`;
      })
      .join('\n');

    return `Struct {\n${fields}\n} // ${this._totalSize} bytes`;
  }

  /**
   * Validate that this struct can be read by a binary reader
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.fieldCount === 0) {
      errors.push('Struct has no fields');
    }

    if (this._totalSize === 0) {
      errors.push('Struct has zero size');
    }

    for (const [name, field] of Object.entries(this._fields)) {
      if (!field.func) {
        errors.push(`Field "${name}" has no reader function`);
      }

      if (field.count < 1) {
        errors.push(`Field "${name}" has invalid count: ${field.count}`);
      }

      if (field.size < 1) {
        errors.push(`Field "${name}" has invalid size: ${field.size}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a struct from a JavaScript object schema
   */
  static fromSchema(schema: Record<string, string>): Struct {
    const definitions = Object.entries(schema).map(([name, type]) => `${type} ${name}`);
    return new Struct(...definitions);
  }

  /**
   * Create common struct types
   */
  static createCommonTypes() {
    return {
      Vector2: new Struct('float x', 'float y'),
      Vector3: new Struct('float x', 'float y', 'float z'),
      Color: new Struct('unsigned char r', 'unsigned char g', 'unsigned char b', 'unsigned char a'),
      Point2D: new Struct('int x', 'int y'),
      Rectangle: new Struct('int x', 'int y', 'int width', 'int height'),
    };
  }
}

// Backward compatibility: expose the legacy _list property
Object.defineProperty(Struct.prototype, '_list', {
  get: function() {
    return this.getFieldList();
  }
});

// Default export
export default Struct;