import { getDomain } from "tldts"
import { rdapDomain, whoisInfo, whoisInfoHk } from "@/lib/threat-intel"

export type DomainWhoisInfo = {
  createdDate: string | null
  updatedDate: string | null
  expiresDate: string | null
  registrar: string | null
  nameservers: string[]
  ageDays: number | null
}

export type LookupDomainWhoisResult = {
  ok: boolean
  domain: string
  tld: string | null
  source: string
  info: DomainWhoisInfo | null
  error?: string
}

function toIso(date: Date | null | undefined): string | null {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function ageDaysFromCreated(createdDate: Date | null): number | null {
  if (!createdDate || Number.isNaN(createdDate.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 86_400_000))
}

function serializeInfo(info: {
  createdDate: Date | null
  updatedDate: Date | null
  expiresDate: Date | null
  registrar: string | null
  nameservers: string[]
}): DomainWhoisInfo {
  const createdDate = info.createdDate ?? null
  return {
    createdDate: toIso(createdDate),
    updatedDate: toIso(info.updatedDate),
    expiresDate: toIso(info.expiresDate),
    registrar: info.registrar ?? null,
    nameservers: Array.isArray(info.nameservers) ? info.nameservers : [],
    ageDays: ageDaysFromCreated(createdDate),
  }
}

/** Same RDAP → WHOIS fallback chain as static analysis (`/api/ti/whois`). */
export async function lookupDomainWhois(domain: string): Promise<LookupDomainWhoisResult> {
  const trimmed = domain.trim()
  if (!trimmed) {
    return {
      ok: false,
      domain: trimmed,
      tld: null,
      source: "none",
      info: null,
      error: "domain is required",
    }
  }

  const apex = getDomain(trimmed) || trimmed
  const tld = apex.split(".").pop()?.toLowerCase() ?? null

  try {
    let info: {
      createdDate: Date | null
      updatedDate: Date | null
      expiresDate: Date | null
      registrar: string | null
      nameservers: string[]
    }
    let source = "rdap"

    if (tld === "hk") {
      info = await whoisInfoHk(apex)
      source = "whois_hk"
    } else if (tld === "dev") {
      const r = await rdapDomain(apex)
      info = {
        createdDate: r.createdDate ?? null,
        updatedDate: null,
        expiresDate: r.expiresDate ?? null,
        registrar: r.registrar ?? null,
        nameservers: r.nameservers || [],
      }
    } else {
      try {
        const r = await rdapDomain(apex)
        info = {
          createdDate: r.createdDate ?? null,
          updatedDate: null,
          expiresDate: r.expiresDate ?? null,
          registrar: r.registrar ?? null,
          nameservers: r.nameservers || [],
        }
        source = "rdap"
      } catch {
        info = {
          createdDate: null,
          updatedDate: null,
          expiresDate: null,
          registrar: null,
          nameservers: [],
        }
      }
      const hasCreatedDate =
        info.createdDate instanceof Date && !Number.isNaN(info.createdDate.getTime())
      if (!hasCreatedDate) {
        const hadRdapData =
          !!(info.registrar || info.expiresDate || info.nameservers.length > 0)
        const w = await whoisInfo(apex)
        info = {
          createdDate: w.createdDate ?? info.createdDate,
          updatedDate: w.updatedDate,
          expiresDate: info.expiresDate ?? w.expiresDate ?? null,
          registrar: info.registrar ?? w.registrar ?? null,
          nameservers: info.nameservers.length ? info.nameservers : w.nameservers,
        }
        source = hadRdapData ? "rdap+whois" : tld === "com" ? "whois_com" : "whois"
      }
    }

    return {
      ok: true,
      domain: apex,
      tld,
      source,
      info: serializeInfo(info),
    }
  } catch (e: unknown) {
    const message =
      e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
        ? (e as { message: string }).message
        : "lookup failed"
    return {
      ok: false,
      domain: apex,
      tld,
      source: "error",
      info: null,
      error: message,
    }
  }
}
