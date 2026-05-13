import fs from 'fs'
import path from 'path'
import { syncAgentQueueCliConfigTemplateFromBundled } from '@/lib/agent-queue'
import {
  getAgentCliConfigTemplatePath,
  getExtensionSidecarRoot,
  parseExtensionUnpackPath,
} from '@/lib/extension-storage'

function resolveHeadlessFromEnv(): boolean {
    const raw = process.env.PLAYWRIGHT_CLI_HEADLESS
    if (raw === undefined || String(raw).trim() === '') return true
    return !/^0|false|no|off$/i.test(String(raw).trim())
}

/** Escape backslashes for JSON string segments after placeholder substitution. */
function escapePathForJsonText(p: string): string {
    return p.replace(/\\/g, '\\\\')
}

/**
 * Substitute `{{EXTENSION_ROOT}}` and `{{USER_DATA_DIR}}` in the template text, then parse JSON.
 * `EXTENSION_ROOT` is the unpacked extension dir; `USER_DATA_DIR` defaults to `<sidecarRoot>/.playwright-profile`
 * unless `PLAYWRIGHT_CLI_USER_DATA_DIR` is set.
 */
export function fillCliConfigTemplate(
    templateRaw: string,
    extensionUnpackAbs: string,
    sidecarRootAbs: string,
): unknown {
    const abs = path.resolve(extensionUnpackAbs)
    const sidecar = path.resolve(sidecarRootAbs)
    const userDataDir =
        process.env.PLAYWRIGHT_CLI_USER_DATA_DIR?.trim() || path.join(sidecar, '.playwright-profile')
    const filled = templateRaw
        .replace(/\{\{EXTENSION_ROOT\}\}/g, escapePathForJsonText(abs))
        .replace(/\{\{USER_DATA_DIR\}\}/g, escapePathForJsonText(userDataDir))
    return JSON.parse(filled) as unknown
}

/** Programmatic fallback if no template exists (same shape as bundled template). */
function buildDefaultCliConfigPayload(extensionUnpackAbs: string, sidecarRootAbs: string) {
    const abs = path.resolve(extensionUnpackAbs)
    const sidecar = path.resolve(sidecarRootAbs)
    const userDataDir =
        process.env.PLAYWRIGHT_CLI_USER_DATA_DIR?.trim() || path.join(sidecar, '.playwright-profile')

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

function applyHeadlessOverride(payload: Record<string, unknown>): void {
    const browser = payload.browser
    if (!browser || typeof browser !== 'object') return
    const launch = (browser as Record<string, unknown>).launchOptions
    if (!launch || typeof launch !== 'object') return
    ;(launch as Record<string, unknown>).headless = resolveHeadlessFromEnv()
}

/**
 * If `cli_config.json` is missing, write it under the version **sidecar**
 * (`AGENT_QUEUE_ROOT/extension-data/<storeId>/<version>/`) when `versionDir` is a standard unpack path;
 * otherwise (legacy) write next to `versionDir`.
 * Template: `AGENT_QUEUE_ROOT/cli_config_template.json`, substituting:
 * - `{{EXTENSION_ROOT}}` → absolute unpacked extension directory
 * - `{{USER_DATA_DIR}}` → `PLAYWRIGHT_CLI_USER_DATA_DIR` or `<sidecar>/.playwright-profile`
 */
export function ensureDefaultCliConfigIfAbsent(versionDir: string): void {
    const parsed = parseExtensionUnpackPath(versionDir)
    const sidecar =
        parsed !== null
            ? getExtensionSidecarRoot(parsed.storeId, parsed.version)
            : versionDir
    const preferred = path.join(sidecar, 'cli_config.json')
    if (fs.existsSync(preferred)) return

    syncAgentQueueCliConfigTemplateFromBundled()

    let payload: Record<string, unknown>
    const templatePath = getAgentCliConfigTemplatePath()
    if (fs.existsSync(templatePath)) {
        const raw = fs.readFileSync(templatePath, 'utf8')
        try {
            payload = fillCliConfigTemplate(raw, versionDir, sidecar) as Record<string, unknown>
            if (
                process.env.PLAYWRIGHT_CLI_HEADLESS !== undefined &&
                String(process.env.PLAYWRIGHT_CLI_HEADLESS).trim() !== ''
            ) {
                applyHeadlessOverride(payload)
            }
        } catch {
            payload = buildDefaultCliConfigPayload(versionDir, sidecar) as Record<string, unknown>
        }
    } else {
        payload = buildDefaultCliConfigPayload(versionDir, sidecar) as Record<string, unknown>
    }

    const dir = path.dirname(preferred)
    fs.mkdirSync(dir, { recursive: true })
    const tmpPath = path.join(dir, `.cli_config.json.${process.pid}.${Date.now()}.tmp`)
    fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    fs.renameSync(tmpPath, preferred)
}
