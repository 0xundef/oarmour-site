import type { NavItem } from '@/types'
import { navItems } from '@/constants/data'

/** Shared top-level nav (Billing, optional Admin subtree). */
export function buildDashboardNavItems(params: { isAdmin?: boolean }): NavItem[] {
  const finalNavItems = [...navItems]

  if (params.isAdmin) {
    finalNavItems.push({
      title: 'Admin',
      icon: 'user',
      label: 'Admin',
      items: [
        { title: 'Users', href: '/dashboard/admin?section=users', icon: 'user' },
        { title: 'Audit', href: '/dashboard/admin?section=audit', icon: 'post' },
      ],
    })
  }

  return finalNavItems
}
