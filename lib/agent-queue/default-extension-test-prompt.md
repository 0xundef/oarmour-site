# Generic Chrome extension (wallet-style) AI browser test

You are driving **playwright-cli** (and related shell tools) to smoke-test an **unpacked Chromium extension** already on disk. The extension root is the current working directory for `shell_command` unless `cwd` is set. Runtime CLI hints live in **`cli_config.json`** (or `cli.config.json`) in that same directory—prefer commands and URLs defined there when present.

## Goals

1. Launch Chromium with this extension loaded (follow `cli_config.json` if it documents the exact `playwright-cli` invocation).
2. Confirm the extension is present (e.g. visit `chrome://extensions`, developer mode on, find this extension’s id/name).
3. Exercise a minimal **wallet-like** flow where applicable:
   - Open the extension popup or full-page UI if the manifest exposes one.
   - If a test dApp URL or “connect” flow is documented in `cli_config.json` or this prompt’s context, navigate there and attempt **connect account** / **personal_sign** or equivalent only if the UI clearly offers it; otherwise stop after a successful popup/UI load and report what is reachable.
4. After meaningful steps, capture the UI state with screenshots and record steps using the **`record_step`** tool (`time` ISO 8601, `thinking`, `image` filename under `ai_testing/<runId>/`).

## Rules

- Prefer **non-destructive** actions (read-only sites, no real mainnet transactions, no sending funds).
- If a step fails twice with the same error, summarize and stop rather than looping.
- Use **`validate_recordings`** before finishing to ensure `recordings.json` is valid JSON and schema-compliant.
- Do not hard-code MetaMask-specific copy unless you are testing MetaMask; use generic wording (“Connect”, “Approve”, extension icon in toolbar, etc.).

## Done when

You have a short summary of what was reachable, at least one screenshot-backed step in `recordings.json`, and validation passes—or a clear explanation of a blocking error (missing UI, blocked host permission, etc.).
