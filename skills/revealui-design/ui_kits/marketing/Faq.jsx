const FAQ_ITEMS = [
  { q:'Why \"agent-native\"?', a:'Every primitive ships with an MCP server. Your agents query users, content, billing, and intelligence the same way they call any other tool — no glue code.' },
  { q:'How is this different from Supabase or Convex?', a:'Those give you a database. RevealUI gives you a business runtime — auth + billing + content + AI, wired together, with the agent surface built in.' },
  { q:'What is Fair Source?', a:'Source-available, free for teams under \$1M ARR, converts to MIT after two years. The full license is in the repo.' },
  { q:'Can I self-host?', a:'Yes. `docker compose up` gets you the full stack on your hardware. No phone-home, no vendor APIs required.' }
];

function Faq() {
  const [open, setOpen] = React.useState(0);
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-400">Frequently asked</p>
          <h2 style={{fontFamily:'"Inter Tight", sans-serif'}} className="mt-3 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">Questions, answered.</h2>
        </div>
        <div className="mt-12 rounded-2xl bg-white" style={{boxShadow:'inset 0 0 0 1px #9eb6dc'}}>
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className={i ? 'border-t' : ''} style={i ? {borderColor:'#e0e7eb'} : null}>
              <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between px-6 py-5 text-left">
                <span className="text-base font-semibold text-brand-900">{item.q}</span>
                <span className="ml-4 flex h-7 w-7 flex-none items-center justify-center rounded-full transition-transform" style={{background:'#e3eafc', boxShadow:'inset 0 0 0 1px #9eb6dc', transform: open === i ? 'rotate(45deg)' : 'none'}}>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="#001540" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/></svg>
                </span>
              </button>
              {open === i && (
                <div className="px-6 pb-6 text-sm leading-7 text-brand-500">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}