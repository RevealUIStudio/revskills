/**
 * Pricing teaser craft (2026-08): no inverted black Pro card.
 * Highlight with quiet badge + light ring; both Free and Pro on paper surfaces.
 * Full pricing page may still show Max/Enterprise elsewhere.
 */
const PRICING_TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    description: 'Run the open stack on your own infrastructure. Most packages stay MIT forever. No telemetry.',
    features: ['Full primitive stack', 'Admin dashboard + API', 'Self-host on any infra', 'Bring your own model (open-weight default)'],
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/mo',
    description: 'Add the AI layer, an agent task allowance, and priority support when you scale agents.',
    features: ['Everything in Free', '10,000 agent tasks / month included', 'Pro AI features (agents, MCP, memory), beta in production', 'Priority support'],
    cta: 'See Pro pricing',
    highlight: true,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="py-20 sm:py-28" style={{background:'#f1f5fa'}}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.20em]" style={{color:'#4f6580'}}>Pricing</p>
          <h2 style={{fontFamily:'"Inter Tight", sans-serif'}} className="mt-3 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
            Start free. Pay when you scale.
          </h2>
          <p className="mt-5 text-lg leading-8" style={{color:'#4f6580'}}>
            Self-host the open stack at no cost. Pro, Max, and Enterprise add agent capacity and support. Pro and Max include a 7-day free trial.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6">
          {PRICING_TIERS.map((t) => (
            <div
              key={t.name}
              className="relative flex flex-col rounded-2xl bg-white p-7 sm:p-8"
              style={{
                boxShadow: t.highlight
                  ? '0 8px 24px rgba(10,19,32,0.06), inset 0 0 0 1px rgba(10,19,32,0.10)'
                  : 'inset 0 0 0 1px rgba(10,19,32,0.08)',
              }}
            >
              {t.highlight && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.20em]"
                  style={{background:'#f1f5fa', color:'#0a1320', boxShadow:'inset 0 0 0 1px rgba(10,19,32,0.10)'}}
                >
                  Recommended
                </span>
              )}
              <h3 style={{fontFamily:'"Inter Tight", sans-serif'}} className="text-lg font-semibold text-brand-900">{t.name}</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span style={{fontFamily:'"Inter Tight", sans-serif'}} className="text-4xl font-bold tracking-tight text-brand-900 tabular-nums">{t.price}</span>
                {t.period && <span className="text-sm" style={{color:'#4f6580'}}>{t.period}</span>}
              </div>
              <p className="mt-4 text-sm leading-6" style={{color:'#4f6580'}}>{t.description}</p>
              <ul className="mt-6 flex-1 space-y-3 list-none p-0 m-0">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-brand-900">
                    <svg className="mt-0.5 h-4 w-4 flex-none" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3.5 8.5l3 3 6-7" stroke="#003E7A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#"
                className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-[10px] text-sm font-semibold transition-all"
                style={
                  t.highlight
                    ? {background:'#003E7A', color:'#f8fafa', boxShadow:'0 6px 20px rgba(0,62,122,0.28)'}
                    : {background:'#fff', color:'#001540', boxShadow:'inset 0 0 0 1px #9eb6dc'}
                }
              >
                {t.cta}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a href="#" className="text-sm font-medium text-brand-600 hover:text-brand-900">See full pricing →</a>
        </div>
      </div>
    </section>
  );
}
