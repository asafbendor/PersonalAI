import type { StorageHealth } from '@/lib/storage'

// Pure presentational banner: no fs access, no state, no 'use client' needed,
// so it can be rendered from both Server Components (StorageWarning) and
// Client Components (the candidates page, which fetches health over the API).
// Keeping the wording in one place, the same reason questionnaire.ts exists.
export default function StorageWarningBanner({ health }: { health: StorageHealth | null }) {
  if (!health || health.ok) return null

  return (
    <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-5">
      <h2 className="text-red-800 font-bold mb-2">
        אזהרה: הגשות של מועמדים לא נשמרות
      </h2>
      <p className="text-sm text-red-700 mb-3">{health.reason}</p>
      <p className="text-sm text-red-700 mb-2">
        טופס ההרשמה ב-<code className="font-mono">/onboarding</code> חסום כרגע בכוונה,
        כדי שאף מועמד לא ימלא 42 שאלות שיימחקו. כדי לפתוח אותו, ב-Railway:
      </p>
      <ol className="text-sm text-red-700 list-decimal list-inside space-y-1">
        <li>Service ← Volumes ← יצירת Volume עם mount path <code className="font-mono">/data</code></li>
        <li>Service ← Variables ← הוספת <code className="font-mono">PERSISTENT_DATA_PATH=/data</code></li>
        <li>המתנה לדיפלוי מחדש, ואז רענון הדף הזה</li>
      </ol>
    </div>
  )
}
