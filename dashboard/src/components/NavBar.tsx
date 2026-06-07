'use client'

import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'

// Routes that must never show the dashboard chrome, even to an authenticated owner
// browsing them. /onboarding is shared as a public link with candidates, it must look
// like a clean standalone form with zero hint that other admin pages exist.
const HIDE_NAV_PREFIXES = ['/onboarding', '/login']

export default function NavBar({ isAuthed }: { isAuthed: boolean }) {
  const pathname = usePathname()

  if (HIDE_NAV_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return null
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <a href="/" className="text-xl font-bold text-brand-700">
        🏛️ פרויקט שגרירים
      </a>
      <div className="flex items-center gap-3">
        {isAuthed && (
          <>
            <a
              href="/candidates"
              className="text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              מועמדים
            </a>
            <a
              href="/onboarding"
              className="text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              שאלון הכרות
            </a>
            <a
              href="/generate"
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              + יצירת פוסט
            </a>
            <LogoutButton />
          </>
        )}
      </div>
    </nav>
  )
}
