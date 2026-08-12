/**
 * Demo — product-as-proof (craft 2026-08).
 * Dark outer mat + quiet admin chrome + live-component frame (not stale screenshots).
 * Beats are divided columns, not three bordered cards.
 */
const BEATS = [
  { n: '01', title: 'Spin up a stack.', body: 'One command. Sign-in, content, admin UI, billing hooks, and agent tooling run locally in about a minute.' },
  { n: '02', title: 'Customer flow, end to end.', body: 'A user signs up, picks a plan, and test-mode checkout completes. Switch to live mode when you are ready.' },
  { n: '03', title: 'Agents on your data.', body: 'Connect a model. Agents read and write the same content your team does, under the same sign-in and plan rules.' },
];

const EVENTS = [
  ['09:41:07', 'support-agent', 'signed in as', 'agents@demo.revealui.com'],
  ['09:41:09', 'support-agent', 'refunded', 'order #4189'],
  ['09:41:09', 'policy', 'allowed', 'refunds under $100'],
  ['09:41:10', 'audit-log', 'recorded', 'the receipt'],
];

function Demo() {
  return (
    <section id="demo" className="py-20 sm:py-28" style={{background:'#f1f5fa'}}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.20em]" style={{color:'#4f6580'}}>Watch it work</p>
          <h2 style={{fontFamily:'"Inter Tight", sans-serif'}} className="mt-3 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
            From one command to a running stack in about a minute.
          </h2>
          <p className="mt-5 text-lg leading-8" style={{color:'#4f6580'}}>
            Install on your machine. Take a test payment. Connect an agent to the same data your admin UI already uses.
          </p>
        </div>

        <figure className="mx-auto mt-14 w-full max-w-5xl sm:mt-16">
          {/* Product mat — only device-frame trick on the site */}
          <div className="overflow-hidden rounded-2xl p-1.5 sm:p-2" style={{background:'#0a1320', boxShadow:'0 24px 48px rgba(10,19,32,0.18)'}} role="img" aria-label="RevealUI admin shell, live component demo">
            <div className="overflow-hidden rounded-xl bg-white">
              <div className="flex h-10 items-center gap-3 border-b px-3 sm:px-4" style={{borderColor:'rgba(10,19,32,0.08)'}}>
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="size-2 rounded-full" style={{background:'rgba(79,101,128,0.35)'}} />
                  <span className="size-2 rounded-full" style={{background:'rgba(79,101,128,0.35)'}} />
                  <span className="size-2 rounded-full" style={{background:'rgba(79,101,128,0.35)'}} />
                </div>
                <div className="flex flex-1 justify-center">
                  <span className="font-mono text-[11px] tabular-nums" style={{color:'#4f6580'}}>admin.local · Agents</span>
                </div>
                <div className="w-8" aria-hidden="true" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[10.5rem_1fr]">
                <aside className="hidden border-r p-2 sm:block" style={{borderColor:'rgba(10,19,32,0.08)', background:'rgba(241,245,250,0.6)'}} aria-hidden="true">
                  <div className="mb-3 flex h-8 items-center gap-2 px-2">
                    <span className="flex size-5 items-center justify-center rounded-[5px] text-[9px] font-bold text-white" style={{background:'#003E7A', fontFamily:'"Inter Tight", sans-serif'}}>R</span>
                    <span className="text-xs font-medium text-brand-900">RevealUI</span>
                  </div>
                  <ul className="space-y-0.5 list-none p-0 m-0">
                    {['People', 'Content', 'Offers', 'Payments', 'Agents'].map((label, i) => (
                      <li key={label}>
                        <span className="flex h-8 items-center gap-2 rounded-md px-2 text-xs" style={i === 4 ? {background:'rgba(10,19,32,0.06)', color:'#0a1320', fontWeight:500} : {color:'#4f6580'}}>
                          <span className="size-1 rounded-full" style={{background: i === 4 ? '#0a1320' : 'rgba(79,101,128,0.4)'}} />
                          {label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </aside>

                <div className="min-w-0 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.20em]" style={{color:'#4f6580'}}>Agent activity</p>
                      <h3 style={{fontFamily:'"Inter Tight", sans-serif'}} className="mt-1 text-base font-semibold tracking-tight text-brand-900">
                        support-agent · refund flow
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs" style={{background:'#f1f5fa', color:'#4f6580'}}>
                        <span className="size-2 rounded-full" style={{background:'#2d9f6f'}} />
                        Online
                      </span>
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium" style={{background:'rgba(45,159,111,0.12)', color:'#1f7a54'}}>
                        Approved
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-lg border" style={{borderColor:'rgba(10,19,32,0.10)'}}>
                    <div className="flex h-8 items-center border-b px-3" style={{borderColor:'rgba(10,19,32,0.08)'}}>
                      <p className="text-[11px] font-medium uppercase tracking-[0.20em]" style={{color:'#4f6580'}}>Live audit trail</p>
                    </div>
                    <ul className="divide-y list-none p-0 m-0" style={{borderColor:'rgba(10,19,32,0.08)', fontFamily:'"JetBrains Mono", monospace'}}>
                      {EVENTS.map(([ts, actor, action, object]) => (
                        <li key={ts + action} className="px-3 py-2 text-xs tabular-nums flex flex-wrap gap-x-2" style={{color:'#2a3a52'}}>
                          <span style={{color:'#4f6580'}}>{ts}</span>
                          <span className="font-medium text-brand-900">{actor}</span>
                          <span>{action}</span>
                          <span className="text-brand-900">{object}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="mt-3 text-xs leading-5" style={{color:'#4f6580'}}>
                    Live presentation components. Same receipt story as the hero, inside an admin shell.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <figcaption className="mt-4 text-center text-sm" style={{color:'#4f6580'}}>
            Local stack from a fresh <code className="rounded px-1.5 py-0.5 font-mono text-[11px] text-brand-900" style={{background:'#e3eafc'}}>npx create-revealui</code>. The three beats below describe the steps.
          </figcaption>
        </figure>

        <ol className="mx-auto mt-14 grid max-w-5xl list-none grid-cols-1 gap-0 divide-y border-y p-0 sm:mt-16 lg:grid-cols-3 lg:divide-x lg:divide-y-0" style={{borderColor:'rgba(10,19,32,0.08)'}}>
          {BEATS.map((b) => (
            <li key={b.n} className="relative px-0 py-7 lg:px-8 lg:py-8 first:lg:pl-0 last:lg:pr-0">
              <div className="font-mono text-[11px] font-medium tabular-nums tracking-[0.20em]" style={{color:'#4f6580'}}>{b.n}</div>
              <h3 style={{fontFamily:'"Inter Tight", sans-serif'}} className="mt-3 text-lg font-semibold tracking-tight text-brand-900">{b.title}</h3>
              <p className="mt-2 text-sm leading-6" style={{color:'#4f6580'}}>{b.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
