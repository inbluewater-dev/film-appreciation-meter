// 영화 감상 측정기 — 감상문 → 문장 나누기 → 온톨로지 지표로 AI 판정(근거 인용 대조) → 감상 프로파일 → 사람 판정과 일치도
import { useMemo, useRef, useState } from 'react';
import { AgreementView } from './components/AgreementView';
import { Cabinet } from './components/Cabinet';
import { DimChip } from './components/Chip';
import { CriteriaView } from './components/CriteriaView';
import { RatingTable } from './components/RatingTable';
import { SentenceTable } from './components/SentenceTable';
import { DEFAULT_MODEL, MODELS, runJudge, type GenerateFn, type ModelId } from './lib/ai/core';
import { mockGenerate } from './lib/ai/mock';
import { config } from './lib/config';
import { downloadBlob, safeName, svgString, svgToPng } from './lib/download';
import { ONTOLOGY } from './lib/ontology';
import { profileOf, promptsFor } from './lib/profile';
import { MAX_ESSAY_CHARS } from './lib/prompt';
import { checkQuote } from './lib/quote';
import { SAMPLE_ESSAYS } from './lib/samples';
import type { Rating } from './lib/schema';
import { splitSentences } from './lib/segment';
import { exportJson, importJson, loadEssays, raterNames, saveEssays, toCsv, type EssayRecord } from './lib/storage';

type Tab = 'profile' | 'sentences' | 'rate' | 'agreement' | 'criteria';
const TABS: { id: Tab; label: string; needsEssay: boolean }[] = [
  { id: 'profile', label: '감상 프로파일', needsEssay: true },
  { id: 'sentences', label: '문장별 판정', needsEssay: true },
  { id: 'rate', label: '사람 판정', needsEssay: true },
  { id: 'agreement', label: '일치도', needsEssay: true },
  { id: 'criteria', label: '판정 기준(온톨로지)', needsEssay: false },
];
const primary = 'rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50';
const secondary = 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50';

async function generator(): Promise<GenerateFn> {
  if (config.aiMode !== 'gemini') return mockGenerate;
  try {
    return (await import('./lib/ai/gemini')).geminiGenerate;
  } catch {
    throw new Error('사이트가 새 버전으로 바뀌었습니다. 새로고침(F5)한 뒤 다시 눌러 주세요.');
  }
}

export default function App() {
  const [essays, setEssaysState] = useState<EssayRecord[]>(() => loadEssays());
  const [currentId, setCurrentId] = useState<string | null>(() => loadEssays()[0]?.id ?? null);
  const [filmId, setFilmId] = useState(ONTOLOGY.films[0]?.id ?? '');
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [rater, setRater] = useState(() => raterNames(loadEssays())[0] ?? '연구자');
  const cabinetRef = useRef<SVGSVGElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  const film = ONTOLOGY.films.find((f) => f.id === filmId) ?? ONTOLOGY.films[0];
  const current = essays.find((e) => e.id === currentId) ?? null;
  const preview = useMemo(() => splitSentences(text), [text]);
  const raters = raterNames(essays);
  const profile = useMemo(() => (current?.ai ? profileOf(current.ai.judgements) : null), [current]);
  const currentFilm = current ? (ONTOLOGY.films.find((f) => f.id === current.filmId) ?? film) : film;
  const quoteStats = useMemo(() => {
    const s = { exact: 0, partial: 0, missing: 0 };
    if (current?.ai) for (const j of current.ai.judgements) if (j.quote) s[checkQuote(j.quote, current.sentences.find((x) => x.id === j.id)?.text ?? '')]++;
    return s;
  }, [current]);

  const setEssays = (xs: EssayRecord[]) => {
    setEssaysState(xs);
    const err = saveEssays(xs);
    if (err) setError(err);
  };
  const nextLabel = () => {
    for (let i = essays.length + 1; ; i++) if (!essays.some((e) => e.label === `학생 ${i}`)) return `학생 ${i}`;
  };

  async function judge() {
    setError(null);
    setNotice(null);
    const sentences = splitSentences(text.slice(0, MAX_ESSAY_CHARS));
    if (!sentences.length) return;
    setBusy(`AI가 ${sentences.length}문장을 판정하는 중… (30초쯤 걸립니다)`);
    try {
      const r = await runJudge(await generator(), { film, sentences, model }, { onStatus: setBusy });
      const rec: EssayRecord = {
        id: String(Date.now()),
        createdAt: new Date().toISOString(),
        filmId: film.id,
        label: label.trim() || nextLabel(),
        text,
        sentences,
        ai: { judgements: r.result.judgements, summary: r.result.summary, model: config.aiMode === 'gemini' ? r.model : 'mock', at: new Date().toISOString(), missing: r.missing },
        ratings: {},
      };
      setEssays([rec, ...essays]);
      setCurrentId(rec.id);
      setTab('profile');
      setText('');
      setLabel('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function rate(sid: string, r: Rating | null) {
    if (!current) return;
    const mine = { ...(current.ratings[rater] ?? {}) };
    if (r) mine[sid] = r;
    else delete mine[sid];
    setEssays(essays.map((e) => (e.id === current.id ? { ...e, ratings: { ...e.ratings, [rater]: mine } } : e)));
  }

  async function exportFig(kind: 'png' | 'svg') {
    const svg = cabinetRef.current;
    if (!svg || !current) return;
    const name = `${safeName(current.label)}_감상프로파일`;
    if (kind === 'svg') downloadBlob(`${name}.svg`, new Blob([svgString(svg)], { type: 'image/svg+xml' }));
    else downloadBlob(`${name}.png`, await svgToPng(svg));
  }

  function onImport(f: File) {
    setError(null);
    f.text()
      .then((t) => {
        const r = importJson(t, essays);
        setEssays(r.essays);
        setNotice(`가져오기: 새 감상문 ${r.added}편, 사람 판정을 합친 감상문 ${r.merged}편`);
        if (!currentId && r.essays[0]) setCurrentId(r.essays[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  const len = text.length;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[100rem] flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-4">
          <h1 className="text-xl font-bold">영화 감상 측정기</h1>
          <p className="text-sm text-slate-600">감상문의 문장마다 지각·이해·해석·평가(네 서랍)와 향유·참여를 판정해 감상 프로파일을 그리고, 사람 판정과의 일치도를 잽니다.</p>
        </div>
        {config.aiMode === 'mock' && <p className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">샘플 모드 — 실제 AI 대신 낱말 규칙으로 흉내 낸 판정을 보여 줍니다</p>}
      </header>

      <main className="mx-auto grid max-w-[100rem] gap-6 px-4 py-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">1. 영화</h2>
            <select aria-label="영화" value={film.id} onChange={(e) => setFilmId(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              {ONTOLOGY.films.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} ({f.director}, {f.year})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              {film.rating} · {film.runtimeMinutes}분 · 학생에게 줄 발문: “{film.prompts.find((p) => !p.targets)?.text}”
            </p>
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">2. 감상문</h2>
            <label className="block">
              <span className="text-sm text-slate-600">학생 표시 (이름 대신)</span>
              <input aria-label="학생 표시" value={label} maxLength={20} onChange={(e) => setLabel(e.target.value)} placeholder={nextLabel()} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm text-slate-600">감상문 붙여 넣기</span>
              <textarea aria-label="감상문" rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder="학생이 쓴 감상문을 그대로 붙여 넣으세요" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <p className="text-xs text-slate-500">
              {preview.length}문장으로 나뉩니다 · {len.toLocaleString()}자{len > MAX_ESSAY_CHARS && <span className="text-amber-700"> · 앞 {MAX_ESSAY_CHARS.toLocaleString()}자만 판정</span>}
            </p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="text-slate-500">가상 감상문:</span>
              {SAMPLE_ESSAYS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  title={s.note}
                  className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-100"
                  onClick={() => {
                    setText(s.text);
                    setLabel(s.label);
                  }}
                >
                  {s.label.replace('가상 감상문 ', '')}
                </button>
              ))}
            </div>
            {config.aiMode === 'gemini' && (
              <label className="block">
                <span className="text-sm text-slate-600">AI 모델</span>
                <select aria-label="AI 모델" value={model} onChange={(e) => setModel(e.target.value as ModelId)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                  {(Object.keys(MODELS) as ModelId[]).map((m) => (
                    <option key={m} value={m}>
                      {MODELS[m]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="button" className={`${primary} w-full`} disabled={!!busy || preview.length === 0} onClick={judge}>
              {busy ? '판정 중…' : '판정하기'}
            </button>
            {busy && (
              <p role="status" className="text-sm text-indigo-800">
                {busy}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <p className="text-xs text-slate-500">감상문은 AI(Google Gemini 무료 등급)로 보내지며 Google 제품 개선에 쓰일 수 있습니다. 학생 이름·학교 등 개인정보는 지우고 넣으세요. 가상 감상문은 설계용으로 새로 쓴 글입니다.</p>
          </section>

          {essays.length > 0 && (
            <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-semibold">저장된 감상문 ({essays.length}) <span className="text-xs font-normal text-slate-500">이 브라우저</span></h2>
              <ul className="space-y-1.5 text-sm" aria-label="저장된 감상문">
                {essays.map((e) => {
                  const p = e.ai ? profileOf(e.ai.judgements) : null;
                  return (
                    <li key={e.id} className={`flex items-center gap-2 rounded-md px-1.5 py-1 ${e.id === currentId ? 'bg-indigo-50' : ''}`}>
                      <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => setCurrentId(e.id)}>
                        {e.label}
                      </button>
                      <span className="flex shrink-0 gap-0.5">
                        {p?.openedLayers.map((k) => (
                          <span key={k} className="h-2.5 w-2.5 rounded-sm" style={{ background: ONTOLOGY.dimensions.find((d) => d.key === k)?.color }} title={k} />
                        ))}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400" title="사람 평정자 수">
                        사람 {Object.keys(e.ratings).filter((r) => Object.keys(e.ratings[r]).length).length}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-slate-400 hover:text-red-700"
                        aria-label={`${e.label} 지우기`}
                        onClick={() => {
                          const rest = essays.filter((x) => x.id !== e.id);
                          setEssays(rest);
                          if (currentId === e.id) setCurrentId(rest[0]?.id ?? null);
                        }}
                      >
                        지우기
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">연구 자료</h2>
            <p className="text-xs text-slate-500">다른 평정자에게 파일을 보내 판정을 받은 뒤 다시 가져오면, 사람 판정이 평정자별로 합쳐집니다.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondary} disabled={!essays.length} onClick={() => downloadBlob(`영화감상측정_연구자료_${new Date().toISOString().slice(0, 10)}.json`, new Blob([exportJson(essays)], { type: 'application/json' }))}>
                JSON 내보내기
              </button>
              <button type="button" className={secondary} onClick={() => importRef.current?.click()}>
                JSON 가져오기
              </button>
              <button type="button" className={secondary} disabled={!essays.length} onClick={() => downloadBlob(`영화감상측정_문장별판정_${new Date().toISOString().slice(0, 10)}.csv`, new Blob([toCsv(essays)], { type: 'text/csv' }))}>
                CSV (엑셀)
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                aria-label="연구 자료 가져오기"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                  e.target.value = '';
                }}
              />
            </div>
            {notice && <p className="text-xs text-emerald-800">{notice}</p>}
          </section>
        </aside>

        <section className="min-w-0 space-y-4">
          {current && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-bold">{current.label}</h2>
              <p className="text-xs text-slate-500">
                &lt;{currentFilm.title}&gt; · 문장 {current.sentences.length}개 · {current.ai ? `판정 ${current.ai.model === 'mock' ? '샘플' : current.ai.model}` : '판정 없음'} · {new Date(current.createdAt).toLocaleString('ko-KR')}
              </p>
              {current.ai && (
                <>
                  <p className="mt-2 text-slate-800">{current.ai.summary}</p>
                  <p className="mt-1 text-xs text-slate-500" data-testid="quote-stats">
                    근거 인용 대조 — 문장에 있음 {quoteStats.exact} · 부분 일치 {quoteStats.partial} · 문장에 없음 {quoteStats.missing}
                    {current.ai.missing.length > 0 && <span className="text-amber-700"> · AI가 판정하지 않아 ‘기타’로 둔 문장: {current.ai.missing.join(', ')}</span>}
                  </p>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1" role="tablist">
              {TABS.filter((t) => current || !t.needsEssay).map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`rounded-md px-3 py-1.5 text-sm ${tab === t.id ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white hover:bg-slate-100'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'profile' && current?.ai && (
              <div className="flex gap-2">
                <button type="button" className={secondary} onClick={() => exportFig('png')}>
                  PNG
                </button>
                <button type="button" className={secondary} onClick={() => exportFig('svg')}>
                  SVG
                </button>
              </div>
            )}
          </div>

          {!current && tab !== 'criteria' && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              <p>왼쪽에 감상문을 넣고 ‘판정하기’를 누르세요. 가상 감상문 A~D로 바로 시험할 수 있습니다.</p>
              <p className="mt-1 text-sm">결과: 감상 프로파일(네 서랍과 향유·참여), 문장별 판정과 근거, 사람 판정과의 일치도(Cohen’s κ). 판정 기준은 ‘판정 기준(온톨로지)’ 탭에서 볼 수 있습니다.</p>
            </div>
          )}

          {tab === 'profile' && current && profile && (
            <div className="space-y-4">
              <Cabinet ref={cabinetRef} profile={profile} title={current.label} subtitle={`<${currentFilm.title}>(${currentFilm.director}, ${currentFilm.year}) 감상문 · 온톨로지 v${ONTOLOGY.version}`} />
              {profile.closedLayers.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm" data-testid="next-prompts">
                  <h3 className="font-semibold">열지 않은 서랍을 여는 발문</h3>
                  <p className="text-xs text-slate-500">온톨로지에 적어 둔 발문 가운데, 이 감상문이 열지 않은 서랍을 겨냥한 것입니다(AI가 만든 것이 아님).</p>
                  <ul className="mt-2 space-y-1.5">
                    {promptsFor(currentFilm, profile.closedLayers).map((p) => (
                      <li key={p.order} className="flex flex-wrap items-start gap-2">
                        {p.targets && <DimChip k={p.targets} />}
                        <span className="min-w-0 flex-1">{p.text}</span>
                        {p.source && <span className="text-xs text-slate-400">{p.source}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {tab === 'sentences' && current?.ai && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <SentenceTable sentences={current.sentences} judgements={current.ai.judgements} />
            </div>
          )}
          {tab === 'rate' && current && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <RatingTable sentences={current.sentences} ai={current.ai?.judgements} raters={raters} rater={rater} onRater={setRater} ratings={current.ratings[rater] ?? {}} onRate={rate} />
            </div>
          )}
          {tab === 'agreement' && current && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <AgreementView essays={essays} current={current} />
            </div>
          )}
          {tab === 'criteria' && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <CriteriaView film={currentFilm} />
            </div>
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-[100rem] px-4 pb-8 text-xs text-slate-500">
        판정은 온톨로지의 판정 지표를 따른 AI 초안이며 교사가 확인합니다. 본보기: Purves & Rippere(1968), PISA 2018 읽기 채점 지침의 꼴. 판정 기준 근거: 「영화와 삶」·「영화 감상과 비평」(2022 개정). · 디지털도서관연구 기말 프로그램
      </footer>
    </div>
  );
}


