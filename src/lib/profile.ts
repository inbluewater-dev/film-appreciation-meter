// 감상 프로파일 — 점수 하나가 아니라 '어느 서랍을 열었고 어느 서랍을 아직 열지 않았는가'
import { LAYERS, type DimensionKey, type Film, type PromptItem } from './ontology';

export interface DimCount {
  key: DimensionKey;
  primary: number;
  secondary: number;
  opened: boolean;
  /** 이 차원을 연 문장 id (주 또는 보조) */
  sentenceIds: string[];
}
export interface Profile {
  total: number;
  dims: Record<DimensionKey, DimCount>;
  openedLayers: DimensionKey[];
  closedLayers: DimensionKey[];
}

export function profileOf(judgements: { id: string; primary: DimensionKey; secondary: DimensionKey | '없음' }[]): Profile {
  const keys: DimensionKey[] = ['지각', '이해', '해석', '평가', '향유·참여', '기타'];
  const dims = Object.fromEntries(keys.map((k) => [k, { key: k, primary: 0, secondary: 0, opened: false, sentenceIds: [] as string[] }])) as Record<DimensionKey, DimCount>;
  for (const j of judgements) {
    dims[j.primary].primary++;
    dims[j.primary].sentenceIds.push(j.id);
    if (j.secondary !== '없음') {
      dims[j.secondary].secondary++;
      dims[j.secondary].sentenceIds.push(j.id);
    }
  }
  for (const k of keys) dims[k].opened = k !== '기타' && dims[k].primary + dims[k].secondary > 0;
  return {
    total: judgements.length,
    dims,
    openedLayers: LAYERS.filter((k) => dims[k].opened),
    closedLayers: LAYERS.filter((k) => !dims[k].opened),
  };
}

/** 열지 않은 서랍을 여는 발문 — 온톨로지의 발문(fam:targets) 가운데서 고른다(AI가 만들지 않는다) */
export function promptsFor(film: Film, closed: DimensionKey[]): PromptItem[] {
  return film.prompts.filter((p) => p.targets && closed.includes(p.targets));
}
