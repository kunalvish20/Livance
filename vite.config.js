import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({
  publicDir:'client/public',
  server:{port:5173,proxy:{'/api':{target:'http://localhost:3001',changeOrigin:true}}},
  build:{outDir:'dist',rollupOptions:{input:{main:resolve(import.meta.dirname,'index.html')}}}
});
