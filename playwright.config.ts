import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:5175',
    locale: 'ko-KR',
    viewport: { width: 1360, height: 900 },
    // 로캘이 없는 리눅스에서도 한글 파일 이름으로 내려받기되게
    launchOptions: { env: { ...process.env, LANG: process.env.LANG || 'C.UTF-8' } },
  },
  webServer: { command: 'npx vite --port 5175 --strictPort', port: 5175, reuseExistingServer: true, env: { VITE_AI_MODE: 'mock' } },
});
