'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

type AiTestingAutoRefreshButtonProps = {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  className?: string
}

export function AiTestingAutoRefreshButton({
  enabled,
  onEnabledChange,
  className,
}: AiTestingAutoRefreshButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      className={cn('h-8 w-8', enabled && 'text-primary', className)}
      title={
        enabled
          ? 'Auto-refresh on — loading latest steps every few seconds (click to disable)'
          : 'Auto-refresh off — click to load latest steps automatically'
      }
      aria-pressed={enabled}
      onClick={() => onEnabledChange(!enabled)}
    >
      <RefreshCw className={cn('h-4 w-4', enabled && 'animate-spin')} />
    </Button>
  )
}
