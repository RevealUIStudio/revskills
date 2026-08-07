# Disposition Actions — Propose, Don't Dispose

**Status:** convention. Applies to every agent working in this fleet.

## The boundary

Agent work is proposal-shaped by default. A proposal produces an artifact
someone else can act on; a disposition consummates an outcome. Proposals
never need special authorization; dispositions always do.

**Always safe (proposal-shaped):**
- Reading, grepping, auditing; empirical tests in a scratch environment.
- Posting review or verdict comments on PRs.
- Creating worktrees, committing to fresh branches, pushing feature branches.
- Opening PRs, filing issues, authoring specs and plan docs.

**Disposition-shaped (requires named, in-session authorization from the
project owner, or a standing settings allow-rule):**
- Merging any PR the agent authored this session, in any repo.
- Merging any PR whose subject matter is security-sensitive, even when a
  docs-self-merge convention would otherwise cover it.
- Applying gate-clearing labels (approval labels and siblings).
- Deleting remote branches.
- Mutating repo settings, rulesets, required checks, CI variables or
  secrets, webhooks, environments.
- Force pushes, history rewrites, removing another session's worktree.

A blanket preference recorded in memory ("merge green PRs") does not cover
the security-classed items above; only named in-session words or a settings
rule do.

## Never bundle a disposition with anything else

One disposition action per command, alone. Permission classifiers typically
evaluate per command, so a mid-bundle block leaves the bundle half-executed
(for example: a merge lands, but the follow-up branch delete is blocked,
leaving state someone has to go verify by hand). A lone command either fully
lands or cleanly does not.

## When work is ready and no authorization exists

Stop at the open PR. List it under owner actions with the exact one-line
command that clears it. Do not re-send a blocked command, do not reword it,
and do not accomplish it through another tool.

## Reducing friction the sanctioned way

- The project owner names dispositions in the prompt when delegating them.
- The owner adds targeted permission allow-rules for command classes that
  should never prompt.
- Widening this boundary (letting agents self-merge a class of change)
  happens by the owner editing the rule, not by an agent inferring it.
