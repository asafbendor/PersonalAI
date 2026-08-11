import { getStorageHealth } from '@/lib/storage'
import OnboardingForm from './OnboardingForm'

// Checked on the server so a candidate never sees the form at all when their
// answers could not be kept. /api/candidates refuses the POST too, but by then
// they have already spent time on 42 questions, which is the actual harm.
//
// The maintenance notice is deliberately plain: no technical detail, no hint
// that an admin area exists behind this route. Same reasoning as
// HIDE_NAV_PREFIXES in components/NavBar.tsx.
export const dynamic = 'force-dynamic'

export default function OnboardingPage() {
  if (!getStorageHealth().ok) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
        <div className="text-5xl mb-4">🛠️</div>
        <h1 className="text-2xl font-bold mb-2">השאלון אינו זמין כרגע</h1>
        <p className="text-gray-600 leading-relaxed">
          אנחנו מבצעים תחזוקה קצרה. נשמח שתחזרו מאוחר יותר, התשובות שלכם חשובות לנו
          ולא היינו רוצים שיאבדו בדרך.
        </p>
      </div>
    )
  }

  return <OnboardingForm />
}
