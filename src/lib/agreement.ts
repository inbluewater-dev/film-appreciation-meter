// 일치도 — 같은 문장들을 두 평정자가 판정했을 때 얼마나 같은가 (Cohen, 1960의 κ)
// 해석 기준: Landis & Koch(1977)
import { DIMENSION_KEYS, type DimensionKey } from './ontology';

export interface Pair {
  a: DimensionKey;
  b: DimensionKey;
}

export interface KappaResult {
  n: number;
  observed: number;
  expected: number;
  /** p_e = 1 이면 정의되지 않음(null) */
  kappa: number | null;
}

export function cohenKappa<T extends string>(pairs: { a: T; b: T }[], categories: readonly T[]): KappaResult {
  const n = pairs.length;
  if (!n) return { n, observed: 0, expected: 0, kappa: null };
  let agree = 0;
  const ca = new Map<T, number>();
  const cb = new Map<T, number>();
  for (const p of pairs) {
    if (p.a === p.b) agree++;
    ca.set(p.a, (ca.get(p.a) ?? 0) + 1);
    cb.set(p.b, (cb.get(p.b) ?? 0) + 1);
  }
  const po = agree / n;
  const pe = categories.reduce((s, c) => s + ((ca.get(c) ?? 0) / n) * ((cb.get(c) ?? 0) / n), 0);
  return { n, observed: po, expected: pe, kappa: pe >= 1 - 1e-12 ? null : (po - pe) / (1 - pe) };
}

/** 주 차원 전체(6범주) κ + 차원별 κ(그 차원인가 아닌가, 2범주) + 혼동표 */
export function agreement(pairs: Pair[]) {
  const overall = cohenKappa(pairs, DIMENSION_KEYS);
  const perDim = DIMENSION_KEYS.map((k) => {
    const bin = pairs.map((p) => ({ a: p.a === k ? '예' : '아니오', b: p.b === k ? '예' : '아니오' }));
    const used = pairs.some((p) => p.a === k || p.b === k);
    return { key: k, used, ...cohenKappa(bin, ['예', '아니오'] as const) };
  });
  const matrix = DIMENSION_KEYS.map((ra) => DIMENSION_KEYS.map((rb) => pairs.filter((p) => p.a === ra && p.b === rb).length));
  return { overall, perDim, matrix };
}

export function kappaLabel(k: number | null): string {
  if (k === null) return '계산 불가';
  if (k < 0) return '우연보다 낮음';
  if (k <= 0.2) return '미미함';
  if (k <= 0.4) return '약함';
  if (k <= 0.6) return '보통';
  if (k <= 0.8) return '상당함';
  return '거의 완전함';
}

/** 사람 평정자가 둘 이상일 때: 모두 같은 주 차원을 준 문장만 '합의' 기준값으로 쓴다(Purves의 절차) */
export function consensus(ratings: (DimensionKey | undefined)[]): DimensionKey | null {
  const xs = ratings.filter((x): x is DimensionKey => !!x);
  if (xs.length < 2 || xs.length !== ratings.length) return null;
  return xs.every((x) => x === xs[0]) ? xs[0] : null;
}
