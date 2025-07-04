import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  const isProduction = command === 'build';
  
  // Define entry points for different modes
  const getEntryPoint = (mode) => {
    switch (mode) {
      case 'online':
        return resolve(__dirname, 'src/App/Online.js');
      case 'mapviewer':
        return resolve(__dirname, 'src/App/MapViewer.js');
      case 'grfviewer':
        return resolve(__dirname, 'src/App/GrfViewer.js');
      case 'modelviewer':
        return resolve(__dirname, 'src/App/ModelViewer.js');
      case 'strviewer':
        return resolve(__dirname, 'src/App/StrViewer.js');
      case 'effectviewer':
        return resolve(__dirname, 'src/App/EffectViewer.js');
      case 'grannymodelviewer':
        return resolve(__dirname, 'src/App/GrannyModelViewer.js');
      case 'threadeventhandler':
        return resolve(__dirname, 'src/Core/ThreadEventHandler.js');
      default:
        return resolve(__dirname, 'index.html');
    }
  };

  return {
    root: '.',
    
    // Define entry points
    build: {
      outDir: 'dist/Web',
      emptyOutDir: true,
      rollupOptions: {
        input: mode !== 'development' ? getEntryPoint(mode) : resolve(__dirname, 'index.html'),
        output: {
          entryFileNames: () => {
            switch (mode) {
              case 'online': return 'Online.js';
              case 'mapviewer': return 'MapViewer.js';
              case 'grfviewer': return 'GrfViewer.js';
              case 'modelviewer': return 'ModelViewer.js';
              case 'strviewer': return 'StrViewer.js';
              case 'effectviewer': return 'EffectViewer.js';
              case 'grannymodelviewer': return 'GrannyModelViewer.js';
              case 'threadeventhandler': return 'ThreadEventHandler.js';
              default: return '[name].js';
            }
          },
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      },
      sourcemap: !isProduction,
      minify: isProduction ? 'terser' : false,
      terserOptions: {
        output: {
          ascii_only: true,
          comments: false
        }
      }
    },

    // Development server config
    server: {
      port: 8000,
      host: true,
      open: true
    },

    // Path resolution for modules
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'Utils': resolve(__dirname, 'src/Utils'),
        'Core': resolve(__dirname, 'src/Core'),
        'UI': resolve(__dirname, 'src/UI'),
        'Engine': resolve(__dirname, 'src/Engine'),
        'Renderer': resolve(__dirname, 'src/Renderer'),
        'Controls': resolve(__dirname, 'src/Controls'),
        'DB': resolve(__dirname, 'src/DB'),
        'Loaders': resolve(__dirname, 'src/Loaders'),
        'Network': resolve(__dirname, 'src/Network'),
        'Audio': resolve(__dirname, 'src/Audio'),
        'Plugins': resolve(__dirname, 'src/Plugins'),
        'Preferences': resolve(__dirname, 'src/Preferences'),
        'App': resolve(__dirname, 'src/App'),
        'Vendors': resolve(__dirname, 'src/Vendors')
      }
    },

    // Plugins
    plugins: [
      // Legacy browser support for older devices that might run game clients
      legacy({
        targets: ['defaults', 'not IE 11']
      })
    ],

    // Optimize dependencies
    optimizeDeps: {
      include: ['spark-md5']
    },

    // Define global constants
    define: {
      __BUILD_DATE__: JSON.stringify(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')),
      __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
    }
  };
});