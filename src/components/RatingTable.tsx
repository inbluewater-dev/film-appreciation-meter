// 사람 판정 — 같은 문장을 평정자가 직접 판정한다. AI 판정은 기본으로 가려 두어 영향을 받지 않게 한다(눈가림).
import { useState } from 'react';
import { DIMENSION_KEYS, type DimensionKey } from '../lib/ontology';
import { SECONDARY_KEYS, type Judgement, type Rating } from '../lib/schema';
import type { Sentence } from '../lib/segment';
import { DimChip } from './Chip';

interface Props {
  sentences: Sentence[];
  ai?: Judgement[];
  raters: string[];
  rater: string;
  onRater: (r: string) => void;
  ratings: Record<string, Rating>;
  onRate: (sid: string, r: Rating | null) => void;
}

export function RatingTable({ sentences, ai, raters, rater, onRater, ratings, onRate }: Props) {
  const [hideAi, setHideAi] = useState(true);
  const [newName, setNewName] = useState('');
  const done = sentences.filter((s) => ratings[s.id]).length;
  const add = () => {
    const n = newName.trim().slice(0, 20);
    if (!n || n === 'AI(Gemini)') return;
    onRater(n);
    setNewName('');
  };
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-slate-600">평정자</span>
          <select aria-label="평정자" value={rater} onChange={(e) => onRater(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5">
            {!raters.includes(rater) && rater && <option value={rater}>{rater}</option>}
            {raters.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-1">
          <label className="block">
            <span className="text-xs text-slate-600">평정자 더하기</span>
            <input aria-label="새 평정자 이름" value={newName} maxLength={20} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="예: 교사 B" className="mt-1 block w-32 rounded-md border border-slate-300 px-2 py-1.5" />
          </label>
          <button type="button" className="rounded-md border border-slate-300 px-2 py-1.5 hover:bg-slate-100" onClick={add}>
            더하기
          </button>
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={hideAi} onChange={() => setHideAi(!hideAi)} /> AI 판정 가리기 (판정을 마친 뒤에 보세요)
        </label>
      </div>
      <p className="text-xs text-slate-500">
        ‘{rater}’ 판정 {done}/{sentences.length}문장. 판정 기준은 ‘판정 기준’ 탭의 지표와 예시를 따릅니다. 일치도는 주 차원끼리 비교합니다.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse" data-testid="rating-table">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
              <th className="w-12 py-2 pr-2">문장</th>
              <th className="py-2 pr-3">내용</th>
              <th className="w-32 py-2 pr-2">주 차원</th>
              <th className="w-32 py-2 pr-2">보조</th>
              {!hideAi && <th className="w-28 py-2">AI</th>}
            </tr>
          </thead>
          <tbody>
            {sentences.map((s) => {
              const r = ratings[s.id];
              const a = ai?.find((x) => x.id === s.id);
              return (
                <tr key={s.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-2 text-xs font-semibold text-slate-500">{s.id}</td>
                  <td className="py-2 pr-3 text-slate-800">{s.text}</td>
                  <td className="py-2 pr-2">
                    <select
                      aria-label={`${s.id} 주 차원`}
                      value={r?.primary ?? ''}
                      onChange={(e) => onRate(s.id, e.target.value ? { primary: e.target.value as DimensionKey, secondary: r?.secondary === e.target.value ? '없음' : (r?.secondary ?? '없음') } : null)}
                      className="w-full rounded-md border border-slate-300 bg-white px-1.5 py-1"
                    >
                      <option value="">—</option>
                      {DIMENSION_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      aria-label={`${s.id} 보조 차원`}
                      value={r?.secondary ?? '없음'}
                      disabled={!r || r.primary === '기타'}
                      onChange={(e) => r && onRate(s.id, { ...r, secondary: e.target.value as Rating['secondary'] })}
                      className="w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 disabled:opacity-40"
                    >
                      {SECONDARY_KEYS.filter((k) => k !== r?.primary).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </td>
                  {!hideAi && (
                    <td className="space-x-1 py-2">
                      {a && <DimChip k={a.primary} />}
                      {a && a.secondary !== '없음' && <DimChip k={a.secondary} faint />}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
