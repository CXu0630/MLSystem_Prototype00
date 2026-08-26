import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Repo is a GitHub Pages *project* site (not <user>.github.io), so all
  // asset URLs must be prefixed with the repo name to resolve correctly
  // at https://cxu0630.github.io/MLSystem_Prototype00/
  base: '/MLSystem_Prototype00/',
  plugins: [react()],
})
