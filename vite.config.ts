import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Firebase 호스팅(사이트 맨 위)에서 서비스하므로 base는 '/'
export default defineConfig({ plugins: [react()], base: '/' });
