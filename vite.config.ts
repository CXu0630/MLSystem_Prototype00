import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Repo is a GitHub Pages *project* site (not <user>.github.io), so all
  // asset URLs must be prefixed with the repo name to resolve correctly
  // at https://cxu0630.github.io/MLSystem_Prototype00/
  base: '/MLSystem_Prototype00/',
  plugins: [react()],
  // Transformers.js pulls in onnxruntime-web (large, ships its own .wasm and
  // uses import.meta tricks esbuild's dep pre-bundler chokes on). Let Vite
  // load it as a plain ESM dependency instead of trying to optimize it.
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
})
