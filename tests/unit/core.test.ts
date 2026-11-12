import { describe, expect, it } from 'vitest';
import { agreement, cohenKappa, consensus, kappaLabel } from '../../src/lib/agreement';
import { DEFAULT_MODEL, runJudge, type GenerateFn } from '../../src/lib/ai/core';
import { mockGenerate } from '../../src/lib/ai/mock';
import { DIMENSION_KEYS, ONTOLOGY } from '../../src/lib/ontology';
import { profileOf, promptsFor } from '../../src/lib/profile';
import { buildPrompt } from '../../src/lib/prompt';
import { checkQuote } from '../../src/lib/quote';
import { SAMPLE_ESSAYS } from '../../src/lib/samples';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { JudgeResult, tidy, type Judgement } from '../../src/lib/schema';
import { splitSentences } from '../../src/lib/segment';
import { exportJson, importJson, toCsv, type EssayRecord } from '../../src/lib/storage';

const film = ONTOLOGY.films[0];

describe('온톨로지 읽기', () => {
  it('여섯 차원을 순서대로, 네 층과 층 밖을 가려 읽는다', () => {
    expect(ONTOLOGY.dimensions.map((d) => d.key)).toEqual([...DIMENSION_KEYS]);
    expect(ONTOLOGY.dimensions.filter((d) => d.isLayer).map((d) => d.key)).toEqual(['지각', '이해', '해석', '평가']);
    expect(ONTOLOGY.version).toBe('0.2');
    expect(ONTOLOGY.tripleCount).toBeGreaterThan(350);
  });
  it('차원마다 판정 지표·예시·출처가 붙는다', () => {
    const per = Object.fromEntries(ONTOLOGY.dimensions.map((d) => [d.key, d.indicators.length]));
    expect(per).toEqual({ 지각: 1, 이해: 1, 해석: 1, 평가: 1, '향유·참여': 1, 기타: 0 });
    const ev = ONTOLOGY.dimensions.find((d) => d.key === '평가')!.indicators[0];
    expect(ev.nearMisses[0].text).toBe('재미있었다.');
    expect(ev.nearMisses[0].whyNot).toContain('향유·참여');
    expect(ev.sources.some((s) => s.includes('영화 감상과 비평 p.40'))).toBe(true);
    expect(ONTOLOGY.dimensions.find((d) => d.key === '향유·참여')!.purves?.code).toBe('100');
  });
  it('영화 <우리들>과 장면 발문까지 일곱 발문을 읽는다', () => {
    expect(film.title).toBe('우리들');
    expect(film.runtimeMinutes).toBe(94);
    expect(film.prompts.map((p) => p.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(film.prompts.find((p) => p.order === 5)!.targets).toBe('지각');
    expect(film.synopsis).toContain('피구');
  });
  it('지시문에 온톨로지의 규칙·예시가 그대로 들어간다', () => {
    const p = buildPrompt(film, splitSentences('영화를 봤다. 재미있었다.'));
    expect(p).toContain('[지표 Indicator_지각_형식요소] 이 조건이면 연다: 카메라 거리·움직임');
    expect(p).toContain('열지 않은 예: "재미있었다."');
    expect(p).toContain('S2: 재미있었다.');
    expect(p).toContain(`v${ONTOLOGY.version}`);
  });
});

describe('문장 나누기', () => {
  it('문장 부호와 줄바꿈으로 나누고 따옴표를 붙여 둔다', () => {
    const s = splitSentences('선이 말했다. “금 안 밟았어!” 그래서 놀랐다?\n\n둘째 줄 마침표 없음\n…');
    expect(s.map((x) => x.text)).toEqual(['선이 말했다.', '“금 안 밟았어!”', '그래서 놀랐다?', '둘째 줄 마침표 없음']);
    expect(s.map((x) => x.id)).toEqual(['S1', 'S2', 'S3', 'S4']);
  });
  it('가상 감상문은 모두 나뉜다', () => {
    for (const e of SAMPLE_ESSAYS) expect(splitSentences(e.text).length).toBeGreaterThanOrEqual(3);
  });
});

describe('근거 인용 대조', () => {
  it('띄어쓰기가 달라도 문장 안이면 있음', () => {
    expect(checkQuote('카메라가선의 얼굴', '카메라가 선의 얼굴을 가까이 잡는다.')).toBe('exact');
    expect(checkQuote('카메라가 선의 얼굴을 멀리', '카메라가 선의 얼굴을 가까이 잡는다.')).toBe('partial');
    expect(checkQuote('음악이 슬펐다', '카메라가 선의 얼굴을 가까이 잡는다.')).toBe('missing');
  });
});

describe('판정 정리', () => {
  it('빠진 문장은 기타로 채우고 알려 주며, 보조가 주와 같으면 없음', () => {
    const ss = splitSentences('가. 나. 다.');
    const j = (id: string, p: Judgement['primary'], s: Judgement['secondary']): Judgement => ({ id, primary: p, secondary: s, indicator: '', quote: '', reason: '' });
    const t = tidy({ judgements: [j('S1', '이해', '이해'), j('S3', '기타', '평가')], summary: ' 요약 ' }, ss);
    expect(t.missing).toEqual(['S2']);
    expect(t.result.judgements.map((x) => [x.id, x.primary, x.secondary])).toEqual([['S1', '이해', '없음'], ['S2', '기타', '없음'], ['S3', '기타', '없음']]);
    expect(t.result.summary).toBe('요약');
  });
  it('지표 이름은 온톨로지에 있는 것만 받고, 주 차원과 어긋나면 바로잡는다', () => {
    const schema = JSON.stringify(zodToJsonSchema(JudgeResult));
    expect(schema).toContain('Indicator_이해_인물인과');
    expect(JudgeResult.safeParse({ judgements: [{ id: 'S1', primary: '이해', secondary: '없음', indicator: 'Indicator_이해_인과', quote: '', reason: '' }], summary: '' }).success).toBe(false);
    const ss = splitSentences('가. 나.');
    const t = tidy(
      {
        judgements: [
          { id: 'S1', primary: '이해', secondary: '없음', indicator: 'Indicator_향유_공감', quote: '', reason: '' },
          { id: 'S2', primary: '기타', secondary: '없음', indicator: 'Indicator_지각_형식요소', quote: '', reason: '' },
        ],
        summary: '',
      },
      ss,
    );
    expect(t.result.judgements.map((x) => x.indicator)).toEqual(['Indicator_이해_인물인과', '']);
  });
  it('지침에 열지 않은 예를 따르라는 규칙과 지표 목록이 들어간다', () => {
    const p = buildPrompt(film, splitSentences('지아는 나쁜 아이다.'));
    expect(p).toContain("'열지 않은 예'와 같은 종류의 문장은 그 지표의 차원으로 판정하지 않는다");
    expect(p).toContain('이름을 새로 만들지 않는다');
    expect(p).toContain('"지아는 나쁜 아이다." — 내용 서술이 아니라 판단');
  });
});

describe('판정 실행', () => {
  it('샘플 판정으로 감상문 B는 지각·평가 서랍을 연다', async () => {
    const r = await runJudge(mockGenerate, { film, sentences: splitSentences(SAMPLE_ESSAYS[1].text), model: DEFAULT_MODEL }, { sleep: async () => undefined });
    const p = profileOf(r.result.judgements);
    expect(p.dims['지각'].opened).toBe(true);
    expect(p.dims['평가'].opened).toBe(true);
    expect(r.missing).toEqual([]);
  });
  it('빠진 문장이 있으면 한 번 더 받는다', async () => {
    const ss = splitSentences('재미있었다. 카메라가 가까이 찍었다.');
    const prompts: string[] = [];
    const res = [
      { judgements: [{ id: 'S1', primary: '향유·참여', secondary: '없음', indicator: 'Indicator_향유_공감', quote: '재미있었다', reason: '' }], summary: '' },
      { judgements: [{ id: 'S1', primary: '향유·참여', secondary: '없음', indicator: '', quote: '재미있었다', reason: '' }, { id: 'S2', primary: '지각', secondary: '없음', indicator: '', quote: '카메라', reason: '' }], summary: '두 서랍' },
    ];
    const g: GenerateFn = async ({ prompt, jsonSchema }) => {
      prompts.push(prompt);
      expect(JSON.stringify(jsonSchema)).toContain('향유·참여');
      return JSON.stringify(res.shift());
    };
    const r = await runJudge(g, { film, sentences: ss, model: DEFAULT_MODEL }, { sleep: async () => undefined });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('판정하지 않은 문장이 있습니다: S2');
    expect(r.result.judgements[1].primary).toBe('지각');
  });
  it('서버가 붐비면 다음 모델로 넘어간다', async () => {
    const used: string[] = [];
    const g: GenerateFn = async ({ model }) => {
      used.push(model);
      if (used.length < 3) throw new Error('503 UNAVAILABLE high demand');
      return JSON.stringify({ judgements: [{ id: 'S1', primary: '기타', secondary: '없음', indicator: '', quote: '', reason: '' }], summary: '' });
    };
    const r = await runJudge(g, { film, sentences: splitSentences('봤다.'), model: DEFAULT_MODEL }, { sleep: async () => undefined });
    expect(used).toEqual(['gemini-3.5-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
    expect(r.model).toBe('gemini-3.1-flash-lite');
  });
});

describe('프로파일', () => {
  it('주·보조를 세고, 열지 않은 서랍에 맞는 발문을 온톨로지에서 고른다', () => {
    const p = profileOf([
      { id: 'S1', primary: '이해', secondary: '없음' },
      { id: 'S2', primary: '향유·참여', secondary: '평가' },
      { id: 'S3', primary: '기타', secondary: '없음' },
    ]);
    expect(p.openedLayers).toEqual(['이해', '평가']);
    expect(p.closedLayers).toEqual(['지각', '해석']);
    expect(p.dims['평가']).toMatchObject({ primary: 0, secondary: 1, opened: true });
    expect(p.dims['기타'].opened).toBe(false);
    expect(promptsFor(film, p.closedLayers).map((x) => x.order)).toEqual([4, 5]);
  });
});

describe('일치도', () => {
  it('Cohen의 κ — 교과서 예(일치 0.7, 우연 0.5 → 0.4)', () => {
    const pairs = [
      ...Array(20).fill({ a: '예', b: '예' }),
      ...Array(5).fill({ a: '예', b: '아니오' }),
      ...Array(10).fill({ a: '아니오', b: '예' }),
      ...Array(15).fill({ a: '아니오', b: '아니오' }),
    ];
    const k = cohenKappa(pairs, ['예', '아니오']);
    expect(k.observed).toBeCloseTo(0.7);
    expect(k.expected).toBeCloseTo(0.5);
    expect(k.kappa).toBeCloseTo(0.4);
    expect(kappaLabel(0.4)).toBe('약함');
  });
  it('모두 같으면 1, 우연 기대가 1이면 계산 불가', () => {
    expect(cohenKappa([{ a: '이해', b: '이해' }, { a: '지각', b: '지각' }], DIMENSION_KEYS).kappa).toBe(1);
    expect(cohenKappa([{ a: '이해', b: '이해' }], DIMENSION_KEYS).kappa).toBeNull();
  });
  it('차원별 κ와 혼동표', () => {
    const r = agreement([
      { a: '지각', b: '지각' },
      { a: '이해', b: '이해' },
      { a: '평가', b: '향유·참여' },
      { a: '해석', b: '해석' },
    ]);
    expect(r.overall.observed).toBe(0.75);
    expect(r.perDim.find((d) => d.key === '지각')!.kappa).toBe(1);
    expect(r.matrix[3][4]).toBe(1);
  });
  it('사람 합의는 모두 같을 때만', () => {
    expect(consensus(['이해', '이해'])).toBe('이해');
    expect(consensus(['이해', '해석'])).toBeNull();
    expect(consensus(['이해', undefined])).toBeNull();
    expect(consensus(['이해'])).toBeNull();
  });
});

describe('연구 자료', () => {
  const rec = (id: string, ratings: EssayRecord['ratings']): EssayRecord => ({
    id,
    createdAt: '2026-11-10T00:00:00Z',
    filmId: film.id,
    label: `학생 ${id}`,
    text: '재미있었다. 카메라, 가까이.',
    sentences: splitSentences('재미있었다. 카메라, 가까이.'),
    ai: { judgements: [{ id: 'S1', primary: '향유·참여', secondary: '없음', indicator: '', quote: '재미있었다', reason: '' }], summary: '', model: 'mock', at: '', missing: [] },
    ratings,
  });
  it('가져오면 평정자별 판정이 합쳐진다', () => {
    const mine = [rec('1', { 연구자: { S1: { primary: '향유·참여', secondary: '없음' } } })];
    const theirs = exportJson([rec('1', { '교사 B': { S1: { primary: '평가', secondary: '없음' } } }), rec('2', {})]);
    const r = importJson(theirs, mine);
    expect(r.added).toBe(1);
    expect(r.merged).toBe(1);
    expect(Object.keys(r.essays.find((e) => e.id === '1')!.ratings).sort()).toEqual(['교사 B', '연구자']);
    expect(() => importJson('{"essays":[]}', mine)).toThrow('이 프로그램에서 내보낸');
  });
  it('CSV는 문장마다 한 줄, 쉼표가 든 문장은 따옴표로', () => {
    const csv = toCsv([rec('1', { 연구자: { S1: { primary: '향유·참여', secondary: '없음' } } })]);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe('감상문,영화,문장id,문장,AI 주 차원,AI 보조 차원,AI 지표,AI 근거 인용,인용 대조,연구자 주 차원,연구자 보조 차원');
    expect(lines[1]).toBe('학생 1,우리들,S1,재미있었다.,향유·참여,없음,,재미있었다,문장에 있음,향유·참여,없음');
    expect(lines[2]).toContain('"카메라, 가까이."');
  });
});
