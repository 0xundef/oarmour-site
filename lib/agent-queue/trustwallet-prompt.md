# Trust Wallet extension test prompt

Chrome Web Store ID: **`egjidjbpglichdcondbcbdnbeeppgdph`**

You are driving **playwright-cli** (and related shell tools) to smoke-test the **Trust Wallet** unpacked extension. The default working directory for `shell_command` is the per-version **sidecar** folder (next to the agent queue) that contains **`cli_config.json`**—use that unless `cwd` is set. Prefer commands and URLs defined in `cli_config.json` when present.

## Constraints (CSP / `eval` — Trust Wallet extension pages)

Trust Wallet’s UI runs on **`chrome-extension://…`** origins with a strict **Content Security Policy** that typically **blocks `eval` and inline script execution**.

- **Do not** use `playwright-cli eval …` (or similar “inject and run arbitrary JS string” automation) **while focused on the Trust Wallet / extension UI**—it often fails or appears blocked for this reason.
- **Prefer** tab selection, snapshots, clicking by stable labels / roles / visible text, keyboard input, and screenshots. Use `playwright-cli --help` and **`cli_config.json`** for supported non-eval commands.
- On **normal `https://` test dapps**, `eval` may work if the page CSP allows it; still prefer the same non-eval style when possible.

## Goals

1. Launch Chromium with Trust Wallet loaded (`playwright-cli open --config=./cli_config.json` or the path documented in config).
2. Right after a successful open, call **`start_network_capture`** (clears the playwright-cli network log for this run).
3. Open the **Trust Wallet** extension (toolbar icon or `chrome://extensions` to confirm it is loaded).
4. Complete a minimal **import / unlock** flow on the welcome screen (see **Trust Wallet UI flow** below)—use a test mnemonic from **`generate_mnemonic`**; do **not** create a real mainnet wallet with user funds.
5. After each meaningful UI state, take a screenshot and append a step with **`record_step`** (`time` ISO 8601, `thinking`, `image` under `ai_testing/<runId>/`).
6. If `cli_config.json` documents a test dApp URL, optionally navigate there and attempt **Connect** / **Approve** only when the UI clearly offers it; otherwise stop after a successful wallet home / account view.
7. **Network traffic:** before finishing, call **`capture_network_traffic`**. It runs `playwright-cli network --request-headers --filter="https?://"` and writes **`ai_testing/<runId>/network.json`**. **Always call it**—zero requests is OK; the file must exist with `"requests": []`. HTTPS matches are saved except `chrome-extension://` URLs.
8. Call **`validate_recordings`**, then summarize what was reachable.

## Trust Wallet UI flow (welcome / onboarding)

The first-run UI is often **Chinese**. Use visible text (or accessibility labels) to click—do not assume English.

| UI text (zh) | Meaning | Action for this test |
|--------------|---------|----------------------|
| 我已阅读并同意使用条款和隐私政策 | Terms & Privacy checkbox | **Check** if unchecked before continuing |
| **已有钱包** | I already have a wallet | **Prefer this** — import / restore with test mnemonic |
| 创建一个新钱包 | Create a new wallet | Avoid unless import path is blocked; creates extra setup |
| 已有 Trust Wallet 移动端 App? | Already have mobile app | Optional; skip for automation |
| 扫码同步信息 | Scan QR to sync from mobile | **Skip** — not suitable for headless smoke test |

**Recommended path (import):**

1. On the welcome screen, ensure the terms checkbox is checked.
2. Click **已有钱包**.
3. Follow on-screen steps to **import secret phrase / recovery phrase** (word count may be 12 or 24—match what the UI shows).
4. Call **`generate_mnemonic`** if you need a fresh BIP39 phrase; enter words into the UI fields the same way you would for other wallets (single textarea or per-word boxes—adapt to what appears).
5. Set a **test-only password** if prompted (use a fixed test password documented in `thinking`, e.g. `TestWallet123!`—never a real user password).
6. Stop when you reach a **main wallet / home** view (balance area, asset list, or account header visible). Take a final screenshot.

If the UI is **English** instead, equivalent controls are typically **“I already have a wallet”**, **“Create a new wallet”**, and **“I agree to the Terms of Service and Privacy Policy”**—same rules: prefer import, check terms, skip QR sync.

## Rules

- **Non-destructive only:** no real mainnet transactions, no sending funds, no bridging real assets.
- If the same step fails **twice** with the same error, summarize and stop rather than looping.
- Do not hard-code MetaMask copy; this run is **Trust Wallet only**.
- Finish order: **`capture_network_traffic`** → **`validate_recordings`** → short summary.

## Done when

You have a short summary of what was reachable, at least one screenshot-backed step in **`recordings.json`**, **`network.json`** under `ai_testing/<runId>/` (empty `requests` is valid), and validation passes—or a clear explanation of a blocking error (terms not clickable, import blocked, missing host permission, etc.).
