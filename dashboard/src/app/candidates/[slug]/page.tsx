'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { QUESTIONNAIRE_SECTIONS as SECTIONS, TOTAL_QUESTIONS } from '@/lib/questionnaire'

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

  const [draft, setDraft] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [draftError, setDraftError] = useState('')
  const [copied, setCopied] = useState(false)

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

  const generateDraft = async () => {
    setGenerating(true)
    setDraftError('')
    try {
      const res = await fetch(`/api/candidates/${slug}/persona-draft`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה ביצירת הטיוטה')
      setDraft(data.draft)
    } catch (e) {
      setDraftError(String(e))
    } finally {
      setGenerating(false)
    }
  }

  const copyDraft = async () => {
    if (!draft) return
    await navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
          {candidate.answeredCount}/{TOTAL_QUESTIONS} שאלות נענו
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
          <div>
            <h2 className="text-lg font-bold">✨ טיוטת פרסונה</h2>
            <p className="text-sm text-gray-500 mt-1">
              יצירת טיוטה ראשונה של פרופיל פרסונה (profile.md) על בסיס תשובות המועמד/ת,
              באותו מבנה של הפרסונות הקיימות. זו טיוטה לעיון ועריכה, לא קובץ סופי,
              את/ה צריך/ה לקרוא, לתקן מה שצריך, ולשמור אותה כקובץ
              <code className="mx-1 bg-gray-100 px-1.5 py-0.5 rounded text-xs">personas/{slug}/profile.md</code>
              בדיוק כמו שנוצרו שלוש הפרסונות הקיימות.
            </p>
          </div>
          <button
            onClick={generateDraft}
            disabled={generating || candidate.answeredCount === 0}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {generating ? 'יוצר טיוטה...' : draft ? 'צור טיוטה מחדש' : 'צור טיוטת פרסונה'}
          </button>
        </div>

        {candidate.answeredCount === 0 && (
          <p className="text-sm text-amber-600">למועמד/ת הזה/ו אין עדיין תשובות, אי אפשר ליצור טיוטה.</p>
        )}
        {draftError && <p className="text-red-600 text-sm">{draftError}</p>}

        {draft && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">אפשר לערוך כאן ישירות לפני העתקה ושמירה:</span>
              <button
                onClick={copyDraft}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                {copied ? '✓ הועתק' : 'העתק'}
              </button>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={22}
              dir="ltr"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm leading-relaxed resize-y outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}
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
