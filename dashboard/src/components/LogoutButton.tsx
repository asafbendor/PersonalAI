'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="text-gray-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 hover:text-gray-600 transition-colors"
      title="התנתקות"
    >
      יציאה
    </button>
  )
}
