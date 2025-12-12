import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Project root directory
  root: '.',
  
  // Public directory for static assets
  publicDir: 'assets',
  
  // Development server configuration
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'esbuild',
    
    // Rollup options
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        // Preserve directory structure
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/css/i.test(ext)) {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js'
      }
    },
    
    // Target modern browsers
    target: 'es2020'
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'js')
    },
    extensions: ['.ts', '.js', '.json']
  },
  
  // Enable TypeScript type checking
  esbuild: {
    // Target ES2020 for modern syntax support
    target: 'es2020'
  }
});
