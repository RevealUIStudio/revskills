function NavBar() {
  const links = [['Product','#products'],['Pricing','#pricing'],['Docs','#'],['Blog','#'],['Changelog','#']];
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md" style={{background:'rgba(255,255,255,0.85)', borderBottom:'1px solid #e0e7eb'}}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <a href="#" className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" style={{borderRadius:'6px',flexShrink:0}}><rect width="28" height="28" rx="6" fill="#003E7A"/><text x="7" y="20" fontFamily="'Inter Tight',sans-serif" fontWeight="800" fontSize="16" fill="#f8fafc">R</text><circle cx="22" cy="22" r="3.5" fill="#f0b519" stroke="#f8fafc" strokeWidth="1.5"/></svg>
          <span className="text-lg font-bold tracking-tight text-brand-900" style={{fontFamily:'"Inter Tight", sans-serif'}}>RevealUI</span>
          <span className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{background:'#001540', color:'#9eb6dc', boxShadow:'inset 0 0 0 1px #001540'}}>v0.4.2</span>
        </a>
        <nav className="hidden md:flex items-center gap-7">
          {links.map(([l,h]) => (
            <a key={l} href={h} className="text-sm font-medium text-brand-600 hover:text-brand-900 transition-colors">{l}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href="#" className="hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold" style={{background:'#e3eafc', color:'#001540', boxShadow:'inset 0 0 0 1px #9eb6dc'}}>
            ★ Star
          </a>
          <a href="#" className="text-sm font-medium text-brand-600 px-3 hover:text-brand-900">Log in</a>
          <a href="#" className="inline-flex items-center gap-1 rounded-[10px] px-4 h-9 text-sm font-semibold transition-all" style={{background:'#003E7A', color:'#f8fafa', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 2px rgba(13,10,31,0.20), 0 6px 20px rgba(0,62,122,0.42)'}}>
            Start free →
          </a>
        </div>
      </div>
    </header>
  );
}