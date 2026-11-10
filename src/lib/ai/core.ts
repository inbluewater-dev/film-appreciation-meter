// 판정 실행: 온톨로지 지침 → JSON 스키마 강제 생성 → zod 검증(틀리거나 빠진 문장이 있으면 이유를 붙여 1회 재시도) → 정리
// 서버가 붐비거나(5xx) 무료 한도(429)가 차면 다음 모델로 넘어간다 (ANT 개념도 생성기와 같은 장치)
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Film } from '../ontology';
import { buildPrompt } from '../prompt';
import { JudgeResult, tidy } from '../schema';
import type { Sentence } from '../segment';

export type GenerateFn = (input: { model: string; prompt: string; jsonSchema: Record<string, unknown> }) => Promise<string>;

/** 2026-10 무료 등급 안정 모델. 무료 한도는 프로젝트·모델별(측정값: Flash-Lite 하루 약 500, Flash 하루 약 20) */
export const MODELS = {
  'gemini-3.5-flash-lite': '빠름 (Flash-Lite)',
  'gemini-3.1-flash-lite': '빠름 (Flash-Lite 3.1)',
  'gemini-3.6-flash': '정밀 (Flash, 하루 한도 작음)',
} as const;
export type ModelId = keyof typeof MODELS;
export const DEFAULT_MODEL: ModelId = 'gemini-3.5-flash-lite';
const FALLBACK: ModelId[] = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];

export class AiError extends Error {}

function jsonSchema(): Record<string, unknown> {
  const s = zodToJsonSchema(JudgeResult, { $refStrategy: 'none', target: 'jsonSchema7' }) as Record<string, unknown>;
  delete s.$schema;
  delete s.definitions;
  return s;
}

const msgOf = (e: unknown) => String((e as { message?: string })?.message ?? e);
export const isTransient = (e: unknown) => /\b(500|502|503|504)\b|UNAVAILABLE|overloaded|high demand|INTERNAL|DEADLINE_EXCEEDED/i.test(msgOf(e));
export const isQuota = (e: unknown) => /\b429\b|RESOURCE_EXHAUSTED|exceeded your current quota|rate.?limit/i.test(msgOf(e));

export function friendlyError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  const msg = msgOf(e);
  const detail = ` (오류 내용: ${msg.replace(/\s+/g, ' ').slice(0, 200)})`;
  if (isQuota(e)) return new AiError('AI 무료 사용량이 다 찼습니다. 1분쯤 뒤 다시 시도하세요. 계속되면 오늘 한도가 찬 것입니다(매일 오후 4~5시 초기화).' + detail);
  if (isTransient(e)) return new AiError('AI 서버가 지금 붐빕니다. 잠시 뒤 다시 시도하세요.' + detail);
  if (/app.?check|\b40[13]\b|PERMISSION_DENIED|API key/i.test(msg)) return new AiError('AI 연결이 허용되지 않았습니다(App Check·AI Logic 설정 확인).' + detail);
  if (/token|too long|exceeds|context/i.test(msg)) return new AiError('자료가 너무 깁니다. 분석할 부분만 붙여 넣어 다시 시도하세요.' + detail);
  if (/failed to fetch|network|offline/i.test(msg)) return new AiError('인터넷 연결을 확인한 뒤 다시 시도하세요.' + detail);
  return new AiError('AI가 응답하지 못했습니다. 잠시 뒤 다시 시도하세요.' + detail);
}

function stripFence(t: string) {
  return t.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
}

const SCHEMA = jsonSchema();

export interface JudgeRun {
  result: JudgeResult;
  model: string;
  /** AI가 끝내 판정하지 않아 '기타'로 채운 문장 */
  missing: string[];
}
type RunOpts = { sleep?: (ms: number) => Promise<void>; onStatus?: (s: string) => void };

export async function runJudge(generate: GenerateFn, input: { film: Film; sentences: Sentence[]; model: ModelId }, opts: RunOpts = {}): Promise<JudgeRun> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const models = [input.model, ...FALLBACK.filter((m) => m !== input.model)];
  const base = buildPrompt(input.film, input.sentences);

  async function call(prompt: string): Promise<{ text: string; model: string }> {
    let last: unknown;
    for (const model of models) {
      for (let tryNo = 0; tryNo < 2; tryNo++) {
        try {
          if (model !== input.model) opts.onStatus?.(`${model}(으)로 다시 시도하는 중…`);
          return { text: await generate({ model, prompt, jsonSchema: SCHEMA }), model };
        } catch (e) {
          last = e;
          if (isQuota(e)) break;
          if (!isTransient(e)) throw friendlyError(e);
          if (tryNo === 0) await sleep(1500);
        }
      }
    }
    throw friendlyError(last);
  }

  let issue = '';
  let partial: JudgeRun | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? base : `${base}\n\n[주의] 이전 응답을 고쳐 다시 쓰세요. ${issue}`;
    const { text, model } = await call(prompt);
    try {
      const parsed = JudgeResult.safeParse(JSON.parse(stripFence(text).replace(/[\uE000-\uF8FF\uFFFD]/g, '')));
      if (parsed.success) {
        const t = tidy(parsed.data, input.sentences);
        const run = { result: t.result, model, missing: t.missing };
        if (t.missing.length === 0 || attempt === 1) return run;
        partial = run;
        issue = `판정하지 않은 문장이 있습니다: ${t.missing.join(', ')}. 모든 문장을 하나씩 판정하세요.`;
        opts.onStatus?.('빠진 문장을 채워 다시 받는 중…');
        continue;
      }
      issue = `JSON 스키마에 맞지 않았습니다(${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}). 스키마에 맞는 JSON만 출력하세요.`;
    } catch {
      issue = 'JSON이 아니었습니다. 스키마에 맞는 JSON만 출력하세요.';
    }
    if (partial) return partial;
    opts.onStatus?.('응답 형식을 고쳐 다시 받는 중…');
  }
  if (partial) return partial;
  throw new AiError('AI 응답 형식이 맞지 않아 두 번 시도했지만 실패했습니다. 다시 눌러 주세요.');
}
