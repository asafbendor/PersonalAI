import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import LogoutButton from '@/components/LogoutButton'

export const metadata: Metadata = {
  title: 'פרויקט שגרירים',
  description: 'ניהול פרסונות ויצירת תוכן',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isAuthed =
    cookies().get('dashboard_auth')?.value === process.env.DASHBOARD_PASSWORD &&
    !!process.env.DASHBOARD_PASSWORD

  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 min-h-screen text-gray-900">
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
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
