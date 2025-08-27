const fs = require('fs');
const path = require('path');

describe('HTML Page Loading Integration Tests', () => {

  describe('HTML Structure Validation', () => {
    test('should validate main index.html structure', () => {
      const indexPath = path.join(process.cwd(), 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);
      
      const content = fs.readFileSync(indexPath, 'utf8');
      
      // Basic HTML structure
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<html>');
      expect(content).toContain('<head>');
      expect(content).toContain('<body>');
      
      // ROBrowser specific content
      expect(content).toContain('ROConfig');
      expect(content).toContain('Online.js');
      expect(content).toContain('TitanRO2');
    });

    test('should validate test HTML files structure', () => {
      const testFiles = [
        'applications/tools/tests/action.html',
        'applications/tools/tests/altitude.html',
        'applications/tools/tests/targa.html'
      ];
      
      testFiles.forEach(testFile => {
        const filePath = path.join(process.cwd(), testFile);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Basic HTML structure
          expect(content).toContain('<!DOCTYPE html>');
          expect(content).toContain('<html>');
          expect(content).toContain('<script');
          
          // RequireJS integration
          expect(content).toContain('require.js');
          expect(content).toContain('FileTester');
        }
      });
    });

    test('should validate build tool HTML interface', () => {
      const buildIndexPath = path.join(process.cwd(), 'applications', 'tools', 'build', 'index.html');
      expect(fs.existsSync(buildIndexPath)).toBe(true);
      
      const content = fs.readFileSync(buildIndexPath, 'utf8');
      
      // Build tool specific content
      expect(content).toContain('Compilation Tool');
      expect(content).toContain('data-app="App/Online"');
      expect(content).toContain('data-app="Core/ThreadEventHandler"');
      expect(content).toContain('data-app="App/GrfViewer"');
    });
  });

  describe('Application Configuration Validation', () => {
    test('should validate ROConfig in index.html', () => {
      const indexPath = path.join(process.cwd(), 'index.html');
      const content = fs.readFileSync(indexPath, 'utf8');
      
      // Extract ROConfig object
      const configMatch = content.match(/ROConfig\s*=\s*{[\s\S]*?};/);
      expect(configMatch).toBeTruthy();
      
      const configStr = configMatch[0];
      
      // Validate config properties
      expect(configStr).toContain('development:');
      expect(configStr).toContain('servers:');
      expect(configStr).toContain('TitanRO2');
      expect(configStr).toContain('packetver:');
    });

    test('should validate test configurations', () => {
      const testConfigFiles = [
        'applications/tools/tests/action.html'
      ];
      
      testConfigFiles.forEach(testFile => {
        const filePath = path.join(process.cwd(), testFile);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Should have basic RequireJS config
          expect(content).toContain('baseUrl:');
          expect(content).toContain('paths:');
          expect(content).toContain('text:');
          expect(content).toContain('jquery:');
        }
      });
    });
  });

  describe('Resource Loading Validation', () => {
    test('should validate required JavaScript dependencies exist', () => {
      const requiredFiles = [
        'src/Vendors/require.js',
        'src/Vendors/text.require.js',
        'src/Vendors/jquery-1.9.1.js'
      ];
      
      requiredFiles.forEach(file => {
        const filePath = path.join(process.cwd(), file);
        expect(fs.existsSync(filePath)).toBe(true);
        
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          expect(stats.size).toBeGreaterThan(0);
        }
      });
    });

    test('should validate core module structure', () => {
      const coreModules = [
        'src/Core/Client.js',
        'src/Core/Thread.js',
        'src/Core/Configs.js'
      ];
      
      coreModules.forEach(module => {
        const modulePath = path.join(process.cwd(), module);
        if (fs.existsSync(modulePath)) {
          const content = fs.readFileSync(modulePath, 'utf8');
          
          // Should be AMD modules
          expect(content).toContain('define(');
          expect(content).toMatch(/return\s+\w+/); // Should return something
        }
      });
    });
  });
});