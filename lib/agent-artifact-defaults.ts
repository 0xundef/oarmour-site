import fs from 'fs'
import path from 'path'

function resolveHeadlessFromEnv(): boolean {
    const raw = process.env.PLAYWRIGHT_CLI_HEADLESS
    if (raw === undefined || String(raw).trim() === '') return true
    return !/^0|false|no|off$/i.test(String(raw).trim())
}

/**
 * Default `cli_config.json` for extension runs — aligned with a known-good MetaMask / Chromium setup:
 * chromium channel, headless by default, persistent `userDataDir`, extension load args, sandbox disabled for CI/Linux.
 *
 * - `PLAYWRIGHT_CLI_USER_DATA_DIR`: optional absolute profile path (default: `<artifact>/.playwright-profile`).
 * - `PLAYWRIGHT_CLI_HEADLESS`: set `0` / `false` / `no` / `off` for headed browser.
 */
export function buildDefaultCliConfigPayload(extensionRootAbs: string) {
    const abs = path.resolve(extensionRootAbs)
    const userDataDir =
        process.env.PLAYWRIGHT_CLI_USER_DATA_DIR?.trim() || path.join(abs, '.playwright-profile')

    return {
        browser: {
            launchOptions: {
                headless: resolveHeadlessFromEnv(),
                channel: 'chromium',
                args: [
                    `--load-extension=${abs}`,
                    `--disable-extensions-except=${abs}`,
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                ],
            },
            browserName: 'chromium',
            userDataDir,
            chromiumSandbox: false,
        },
    }
}

/**
 * If `cli_config.json` is missing under the versioned artifact dir, write a minimal file so
 * browseragent can run `playwright-cli open --config=./cli_config.json`.
 */
export function ensureDefaultCliConfigIfAbsent(versionDir: string): void {
    const preferred = path.join(versionDir, 'cli_config.json')
    if (fs.existsSync(preferred)) return

    const payload = buildDefaultCliConfigPayload(versionDir)
    const dir = path.dirname(preferred)
    fs.mkdirSync(dir, { recursive: true })
    const tmpPath = path.join(dir, `.cli_config.json.${process.pid}.${Date.now()}.tmp`)
    fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    fs.renameSync(tmpPath, preferred)
}
