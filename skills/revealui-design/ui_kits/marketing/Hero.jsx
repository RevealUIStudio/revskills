/**
 * Marketing Hero — aligned to apps/marketing craft pass (2026-08).
 * Signature moment: receipt motif (not CLI, not multi-blob gradients).
 * Locked production H1: "Build it once. Every product after starts ahead."
 * CLI quick-start lives on GetStarted, not the hero.
 */
function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-white px-6 pt-16 pb-16 sm:pt-24 sm:pb-20 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0" style={{background:'linear-gradient(to bottom, rgba(0,62,122,0.03), white, white)'}} />
        <div className="absolute -top-32 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full" style={{background:'radial-gradient(closest-side, rgba(0,62,122,0.12), transparent 70%)', opacity:0.45, filter:'blur(48px)'}} />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          {/* Audience toggle (chrome only in kit; production is router Links) */}
          <div className="mb-7 flex justify-center sm:mb-8">
            <nav aria-label="Choose your view" className="inline-flex items-center gap-1 rounded-full p-1" style={{background:'#f1f5fa', boxShadow:'inset 0 0 0 1px rgba(10,19,32,0.08)'}}>
              <span className="rounded-full px-4 py-1.5 text-sm font-medium" style={{color:'#4f6580'}}>Non-technical</span>
              <span className="rounded-full px-4 py-1.5 text-sm font-semibold text-white" style={{background:'#003E7A'}}>Technical</span>
            </nav>
          </div>

          <h1 style={{fontFamily:'"Inter Tight", sans-serif'}} className="text-[2.75rem] font-extrabold leading-[1.05] tracking-tighter text-brand-900 sm:text-6xl lg:text-7xl">
            Build it once. Every product after starts ahead.
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-brand-500 sm:mt-8 sm:text-xl">
            RevealUI is the self-hosted runtime where your business and the AI agents that run it live under one roof. Every agent is a governed and audited user that lives on your infrastructure. It runs on any AI provider you choose.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 sm:mt-10 sm:gap-4">
            <a href="#" className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-[10px] px-6 h-12 text-sm font-semibold transition-all" style={{background:'#003E7A', color:'#f8fafa', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 2px rgba(13,10,31,0.20), 0 8px 22px rgba(0,62,122,0.32)'}}>
              Start free
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </a>
            <a href="#" className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-[10px] px-6 h-12 text-sm font-semibold bg-white text-brand-900 transition-all" style={{boxShadow:'inset 0 0 0 1px #9eb6dc'}}>
              See it on GitHub
            </a>
          </div>

          {/* Trust strip: separators, not brand dots (Linear craft: limit chrome) */}
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-y-2 text-sm list-none p-0" style={{color:'#4f6580'}}>
            {['Open source', 'Self-hostable', 'Local-first AI'].map((signal, index) => (
              <li key={signal} className="flex items-center">
                {index > 0 && <span aria-hidden="true" className="mx-3 h-3 w-px sm:mx-4" style={{background:'rgba(10,19,32,0.12)'}} />}
                <span>{signal}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Receipt motif — one signature creative moment */}
        <div className="mt-12 w-full max-w-md min-w-0 mx-auto text-left sm:mt-14 sm:max-w-lg">
          <section aria-label="Refund, handled by an agent" className="flex flex-col border rounded-2xl overflow-hidden" style={{background:'#141c28', borderColor:'rgba(255,255,255,0.08)'}}>
            <header className="flex items-baseline justify-between gap-3 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">Refund, handled by an agent</h3>
              <time className="text-xs tabular-nums" style={{color:'#8298b3', fontFamily:'"JetBrains Mono", monospace'}}>09:41:10</time>
            </header>
            <ul className="divide-y list-none p-0 m-0" style={{borderColor:'rgba(255,255,255,0.06)', fontFamily:'"JetBrains Mono", monospace'}}>
              {[
                ['09:41:07', 'support-agent', 'signed in as', 'agents@demo.revealui.com'],
                ['09:41:09', 'support-agent', 'refunded', 'order #4189'],
                ['09:41:09', 'policy', 'allowed', 'refunds under $100'],
                ['09:41:10', 'audit-log', 'recorded', 'the receipt'],
              ].map(([ts, actor, action, object]) => (
                <li key={ts + action} className="px-4 py-2.5 text-xs tabular-nums flex flex-wrap gap-x-2 gap-y-0.5">
                  <span style={{color:'#8298b3'}}>{ts}</span>
                  <span className="font-medium text-white">{actor}</span>
                  <span style={{color:'#c2cfd5'}}>{action}</span>
                  <span className="text-white">{object}</span>
                </li>
              ))}
            </ul>
            <footer className="flex items-center gap-2 border-t px-4 py-2.5 text-xs" style={{borderColor:'rgba(255,255,255,0.06)', color:'#8298b3', fontFamily:'"JetBrains Mono", monospace'}}>
              <span>sha256</span>
              <span className="text-white">4b6c…e91a</span>
            </footer>
          </section>
          <p className="mt-4 text-center text-sm" style={{color:'#4f6580'}}>
            If an agent did it, there&apos;s a receipt.{' '}
            <a href="#" className="text-brand-900 underline underline-offset-4">See ours →</a>
          </p>
        </div>
      </div>
    </section>
  );
}
