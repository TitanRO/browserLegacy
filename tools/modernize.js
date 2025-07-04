#!/usr/bin/env node

/**
 * Comprehensive modernization script for ROBrowser
 * 
 * This script converts all AMD/RequireJS modules to ES6 modules
 * and applies modern JavaScript patterns throughout the codebase.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const SRC_DIR = path.join(__dirname, '..', 'src');
const VENDORS_DIR = path.join(SRC_DIR, 'Vendors');
const BACKUP_DIR = path.join(__dirname, '..', 'backup');

// Modernization patterns
const PATTERNS = {
  // AMD to ES6 module conversion
  amdDefine: /define\s*\(\s*(?:\[([^\]]*)\],\s*)?function\s*\(([^)]*)\)\s*\{/g,
  amdDefineSimple: /define\s*\(\s*function\s*\(\s*require\s*\)\s*\{/g,
  amdDefineEmpty: /define\s*\(\s*function\s*\(\s*\)\s*\{/g,
  amdReturn: /return\s+([^;]+);?\s*\}\s*\)\s*;?\s*$/,
  
  // Variable declarations
  varDeclaration: /var\s+(\w+)/g,
  
  // Function expressions to arrow functions
  functionExpression: /function\s*\(\s*([^)]*)\s*\)\s*\{/g,
  
  // jQuery patterns
  jquerySelectors: /\$\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  jqueryEvents: /\.on\s*\(\s*['"`]([^'"`]+)['"`]\s*,/g,
  
  // RequireJS text plugin
  textPlugin: /['"`]text!([^'"`]+)['"`]/g,
};

// Dependency mapping for common modules
const DEPENDENCY_MAP = {
  'jquery': 'Utils/DOM',
  'Utils/jquery': 'Utils/DOM',
  'text!': '', // Will be handled specially
  'Core/Client': 'Core/Client',
  'Core/Context': 'Core/Context',
  'Core/Configs': 'Core/Configs',
  'Utils/Texture': 'Utils/Texture',
  'Utils/WebGL': 'Utils/WebGL',
  'Utils/colors': 'Utils/colors',
  'Loaders/Targa': 'Loaders/Targa',
};

class ModernizationProcessor {
  constructor() {
    this.processedFiles = new Set();
    this.errors = [];
    this.stats = {
      total: 0,
      processed: 0,
      errors: 0,
      converted: 0,
    };
  }

  async run() {
    console.log('🚀 Starting comprehensive ROBrowser modernization...');
    
    // Create backup
    await this.createBackup();
    
    // Get all JS files
    const jsFiles = await this.getAllJSFiles();
    this.stats.total = jsFiles.length;
    
    console.log(`📊 Found ${jsFiles.length} JavaScript files to modernize`);
    
    // Process each file
    for (const file of jsFiles) {
      try {
        await this.processFile(file);
        this.stats.processed++;
        
        if (this.stats.processed % 10 === 0) {
          console.log(`📈 Progress: ${this.stats.processed}/${this.stats.total} files processed`);
        }
      } catch (error) {
        this.stats.errors++;
        this.errors.push({ file, error: error.message });
        console.error(`❌ Error processing ${file}: ${error.message}`);
      }
    }
    
    // Generate report
    await this.generateReport();
    
    console.log('✅ Modernization complete!');
    console.log(`📊 Stats: ${this.stats.processed} processed, ${this.stats.converted} converted, ${this.stats.errors} errors`);
  }

  async createBackup() {
    console.log('💾 Creating backup...');
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `src-${timestamp}`);
    
    await execAsync(`cp -r "${SRC_DIR}" "${backupPath}"`);
    console.log(`✅ Backup created at ${backupPath}`);
  }

  async getAllJSFiles() {
    const files = [];
    
    const walk = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && item !== 'Vendors') {
          walk(fullPath);
        } else if (stat.isFile() && item.endsWith('.js')) {
          files.push(fullPath);
        }
      }
    };
    
    walk(SRC_DIR);
    return files;
  }

  async processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(SRC_DIR, filePath);
    
    // Skip if already processed or if it's a vendor file
    if (this.processedFiles.has(filePath) || filePath.includes('Vendors')) {
      return;
    }
    
    // Check if this is an AMD module
    if (!content.includes('define(')) {
      return;
    }
    
    console.log(`🔄 Processing: ${relativePath}`);
    
    let modernizedContent = content;
    let hasChanges = false;
    
    // Convert AMD to ES6 modules
    const amdResult = this.convertAMDToES6(modernizedContent, filePath);
    if (amdResult.changed) {
      modernizedContent = amdResult.content;
      hasChanges = true;
    }
    
    // Apply other modernizations
    modernizedContent = this.modernizeVariables(modernizedContent);
    modernizedContent = this.modernizeFunctions(modernizedContent);
    modernizedContent = this.modernizeJQuery(modernizedContent);
    
    if (hasChanges) {
      // Write as TypeScript file
      const newFilePath = filePath.replace('.js', '.ts');
      fs.writeFileSync(newFilePath, modernizedContent);
      
      // Remove old JS file
      fs.unlinkSync(filePath);
      
      this.stats.converted++;
      console.log(`✅ Converted: ${relativePath} -> ${path.basename(newFilePath)}`);
    }
    
    this.processedFiles.add(filePath);
  }

  convertAMDToES6(content, filePath) {
    let result = content;
    let changed = false;
    
    // Handle different AMD patterns
    const amdMatch = content.match(/define\s*\(\s*(?:\[([^\]]*)\],\s*)?function\s*\(([^)]*)\)\s*\{/);
    
    if (amdMatch) {
      const [fullMatch, dependenciesStr, parametersStr] = amdMatch;
      
      // Parse dependencies
      const dependencies = dependenciesStr 
        ? dependenciesStr.split(',').map(d => d.trim().replace(/['"]/g, ''))
        : [];
      
      // Parse parameters
      const parameters = parametersStr
        ? parametersStr.split(',').map(p => p.trim())
        : [];
      
      // Generate imports
      const imports = this.generateImports(dependencies, parameters);
      
      // Find return statement
      const returnMatch = content.match(/return\s+([^;]+);?\s*\}\s*\)\s*;?\s*$/);
      
      if (returnMatch) {
        const exportStatement = this.generateExport(returnMatch[1]);
        
        // Replace AMD structure with ES6
        result = result.replace(fullMatch, '');
        result = result.replace(returnMatch[0], exportStatement);
        result = imports + '\n\n' + result;
        
        changed = true;
      }
    }
    
    return { content: result, changed };
  }

  generateImports(dependencies, parameters) {
    const imports = [];
    
    dependencies.forEach((dep, index) => {
      const param = parameters[index];
      if (!param) return;
      
      if (dep.startsWith('text!')) {
        // Handle text imports specially
        const textPath = dep.replace('text!', '');
        imports.push(`import ${param} from '${textPath}?raw';`);
      } else {
        // Map dependency to modern path
        const modernPath = DEPENDENCY_MAP[dep] || dep;
        imports.push(`import ${param} from '${modernPath}';`);
      }
    });
    
    return imports.join('\n');
  }

  generateExport(returnValue) {
    // Handle different export patterns
    if (returnValue.trim().startsWith('{')) {
      // Object export
      return `export default ${returnValue};`;
    } else if (returnValue.includes(':')) {
      // Object with methods
      return `export default ${returnValue};`;
    } else {
      // Simple export
      return `export default ${returnValue};`;
    }
  }

  modernizeVariables(content) {
    // Convert var to const/let
    return content.replace(/var\s+(\w+)\s*=\s*([^;]+);/g, (match, name, value) => {
      // Simple heuristic: if it's reassigned later, use let, otherwise const
      const isReassigned = new RegExp(`${name}\\s*=\\s*[^=]`).test(content);
      const keyword = isReassigned ? 'let' : 'const';
      return `${keyword} ${name} = ${value};`;
    });
  }

  modernizeFunctions(content) {
    // Convert function expressions to arrow functions where appropriate
    return content.replace(/function\s*\(\s*([^)]*)\s*\)\s*\{/g, (match, params) => {
      // Skip if it's a constructor or method definition
      if (content.includes('this.') || content.includes('prototype.')) {
        return match;
      }
      return `(${params}) => {`;
    });
  }

  modernizeJQuery(content) {
    // Replace jQuery with modern DOM API calls
    let result = content;
    
    // Simple replacements
    result = result.replace(/\$\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, `DOM.$1('$1')`);
    result = result.replace(/\.on\s*\(\s*['"`]([^'"`]+)['"`]\s*,/g, `.addEventListener('$1',`);
    
    return result;
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      errors: this.errors,
      processedFiles: Array.from(this.processedFiles),
    };
    
    const reportPath = path.join(__dirname, '..', 'modernization-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Report generated: ${reportPath}`);
  }
}

// Run the modernization
if (require.main === module) {
  const processor = new ModernizationProcessor();
  processor.run().catch(console.error);
}

module.exports = ModernizationProcessor;