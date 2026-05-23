'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchAiTestingLatestDetail, type AiTestingRecordingStep } from '@/lib/ai-testing-records'
import type { AiTestingNetworkLog } from '@/lib/ai-testing-network'

const AUTO_REFRESH_MS = 4000

type UseAiTestingDetailLoaderOptions = {
  extensionId: string
  open: boolean
  autoRefresh: boolean
  version?: string
}

export function useAiTestingDetailLoader({
  extensionId,
  open,
  autoRefresh,
  version,
}: UseAiTestingDetailLoaderOptions) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [records, setRecords] = useState<AiTestingRecordingStep[]>([])
  const [assetBaseUrl, setAssetBaseUrl] = useState('')
  const [network, setNetwork] = useState<AiTestingNetworkLog | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!extensionId) return
      if (!silent) {
        setLoading(true)
        setError('')
      }
      try {
        const result = await fetchAiTestingLatestDetail(extensionId, version)
        setRecords(result.records)
        setAssetBaseUrl(result.assetBaseUrl)
        setNetwork(result.network)
        setError(result.error)
      } catch {
        setRecords([])
        setAssetBaseUrl('')
        setNetwork(null)
        setError('Failed to load AI testing record.')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [extensionId, version],
  )

  useEffect(() => {
    if (!open || !extensionId) return
    void load(false)
  }, [open, extensionId, load])

  useEffect(() => {
    if (!open || !extensionId || !autoRefresh) return
    const timer = setInterval(() => {
      void load(true)
    }, AUTO_REFRESH_MS)
    return () => clearInterval(timer)
  }, [open, extensionId, autoRefresh, load])

  return { loading, error, records, assetBaseUrl, network, reload: load }
}
