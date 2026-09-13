---
name: skill-audit
description: Inventory, de-duplicate and usage-audit the AI agent skills installed on this machine (ZCode, Codex, Claude Code, Gemini CLI, OpenCode, Cursor). Use when the user asks to audit skills, list installed skills, find zombie/unused skills, check duplicates or stale plugin copies, or estimate the context-tax overhead of their skills. Runs a local zero-dependency CLI — no network, no API keys, no telemetry.
---

# skill-audit

Audit the agent skills installed on this machine by running the bundled CLI, then
summarize the report for the user.

## How to run

1. Determine the project directory the user cares about (default: current working directory).
2. Run the CLI from this skill's directory:

```bash
node "<skill_dir>/bin/cli.js" --dir "<project_dir>"
```

3. Read the output and present a short summary with these highlights:
   - total skills per agent (the `skills:` line);
   - zombie skills (0 triggers) — the red rows;
   - duplicate names / identical-content groups at the bottom;
   - the context-tax line (tokens carried by every request).

## Variants

- Machine-readable: add `--json`.
- Inventory only, skip session-log parsing: add `--no-usage`.
- Trigger counts only: run `node "<skill_dir>/bin/cli.js" usage`.

## Guardrails

- Everything is local-only. Never send any part of the report (or session-log
  contents) to a network service.
- Do not delete, move or modify any skill directory or log file — this tool only
  reads. Cleanup is a future feature; for now, only advise.
- Usage counts are matched by skill name; same-named skills in different agents
  share counts. Codex trigger numbers are baseline-diff estimates (marked ≈).
