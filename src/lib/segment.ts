// 감상문을 문장(판정 단위)으로 나눈다 — 프로그램과 사람이 같은 단위를 판정해야 일치도를 잴 수 있으므로
// AI가 아니라 프로그램이 규칙으로 나눈다.
export interface Sentence {
  id: string;
  text: string;
}

/** 문장 끝: . ! ? … (뒤에 닫는 따옴표·괄호가 붙을 수 있음) 다음의 공백, 또는 줄바꿈 */
const END = /([.!?…。]+["'”’」』)\]]*)\s+/g;

export function splitSentences(essay: string): Sentence[] {
  const out: string[] = [];
  for (const line of essay.replace(/\r\n?/g, '\n').split(/\n+/)) {
    const t = line.trim();
    if (!t) continue;
    let last = 0;
    for (const m of t.matchAll(END)) {
      const end = (m.index ?? 0) + m[1].length;
      out.push(t.slice(last, end).trim());
      last = end;
    }
    out.push(t.slice(last).trim());
  }
  return out
    .filter((s) => s.replace(/[\s.!?…。"'”’」』)\]]/g, '').length > 0)
    .map((text, i) => ({ id: `S${i + 1}`, text }));
}
