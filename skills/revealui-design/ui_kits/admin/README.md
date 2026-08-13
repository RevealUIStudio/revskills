# Admin UI kit

The Babel-in-browser `.jsx` starting points are retired (GAP-479). They were a
parallel UI stack next to `@revealui/presentation`.

For production or prototype React, compose presentation in TypeScript:

```tsx
import { Button, Input, Sidebar } from '@revealui/presentation'
```

Tokens: `@revealui/tokens/design-context/`. Live admin:
`apps/admin/src/` in the revealui repo.

`index.html` is a pointer page only. Static mock HTML (no JSX) is still
allowed for throwaway artifacts.
