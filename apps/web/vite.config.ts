import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  for (const [name, value] of Object.entries(env)) {
    let privilegedJwt = false;
    try { privilegedJwt = JSON.parse(Buffer.from(value.split('.')[1] ?? '', 'base64url').toString()).role === 'service_role'; } catch { /* ordinary public setting */ }
    if (/SECRET|SERVICE_ROLE|PAIFLOW_API_TOKEN/.test(name) || /^(sb_secret_|pfk_|pfd_)/.test(value) || privilegedJwt) {
      throw new Error('Server credentials must not appear in VITE_* settings. Keep them in the API environment.');
    }
  }
  return {
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3002' },
  },
  };
});
