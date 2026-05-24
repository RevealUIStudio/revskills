// @ts-nocheck
const NAV_SECTIONS = [
  { h: 'Workspace', items: [
    { l: 'Overview', i: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z', active: true }, 
    { l: 'Agents', i: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z', badge: '12' },
  ]},
  { h: 'Primitives', items: [
    { l: 'Users', i: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z' },
    { l: 'Content', i: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' },
    { l: 'Products', i: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z' },
    { l: 'Payments', i: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z' },
  ]},
  { h: 'Develop', items: [
    { l: 'MCP servers', i: 'M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z' },
    { l: 'Webhooks', i: 'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244' },
    { l: 'Audit log', i: 'M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z' },
  ]},
];

function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r flex flex-col" style={{background: 'var(--rvui-surface-1)', borderColor: 'var(--rvui-border)'}}>
      <div className="h-14 flex items-center px-4 gap-2 border-b" style={{borderColor: 'var(--rvui-border)'}}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" style={{borderRadius:'6px',flexShrink:0}}><rect width="28" height="28" rx="6" fill="#003E7A"/><text x="7" y="20" fontFamily="'Inter Tight',sans-serif" fontWeight="800" fontSize="16" fill="#f8fafc">R</text><circle cx="22" cy="22" r="3.5" fill="#f0b519" stroke="#f8fafc" strokeWidth="1.5"/></svg>
        <span className="text-sm font-semibold" style={{color: 'var(--rvui-text-0)'}}>RevealUI Studio</span>
      </div>
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {NAV_SECTIONS.map(s => (
          <div key={s.h}>
            <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{color: 'var(--rvui-text-2)'}}>{s.h}</div>
            <nav className="space-y-0.5">
              {s.items.map(it => (
                <a key={it.l} href="#" className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors" style={it.active ? {background: 'var(--rvui-brand-subtle)', color: 'var(--rvui-brand-text)'} : {color: 'var(--rvui-text-1)'}}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d={it.i}/></svg>
                  <span className="flex-1">{it.l}</span>
                  {it.badge && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{background: 'var(--rvui-surface-3)', color: 'var(--rvui-text-1)'}}>{it.badge}</span>}
                </a>
              ))}
            </nav>
          </div>
        ))}
      </div>
      <div className="p-3 border-t flex items-center gap-2.5" style={{borderColor: 'var(--rvui-border)'}}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold" style={{background: 'var(--rvui-brand-subtle)', color: 'var(--rvui-brand-text)'}}>JS</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate" style={{color: 'var(--rvui-text-0)'}}>jordan@studio.com</div>
          <div className="text-[10px]" style={{color: 'var(--rvui-text-2)'}}>Pro · 10k tasks/mo</div>
        </div>
      </div>
    </aside>
  );
}
window.Sidebar = Sidebar;
