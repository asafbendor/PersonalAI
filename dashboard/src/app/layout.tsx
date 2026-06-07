import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import NavBar from '@/components/NavBar'

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
        <NavBar isAuthed={isAuthed} />
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
