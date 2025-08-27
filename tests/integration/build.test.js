const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Build System Integration Tests', () => {
  const distPath = path.join(process.cwd(), 'dist', 'Web');
  
  beforeEach(() => {
    // Clean dist directory before each test
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    // Clean up after all tests
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
    }
  });

  describe('JavaScript Build Process', () => {
    test('should build ThreadEventHandler successfully', () => {
      const output = execSync('npm run build:threadhandler', { 
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 60000 // 60 second timeout
      });
      
      expect(output).toContain('ThreadEventHandler.js has been created');
      
      const outputFile = path.join(distPath, 'ThreadEventHandler.js');
      expect(fs.existsSync(outputFile)).toBe(true);
      
      const stats = fs.statSync(outputFile);
      expect(stats.size).toBeGreaterThan(1000);
    });

    test('should build GrfViewer successfully', () => {
      const output = execSync('npm run build -- -D', { 
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 60000 // 60 second timeout
      });
      
      expect(output).toContain('GrfViewer.js has been created');
      
      const outputFile = path.join(distPath, 'GrfViewer.js');
      expect(fs.existsSync(outputFile)).toBe(true);
      
      const stats = fs.statSync(outputFile);
      expect(stats.size).toBeGreaterThan(1000);
    });
  });

  describe('JavaScript Compression Process', () => {
    test('should build and minify ThreadEventHandler', () => {
      // Test minified build with smaller application
      const output = execSync('npm run build -- -T --m', { 
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 60000
      });
      
      expect(output).toContain('ThreadEventHandler.js has been created');
      expect(output).toContain('Minifying');
      
      const outputFile = path.join(distPath, 'ThreadEventHandler.js');
      expect(fs.existsSync(outputFile)).toBe(true);
      
      // Minified file should still be substantial
      const stats = fs.statSync(outputFile);
      expect(stats.size).toBeGreaterThan(1000);
    });

    test('should verify minified code contains required components', () => {
      execSync('npm run build -- -T --m', { 
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 60000
      });
      
      const outputFile = path.join(distPath, 'ThreadEventHandler.js');
      const content = fs.readFileSync(outputFile, 'utf8');
      
      // Should contain header comment
      expect(content).toContain('Build with RONW Builder');
      expect(content).toContain('ROBrowser');
      
      // Should contain require.js
      expect(content).toContain('require');
    });
  });

  describe('Build Validation', () => {
    test('should validate all build applications exist', () => {
      const builderPath = path.join(process.cwd(), 'applications', 'tools', 'builder-web.js');
      const builderContent = fs.readFileSync(builderPath, 'utf8');
      
      // Extract application names from builder
      const appMatches = builderContent.match(/case "([^"]+)":/g);
      expect(appMatches).toBeTruthy();
      expect(appMatches.length).toBeGreaterThan(5); // Should have multiple applications
      
      // Verify some key applications are included
      expect(builderContent).toContain('case "ThreadEventHandler"');
      expect(builderContent).toContain('case "Online"');
      expect(builderContent).toContain('case "GrfViewer"');
    });

    test('should verify builder output format', () => {
      execSync('npm run build:threadhandler', { 
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 60000
      });
      
      const outputFile = path.join(distPath, 'ThreadEventHandler.js');
      const content = fs.readFileSync(outputFile, 'utf8');
      
      // Check for proper JavaScript structure
      expect(content).toMatch(/function\s*\(/); // Should contain functions
      
      // Should contain header
      expect(content).toContain('Build with RONW Builder');
      expect(content).toContain('ROBrowser');
      
      // Should contain define calls (AMD modules)
      expect(content).toContain('define(');
      expect(content).toContain('require');
    });
  });
});