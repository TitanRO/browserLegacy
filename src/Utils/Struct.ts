/**
 * Utils/Struct.ts
 *
 * Implement C like structure in TypeScript
 *
 * Example:
 * ```typescript
 * const auth = new Struct(
 *     "unsigned char username[24]",
 *     "unsigned char password[24]",
 *     "bool stay_connect",
 *     "float version",
 *     "int tick"
 * );
 * 
 * binaryReader.readStruct(auth);
 * ```
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * Supported C-like data types
 */
export type CDataType = 'bool' | 'char' | 'short' | 'int' | 'long' | 'float' | 'double';

/**
 * Type mapping for binary reader methods
 */
export type BinaryReaderMethod = 
    | 'getInt8' | 'getUint8'
    | 'getInt16' | 'getUint16'
    | 'getInt32' | 'getUint32'
    | 'getFloat32' | 'getFloat64';

/**
 * Structure field definition
 */
export interface StructField {
    /** Binary reader method to use */
    func: BinaryReaderMethod;
    /** Number of elements (for arrays) */
    count: number;
    /** Size in bytes */
    size: number;
    /** Whether the type is unsigned */
    unsigned: boolean;
    /** Original C type */
    type: CDataType;
}

/**
 * Parsed structure definition
 */
export interface StructDefinition {
    [fieldName: string]: StructField;
}

/**
 * Type information for C data types
 */
interface TypeInfo {
    size: number;
    func: string;
}

/**
 * C data type information mapping
 */
const TYPE_INFO_MAP: Record<CDataType, TypeInfo> = {
    bool:   { size: 1, func: 'int8' },
    char:   { size: 1, func: 'int8' },
    short:  { size: 2, func: 'int16' },
    int:    { size: 4, func: 'int32' },
    long:   { size: 4, func: 'int32' },
    float:  { size: 4, func: 'float32' },
    double: { size: 8, func: 'float64' }
};

/**
 * Regular expression for parsing C-like structure definitions
 */
const STRUCT_FIELD_REGEX = /(unsigned\s)?(bool|char|short|int|long|float|double)\s+([a-zA-Z0-9_-]+)(\[(\d+)\])?;?/;

/**
 * C-like structure definition class
 */
export class Struct {
    /** Structure field definitions */
    public readonly _list: StructDefinition;
    
    /** Total size of the structure in bytes */
    public readonly size: number;
    
    /** Number of fields in the structure */
    public readonly fieldCount: number;

    /**
     * Create a new structure definition
     * 
     * @param definitions - C-like structure field definitions
     * @throws {Error} If a field definition is invalid
     */
    constructor(...definitions: string[]) {
        const fields: StructDefinition = {};
        let totalSize = 0;

        for (const definition of definitions) {
            const field = this.parseFieldDefinition(definition);
            fields[field.name] = field.info;
            totalSize += field.info.size * field.info.count;
        }

        this._list = fields;
        this.size = totalSize;
        this.fieldCount = definitions.length;
    }

    /**
     * Parse a single field definition
     * 
     * @param definition - C-like field definition string
     * @returns Parsed field information
     * @throws {Error} If the definition is invalid
     */
    private parseFieldDefinition(definition: string): { name: string; info: StructField } {
        const match = definition.match(STRUCT_FIELD_REGEX);
        
        if (!match) {
            throw new Error(`Struct() - Invalid field definition: "${definition}"`);
        }

        const [, unsignedKeyword, type, name, , arraySize] = match;
        const unsigned = !!unsignedKeyword;
        const count = arraySize ? parseInt(arraySize, 10) : 1;
        const cType = type.toLowerCase() as CDataType;

        if (!(cType in TYPE_INFO_MAP)) {
            throw new Error(`Struct() - Undefined type '${type}'.`);
        }

        const typeInfo = TYPE_INFO_MAP[cType];
        const func = this.getBinaryReaderMethod(typeInfo.func, unsigned);

        return {
            name,
            info: {
                func,
                count,
                size: typeInfo.size,
                unsigned,
                type: cType
            }
        };
    }

    /**
     * Get the appropriate binary reader method name
     * 
     * @param baseFunc - Base function name
     * @param unsigned - Whether the type is unsigned
     * @returns Binary reader method name
     */
    private getBinaryReaderMethod(baseFunc: string, unsigned: boolean): BinaryReaderMethod {
        if (unsigned) {
            return `getU${baseFunc}` as BinaryReaderMethod;
        } else {
            return `get${baseFunc.charAt(0).toUpperCase() + baseFunc.substr(1)}` as BinaryReaderMethod;
        }
    }

    /**
     * Get field information by name
     * 
     * @param fieldName - Name of the field
     * @returns Field information or undefined if not found
     */
    public getField(fieldName: string): StructField | undefined {
        return this._list[fieldName];
    }

    /**
     * Get all field names
     * 
     * @returns Array of field names
     */
    public getFieldNames(): string[] {
        return Object.keys(this._list);
    }

    /**
     * Check if a field exists
     * 
     * @param fieldName - Name of the field
     * @returns True if the field exists
     */
    public hasField(fieldName: string): boolean {
        return fieldName in this._list;
    }

    /**
     * Create a typed interface for the structure data
     * This is a compile-time helper for better TypeScript support
     */
    public createTypedData<T = Record<string, any>>(): T {
        return {} as T;
    }

    /**
     * Validate that a data object matches this structure
     * 
     * @param data - Data object to validate
     * @returns True if the data matches the structure
     */
    public validateData(data: any): boolean {
        if (!data || typeof data !== 'object') {
            return false;
        }

        const fieldNames = this.getFieldNames();
        
        for (const fieldName of fieldNames) {
            if (!(fieldName in data)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get structure information as a readable string
     * 
     * @returns Human-readable structure description
     */
    public toString(): string {
        const fields = Object.entries(this._list).map(([name, field]) => {
            const typeStr = field.unsigned ? `unsigned ${field.type}` : field.type;
            const arrayStr = field.count > 1 ? `[${field.count}]` : '';
            return `  ${typeStr} ${name}${arrayStr}`;
        });

        return `Struct (${this.size} bytes) {\n${fields.join('\n')}\n}`;
    }
}

/**
 * Export the Struct class as default
 */
export default Struct;