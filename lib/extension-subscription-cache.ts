/** Client-side cache so table polling does not flash bell buttons on remount. */
const subscriptionByExtensionId = new Map<string, boolean>()

export function getCachedExtensionSubscription(extensionId: string): boolean | undefined {
  return subscriptionByExtensionId.get(extensionId)
}

export function setCachedExtensionSubscription(extensionId: string, subscribed: boolean) {
  subscriptionByExtensionId.set(extensionId, subscribed)
}
