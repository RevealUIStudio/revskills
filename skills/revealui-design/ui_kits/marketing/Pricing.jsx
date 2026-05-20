const PRICING_TIERS = [
  { name:'Free',  price:'$0',   sub:'OSS · MIT · community',          features:['All five primitives','Local dev runtime','Community Discord','Self-host forever'], cta:'Start building',  variant:'soft'  },
  { name:'Pro',   price:'$49',  sub:'10k agent tasks/mo · SLA · SSO', features:['Everything in Free','Hosted runtime','SSO + audit log','Email support'],          cta:'Start 14-day trial', variant:'presence', popular:true },
  { name:'Enterprise', price:'$299', sub:'Audit log · multi-tenant · dedicated', features:['Everything in Pro','Multi-tenant','Dedicated infra','99.99% SLA'], cta:'Talk to sales',    variant:'authority' }
];

function Pricing() {
  return (
    <section id="pricing" className="bg-brand-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-400">Pricing</p>
          <h2 style={{fontFamily:'"Inter Tight", sans-serif'}} className="mt-3 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
            Free to start. Fair to scale.
          </h2>
          <p className="mt-6 text-lg leading-8 text-brand-500">
            Pro and Enterprise are <a href="#" className="text-brand-700 underline decoration-brand-300 underline-offset-4">Fair Source</a> — source-available, free for small teams.
          </p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-3 items-stretch">
          {PRICING_TIERS.map(t => {
            const isAuth = t.variant === 'authority';
            const isPres = t.variant === 'presence';
            const cardStyle = isAuth
              ? {background:'#07090e', color:'#e0e7eb', boxShadow:'0 12px 28px rgba(7,9,14,0.32), inset 0 0 0 1px rgba(194,205,213,0.22)'}
              : isPres
                ? {background:'#fff', boxShadow:'inset 0 0 0 2px #003E7A, 0 12px 28px rgba(0,62,122,0.22)'}
                : {background:'#e3eafc', boxShadow:'inset 0 0 0 1px #9eb6dc'};
            return (
              <div key={t.name} className="relative flex flex-col rounded-2xl p-8" style={cardStyle}>
                {isPres && <div className="absolute -inset-px rounded-2xl pointer-events-none" style={{background:'radial-gradient(120% 70% at 0% 0%, rgba(0,62,122,0.12), transparent 60%)', mixBlendMode:'multiply'}} />}
                {isAuth && <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden"><div className="absolute right-[-30%] top-[-30%] w-[170px] h-[170px] rounded-full" style={{background:'radial-gradient(closest-side,rgba(87,114,125,0.55),rgba(0,62,122,0.20) 55%,transparent 80%)', filter:'blur(8px)'}} /></div>}
                {t.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{background:'linear-gradient(110deg,#004F8C 0%,#003E7A 100%)', color:'#f8fafa', boxShadow:'0 4px 14px rgba(0,62,122,0.32), inset 0 0 0 1px rgba(255,255,255,0.22)'}}>Most popular</span>}
                <div className="relative">
                  <div className={isAuth?'text-sm font-semibold':'text-sm font-semibold text-brand-900'} style={isAuth?{color:'#9eb6dc'}:null}>{t.name}</div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span style={{fontFamily:'"Inter Tight", sans-serif', color:isAuth?'#f8fafa':'#001540'}} className="text-5xl font-extrabold tracking-tight">{t.price}</span>
                    {t.price !== '$0' && <span className="text-sm" style={{color:isAuth?'#4485bd':'#4485bd'}}>/mo</span>}
                  </div>
                  <p className="mt-2 text-sm" style={{color:isAuth?'#9eb6dc':'#004F8C'}}>{t.sub}</p>
                  <ul className="mt-6 space-y-3 flex-1">
                    {t.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <svg className="h-5 w-5 flex-none" fill="currentColor" viewBox="0 0 20 20" style={{color:isAuth?'#4485bd':'#003E7A'}}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                        <span style={{color:isAuth?'#e0e7eb':'#001540'}}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="#" className="mt-8 inline-flex items-center justify-center h-11 rounded-[10px] text-sm font-semibold w-full transition-all" style={isAuth ? {background:'#f8fafa', color:'#0c181e'} : isPres ? {background:'#003E7A', color:'#f8fafa', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 2px rgba(13,10,31,0.20), 0 6px 20px rgba(0,62,122,0.42)'} : {background:'#fff', color:'#001540', boxShadow:'inset 0 0 0 1px #9eb6dc'}}>
                    {t.cta} →
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}