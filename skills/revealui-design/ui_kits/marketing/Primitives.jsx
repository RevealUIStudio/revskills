/**
 * Primitives — stacked rows (craft 2026-08), not a 5-card grid.
 * Canonical names: People, Content, Offers, Payments, Agents.
 */
const PRIMITIVES_DATA = [
  { label: 'People', body: 'Your team signs in once. Roles and policies decide who can do what.', color: '#003E7A', soft: 'rgba(0,62,122,0.10)' },
  { label: 'Content', body: 'Define your content once. The admin UI and API come with it.', color: '#2563eb', soft: 'rgba(37,99,235,0.10)' },
  { label: 'Offers', body: 'Plans and feature gates decide what each customer and agent can use.', color: '#d97706', soft: 'rgba(217,119,6,0.10)' },
  { label: 'Payments', body: 'Checkout and subscriptions ship ready, including webhook handling.', color: '#0891b2', soft: 'rgba(8,145,178,0.10)' },
  { label: 'Agents', body: 'Agents run on models you host by default. Add a hosted provider when you choose.', color: '#7c3aed', soft: 'rgba(124,58,237,0.10)' },
];

function Primitives() {
  return (
    <section id="products" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.20em]" style={{color:'#4f6580'}}>Five primitives. One login.</p>
          <h2 style={{fontFamily:'"Inter Tight", sans-serif'}} className="mt-3 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
            The five things every business runs on.
          </h2>
          <p className="mt-5 text-lg leading-8" style={{color:'#4f6580'}}>
            Each one ships ready for your team and for agents. One login covers the whole set.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-3xl divide-y border-y sm:mt-16" style={{borderColor:'rgba(10,19,32,0.08)'}}>
          {PRIMITIVES_DATA.map((p, index) => {
            const flipped = index % 2 === 1;
            return (
              <div
                key={p.label}
                className={`flex flex-col gap-4 py-8 sm:items-center sm:gap-8 sm:py-10 ${flipped ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}
              >
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                  style={{background: p.soft, boxShadow: `inset 0 0 0 1px ${p.color}33`}}
                >
                  <span className="text-sm font-bold" style={{color: p.color, fontFamily:'"Inter Tight", sans-serif'}}>
                    {p.label.slice(0, 1)}
                  </span>
                </div>
                <div className={`flex-1 min-w-0 ${flipped ? 'sm:text-right' : ''}`}>
                  <h3 style={{fontFamily:'"Inter Tight", sans-serif'}} className="text-lg font-semibold tracking-tight text-brand-900">
                    {p.label}
                  </h3>
                  <p className="mt-1.5 text-base leading-7" style={{color:'#4f6580'}}>{p.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <a href="#" className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-900 transition-colors">
            See the primitive reference <span>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
