// 판정 기준 — 프로그램이 AI에게 주는 지침의 원천인 온톨로지를 그대로 보여 준다
import { downloadBlob } from '../lib/download';
import { ONTOLOGY, ONTOLOGY_TTL, type Film } from '../lib/ontology';
import { DimChip } from './Chip';

export function CriteriaView({ film }: { film: Film }) {
  return (
    <div className="space-y-6 text-sm" data-testid="criteria">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-slate-600">
          영화 감상 능력 측정 온톨로지 v{ONTOLOGY.version} ({ONTOLOGY.modified}) · 트리플 {ONTOLOGY.tripleCount}개. AI는 아래 지표와 예시만 보고 판정합니다. 지표를 고치려면 TTL 파일을 고칩니다.
        </p>
        <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100" onClick={() => downloadBlob('film-appreciation.ttl', new Blob([ONTOLOGY_TTL], { type: 'text/turtle' }))}>
          TTL 내려받기
        </button>
      </div>
      {ONTOLOGY.dimensions.map((d) => (
        <section key={d.key} className="rounded-lg border border-slate-200 p-4" style={{ borderLeft: `5px solid ${d.color}` }}>
          <h3 className="flex flex-wrap items-center gap-2 font-semibold">
            <DimChip k={d.key} />
            <span className="text-xs font-normal text-slate-500">
              {d.isLayer ? '층(서랍)' : d.key === '기타' ? '어느 차원도 열지 않음' : '층 밖 — 프로파일에 따로 표시'}
              {d.purves && ` · Purves ${d.purves.code} ${d.purves.label}`}
            </span>
          </h3>
          <p className="mt-1 text-slate-700">{d.comment}</p>
          {d.indicators.map((ind) => (
            <div key={ind.id} className="mt-3 space-y-1.5">
              <p>
                <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{ind.id}</span>
                <b>판정 규칙:</b> {ind.rule}
              </p>
              {ind.sources.map((s, i) => (
                <p key={i} className="text-xs text-slate-500">
                  근거: {s}
                </p>
              ))}
              <ul className="space-y-1">
                {ind.examples.map((e, i) => (
                  <li key={i} className="text-xs">
                    <span className="mr-1 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900">연 예</span>“{e.text}” <span className="text-slate-400">{e.source ?? e.origin}</span>
                    {e.note && <span className="block pl-10 text-slate-500">{e.note}</span>}
                  </li>
                ))}
                {ind.nearMisses.map((e, i) => (
                  <li key={i} className="text-xs">
                    <span className="mr-1 rounded bg-rose-100 px-1.5 py-0.5 text-rose-900">열지 않은 예</span>“{e.text}” <span className="text-slate-400">{e.source ?? e.origin}</span>
                    <span className="block pl-[5.5rem] text-slate-500">→ {e.whyNot}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold">
          자극: &lt;{film.title}&gt; ({film.director}, {film.year}{film.rating ? `, ${film.rating}` : ''}{film.runtimeMinutes ? `, ${film.runtimeMinutes}분` : ''})
        </h3>
        {film.synopsis && (
          <p className="mt-1 text-slate-700">
            {film.synopsis} <span className="text-xs text-slate-400">({film.synopsisSource})</span>
          </p>
        )}
        <h4 className="mt-3 text-xs font-semibold text-slate-500">발문</h4>
        <ol className="mt-1 space-y-1">
          {film.prompts.map((p) => (
            <li key={p.order} className="flex flex-wrap items-start gap-2">
              <span className="text-xs text-slate-400">{p.order}.</span>
              <span className="min-w-0 flex-1">{p.text}</span>
              {p.targets ? <DimChip k={p.targets} faint /> : <span className="text-xs text-slate-500">측정 본체(차원 정하지 않음)</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
