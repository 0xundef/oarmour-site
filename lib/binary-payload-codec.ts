import { gunzipSync } from "node:zlib"

const DEFAULT_GZIP_MAX_OUTPUT_BYTES = 256 * 1024

export type Base64CodecResult =
  | { ok: true; operation: "encode" | "decode"; output: string }
  | { ok: false; error: string }

export function runBase64Codec(params: {
  operation: "encode" | "decode"
  input: string
}): Base64CodecResult {
  const input = params.input
  if (!input) return { ok: false, error: "input is empty" }

  try {
    if (params.operation === "encode") {
      return {
        ok: true,
        operation: "encode",
        output: Buffer.from(input, "utf8").toString("base64"),
      }
    }

    const normalized = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/")
    const decoded = Buffer.from(normalized, "base64")
    if (decoded.length === 0 && normalized.length > 0) {
      return { ok: false, error: "invalid base64 input" }
    }
    return {
      ok: true,
      operation: "decode",
      output: decoded.toString("utf8"),
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  }
}

export type GzipDecodeResult =
  | { ok: true; output: string; outputBytes: number; truncated: boolean }
  | { ok: false; error: string }

export function runGzipDecode(params: {
  input: string
  inputEncoding?: "base64" | "hex"
  maxOutputBytes?: number
}): GzipDecodeResult {
  const input = params.input.trim()
  if (!input) return { ok: false, error: "input is empty" }

  const maxOutputBytes = params.maxOutputBytes ?? DEFAULT_GZIP_MAX_OUTPUT_BYTES
  const encoding = params.inputEncoding ?? "base64"

  try {
    const compressed =
      encoding === "hex"
        ? Buffer.from(input.replace(/\s+/g, ""), "hex")
        : Buffer.from(input.replace(/\s+/g, ""), "base64")

    if (compressed.length < 2 || compressed[0] !== 0x1f || compressed[1] !== 0x8b) {
      return { ok: false, error: "input is not gzip (missing 1f 8b magic bytes)" }
    }

    const decompressed = gunzipSync(compressed)
    const truncated = decompressed.length > maxOutputBytes
    const slice = truncated ? decompressed.subarray(0, maxOutputBytes) : decompressed
    return {
      ok: true,
      output: slice.toString("utf8"),
      outputBytes: decompressed.length,
      truncated,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  }
}
