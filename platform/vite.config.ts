import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tanstackStart(), viteReact()],
  // The HEIC decoder is only imported when a sender adds an iPhone photo. Prepared up front, the dev
  // server doesn't discover it mid-session and reload the page, which would clear the draft.
  optimizeDeps: { include: ['heic-to'] },
})
