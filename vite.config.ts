import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const isCodespaces = Boolean(process.env.CODESPACES) || Boolean(process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN);
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      watch: {
        ignored: ['**/pb_data/**', '**/pb_migrations/**', '**/pagination_info.json', '**/raw_data_debug.json', '**/raw_instagram_response.json', '**/test_output.json', '**/scraped_data_debug.json', '**/raw_data_debug.json', '**/src/**/*.py']
      },
      // Codespaces/forwarded ports frequently drop Vite HMR websockets and spam client errors.
      hmr: isCodespaces ? false : process.env.DISABLE_HMR !== 'true',
      host: true,
      allowedHosts: ['unheard-kora-birefringent.ngrok-free.dev']
    },
  };
});
