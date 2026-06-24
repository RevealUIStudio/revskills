---
title: /checkpoint commits + converges the .jv delta, worktree-gated
date: 2026-06-24
status: accepted
---

# /checkpoint auto-commit is worktree-gated on the .jv Single-Writer Discipline

`/checkpoint` 0.5.0 commits + converges the `.jv` handoff/workboard delta to `origin/test` by default (Step 5b), removing the manual commit-after-checkpoint that was friction every session and a clobber window in the shared `.jv` ext4 checkout, but it GATES that commit on the `.jv` Single-Writer Discipline: a solo session commits on the `.jv` branch directly, while when a peer session is live the commit happens from a throwaway `~/revfleet/.jv-wt/` worktree so the main checkout never strands on a `chore/checkpoint-*` branch — which was the root cause of the prior 8-session checkpoint-merge divergence (a naive auto-commit left the main checkout on a checkpoint branch that later merged+deleted, so every subsequent checkpoint merged onto the dead branch and never converged). `/checkpoint --no-commit` preserves the pre-0.5.0 owner-review behavior (writes left unstaged). The commit always uses the locked posture (`core.fileMode=false`, explicit pathspec that leaves peer-WIP `tmp/` untracked, `-F` message, merge-COMMIT via a `chore/checkpoint-*` PR, no `--admin`/squash) and falls back to the `--no-commit` end state on any non-clean reconcile rather than risk stranding or clobbering.

This decision record lives in `revskills` (the home of the checkpoint skill) to keep the change a single-repo PR. If a fleet-level ADR is preferred it can be lifted into `~/revfleet/.jv/docs/decisions/`, which would then require a `tracking-issue:` field per the `m1-adr-tracking` check.
