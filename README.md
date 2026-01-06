# WappLink

Website Builder
Create buttons, move them around, and save the layout.

## AI Setup

- Agent: Codex CLI (GPT-5 based).
- Scope: edits project files, runs local commands, and updates `WORK_LOG.json`.
- Context: no persistence beyond this repo; relies on `WORK_LOG.json` for continuity.

## Workflow Optimization

- Work in small, focused tasks; confirm each change before stacking more.
- Reference UI by target names from `UI_TARGETS.md` to avoid ambiguity.
- Provide a short acceptance criteria line ("done when...") for UI changes.
- Keep `WORK_LOG.json` updated after changes and include a short last-known state note when behavior is tricky.
- Prefer incremental renders and avoid full tree re-renders when possible for UI performance.
- Policy intents: keep lean principles, update logs with file changes, and preserve meaning when policies are shortened.
- Policies live in `POLICIES.json`; copy it to new projects when you only need the rules.
