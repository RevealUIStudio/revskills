// @ts-nocheck
const STATS = [
  { l: 'Agent tasks (24h)', v: '4,219', d: '+12.4%', up: true },
  { l: 'Active users', v: '1,847', d: '+3.1%', up: true },
  { l: 'MRR', v: '$28,420', d: '+8.7%', up: true },
  { l: 'p95 latency', v: '184ms', d: '−4ms', up: true },
];

const AGENTS = [
  { n: 'support-triage', s: 'running', m: 'haiku-4-5', t: '1,204 tasks', l: '2s ago' },
  { n: 'invoice-generator', s: 'running', m: 'sonnet-4-5', t: '482 tasks', l: '14s ago' },
  { n: 'content-translator', s: 'running', m: 'haiku-4-5', t: '3,019 tasks', l: '4s ago' },
  { n: 'lead-enricher', s: 'paused', m: 'sonnet-4-5', t: '0 tasks', l: '2h ago' },
  { n: 'churn-predictor', s: 'error', m: 'sonnet-4-5', t: '128 tasks', l: '11m ago' },
];

// Running uses --rvui-success — UI signal green, distinct from brand verdigris.
const STATUS_STYLE = {
  running: { bg: 'rgba(142,214,177,0.14)', dot: 'var(--rvui-success)', fg: 'var(--rvui-success)' },
  paused: { bg: 'rgba(168,163,184,0.14)', dot: 'var(--rvui-smoke-300)', fg: 'var(--rvui-smoke-200)' },
  error: { bg: 'rgba(255,64,96,0.16)', dot: 'var(--rvui-error)', fg: 'var(--rvui-error)' },
};

function StatCard({ stat }) {
  return (
    <div className="rounded-xl p-5" style={{background: 'var(--rvui-surface-1)', border: '1px solid var(--rvui-border)'}}>
      <div className="text-xs" style={{color: 'var(--rvui-text-2)'}}>{stat.l}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight" style={{color: 'var(--rvui-text-0)', fontFamily: 'Inter Tight, sans-serif'}}>{stat.v}</div>
        <div className="text-xs font-medium" style={{color: stat.up ? 'var(--rvui-success)' : 'var(--rvui-error)'}}>{stat.d}</div>
      </div>
      <svg className="mt-3 w-full h-10" viewBox="0 0 120 32" preserveAspectRatio="none">
        <path d="M0 24 L15 22 L30 25 L45 18 L60 14 L75 12 L90 9 L105 11 L120 6" fill="none" stroke="var(--rvui-brand)" strokeWidth="1.5"/>
        <path d="M0 24 L15 22 L30 25 L45 18 L60 14 L75 12 L90 9 L105 11 L120 6 L120 32 L0 32 Z" fill="var(--rvui-brand-soft)"/>
      </svg>
    </div>
  );
}

function Dashboard() {
  return (
    <main className="flex-1 overflow-y-auto px-8 py-6" style={{background: 'var(--rvui-surface-0)'}}>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{color: 'var(--rvui-text-0)', fontFamily: 'Inter Tight, sans-serif'}}>Overview</h1>
          <p className="text-sm mt-1" style={{color: 'var(--rvui-text-2)'}}>Workspace activity, last 24 hours</p>
        </div>
        <div className="flex gap-1 p-1 rounded-md" style={{background: 'var(--rvui-surface-1)', border: '1px solid var(--rvui-border)'}}>
          {['24h','7d','30d','All'].map((r,i) => (
            <button key={r} className="text-xs px-3 py-1 rounded transition-colors" style={i===0 ? {background: 'var(--rvui-surface-3)', color: 'var(--rvui-text-0)'} : {color: 'var(--rvui-text-2)'}}>{r}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {STATS.map(s => <StatCard key={s.l} stat={s} />)}
      </div>

      <div className="rounded-xl overflow-hidden" style={{background: 'var(--rvui-surface-1)', border: '1px solid var(--rvui-border)'}}>
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{borderColor: 'var(--rvui-border)'}}>
          <div>
            <h2 className="text-sm font-semibold" style={{color: 'var(--rvui-text-0)'}}>Agents</h2>
            <p className="text-xs mt-0.5" style={{color: 'var(--rvui-text-2)'}}>5 running · 1 paused · 1 with errors</p>
          </div>
          <button className="text-xs px-3 py-1.5 rounded-md font-medium" style={{color: 'var(--rvui-text-1)', border: '1px solid var(--rvui-border)'}}>View all →</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider" style={{color: 'var(--rvui-text-2)'}}>
              <th className="px-5 py-2 font-medium">Name</th>
              <th className="px-5 py-2 font-medium">Status</th>
              <th className="px-5 py-2 font-medium">Model</th>
              <th className="px-5 py-2 font-medium">Throughput</th>
              <th className="px-5 py-2 font-medium">Last run</th>
              <th className="px-5 py-2 font-medium w-12"></th>
            </tr>
          </thead>
          <tbody>
            {AGENTS.map((a,i) => {
              const st = STATUS_STYLE[a.s];
              return (
                <tr key={a.n} className="border-t" style={{borderColor: 'var(--rvui-border-subtle)'}}>
                  <td className="px-5 py-3 font-medium" style={{color: 'var(--rvui-text-0)', fontFamily: 'JetBrains Mono, monospace', fontSize: 13}}>{a.n}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium" style={{background: st.bg, color: st.fg}}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{background: st.dot}}/>
                      {a.s}
                    </span>
                  </td>
                  <td className="px-5 py-3" style={{color: 'var(--rvui-text-1)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12}}>{a.m}</td>
                  <td className="px-5 py-3" style={{color: 'var(--rvui-text-1)'}}>{a.t}</td>
                  <td className="px-5 py-3" style={{color: 'var(--rvui-text-2)'}}>{a.l}</td>
                  <td className="px-5 py-3 text-right">
                    <button className="opacity-60 hover:opacity-100" style={{color: 'var(--rvui-text-1)'}}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"/></svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
window.Dashboard = Dashboard;
