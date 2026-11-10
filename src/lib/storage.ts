// 저장 — 로그인 없이 이 브라우저에만 남긴다. 다른 컴퓨터·다른 평정자와는 JSON 파일로 주고받는다.
import { DIMENSION_KEYS, ONTOLOGY, type DimensionKey } from './ontology';
import { checkQuote, QUOTE_LABEL } from './quote';
import type { Judgement, Rating } from './schema';
import type { Sentence } from './segment';

export interface AiJudgement {
  judgements: Judgement[];
  summary: string;
  model: string;
  at: string;
  missing: string[];
}
export interface EssayRecord {
  id: string;
  createdAt: string;
  filmId: string;
  /** 학생 표시(이름 대신 '학생 1' 같은 가명) */
  label: string;
  text: string;
  sentences: Sentence[];
  ai?: AiJudgement;
  /** 사람 평정자 이름 → 문장 id → 판정 */
  ratings: Record<string, Record<string, Rating>>;
}

const KEY = 'film-appreciation-meter:essays';
export const AI_RATER = 'AI(Gemini)';

export function loadEssays(): EssayRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    const xs = raw ? (JSON.parse(raw) as EssayRecord[]) : [];
    return Array.isArray(xs) ? xs.filter((x) => x && typeof x.id === 'string' && Array.isArray(x.sentences)).map((x) => ({ ...x, ratings: x.ratings ?? {} })) : [];
  } catch {
    return [];
  }
}
export function saveEssays(xs: EssayRecord[]): string | null {
  try {
    localStorage.setItem(KEY, JSON.stringify(xs));
    return null;
  } catch {
    return '브라우저 저장 공간에 저장하지 못했습니다. 연구 자료(JSON)를 내려받아 두세요.';
  }
}

export const raterNames = (xs: EssayRecord[]) => [...new Set(xs.flatMap((x) => Object.keys(x.ratings)))].sort((a, b) => a.localeCompare(b, 'ko'));

/** 연구 자료 내보내기: 판정과 사람 판정 전부 + 이때 쓴 온톨로지 판 */
export function exportJson(xs: EssayRecord[]): string {
  return JSON.stringify({ app: 'film-appreciation-meter', ontologyVersion: ONTOLOGY.version, exportedAt: new Date().toISOString(), essays: xs }, null, 2);
}

/** 가져오기: 같은 id면 사람 판정을 합치고(평정자별), AI 판정은 없을 때만 채운다 */
export function importJson(text: string, current: EssayRecord[]): { essays: EssayRecord[]; added: number; merged: number } {
  const data = JSON.parse(text) as { app?: string; essays?: EssayRecord[] };
  if (data.app !== 'film-appreciation-meter' || !Array.isArray(data.essays)) throw new Error('이 프로그램에서 내보낸 연구 자료(JSON)가 아닙니다.');
  const out = current.map((x) => ({ ...x, ratings: { ...x.ratings } }));
  let added = 0;
  let merged = 0;
  for (const e of data.essays) {
    if (!e || typeof e.id !== 'string' || !Array.isArray(e.sentences)) continue;
    const i = out.findIndex((x) => x.id === e.id);
    if (i < 0) {
      out.push({ ...e, ratings: e.ratings ?? {} });
      added++;
    } else {
      out[i] = { ...out[i], ai: out[i].ai ?? e.ai, ratings: { ...out[i].ratings, ...(e.ratings ?? {}) } };
      merged++;
    }
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { essays: out, added, merged };
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** 문장 하나에 한 줄: 엑셀·SPSS·R에서 바로 분석할 수 있게 */
export function toCsv(xs: EssayRecord[]): string {
  const raters = raterNames(xs);
  const head = ['감상문', '영화', '문장id', '문장', 'AI 주 차원', 'AI 보조 차원', 'AI 지표', 'AI 근거 인용', '인용 대조', ...raters.flatMap((r) => [`${r} 주 차원`, `${r} 보조 차원`])];
  const rows = [head];
  for (const e of xs) {
    const film = ONTOLOGY.films.find((f) => f.id === e.filmId)?.title ?? e.filmId;
    for (const s of e.sentences) {
      const j = e.ai?.judgements.find((x) => x.id === s.id);
      rows.push([
        e.label,
        film,
        s.id,
        s.text,
        j?.primary ?? '',
        j?.secondary ?? '',
        j?.indicator ?? '',
        j?.quote ?? '',
        j && j.quote ? QUOTE_LABEL[checkQuote(j.quote, s.text)] : '',
        ...raters.flatMap((r) => [e.ratings[r]?.[s.id]?.primary ?? '', e.ratings[r]?.[s.id]?.secondary ?? '']),
      ]);
    }
  }
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export const isDim = (x: unknown): x is DimensionKey => (DIMENSION_KEYS as readonly unknown[]).includes(x);
