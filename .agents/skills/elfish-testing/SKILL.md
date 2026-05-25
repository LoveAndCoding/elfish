---
name: elfish-testing
description: >-
  How to test elfish. Use when writing, changing, reviewing, or planning tests,
  and when building any feature via TDD. Defines what to fake, where a test
  belongs, what must run end-to-end, and how to tell a worthwhile test from a
  worthless one.
---

# Testing elfish

## The claim tests must protect

If the suite is green, elfish's **orchestration** is correct for any agent that returns
well-formed output: config loads, workflows sequence, gates gate, workspaces always clean
up, results/retries are determined right, exit codes are honest. Green while the system is
broken = a **test bug**. Fix the tests.

Agent output _quality_ is not in scope — the agent is faked.

## Rules

**Fake only the agent.** Replace agent execution at its boundary; run everything else for
real against a real temp filesystem. Never mock the filesystem or elfish's own packages — if
you need to, you're testing at the wrong layer; move up to a real seam test.

**Make the fake hostile and realistic.** It must reproduce failure (errors, malformed
output, unavailable agent, stalls), not just success — an always-succeeds double is banned.
Its outputs must trace to shapes the real agent actually produces, not invented ones.

**Don't test what the type system already enforces** — except at a genuine user-input
boundary (config, external or agent-provided data), where invalid values really arrive at
runtime and must be rejected with a clear error.

**Put each test where the smallest bug makes it red.** Pure logic → unit. Wrong handoff
between packages → seam test. Runtime decisions (result determination, retries, "every
workspace created is cleaned up") → property/invariant test. Only breaks in the assembled
binary → end-to-end.

**Always keep an end-to-end spine that runs the real entry point.** It must prove: it boots;
a clean run succeeds and cleans up; a failing gate stops the run with a reason; a failing
agent yields a defined failure and nonzero exit; bad config fails fast before doing work; a
cancelled run still cleans up. These never get skipped to make CI green.

## The loop

1. State the behavior as one observable sentence ("when X, the system does Y"). Can't? Don't code yet.
2. Write the failing test at the right layer; confirm it fails for the _right_ reason.
3. Implement the minimum with real components; fake only the agent.
4. Add the failure-path counterpart before calling it done.
5. Fixed a bug? Write the reproducing test first.
6. Never weaken a contract to pass — fix the producer.

## Judging a test

Ask: _what real breakage does this catch, and could the system break that way while it stays
green?_ "Nothing" or "yes" → delete it.

- **Good:** asserts an observable outcome, fails for one reason, survives a behavior-preserving refactor, deterministic.
- **Bad:** asserts call counts or internals, restates the type checker, piles on weak assertions, exists to raise coverage.

## Priorities

- **Invest most** where breakage is silent and costly: result determination, the agent
  boundary (false success is the worst outcome), workspace cleanup on failure, config validation.
- **Skip:** trivial glue, output wording, type-only changes, anything already pinned lower down.
- Prefer one sharp seam test over many mock-heavy unit tests.
- Coverage is not correctness and is not a gate. Flaky tests get fixed in the same change, never deleted.
