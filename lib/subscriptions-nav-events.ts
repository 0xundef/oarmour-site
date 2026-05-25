import type { NavItem } from '@/types'

export const SUBSCRIPTIONS_NAV_REFRESH_EVENT = 'oarmour:subscriptions-nav-refresh'

export function dispatchSubscriptionsNavRefresh() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SUBSCRIPTIONS_NAV_REFRESH_EVENT))
}

export function patchNavItemsWithSubscribedChildren(
  items: NavItem[],
  subscribedChildren: NavItem[],
): NavItem[] {
  return items.map((item) =>
    item.title === 'Subscribed' ? { ...item, items: subscribedChildren } : item,
  )
}
