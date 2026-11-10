// 샘플(Mock) 모드 — 인터넷·Firebase 없이 화면을 시험한다. 실제 AI가 아니라 낱말 규칙으로 흉내 낸다.
import type { DimensionKey } from '../ontology';
import type { Judgement } from '../schema';
import type { GenerateFn } from './core';

const RULES: { key: DimensionKey; indicator: string; re: RegExp; why: string }[] = [
  { key: '지각', indicator: 'Indicator_지각_형식요소', re: /(카메라|클로즈업|접사|핸드헬드|앵글|화면|조명|빛|색감|색|음악|소리|소음|편집|컷|롱테이크|구도|프레임)/, why: '형식 요소를 짚음' },
  { key: '해석', indicator: 'Indicator_해석_상징', re: /(상징|의미|뜻하|셈이다|보여 주는 장치|말하려는|주제|은유|나타낸다|나타내는)/, why: '드러나지 않은 의미를 읽음' },
  { key: '평가', indicator: 'Indicator_평가_근거판단', re: /(완성도|연출|훌륭|뛰어나|아쉬|설득력|탁월|별점|잘 만든|좋은 영화)/, why: '가치를 판단함' },
  { key: '향유·참여', indicator: 'Indicator_향유_공감', re: /(나도|나라면|내가 .*(라면|였다면|이었다면)|공감|재미있|재밌|감동|슬펐|눈물|마음이 아팠|기억에 남|응원)/, why: '공감·느낌을 말함' },
  { key: '이해', indicator: 'Indicator_이해_인물인과', re: /(때문에|그래서|결국|멀리|가까워|친해|비밀|목표|원했|하려고|선은|지아는|보라는)/, why: '인물의 목표·인과를 서술함' },
];

export function mockJudge(id: string, text: string): Judgement {
  const hits = RULES.filter((r) => r.re.test(text));
  if (!hits.length) return { id, primary: '기타', secondary: '없음', indicator: '', quote: '', reason: '(샘플 판정) 어느 지표에도 맞는 말이 없음' };
  const [p, s] = hits;
  const m = text.match(p.re)!;
  return {
    id,
    primary: p.key,
    secondary: s && s.key !== '기타' ? (s.key as Exclude<DimensionKey, '기타'>) : '없음',
    indicator: p.indicator,
    quote: m[0],
    reason: `(샘플 판정 — 실제 AI 아님) ${p.why}${s ? `, ${s.why}` : ''}`,
  };
}

export const mockGenerate: GenerateFn = async ({ prompt }) => {
  await new Promise((r) => setTimeout(r, 500));
  const body = prompt.slice(prompt.lastIndexOf('[감상문]') + '[감상문]'.length);
  const judgements = [...body.matchAll(/^(S\d+): (.*)$/gm)].map((m) => mockJudge(m[1], m[2]));
  const opened = [...new Set(judgements.map((j) => j.primary).filter((k) => k !== '기타'))];
  return JSON.stringify({ judgements, summary: `(샘플 결과 — 실제 AI가 아닙니다) 이 감상문은 ${opened.join('·') || '어느 서랍도'}을(를) 열었습니다.` });
};
