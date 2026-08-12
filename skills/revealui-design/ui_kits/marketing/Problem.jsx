/**
 * Problem — capability stack (craft 2026-08).
 * No spreadsheet table. No mobile matrix cards. No path cards.
 * Hierarchy via type + aligned columns (Linear: noise down, alignment up).
 */
const PATHS = [
  { name: 'Vendor sprawl', blurb: 'Rent a product for each slice. Glue them together yourself.', emphasis: false },
  { name: 'Agent framework only', blurb: 'Agents first. Rebuild sign-in, content, and billing underneath.', emphasis: false },
  { name: 'RevealUI', blurb: 'One self-hosted runtime for the business and the agents that run it.', emphasis: true },
];

const ROWS = [
  {
    capability: 'Sign-in and permissions',
    answers: [
      ['Vendor sprawl', 'A separate auth product, priced per seat'],
      ['Agent framework only', 'Bring your own'],
      ['RevealUI', 'Sign-in, roles, and policies built in'],
    ],
  },
  {
    capability: 'Content and admin',
    answers: [
      ['Vendor sprawl', 'A CMS plus a team to wire it'],
      ['Agent framework only', 'Bring your own'],
      ['RevealUI', 'Your content model, with admin UI and API'],
    ],
  },
  {
    capability: 'Billing',
    answers: [
      ['Vendor sprawl', 'Stripe + your glue'],
      ['Agent framework only', 'Bring your own'],
      ['RevealUI', 'Checkout, subscriptions, and webhook handling'],
    ],
  },
  {
    capability: 'Agents on your data',
    answers: [
      ['Vendor sprawl', 'One-off integrations'],
      ['Agent framework only', 'Tool registry only'],
      ['RevealUI', 'Agents use the same data and gates as your team'],
    ],
  },
];

function Problem() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.20em]" style={{color:'#4f6580'}}>The problem</p>
          <h2 style={{fontFamily:'"Inter Tight", sans-serif'}} className="mt-3 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
            Stop buying a separate product for each slice of the stack.
          </h2>
          <p className="mt-5 text-lg leading-8" style={{color:'#4f6580'}}>
            Most teams stitch sign-in, content, billing, and agents from different vendors. Or they pick an agent framework and rebuild the rest underneath it. RevealUI is the third path.
          </p>
        </div>

        <ul className="mx-auto mt-10 flex max-w-3xl flex-col gap-3 text-left list-none p-0 sm:mt-12" aria-label="Three paths">
          {PATHS.map((path) => (
            <li key={path.name} className="grid grid-cols-1 gap-1 sm:grid-cols-[11rem_1fr] sm:gap-6 sm:items-baseline">
              <span className={path.emphasis ? 'text-sm font-semibold text-brand-900' : 'text-sm font-medium'} style={path.emphasis ? null : {color:'#4f6580'}}>
                {path.emphasis && (
                  <span className="mr-2 block sm:inline text-[11px] font-semibold uppercase tracking-[0.20em]" style={{color:'#003E7A'}}>
                    The third path
                  </span>
                )}
                {path.name}
              </span>
              <span className="text-sm leading-6" style={{color: path.emphasis ? '#0a1320' : '#4f6580'}}>
                {path.blurb}
              </span>
            </li>
          ))}
        </ul>

        <ul className="mx-auto mt-14 max-w-3xl list-none border-t p-0 sm:mt-16" style={{borderColor:'rgba(10,19,32,0.08)'}} aria-label="Vendor sprawl vs agent-framework vs RevealUI comparison">
          {ROWS.map((row) => (
            <li key={row.capability} className="border-b py-8 first:pt-10 last:pb-2" style={{borderColor:'rgba(10,19,32,0.08)'}}>
              <h3 style={{fontFamily:'"Inter Tight", sans-serif'}} className="text-base font-semibold tracking-tight text-brand-900 sm:text-lg">
                {row.capability}
              </h3>
              <dl className="mt-4 space-y-3">
                {row.answers.map(([label, value], i) => {
                  const emphasis = i === 2;
                  return (
                    <div key={label} className="grid grid-cols-1 gap-0.5 sm:grid-cols-[11rem_1fr] sm:items-baseline sm:gap-6">
                      <dt className={emphasis ? 'text-sm font-semibold text-brand-900' : 'text-sm'} style={emphasis ? null : {color:'#4f6580'}}>
                        {label}
                      </dt>
                      <dd className={emphasis ? 'text-sm leading-6 font-medium text-brand-900' : 'text-sm leading-6'} style={emphasis ? null : {color:'#4f6580'}}>
                        {value}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
