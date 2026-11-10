// 판정 결과의 형식 — AI 응답은 이 스키마로 강제·검증한다
import { z } from 'zod';
import { DIMENSION_KEYS, type DimensionKey } from './ontology';
import type { Sentence } from './segment';

export const SECONDARY_KEYS = ['없음', '지각', '이해', '해석', '평가', '향유·참여'] as const;

export const Judgement = z.object({
  id: z.string(),
  primary: z.enum(DIMENSION_KEYS),
  secondary: z.enum(SECONDARY_KEYS),
  indicator: z.string(),
  quote: z.string(),
  reason: z.string(),
});
export const JudgeResult = z.object({
  judgements: z.array(Judgement),
  summary: z.string(),
});
export type Judgement = z.infer<typeof Judgement>;
export type JudgeResult = z.infer<typeof JudgeResult>;

/** 사람(또는 AI)의 한 문장 판정 — 일치도 계산의 단위 */
export interface Rating {
  primary: DimensionKey;
  secondary: DimensionKey | '없음';
}

/** 정리: 문장 순서대로 하나씩, 없는 문장은 '기타'로 채우고 표시, 보조=주이거나 기타면 '없음' */
export function tidy(r: JudgeResult, sentences: Sentence[]): { result: JudgeResult; missing: string[] } {
  const byId = new Map<string, Judgement>();
  for (const j of r.judgements) if (!byId.has(j.id)) byId.set(j.id, j);
  const missing: string[] = [];
  const judgements = sentences.map((s) => {
    const j = byId.get(s.id);
    if (!j) {
      missing.push(s.id);
      return { id: s.id, primary: '기타' as const, secondary: '없음' as const, indicator: '', quote: '', reason: '(AI가 이 문장을 판정하지 않음)' };
    }
    const secondary = j.secondary === j.primary || j.primary === '기타' ? ('없음' as const) : j.secondary;
    return { ...j, secondary };
  });
  return { result: { judgements, summary: r.summary.trim() }, missing };
}
