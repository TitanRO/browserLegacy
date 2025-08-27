# ROBrowser Legacy - GitHub Copilot Instructions

ROBrowser Legacy is a web-based MMORPG client for Ragnarok Online, built with JavaScript, HTML5, and CSS. It's packaged and distributed as both a website and can be containerized with Docker.

**ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Prerequisites and Environment Setup
- Install Node.js LTS (v18 or higher, tested with v20.19.4):
  ```bash
  node --version  # Should show v18.0.0 or higher
  npm --version   # Should show compatible npm version
  ```
- Install dependencies:
  ```bash
  npm install  # Takes ~30 seconds. NEVER CANCEL.
  ```

### Build Commands - CRITICAL TIMING INFORMATION
**NEVER CANCEL ANY BUILD COMMAND** - Set appropriate timeouts and wait for completion.

- **Quick HTML build** (for testing):
  ```bash
  npm run build:html  # Takes <1 second
  ```

- **Individual module builds** (3-17 seconds each):
  ```bash
  npm run build:online        # Takes ~5 seconds - main game client
  npm run build:mapviewer     # Takes ~10 seconds
  npm run build:grfviewer     # Takes ~6 seconds  
  npm run build:modelviewer   # Takes ~13 seconds
  npm run build:strviewer     # Takes ~20 seconds
  npm run build:effectviewer  # Takes ~24 seconds
  npm run build:threadhandler # Takes ~24 seconds
  ```

- **Full build** (for production):
  ```bash
  npm run build:all  # Takes ~25 seconds. NEVER CANCEL. Set timeout to 60+ seconds.
  ```

- **Minified build** (for final production):
  ```bash
  npm run build:all:minify  # Takes ~3 minutes. NEVER CANCEL. Set timeout to 300+ seconds.
  ```

### Development and Testing
- **Development server** (live reload):
  ```bash
  npm run live  # Serves on http://127.0.0.1:8080, opens browser examples
  ```

- **Production server** (serve built files):
  ```bash
  npm run serve  # Serves dist/Web on http://127.0.0.1:8080
  ```

- **Tools server** (development utilities):
  ```bash
  npm run tools  # Opens file testing and development tools
  ```

## Validation and Testing

### Manual Validation Requirements
**ALWAYS manually validate any new code by running through complete user scenarios** after making changes:

1. **Build validation**:
   ```bash
   npm run build:all  # Must complete without errors
   npm run serve      # Must start server successfully
   ```

2. **Application validation**:
   - Navigate to http://127.0.0.1:8080/
   - Verify the Ragnarok Online client interface loads
   - Check browser console (F12) for JavaScript errors
   - Ensure the "START NOW" button and file drag-drop area are functional

3. **File testing tools** (for game asset validation):
   - Access via `npm run tools`
   - Use applications/tools/tests/ for testing game file formats
   - Available testers: sprites, models, altitude, ground, str, targa, action files

### No Traditional Testing Framework
- **NO** Jest, Mocha, or similar unit test frameworks
- **NO** configured linters (ESLint, JSHint, etc.)
- Custom file testing tools in `applications/tools/tests/`
- Code style enforced via `.editorconfig` (tabs, UTF-8, etc.)

## Repository Structure and Navigation

### Key Directories
```
├── src/                    # Main source code
│   ├── Core/              # Core engine (Client, Thread, Events, Configs)
│   ├── UI/Components/     # User interface components
│   ├── Engine/            # Game engine (EntityManager, MapEngine)
│   ├── Network/           # Network communication
│   ├── Renderer/          # WebGL rendering
│   ├── Audio/             # Audio system
│   ├── Loaders/           # Asset loaders (GRF, sprites, models)
│   ├── Plugins/           # Plugin system
│   └── Vendors/           # Third-party libraries
├── applications/          # Built applications and tools
│   ├── browser-examples/  # Demo and example pages
│   ├── tools/            # Build tools and file testers
│   └── nwjs/             # NW.js desktop app
├── dist/Web/             # Built output directory
└── doc/                  # Documentation and setup guides
```

### Important Files to Know
- `package.json` - Build scripts and dependencies
- `applications/tools/builder-web.js` - Main build system
- `src/Core/Client.js` - Main game client
- `src/Core/Configs.js` - Configuration system
- `src/Plugins/PluginManager.js` - Plugin loading system
- `index.html` - Main application entry point

## Common Development Tasks

### Making Code Changes
1. **ALWAYS** build and test before making changes:
   ```bash
   npm run build:all && npm run serve
   ```

2. **For UI changes**: Test with the development server:
   ```bash
   npm run live  # Live reload for faster iteration
   ```

3. **For plugin development**: 
   - Add plugins to `src/Plugins/`
   - Configure in game settings or via config file
   - Reference existing plugins for structure

4. **For core changes**: Focus on these key areas:
   - `src/Core/` - Engine functionality
   - `src/UI/Components/` - User interface
   - `src/Network/` - Server communication
   - `src/Engine/` - Game logic

### Build Artifacts and Distribution
- **Development**: Use `npm run live` with source files
- **Production web**: Use `npm run build:all` → `dist/Web/`
- **Production optimized**: Use `npm run build:all:minify` → `dist/Web/`
- **Docker**: Use provided Dockerfile (builds automatically)

### Troubleshooting Common Issues
1. **Build failures**: Check Node.js version (must be v18+)
2. **Asset loading errors**: Verify game files are properly placed
3. **Blank screen**: Check browser console for JavaScript errors
4. **Network errors**: Ensure WebSocket proxy is configured
5. **Performance issues**: Use minified build for production

## Docker Support
- **Development container**: `docker-compose up ro-browser`
- **Production container**: `docker-compose up serve-dist`
- **Custom build**: See Dockerfile for production setup

## Critical Reminders
- **NEVER CANCEL** build commands - they may take several minutes
- **ALWAYS** test functionality manually after code changes
- **NO** traditional unit tests - use file testing tools and manual validation
- **NO** configured linters - follow `.editorconfig` style guidelines
- Set build timeouts to **60+ seconds** for regular builds, **300+ seconds** for minified builds
- Builds over 2 minutes are NORMAL for minified versions

## External Dependencies
- **WebSocket Proxy**: Required for server connection (roBrowserLegacy-wsProxy)
- **Remote Client**: Optional for centralized asset serving (PHP or JS implementations)  
- **Game Assets**: GRF files required for full functionality
- **Game Server**: Compatible Ragnarok Online server for online play