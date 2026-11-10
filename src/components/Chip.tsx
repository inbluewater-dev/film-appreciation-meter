import { colorOf, type DimensionKey } from '../lib/ontology';

export function DimChip({ k, faint }: { k: DimensionKey | '없음'; faint?: boolean }) {
  if (k === '없음') return <span className="text-xs text-slate-400">없음</span>;
  const c = colorOf(k);
  return (
    <span className="inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold" style={faint ? { color: c, border: `1px solid ${c}` } : { background: c, color: '#fff' }}>
      {k}
    </span>
  );
}
