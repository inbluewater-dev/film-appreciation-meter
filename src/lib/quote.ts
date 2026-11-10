// 근거 인용 대조 — AI가 판정의 근거로 든 구절이 그 문장에 정말 있는지 프로그램이 확인한다
export type QuoteStatus = 'exact' | 'partial' | 'missing';
export const QUOTE_LABEL: Record<QuoteStatus, string> = { exact: '문장에 있음', partial: '부분 일치', missing: '문장에 없음' };

export function normalize(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[·ㆍ・]/g, '·')
    .replace(/[\s ​]+/g, '')
    .toLowerCase();
}

function longestCommon(hay: string, needle: string): number {
  let best = 0;
  const m = needle.length;
  let prev = new Uint16Array(m + 1);
  let cur = new Uint16Array(m + 1);
  for (let i = 1; i <= hay.length; i++) {
    for (let j = 1; j <= m; j++) {
      cur[j] = hay.charCodeAt(i - 1) === needle.charCodeAt(j - 1) ? prev[j - 1] + 1 : 0;
      if (cur[j] > best) best = cur[j];
    }
    [prev, cur] = [cur, prev];
    cur.fill(0);
  }
  return best;
}

/** 인용이 문장 안에 그대로 있으면 exact, 70% 이상 이어서 같으면 partial */
export function checkQuote(quote: string, sentence: string): QuoteStatus {
  const q = normalize(quote);
  const s = normalize(sentence);
  if (q.length < 2) return 'missing';
  if (s.includes(q)) return 'exact';
  return longestCommon(s, q) >= Math.max(2, Math.floor(q.length * 0.7)) ? 'partial' : 'missing';
}
