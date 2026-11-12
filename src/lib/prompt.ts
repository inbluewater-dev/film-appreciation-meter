// AI에게 주는 판정 지침 — 온톨로지의 감상 차원·판정 지표·예시 진술을 그대로 옮겨 만든다.
// 지침을 바꾸려면 이 파일이 아니라 src/data/film-appreciation.ttl 을 고친다.
import { ONTOLOGY, type Dimension, type Film } from './ontology';
import type { Sentence } from './segment';

export const MAX_ESSAY_CHARS = 6000;

function dimensionBlock(d: Dimension): string {
  const lines = [`■ ${d.key}${d.isLayer ? '' : d.key === '기타' ? ' (어느 차원도 열지 않은 문장)' : ' (층이 아님: 프로파일에 따로 표시)'}`, `  뜻: ${d.comment}`];
  for (const ind of d.indicators) {
    lines.push(`  [지표 ${ind.id}] 이 조건이면 연다: ${ind.rule}`);
    for (const s of ind.sources) lines.push(`    근거: ${s}`);
    for (const e of ind.examples) lines.push(`    연 예: "${e.text}"${e.source ? ` (${e.source})` : ''}${e.note ? ` — ${e.note}` : ''}`);
    for (const e of ind.nearMisses) lines.push(`    열지 않은 예: "${e.text}" — ${e.whyNot ?? ''}`);
  }
  return lines.join('\n');
}

export function buildPrompt(film: Film, sentences: Sentence[]): string {
  const dims = ONTOLOGY.dimensions;
  const indicatorIds = dims.flatMap((d) => d.indicators.map((i) => i.id));
  return `[역할] 당신은 고등학생의 영화 감상문을 읽고, 문장마다 어떤 감상 차원을 열었는지 판정하는 평정자입니다. 판정은 아래 [판정 기준]만 따릅니다. 이 기준은 영화 감상 능력 측정 온톨로지(v${ONTOLOGY.version})에서 그대로 옮긴 것입니다.

[감상한 영화] <${film.title}>(${film.director}, ${film.year})
${film.synopsis ? `줄거리 요약(인물 이름을 알아보는 데만 쓴다): ${film.synopsis}` : ''}

[판정 기준]
네 층(지각·이해·해석·평가)은 순서가 있는 단계가 아니라 서로 독립된 '서랍'이다. 문장이 어느 서랍을 열었는지만 본다.
${dims.map(dimensionBlock).join('\n\n')}

[반드시 지킬 규칙]
1. [감상문]의 모든 문장(S1, S2, …)마다 judgements를 정확히 하나씩, 같은 id로 쓴다. 문장을 합치거나 나누지 않는다.
2. primary(주 차원)는 ${dims.map((d) => d.key).join(' / ')} 중 하나다. 지표의 조건에 가장 분명하게 맞는 차원을 고른다.
3. secondary(보조 차원)는 그 문장이 다른 차원의 조건도 분명히 채울 때만 하나 쓰고, 아니면 "없음"이다. 주 차원과 같은 것은 쓰지 않는다.
4. 근거(기준·이유) 없이 좋고 싫음만 말한 문장("재미있었다", "감동적이었다")은 향유·참여다. 기준이나 이유를 들어 작품·표현의 가치를 판단하면 평가다.
5. 장면을 지목했더라도 카메라·소리·색·빛·편집 같은 형식 요소를 구체적으로 짚지 않으면 지각이 아니다.
6. 줄거리가 영화와 사실로 맞는지는 판정하지 않는다(교사가 확인한다). 인물의 목표·사건의 인과를 서술했는지만 보고, reason에도 '영화 내용과 맞다/틀리다'를 쓰지 않는다.
7. 문장이 길거나 어휘가 어렵다고 높은 차원으로 판정하지 않는다. 지표의 조건만 본다.
7-1. '열지 않은 예'와 같은 종류의 문장은 그 지표의 차원으로 판정하지 않는다. '열지 않은 예'에 적힌 까닭이 그 문장에도 해당하는지 먼저 확인한다.
8. quote에는 그 문장에서 판정의 근거가 된 부분을 띄어쓰기까지 그대로 옮긴다(2~60자). 고쳐 쓰거나 요약하지 않는다. 기타는 빈 문자열로 둔다.
9. indicator에는 주 차원의 지표 이름을 이 목록에서 그대로 골라 쓴다(${indicatorIds.join(', ')}). 이름을 새로 만들지 않는다. 기타면 빈 문자열로 둔다.
10. reason에는 왜 그 차원인지 지표 조건에 비추어 한 문장으로 쓴다(보조 차원이 있으면 그 까닭도).
11. summary에는 교사에게 보여 줄 두세 문장을 쓴다: 이 감상문이 연 서랍과 열지 않은 서랍, 두드러진 특징. 학생을 평가하는 말(잘했다, 부족하다)은 쓰지 않는다.
12. 감상문에 이름 같은 개인정보가 있어도 결과에 옮기지 않는다.

[출력] 지정된 JSON 스키마만 출력한다.

[감상문]
${sentences.map((s) => `${s.id}: ${s.text}`).join('\n')}`;
}
