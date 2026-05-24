const PRIMITIVES_DATA = [
  { label: 'Users',       body: 'Auth, orgs, RBAC, tenancy.',           path: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { label: 'Content',     body: 'CMS schemas, drafts, MDX.',            path: 'M9 12h6m-6 4h6m-7 4h8a2 2 0 002-2V6a2 2 0 00-2-2h-3.586a1 1 0 01-.707-.293l-1.414-1.414A1 1 0 009.586 2H6a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { label: 'Intelligence',body: 'Models, prompts, MCP server.',         path: 'M12 2a3 3 0 013 3v0M9 5v0a3 3 0 013-3M9 19v0a3 3 0 003 3M15 19v0a3 3 0 01-3 3M5 9a3 3 0 010 6M19 9a3 3 0 010 6M9 5a3 3 0 00-4 4M9 19a3 3 0 01-4-4M15 5a3 3 0 014 4M15 19a3 3 0 003-3' },
  { label: 'Products',    body: 'Catalog, plans, entitlements.',        path: 'M3 7l9-4 9 4-9 4-9-4zm0 6l9 4 9-4M3 17l9 4 9-4' },
  { label: 'Payments',    body: 'Stripe billing, taxes, dunning.',      path: 'M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z' }
];
// Step assignment per cards.html / badges.html cobalt ladder
const STEPS = [
  { bg:'#e3eafc', ring:'#9eb6dc', icon:'#003E7A' },          // 50/200
  { bg:'#e0e7eb', ring:'#9eb6dc', icon:'#001540' },          // 100/200
  { bg:'#9eb6dc', ring:'#4485bd', icon:'#001540' },          // 200/300
  { bg:'#003E7A', ring:'#001540', icon:'#f8fafa' },          // 500
  { bg:'#001540', ring:'#16242c', icon:'#9eb6dc' }           // 700
];

function Primitives() {
  return (
    <section id="products" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-400">Five primitives, one runtime</p>
          <h2 style={{fontFamily:'"Inter Tight", sans-serif'}} className="mt-3 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
            Everything a business needs. Nothing you don't.
          </h2>
          <p className="mt-6 text-lg leading-8 text-brand-500">
            Each primitive is a workspace package. Use them all, or pick what you need.
          </p>
        </div>
        <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PRIMITIVES_DATA.map((p,i) => {
            const s = STEPS[i];
            return (
              <div key={p.label} className="flex flex-col items-start rounded-2xl bg-white p-6 transition" style={{boxShadow:'inset 0 0 0 1px #9eb6dc'}}>
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl" style={{background:s.bg, boxShadow:'inset 0 0 0 1px ' + s.ring}}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke={s.icon}><path strokeLinecap="round" strokeLinejoin="round" d={p.path}/></svg>
                </div>
                <h3 className="text-base font-semibold text-brand-900">{p.label}</h3>
                <p className="mt-2 text-sm leading-6 text-brand-500">{p.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-mono font-medium uppercase tracking-[0.10em] text-brand-300">cobalt-{['50','100','200','500','700'][i]}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-12 text-center">
          <a href="#" className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-900 transition-colors">
            See the primitive reference <span>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}