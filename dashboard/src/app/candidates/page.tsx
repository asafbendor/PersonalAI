'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface CandidateMeta {
  slug: string
  name: string
  role: string
  company: string
  submittedAt: string
  status: string
  answeredCount: number
}

const TOTAL_QUESTIONS = 39

const STATUS_LABELS: Record<string, string> = {
  new: 'חדש',
  reviewed: 'נסקר',
  'persona-created': 'נוצרה פרסונה',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-amber-100 text-amber-700',
  'persona-created': 'bg-green-100 text-green-700',
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/candidates')
      .then((r) => r.json())
      .then((data) => setCandidates(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">מועמדים לשגרירות</h1>
          <p className="text-gray-500 mt-1">תשובות שהתקבלו דרך שאלון ההכרות</p>
        </div>
        <Link
          href="/onboarding"
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          + שאלון חדש
        </Link>
      </div>

      {loading && <p className="text-gray-400">טוען...</p>}

      {!loading && candidates.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">
          עדיין לא התקבלו תשובות. שתף את הקישור{' '}
          <Link href="/onboarding" className="text-brand-600 underline">/onboarding</Link>{' '}
          עם מועמדים פוטנציאליים.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((c) => (
          <Link
            key={c.slug}
            href={`/candidates/${c.slug}`}
            className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <h2 className="font-bold text-lg">{c.name}</h2>
              <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[c.status] || c.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              {c.role}{c.role && c.company ? ' · ' : ''}{c.company}
            </p>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-brand-500"
                style={{ width: `${Math.round((c.answeredCount / TOTAL_QUESTIONS) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {c.answeredCount}/{TOTAL_QUESTIONS} שאלות נענו
              {c.submittedAt ? ` · נשלח ${new Date(c.submittedAt).toLocaleDateString('he-IL')}` : ''}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
