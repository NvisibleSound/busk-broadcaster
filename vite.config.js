import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      include: "**/*.{jsx,js,ts,tsx}",
      babel: {
        plugins: [],
        presets: ['@babel/preset-react']
      }
    })
  ],
  server: {
    port: 3020,
    open: true, // This will automatically open your browser
    // Comment out proxy section for now
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json']
  }
})
