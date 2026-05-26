import type { NavItem } from '@/types'
import { navItems } from '@/constants/data'

const subscribedPlaceholder: NavItem[] = [
  {
    title: 'No subscriptions',
    href: '/dashboard/subscribed',
    icon: 'arrowRight',
    disabled: true,
  },
]

/** Shared top-level nav (Extensions, Subscribed, Billing, optional Admin). */
export function buildDashboardNavItems(params: {
  subscribedChildren?: NavItem[]
  isAdmin?: boolean
}): NavItem[] {
  const finalNavItems = [...navItems]

  finalNavItems.splice(1, 0, {
    title: 'Subscribed',
    href: '/dashboard/subscribed',
    icon: 'star',
    label: 'Subscribed',
    disabled: true,
    tree: true,
    items: params.subscribedChildren ?? subscribedPlaceholder,
  })

  if (params.isAdmin) {
    finalNavItems.push({
      title: 'Admin',
      icon: 'user',
      label: 'Admin',
      items: [
        { title: 'Users', href: '/dashboard/admin?section=users', icon: 'user' },
        { title: 'Audit', href: '/dashboard/admin?section=audit', icon: 'post' },
        { title: 'Monitoring', href: '/dashboard/admin?section=monitoring', icon: 'monitor' },
      ],
    })
  }

  return finalNavItems
}
