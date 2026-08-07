# Durable Solutions — Long-Term First, Hotfixes Are Debt

**Status:** convention. Applies to every session, product and internal work
alike. No "just this once" carve-out.

## The rule

1. **Prefer long-term durable solutions.** Fix root causes in the owning
   layer (shared lib, env bootstrap, policy, product primitive) so the
   failure class cannot recur. Session-local patches, ad hoc edits to
   generated or environment files, one-off shell recipes, and "works on my
   machine" overrides are not acceptable unless the project owner explicitly
   accepts a registered hotfix.
2. **Hotfixes are allowed only as registered debt.** If something needs to be
   unblocked right now, a narrow hotfix may ship, but it must be registered
   the same session. Unregistered hotfixes are policy violations, the same
   class of problem as orphaned temp scripts.
3. **Every hotfix has a durable destination.** Registration records: symptom,
   temporary shape, durable target, owning path/repo, and what counts as
   "converted." Pending hotfixes should surface at session boundaries until
   resolved.
4. **Extend before create still wins.** Durable does not mean greenfield.
   Prefer hardening the existing primitive (a seed script, a hook, a
   package, a gate) over standing up a parallel one-off.

## What counts as non-durable (must register or refuse)

| Shape | Examples |
|-------|----------|
| Env / machine only | Editing a gitignored local env file without fixing the loader; an env-var override treated as the permanent recipe |
| Session-only | Scratch scripts left for someone else to run; undocumented escape-hatch flags |
| Symptom patch | Catch-and-ignore without a root fix; copying credentials into chat or docs |
| Parallel path | A second seed script or a second resolver "just for this one case" |
| Silent demotion | "We'll harden this later" with no registry entry and no tracked follow-up |

## What counts as durable

- A shared module, rule, hook, or CI gate that fails closed for the whole
  class of problem, not just the instance in front of you.
- Documented escape hatches with explicit, named override flags.
- A design doc or ticket when the durable fix needs multi-session design.
- Tests that lock the durable behavior in place (prove red, then green).

## Relationship to other conventions

- Extend-before-create: durable means extending the real primitive, not
  building a second one beside it.
- Temp-scripts lifecycle: one-shot helper scripts are a related but separate
  lifecycle (register, confirm, clean up) from hotfix debt.
- Disposition boundary: registering a hotfix is proposal-shaped; shipping the
  durable fix to production still needs the same authorization any
  disposition needs.
