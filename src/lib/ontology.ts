// 온톨로지(TTL)를 읽어 판정 기준을 만든다 — 이 파일이 곧 AI 판정 지침의 원천이다.
// src/data/film-appreciation.ttl 의 감상 차원·판정 지표·예시 진술·자극·발문을 그대로 꺼낸다.
import { Parser, type Quad } from 'n3';
import ttl from '../data/film-appreciation.ttl?raw';

const FAM = 'http://example.org/film-appreciation#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const DCT = 'http://purl.org/dc/terms/';

/** 프로그램 안에서 쓰는 차원 이름(온톨로지의 rdfs:label과 같다) */
export const DIMENSION_KEYS = ['지각', '이해', '해석', '평가', '향유·참여', '기타'] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];
/** 네 서랍(층) — 프로파일의 본체 */
export const LAYERS = ['지각', '이해', '해석', '평가'] as const satisfies readonly DimensionKey[];

export interface Anchor {
  text: string;
  origin: string;
  source?: string;
  whyNot?: string;
  note?: string;
}
export interface Indicator {
  id: string;
  rule: string;
  sources: string[];
  examples: Anchor[];
  nearMisses: Anchor[];
}
export interface Dimension {
  key: DimensionKey;
  iri: string;
  isLayer: boolean;
  comment: string;
  color: string;
  purves?: { code: string; label: string };
  indicators: Indicator[];
}
export interface PromptItem {
  order: number;
  text: string;
  targets: DimensionKey | null;
  source?: string;
}
export interface Film {
  id: string;
  title: string;
  director: string;
  year: string;
  rating?: string;
  runtimeMinutes?: number;
  synopsis?: string;
  synopsisSource?: string;
  comment?: string;
  prompts: PromptItem[];
}
export interface Ontology {
  version: string;
  modified: string;
  dimensions: Dimension[];
  films: Film[];
  tripleCount: number;
}

export function parseOntology(text: string): Ontology {
  const quads: Quad[] = new Parser().parse(text);
  const objs = (s: string, p: string) => quads.filter((q) => q.subject.value === s && q.predicate.value === p).map((q) => q.object);
  const val = (s: string, p: string) => objs(s, p)[0]?.value;
  const vals = (s: string, p: string) => objs(s, p).map((o) => o.value);
  const subjectsOfType = (t: string) => [...new Set(quads.filter((q) => q.predicate.value === RDF_TYPE && q.object.value === t).map((q) => q.subject.value))];
  const local = (iri: string) => iri.replace(FAM, '');

  const anchor = (node: string): Anchor => ({
    text: val(node, FAM + 'text') ?? '',
    origin: val(node, FAM + 'origin') ?? '',
    source: val(node, DCT + 'source'),
    whyNot: val(node, FAM + 'whyNot'),
    note: val(node, RDFS + 'comment'),
  });

  const dimIris = [...subjectsOfType(FAM + 'Layer'), ...subjectsOfType(FAM + 'ResponseDimension')];
  const indicators = subjectsOfType(FAM + 'Indicator');
  const dimensions: Dimension[] = dimIris
    .map((iri) => {
      const key = val(iri, RDFS + 'label') as DimensionKey;
      const pc = val(iri, FAM + 'correspondsTo');
      return {
        key,
        iri,
        isLayer: quads.some((q) => q.subject.value === iri && q.predicate.value === RDF_TYPE && q.object.value === FAM + 'Layer'),
        comment: val(iri, RDFS + 'comment') ?? '',
        color: val(iri, FAM + 'color') ?? '#64748b',
        order: Number(val(iri, FAM + 'order') ?? 99),
        purves: pc ? { code: val(pc, FAM + 'code') ?? '', label: val(pc, RDFS + 'label') ?? '' } : undefined,
        indicators: indicators
          .filter((ind) => val(ind, FAM + 'opens') === iri)
          .map((ind) => ({
            id: local(ind),
            rule: val(ind, FAM + 'rule') ?? '',
            sources: vals(ind, DCT + 'source'),
            examples: vals(ind, FAM + 'example').map(anchor),
            nearMisses: vals(ind, FAM + 'nearMiss').map(anchor),
          })),
      };
    })
    .filter((d) => (DIMENSION_KEYS as readonly string[]).includes(d.key))
    .sort((a, b) => a.order - b.order)
    .map(({ order: _o, ...d }) => d);

  const keyOf = (iri: string | undefined) => (iri ? (dimensions.find((d) => d.iri === iri)?.key ?? null) : null);
  const films: Film[] = subjectsOfType(FAM + 'Film').map((iri) => {
    const scenes = subjectsOfType(FAM + 'Scene').filter((sc) => val(sc, FAM + 'inFilm') === iri);
    const prompts = subjectsOfType(FAM + 'Prompt')
      .filter((p) => {
        const st = val(p, FAM + 'forStimulus');
        return st === iri || (!!st && scenes.includes(st));
      })
      .map((p) => ({ order: Number(val(p, FAM + 'order') ?? 0), text: val(p, FAM + 'text') ?? '', targets: keyOf(val(p, FAM + 'targets')), source: val(p, DCT + 'source') }))
      .sort((a, b) => a.order - b.order);
    return {
      id: local(iri),
      title: val(iri, RDFS + 'label') ?? '',
      director: val(iri, FAM + 'director') ?? '',
      year: val(iri, FAM + 'year') ?? '',
      rating: val(iri, FAM + 'rating'),
      runtimeMinutes: val(iri, FAM + 'runtimeMinutes') ? Number(val(iri, FAM + 'runtimeMinutes')) : undefined,
      synopsis: val(iri, FAM + 'synopsis'),
      synopsisSource: val(iri, DCT + 'source'),
      comment: val(iri, RDFS + 'comment'),
      prompts,
    };
  });

  const onto = 'http://example.org/film-appreciation';
  return {
    version: val(onto, 'http://www.w3.org/2002/07/owl#versionInfo') ?? '',
    modified: val(onto, DCT + 'modified') ?? val(onto, DCT + 'created') ?? '',
    dimensions,
    films,
    tripleCount: quads.length,
  };
}

export const ONTOLOGY: Ontology = parseOntology(ttl);
export const ONTOLOGY_TTL = ttl;
export const dim = (k: DimensionKey) => ONTOLOGY.dimensions.find((d) => d.key === k)!;
export const colorOf = (k: DimensionKey) => dim(k)?.color ?? '#64748b';
