import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // Your backend server
        changeOrigin: true,
      }, '/socket.io': {
        target: 'http://localhost:5000', // backend WS
        changeOrigin: true,
        ws: true, // << important for websockets
      },
    },
  },
});