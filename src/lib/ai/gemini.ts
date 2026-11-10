// 실제 AI — Firebase AI Logic(Gemini Developer API, 무료 등급). API 키를 앱에 넣지 않는다.
// App Check: 배포 사이트는 Fraud Defense(이전 reCAPTCHA Enterprise) 키, 내 컴퓨터는 디버그 토큰
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { CustomProvider, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { config } from '../config';
import type { GenerateFn } from './core';

let app: FirebaseApp | null = null;

function firebaseApp(): FirebaseApp {
  if (app) return app;
  const f = config.firebase;
  if (!f.apiKey || !f.projectId || !f.appId) throw new Error('Firebase 설정값이 없습니다(.env.local 확인).');
  app = initializeApp({ apiKey: f.apiKey, authDomain: f.authDomain, projectId: f.projectId, appId: f.appId });
  const debugToken = config.appCheckDebugToken;
  if (debugToken) (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  if (config.recaptchaSiteKey || debugToken)
    initializeAppCheck(app, {
      provider:
        config.recaptchaSiteKey && !debugToken
          ? new ReCaptchaEnterpriseProvider(config.recaptchaSiteKey)
          : new CustomProvider({ getToken: () => Promise.reject(new Error('App Check: 사이트 키가 없습니다.')) }),
      isTokenAutoRefreshEnabled: true,
    });
  return app;
}

export const geminiGenerate: GenerateFn = async ({ model, prompt, jsonSchema }) => {
  const ai = getAI(firebaseApp(), { backend: new GoogleAIBackend() });
  const m = getGenerativeModel(ai, { model, generationConfig: { responseMimeType: 'application/json', responseJsonSchema: jsonSchema, temperature: 0.2 } });
  const res = await m.generateContent(prompt);
  return res.response.text();
};
