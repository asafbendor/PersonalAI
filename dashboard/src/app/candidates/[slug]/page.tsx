'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { QUESTIONNAIRE_SECTIONS as SECTIONS } from '@/lib/questionnaire'

interface CandidateFull {
  slug: string
  name: string
  role: string
  company: string
  submittedAt: string
  status: string
  answeredCount: number
  answers: Record<string, string>
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'חדש' },
  { value: 'reviewed', label: 'נסקר' },
  { value: 'persona-created', label: 'נוצרה פרסונה' },
]

export default function CandidateDetailPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [candidate, setCandidate] = useState<CandidateFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/candidates/${slug}`)
      .then((r) => r.json())
      .then((data) => setCandidate(data))
      .finally(() => setLoading(false))
  }, [slug])

  const updateStatus = async (status: string) => {
    if (!candidate) return
    setUpdating(true)
    try {
      await fetch(`/api/candidates/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setCandidate({ ...candidate, status })
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <p className="text-gray-400">טוען...</p>
  if (!candidate) return <p className="text-gray-400">מועמד לא נמצא</p>

  return (
    <div>
      <Link href="/candidates" className="text-sm text-brand-600 hover:underline mb-4 inline-block">
        ← חזרה לרשימת מועמדים
      </Link>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{candidate.name}</h1>
            <p className="text-gray-500 mt-1">
              {candidate.role}{candidate.role && candidate.company ? ' · ' : ''}{candidate.company}
            </p>
            {candidate.submittedAt && (
              <p className="text-xs text-gray-400 mt-1">
                נשלח: {new Date(candidate.submittedAt).toLocaleString('he-IL')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">סטטוס:</span>
            <select
              value={candidate.status}
              disabled={updating}
              onChange={(e) => updateStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          {candidate.answeredCount}/39 שאלות נענו
        </p>
      </div>

      <div className="space-y-6">
        {SECTIONS.map((section, i) => (
          <div key={section.id} className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-lg font-bold mb-4">חלק {i + 1}: {section.title}</h2>
            <div className="space-y-4">
              {section.questions.map((q) => {
                const answer = candidate.answers[q.id]
                return (
                  <div key={q.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-gray-700 mb-1">{q.text}</p>
                    {answer ? (
                      <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{answer}</p>
                    ) : (
                      <p className="text-gray-300 italic text-sm">לא נענה</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
