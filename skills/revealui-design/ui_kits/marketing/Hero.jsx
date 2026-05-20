function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-white px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0" style={{background:'linear-gradient(to bottom, rgba(240,243,245,0.55), white, white)'}} />
        <div className="absolute -top-40 left-1/2 h-[700px] w-[1100px] -translate-x-1/2 rounded-full" style={{background:'radial-gradient(closest-side, rgba(0,62,122,0.18), rgba(0,62,122,0.04) 60%, transparent 75%)'}} />
      </div>
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          {/* status pill — from badges spec, b-bare with dot-pulse */}
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{background:'#e3eafc', color:'#001540', boxShadow:'inset 0 0 0 1px #9eb6dc'}}>
            <span className="relative inline-block h-1.5 w-1.5 rounded-full" style={{background:'#003E7A'}}>
              <span className="absolute inset-[-3px] rounded-full animate-ping" style={{background:'#003E7A',opacity:0.30}} />
            </span>
            Agent-native business runtime
          </span>
          <h1 style={{fontFamily:'"Inter Tight", sans-serif'}} className="mt-7 text-5xl font-extrabold tracking-tight text-brand-900 sm:text-6xl lg:text-7xl">
            <span className="block">Build a business</span>
            <span className="block">your agents can run.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-brand-500 sm:text-xl">
            Auth, billing, content, and AI primitives wired into one runtime, with every primitive exposed to your agents via MCP.
          </p>

          {/* Buttons — primary + inverse + outline pattern from buttons spec */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="#" className="group inline-flex items-center justify-center gap-2 rounded-[10px] px-6 h-12 text-sm font-semibold transition-all" style={{background:'#003E7A', color:'#f8fafa', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 2px rgba(13,10,31,0.20), 0 8px 22px rgba(0,62,122,0.42)'}}>
              Start free
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </a>
            <a href="#demo" className="inline-flex items-center justify-center gap-2 rounded-[10px] px-6 h-12 text-sm font-semibold bg-white text-brand-900 transition-all" style={{boxShadow:'inset 0 0 0 1px #9eb6dc'}}>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              Watch the 90-second demo
            </a>
          </div>

          {/* Code button — from buttons spec, btn-code */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-[10px] px-5 py-3 text-sm" style={{background:'#07090e', color:'#e0e7eb', boxShadow:'inset 0 0 0 1px #001540', fontFamily:'"JetBrains Mono", monospace', fontFeatureSettings:'"liga" 0'}}>
            <span style={{color:'#4485bd'}}>$</span>
            <span style={{color:'#9eb6dc'}}>npx</span>
            <span style={{color:'#f8fafa'}}>create-revealui@latest</span>
            <span style={{color:'#4485bd'}}>my-app</span>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-brand-400">
            {['OSS (MIT)','Pro is Fair Source','Self-hostable','No vendor lock-in'].map(label => (
              <div key={label} className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="#003E7A" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}