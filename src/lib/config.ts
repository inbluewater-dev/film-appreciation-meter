// 실행 모드 — .env.local 의 값으로 전환
const env = import.meta.env;
export const config = {
  aiMode: (env.VITE_AI_MODE === 'gemini' ? 'gemini' : 'mock') as 'gemini' | 'mock',
  firebase: {
    apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
    projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    appId: env.VITE_FIREBASE_APP_ID as string | undefined,
  },
  recaptchaSiteKey: env.VITE_RECAPTCHA_SITE_KEY as string | undefined,
  /** 내 컴퓨터(npm run dev)에서만 쓰는 App Check 디버그 토큰 — 배포 빌드에는 넣지 않는다 */
  appCheckDebugToken: (env.DEV ? env.VITE_APPCHECK_DEBUG_TOKEN : undefined) as string | undefined,
};
