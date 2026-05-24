// @ts-nocheck
function Topbar() {
  return (
    <header className="h-14 flex items-center px-6 border-b gap-4 shrink-0" style={{borderColor: 'var(--rvui-border)', background: 'var(--rvui-surface-0)'}}>
      <nav className="flex items-center gap-1.5 text-sm" style={{color: 'var(--rvui-text-2)'}}>
        <span>Workspace</span>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="m9 5 7 7-7 7"/></svg>
        <span style={{color: 'var(--rvui-text-0)'}}>Overview</span>
      </nav>
      <div className="flex-1 max-w-md ml-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} style={{color: 'var(--rvui-text-2)'}}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
          <input placeholder="Search agents, users, content…" className="w-full h-9 pl-9 pr-12 rounded-md text-sm outline-none" style={{background: 'var(--rvui-surface-1)', border: '1px solid var(--rvui-border)', color: 'var(--rvui-text-0)'}}/>
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded" style={{background: 'var(--rvui-surface-2)', color: 'var(--rvui-text-2)', fontFamily: 'JetBrains Mono, monospace'}}>⌘K</kbd>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md font-medium" style={{background: 'var(--rvui-brand-soft)', color: 'var(--rvui-brand)'}}>
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{background: 'var(--rvui-brand)'}} />
          LIVE
        </span>
        <button className="h-9 w-9 rounded-md flex items-center justify-center transition-colors hover:bg-white/5" style={{color: 'var(--rvui-text-1)'}}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg>
        </button>
        <button className="h-9 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5" style={{background: 'var(--rvui-brand)', color: 'var(--rvui-text-on-brand)'}}>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          New agent
        </button>
      </div>
    </header>
  );
}
window.Topbar = Topbar;
