"use client"

import { useEffect } from "react"

const RELOAD_KEY = "oarmour:chunk-reload"

function isChunkLoadFailure(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("chunkloaderror") ||
    lower.includes("failed to load chunk") ||
    lower.includes("loading chunk") ||
    (lower.includes("_next/static/chunks") && lower.includes("failed"))
  )
}

function tryRecoverFromChunkError(): void {
  if (typeof window === "undefined") return
  if (sessionStorage.getItem(RELOAD_KEY) === "1") return

  sessionStorage.setItem(RELOAD_KEY, "1")
  window.location.reload()
}

/**
 * After a deploy, open tabs may still reference old hashed chunks. Next.js
 * then throws ChunkLoadError and the app shows "This page couldn't load".
 * One automatic reload usually picks up the new build.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const clearFlag = window.setTimeout(() => {
      sessionStorage.removeItem(RELOAD_KEY)
    }, 5000)

    const onError = (event: ErrorEvent) => {
      const message = event.message || String(event.error ?? "")
      if (isChunkLoadFailure(message)) tryRecoverFromChunkError()
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const message =
        typeof event.reason === "string"
          ? event.reason
          : event.reason instanceof Error
            ? event.reason.message
            : String(event.reason ?? "")
      if (isChunkLoadFailure(message)) tryRecoverFromChunkError()
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.clearTimeout(clearFlag)
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
