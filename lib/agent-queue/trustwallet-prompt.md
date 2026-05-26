# Trust Wallet extension test prompt

Chrome Web Store ID: **`egjidjbpglichdcondbcbdnbeeppgdph`**

You are driving **playwright-cli** (and related shell tools) to smoke-test the **Trust Wallet** unpacked extension. The default working directory for `shell_command` is the per-version **sidecar** folder (next to the agent queue) that contains **`cli_config.json`**—use that unless `cwd` is set. Prefer commands and URLs defined in `cli_config.json` when present.

## Constraints (CSP / `eval` — Trust Wallet extension pages)

Trust Wallet’s UI runs on **`chrome-extension://…`** origins with a strict **Content Security Policy** that typically **blocks `eval` and inline script execution**.

- **Do not** use `playwright-cli eval …` (or similar “inject and run arbitrary JS string” automation) **while focused on the Trust Wallet / extension UI**—it often fails or appears blocked for this reason.
- **Prefer** tab selection, snapshots, clicking by stable labels / roles / visible text, keyboard input, and screenshots. Use `playwright-cli --help` (or `-help`) and **`cli_config.json`** for supported non-eval commands.
- On **normal `https://` test dapps**, `eval` may work if the page CSP allows it; still prefer the same non-eval style when possible.

## Goals

1. Launch Chromium with Trust Wallet loaded (`playwright-cli open --config=./cli_config.json` or the path documented in config).
2. Right after a successful open, call **`start_network_capture`** (clears the in-session request list via `playwright-cli requests --clear` for this run).
3. Open the **Trust Wallet** extension (toolbar icon or `chrome://extensions` to confirm it is loaded).
4. Complete the **已有钱包 → 密码 → MetaMask → recovery phrase** onboarding path (see **Trust Wallet UI flow** below)—use a test mnemonic from **`generate_mnemonic`**; do **not** create a real mainnet wallet with user funds.
5. After each meaningful UI state, take a screenshot and append a step with **`record_step`** (`time` ISO 8601, `thinking`, `image` under `ai_testing/<runId>/`).
6. If `cli_config.json` documents a test dApp URL, optionally navigate there and attempt **Connect** / **Approve** only when the UI clearly offers it; otherwise stop after a successful wallet home / account view.
7. **Network traffic:** before finishing, call **`capture_network_traffic`**. It snapshots HTTPS traffic into **`ai_testing/<runId>/network.json`** (via `playwright-cli requests` under the hood). **Always call it**—zero requests is OK; the file must exist with `"requests": []`. `chrome-extension://` URLs are excluded. For offline review use **`network.json` only**; do not use `playwright-cli request <index>` after the browser session ends.
8. Call **`validate_recordings`**, then summarize what was reachable.

## Trust Wallet UI flow (welcome / onboarding)

The first-run UI is often **Chinese**. Use visible text (or accessibility labels) to click—do not assume English. After each screen change, **screenshot** and **`record_step`**.

| UI text (zh) | Meaning | Action for this test |
|--------------|---------|----------------------|
| 我已阅读并同意使用条款和隐私政策 | Terms & Privacy checkbox | **Check** if unchecked before continuing |
| **已有钱包** | I already have a wallet | **Click this** on the welcome screen (blue primary button) |
| 创建一个新钱包 | Create a new wallet | **Do not** click — skip new-wallet creation |
| 选择一种安全保护方案 | Choose a security method | On this screen, select **密码** (password) |
| 密码 | Password | **Click** to proceed to set / confirm password |
| MetaMask | MetaMask (import source) | **Select** when choosing an existing wallet provider |
| 已有 Trust Wallet 移动端 App? | Already have mobile app | **Skip** |
| 扫码同步信息 | Scan QR to sync from mobile | **Skip** — not suitable for headless smoke test |

**Required path (import via MetaMask + recovery phrase):**

### 1. Welcome — 已有钱包

1. Open the Trust Wallet extension UI (toolbar icon or full-page onboarding).
2. Ensure **我已阅读并同意使用条款和隐私政策** is **checked** (check the box if it is empty).
3. Click the blue button **已有钱包** (not **创建一个新钱包**).
4. Screenshot + **`record_step`**.

### 2. Security — 密码

1. On **选择一种安全保护方案**, click the row **密码** (padlock icon, chevron on the right).
2. On the password screen, enter a **test-only** password in both fields (e.g. `TestWallet123!` — document it in `thinking`; never a real user password).
3. Confirm / continue (e.g. **下一步**, **继续**, **创建**, or **确认** — match the visible primary button).
4. Screenshot + **`record_step`** after password is set.

### 3. Import source — MetaMask

1. When prompted to choose an **existing wallet** / import source, select **MetaMask** (icon or label **MetaMask**).
2. Do **not** pick Trust Wallet mobile, QR sync, or hardware-only paths unless MetaMask is unavailable; then report the blocker.
3. Screenshot + **`record_step`**.

### 4. Recovery phrase — Secret Recovery Phrase or Private Key

1. On the import screen, use the flow for **Secret Recovery Phrase** or **Private Key** (English UI may show exactly that heading; Chinese may say **助记词** / **恢复短语** / **私钥** — follow what is on screen).
2. Call **`generate_mnemonic`** for a fresh **12- or 24-word** BIP39 phrase if you need one; word count must match the UI (12 vs 24).
3. Enter the phrase into the UI (single textarea or per-word fields — adapt to what appears). If the UI offers **Private Key** instead, you may use a test key only if the product flow requires it; prefer mnemonic when both are offered.
4. Complete any **Next** / **Import** / **继续** confirmation until import finishes.
5. Screenshot + **`record_step`**.

### 5. Done with onboarding

1. Stop when you reach a **main wallet / home** view (balance area, asset list, or account header visible). Final screenshot + **`record_step`**.

If the UI is **English** instead, use the same sequence with equivalent labels: **“I already have a wallet”** → **Password** → **MetaMask** → **Secret Recovery Phrase or Private Key** → import → wallet home.

## Rules

- **Non-destructive only:** no real mainnet transactions, no sending funds, no bridging real assets.
- If the same step fails **twice** with the same error, summarize and stop rather than looping.
- This run tests **Trust Wallet only**; **MetaMask** appears only as the **import source** inside Trust Wallet’s UI (not the MetaMask extension).
- Finish order: **`capture_network_traffic`** → **`validate_recordings`** → short summary.

## Done when

You have a short summary of what was reachable, at least one screenshot-backed step in **`recordings.json`**, **`network.json`** under `ai_testing/<runId>/` (empty `requests` is valid), and validation passes—or a clear explanation of a blocking error (terms not clickable, import blocked, missing host permission, etc.). **`agent_testing.log`** in the same folder captures service logs and the agent run narrative for post-mortem review.
