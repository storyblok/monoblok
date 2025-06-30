import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

import { qrcode } from 'vite-plugin-qrcode'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    qrcode(), // only applies in dev mode
    tailwindcss(),
  ],
})