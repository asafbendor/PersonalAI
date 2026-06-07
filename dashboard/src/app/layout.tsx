import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'פרויקט שגרירים',
  description: 'ניהול פרסונות ויצירת תוכן',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 min-h-screen text-gray-900">
        <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-brand-700">
            🏛️ פרויקט שגרירים
          </a>
          <div className="flex items-center gap-3">
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
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
