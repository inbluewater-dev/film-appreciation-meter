// 일치도 — 프로그램의 판정이 사람의 판정과 얼마나 맞는가 (교수님 조건 ④: 검증이 논문이 되는 자리)
import { useMemo, useState } from 'react';
import { agreement, consensus, kappaLabel, type Pair } from '../lib/agreement';
import { DIMENSION_KEYS, colorOf, type DimensionKey } from '../lib/ontology';
import { AI_RATER, raterNames, type EssayRecord } from '../lib/storage';
import { DimChip } from './Chip';

const CONSENSUS = '사람 합의';
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const k3 = (k: number | null) => (k === null ? '—' : k.toFixed(2));

function labelOf(e: EssayRecord, sid: string, who: string): DimensionKey | null {
  if (who === AI_RATER) return e.ai?.judgements.find((j) => j.id === sid)?.primary ?? null;
  if (who === CONSENSUS) {
    const rs = Object.keys(e.ratings).filter((r) => Object.keys(e.ratings[r]).length > 0);
    return rs.length >= 2 ? consensus(rs.map((r) => e.ratings[r][sid]?.primary)) : null;
  }
  return e.ratings[who]?.[sid]?.primary ?? null;
}

export function AgreementView({ essays, current }: { essays: EssayRecord[]; current: EssayRecord }) {
  const raters = raterNames(essays);
  const sources = [AI_RATER, ...raters, ...(raters.length >= 2 ? [CONSENSUS] : [])];
  const [a, setA] = useState(AI_RATER);
  const [b, setB] = useState(raters.length >= 2 ? CONSENSUS : (raters[0] ?? ''));
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const bb = sources.includes(b) ? b : (sources.find((s) => s !== a) ?? '');

  const { pairs, rows } = useMemo(() => {
    const pairs: Pair[] = [];
    const rows: { essay: string; sid: string; text: string; a: DimensionKey; b: DimensionKey }[] = [];
    for (const e of scope === 'current' ? [current] : essays)
      for (const s of e.sentences) {
        const la = labelOf(e, s.id, a);
        const lb = labelOf(e, s.id, bb);
        if (la && lb) {
          pairs.push({ a: la, b: lb });
          rows.push({ essay: e.label, sid: s.id, text: s.text, a: la, b: lb });
        }
      }
    return { pairs, rows };
  }, [essays, current, a, bb, scope]);
  const r = agreement(pairs);
  const disagree = rows.filter((x) => x.a !== x.b);
  const Sel = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <label className="block">
      <span className="text-xs text-slate-600">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
        {sources.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );

  if (!raters.length)
    return (
      <div className="space-y-2 text-sm text-slate-600" data-testid="agreement">
        <p>아직 사람 판정이 없습니다. ‘사람 판정’ 탭에서 같은 문장을 직접 판정하면, 프로그램의 판정과 얼마나 맞는지 여기서 잽니다.</p>
        <p className="text-xs text-slate-500">설계: 프로그램·연구자·다른 교사가 같은 감상문을 따로 판정하고, 사람 판정은 2명 이상 합의한 문장만 기준값으로 씁니다. 일치도는 Cohen의 κ로 잽니다.</p>
      </div>
    );

  return (
    <div className="space-y-5 text-sm" data-testid="agreement">
      <div className="flex flex-wrap items-end gap-3">
        <Sel label="비교 A" value={a} onChange={setA} />
        <Sel label="비교 B" value={bb} onChange={setB} />
        <label className="block">
          <span className="text-xs text-slate-600">범위</span>
          <select aria-label="범위" value={scope} onChange={(e) => setScope(e.target.value as 'current' | 'all')} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5">
            <option value="current">이 감상문 ({current.sentences.length}문장)</option>
            <option value="all">저장된 감상문 전체 ({essays.length}편)</option>
          </select>
        </label>
      </div>
      {bb === CONSENSUS && <p className="text-xs text-slate-500">사람 합의 = 그 감상문을 판정한 사람 평정자 모두가 같은 주 차원을 준 문장만 씁니다(Purves의 절차).</p>}

      {!pairs.length ? (
        <p className="text-slate-600">두 쪽이 모두 판정한 문장이 없습니다.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">비교한 문장</p>
              <p className="text-2xl font-bold">{r.overall.n}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">주 차원 일치율</p>
              <p className="text-2xl font-bold" data-testid="observed">
                {pct(r.overall.observed)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Cohen’s κ (6범주)</p>
              <p className="text-2xl font-bold" data-testid="kappa">
                {k3(r.overall.kappa)} <span className="text-sm font-normal text-slate-600">{kappaLabel(r.overall.kappa)}</span>
              </p>
            </div>
          </div>
          {r.overall.n < 30 && <p className="text-xs text-amber-700">문장이 {r.overall.n}개뿐이라 κ가 크게 흔들릴 수 있습니다. 감상문을 더 모아 ‘저장된 감상문 전체’로 보세요.</p>}

          <div>
            <h3 className="mb-2 font-semibold">차원별 일치도 (그 차원인가 아닌가)</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse" data-testid="per-dim">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
                    <th className="py-1.5">차원</th>
                    <th className="py-1.5">A가 준 문장</th>
                    <th className="py-1.5">B가 준 문장</th>
                    <th className="py-1.5">κ</th>
                    <th className="py-1.5">해석</th>
                  </tr>
                </thead>
                <tbody>
                  {r.perDim.map((d) => (
                    <tr key={d.key} className="border-b border-slate-100">
                      <td className="py-1.5">
                        <DimChip k={d.key} />
                      </td>
                      <td className="py-1.5">{pairs.filter((p) => p.a === d.key).length}</td>
                      <td className="py-1.5">{pairs.filter((p) => p.b === d.key).length}</td>
                      <td className="py-1.5 font-semibold">{d.used ? k3(d.kappa) : '—'}</td>
                      <td className="py-1.5 text-slate-600">{d.used ? kappaLabel(d.kappa) : '둘 다 쓰지 않음'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-slate-500">해석 기준: Landis & Koch(1977) — 0.2 이하 미미, 0.4 이하 약함, 0.6 이하 보통, 0.8 이하 상당, 그 위 거의 완전.</p>
          </div>

          <div>
            <h3 className="mb-2 font-semibold">혼동표 (행 = {a}, 열 = {bb})</h3>
            <div className="overflow-x-auto">
              <table className="border-collapse text-center text-xs" data-testid="matrix">
                <thead>
                  <tr>
                    <th className="p-1.5" />
                    {DIMENSION_KEYS.map((k) => (
                      <th key={k} className="p-1.5" style={{ color: colorOf(k) }}>
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DIMENSION_KEYS.map((ra, i) => (
                    <tr key={ra}>
                      <th className="p-1.5 text-right" style={{ color: colorOf(ra) }}>
                        {ra}
                      </th>
                      {DIMENSION_KEYS.map((rb, j) => {
                        const v = r.matrix[i][j];
                        return (
                          <td key={rb} className={`h-9 w-14 border border-slate-200 ${i === j ? 'font-bold' : ''}`} style={{ background: v ? (i === j ? '#dcfce7' : '#fee2e2') : '#fff' }}>
                            {v || ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-semibold">판정이 갈린 문장 ({disagree.length})</h3>
            {disagree.length ? (
              <ul className="space-y-1.5">
                {disagree.slice(0, 40).map((x, i) => (
                  <li key={i} className="flex flex-wrap items-start gap-2">
                    <span className="text-xs text-slate-400">
                      {x.essay} {x.sid}
                    </span>
                    <span className="min-w-0 flex-1 text-slate-800">{x.text}</span>
                    <span className="text-xs text-slate-500">A</span>
                    <DimChip k={x.a} />
                    <span className="text-xs text-slate-500">B</span>
                    <DimChip k={x.b} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">모든 문장이 일치합니다.</p>
            )}
            <p className="mt-2 text-xs text-slate-500">갈린 문장은 판정 지표를 다듬는 재료입니다. 지표의 예시 진술로 옮겨 온톨로지를 고치면 다음 판정에 반영됩니다.</p>
          </div>
        </>
      )}
    </div>
  );
}
