import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Asset } from '../data/mockData'

interface Props {
  assets: Asset[]
  selected: string
}

export function IVChart({ assets, selected }: Props) {
  const data = assets.map(a => ({
    name: a.symbol.replace('USDT', ''),
    iv: a.iv30,
    hv: a.hv30,
    ivRank: a.ivRank,
    active: a.symbol === selected,
  }))

  return (
    <div className="bg-[#0d0d20] rounded-2xl border border-[#1e1e3f] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">IV vs HV (30-day)</h3>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> IV</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> HV</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} barGap={2} barCategoryGap="20%">
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              background: '#1a1a3a',
              border: '1px solid #4f46e5',
              borderRadius: 10,
              fontSize: 12,
              color: '#e2e8f0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              padding: '8px 12px',
            }}
            labelStyle={{ color: '#a5b4fc', fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ color: '#e2e8f0' }}
            formatter={(v, name) => [`${Number(v).toFixed(1)}%`, name === 'iv' ? 'Implied Vol' : 'Historical Vol']}
            cursor={{ fill: 'rgba(99,102,241,0.08)' }}
          />
          <Bar dataKey="iv" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.active ? '#6366f1' : '#3730a3'} />
            ))}
          </Bar>
          <Bar dataKey="hv" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.active ? '#4b5563' : '#374151'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
