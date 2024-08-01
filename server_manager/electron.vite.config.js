import {defineConfig} from "electron-vite";

export default defineConfig({
  main: {
    build: {
      outDir: "../output/server_manager/main",
      lib: {
        entry: "electron/index.ts"
      }
    }
  },
  preload: {
    build: {
      outDir: "../output/server_manager/preload",
      lib: {
        entry: "electron/preload.ts"
      }
    }
  },
  renderer: {
    root: "www",
    build: {
      outDir: "../output/server_manager/renderer",
      lib: {
        entry: "www/index.html"
      },
      rollupOptions: {
        input: "www/index.html"
      }  
    }
  }
});