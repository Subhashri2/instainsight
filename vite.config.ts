import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      watch: {
        ignored: ['**/pb_data/**', '**/pb_migrations/**', '**/pagination_info.json', '**/raw_data_debug.json', '**/raw_instagram_response.json', '**/test_output.json', '**/scraped_data_debug.json', '**/raw_data_debug.json', '**/src/**/*.py']
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      host: true,
      allowedHosts: ['unheard-kora-birefringent.ngrok-free.dev']
    },
  };
});
