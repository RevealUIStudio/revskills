function Footer() {
  const cols = [
    { h:'Product',   links:['Primitives','Pricing','Changelog','Roadmap'] },
    { h:'Developers',links:['Docs','MCP server','GitHub','Examples'] },
    { h:'Company',   links:['About','Blog','Customers','Careers'] },
    { h:'Legal',     links:['Privacy','Terms','Security','Trust'] }
  ];
  return (
    <footer style={{background:'#07090e', color:'#4485bd'}}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2">
              <svg width="32" height="32" viewBox="0 0 28 28" fill="none" aria-hidden="true" style={{borderRadius:'6px',flexShrink:0}}><rect width="28" height="28" rx="6" fill="#003E7A"/><text x="7" y="20" fontFamily="'Inter Tight',sans-serif" fontWeight="800" fontSize="16" fill="#f8fafc">R</text><circle cx="22" cy="22" r="3.5" fill="#f0b519" stroke="#f8fafc" strokeWidth="1.5"/></svg>
              <span className="text-2xl font-bold tracking-tight" style={{color:'#f8fafa', fontFamily:'"Inter Tight", sans-serif'}}>RevealUI</span>
            </div>
            <p className="mt-4 text-sm leading-6 max-w-sm" style={{color:'#4485bd'}}>
              Auth, billing, content, and AI primitives wired into one runtime — exposed to your agents via MCP.
            </p>
            {/* status badge — from badges spec */}
            <div className="mt-6 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs" style={{background:'#16242c', color:'#9eb6dc', boxShadow:'inset 0 0 0 1px #001540'}}>
              <span className="relative inline-block h-1.5 w-1.5 rounded-full" style={{background:'#4485bd'}}>
                <span className="absolute inset-[-3px] rounded-full animate-ping" style={{background:'#4485bd',opacity:0.30}} />
              </span>
              All systems operational
            </div>
          </div>
          {cols.map(c => (
            <div key={c.h}>
              <h4 className="text-sm font-semibold" style={{color:'#f8fafa'}}>{c.h}</h4>
              <ul className="mt-4 space-y-3">
                {c.links.map(l => (
                  <li key={l}><a href="#" className="text-sm transition-colors hover:text-white" style={{color:'#4485bd'}}>{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-8" style={{borderTop:'1px solid #001540'}}>
          <p className="text-xs" style={{color:'#004F8C'}}>© 2026 RevealUI Studio · MIT &amp; Fair Source.</p>
          <p className="text-xs" style={{color:'#004F8C', fontFamily:'"JetBrains Mono", monospace'}}>v1.4.0 · built {new Date().toISOString().slice(0,10)}</p>
        </div>
      </div>
    </footer>
  );
}