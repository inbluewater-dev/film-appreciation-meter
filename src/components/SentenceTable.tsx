// 문장별 AI 판정 — 주·보조 차원, 적용한 지표, 까닭, 근거 인용이 그 문장에 정말 있는지
import { checkQuote, normalize, QUOTE_LABEL, type QuoteStatus } from '../lib/quote';
import type { Judgement } from '../lib/schema';
import type { Sentence } from '../lib/segment';
import { DimChip } from './Chip';

const TONE: Record<QuoteStatus, string> = { exact: 'bg-emerald-100 text-emerald-900', partial: 'bg-amber-100 text-amber-900', missing: 'bg-red-100 text-red-900' };

/** 인용 부분을 문장 안에서 강조 (띄어쓰기가 달라도 찾는다) */
function Highlight({ text, quote }: { text: string; quote: string }) {
  if (!quote) return <>{text}</>;
  const q = normalize(quote);
  // 문장 글자마다 비교용 위치를 만들어 원문 위치를 찾는다
  const map: number[] = [];
  let norm = '';
  for (let i = 0; i < text.length; i++) {
    const n = normalize(text[i]);
    for (const ch of n) {
      norm += ch;
      map.push(i);
    }
  }
  const p = norm.indexOf(q);
  if (p < 0) return <>{text}</>;
  const s = map[p];
  const e = map[p + q.length - 1] + 1;
  return (
    <>
      {text.slice(0, s)}
      <mark className="rounded bg-yellow-200 px-0.5">{text.slice(s, e)}</mark>
      {text.slice(e)}
    </>
  );
}

export function SentenceTable({ sentences, judgements }: { sentences: Sentence[]; judgements: Judgement[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm" data-testid="sentence-table">
        <thead>
          <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
            <th className="w-12 py-2 pr-2">문장</th>
            <th className="py-2 pr-3">내용 (노란 표시 = AI가 근거로 든 부분)</th>
            <th className="w-20 py-2 pr-2">주 차원</th>
            <th className="w-20 py-2 pr-2">보조</th>
            <th className="w-[34%] py-2">까닭 · 근거 대조</th>
          </tr>
        </thead>
        <tbody>
          {sentences.map((s) => {
            const j = judgements.find((x) => x.id === s.id);
            const st = j && j.quote ? checkQuote(j.quote, s.text) : null;
            return (
              <tr key={s.id} className="border-b border-slate-100 align-top" data-testid={`row-${s.id}`}>
                <td className="py-2 pr-2 text-xs font-semibold text-slate-500">{s.id}</td>
                <td className="py-2 pr-3 text-slate-800">{j ? <Highlight text={s.text} quote={st === 'exact' ? j.quote : ''} /> : s.text}</td>
                <td className="py-2 pr-2">{j && <DimChip k={j.primary} />}</td>
                <td className="py-2 pr-2">{j && <DimChip k={j.secondary} faint />}</td>
                <td className="py-2 text-xs text-slate-600">
                  {j?.reason}
                  {j?.indicator && <span className="mt-0.5 block text-slate-400">지표: {j.indicator}</span>}
                  {st && <span className={`mt-1 inline-block rounded px-1.5 py-0.5 font-medium ${TONE[st]}`}>근거 인용 {QUOTE_LABEL[st]}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
