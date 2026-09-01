import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves from /iv-drip-rate/. When building for another host,
// override with VITE_BASE=/ in the environment.

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE ?? '/iv-drip-rate/';
  return {
    base,
    plugins: [react()],
    build: {
      target: 'es2020',
      sourcemap: false,
    },
  };
});
