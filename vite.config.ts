import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5177,
    host: '127.0.0.1',
    strictPort: false,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
