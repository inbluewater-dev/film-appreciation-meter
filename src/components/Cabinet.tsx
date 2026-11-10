// 감상 프로파일 그림 — 네 서랍(지각·이해·해석·평가)은 순서 없이 나란히, 연 서랍은 앞으로 빠져나와 있다.
// 향유·참여는 층이 아니므로 서랍장 밖 선반에 따로 둔다.
import { forwardRef } from 'react';
import { LAYERS, colorOf, dim } from '../lib/ontology';
import type { Profile } from '../lib/profile';

const W = 900;
const H = 400;

interface Props {
  profile: Profile;
  title: string;
  subtitle: string;
}

export const Cabinet = forwardRef<SVGSVGElement, Props>(function Cabinet({ profile, title, subtitle }, ref) {
  const enjoy = profile.dims['향유·참여'];
  const ec = colorOf('향유·참여');
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-lg border border-slate-200 bg-white" role="img" aria-label="감상 프로파일" fontFamily="Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif">
      <rect width={W} height={H} fill="#ffffff" />
      <text x={28} y={36} fontSize={18} fontWeight={700} fill="#0f172a">
        감상 프로파일 — {title}
      </text>
      <text x={28} y={58} fontSize={12} fill="#64748b">
        {subtitle}
      </text>

      {/* 서랍장 */}
      <rect x={24} y={84} width={612} height={236} rx={10} fill="#f8fafc" stroke="#cbd5e1" />
      <text x={36} y={104} fontSize={11} fill="#64748b">
        네 서랍 (순서 없음 — 사다리가 아니라 서랍)
      </text>
      {LAYERS.map((k, i) => {
        const d = profile.dims[k];
        const c = colorOf(k);
        const x = 40 + i * 148;
        const pc = dim(k).purves?.code;
        if (!d.opened)
          return (
            <g key={k} data-testid={`drawer-${k}`} data-open="false">
              <rect x={x} y={116} width={136} height={188} rx={6} fill="#f1f5f9" stroke="#cbd5e1" />
              <rect x={x + 48} y={136} width={40} height={6} rx={3} fill="#cbd5e1" />
              <text x={x + 68} y={200} textAnchor="middle" fontSize={20} fontWeight={700} fill="#94a3b8">
                {k}
              </text>
              <text x={x + 68} y={224} textAnchor="middle" fontSize={12} fill="#94a3b8">
                열지 않음
              </text>
              {pc && (
                <text x={x + 68} y={292} textAnchor="middle" fontSize={10} fill="#cbd5e1">
                  Purves {pc}
                </text>
              )}
            </g>
          );
        const ids = d.sentenceIds.slice(0, 8).join(' ') + (d.sentenceIds.length > 8 ? ' …' : '');
        return (
          <g key={k} data-testid={`drawer-${k}`} data-open="true">
            {/* 빠져나온 서랍 속 */}
            <rect x={x} y={116} width={136} height={64} rx={6} fill={c} fillOpacity={0.12} stroke={c} strokeOpacity={0.5} />
            <text x={x + 68} y={140} textAnchor="middle" fontSize={10} fill={c}>
              연 문장
            </text>
            <text x={x + 68} y={158} textAnchor="middle" fontSize={11} fontWeight={600} fill={c}>
              {ids}
            </text>
            {/* 서랍 앞판 (앞으로 당겨 나옴) */}
            <rect x={x - 4} y={176} width={144} height={150} rx={6} fill={c} />
            <rect x={x + 48} y={190} width={40} height={6} rx={3} fill="#ffffff" fillOpacity={0.7} />
            <text x={x + 68} y={240} textAnchor="middle" fontSize={22} fontWeight={700} fill="#ffffff">
              {k}
            </text>
            <text x={x + 68} y={266} textAnchor="middle" fontSize={13} fill="#ffffff">
              주 {d.primary} · 보조 {d.secondary}
            </text>
            {pc && (
              <text x={x + 68} y={312} textAnchor="middle" fontSize={10} fill="#ffffff" fillOpacity={0.75}>
                Purves {pc}
              </text>
            )}
          </g>
        );
      })}

      {/* 향유·참여 선반 (층 밖) */}
      <g data-testid="drawer-향유·참여" data-open={enjoy.opened ? 'true' : 'false'}>
        <rect x={664} y={116} width={208} height={188} rx={10} fill={enjoy.opened ? ec : '#ffffff'} fillOpacity={enjoy.opened ? 0.12 : 1} stroke={enjoy.opened ? ec : '#cbd5e1'} strokeDasharray="6 4" />
        <text x={768} y={100} textAnchor="middle" fontSize={11} fill="#64748b">
          층 밖 — 네 층이 향하는 곳
        </text>
        <text x={768} y={196} textAnchor="middle" fontSize={20} fontWeight={700} fill={enjoy.opened ? ec : '#94a3b8'}>
          향유·참여
        </text>
        <text x={768} y={222} textAnchor="middle" fontSize={13} fill={enjoy.opened ? ec : '#94a3b8'}>
          {enjoy.opened ? `주 ${enjoy.primary} · 보조 ${enjoy.secondary}` : '없음'}
        </text>
        {enjoy.opened && (
          <text x={768} y={246} textAnchor="middle" fontSize={11} fill={ec}>
            {enjoy.sentenceIds.slice(0, 8).join(' ')}
          </text>
        )}
        <text x={768} y={292} textAnchor="middle" fontSize={10} fill="#94a3b8">
          Purves {dim('향유·참여').purves?.code}
        </text>
      </g>

      <text x={28} y={354} fontSize={13} fill="#334155">
        문장 {profile.total}개 · 연 서랍 {profile.openedLayers.length}/4{profile.closedLayers.length ? ` (열지 않은 서랍: ${profile.closedLayers.join(', ')})` : ''} · 기타 {profile.dims['기타'].primary}문장
      </text>
      <text x={28} y={378} fontSize={11} fill="#94a3b8">
        서랍이 '열렸다' = 그 차원을 주 또는 보조로 판정한 문장이 하나 이상 있음. 판정은 온톨로지의 판정 지표를 따른 AI 초안이며 교사가 확인합니다.
      </text>
    </svg>
  );
});
