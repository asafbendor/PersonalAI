'use client'

import { useState } from 'react'

export default function ReviewForm({
  token,
  personaName,
  topic,
  platform,
  content,
}: {
  token: string
  personaName: string
  topic: string
  platform: string
  content: string
}) {
  const [text, setText] = useState(content)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ edited: boolean } | null>(null)
  const [error, setError] = useState('')

  const changed = text.trim() !== content.trim()

  const approve = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/review/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה באישור')
      setDone({ edited: data.edited })
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-2">תודה, הפוסט אושר</h1>
        <p className="text-gray-600 leading-relaxed">
          {done.edited
            ? 'השינויים שלך נשמרו, והם גם עוזרים לנו לדייק את הכתיבה בשמך בפעם הבאה. אפשר לסגור את החלון הזה.'
            : 'אפשר לסגור את החלון הזה.'}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">פוסט לאישור</h1>
        <p className="text-gray-500">
          נכתב בשמך{personaName ? `, ${personaName}` : ''}
          {platform ? ` · ${platform}` : ''}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <p className="text-gray-600 leading-relaxed mb-6">
          זהו פוסט שנכתב בשמך ועדיין לא פורסם. אפשר לאשר אותו כמו שהוא, או לערוך אותו
          כאן ישירות ואז לאשר. שום דבר לא יוצא לאוויר לפני שתאשר/י.
        </p>

        {topic && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <span className="text-xs text-gray-400 block mb-1">נושא</span>
            <span className="text-sm text-gray-700">{topic}</span>
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700 mb-1">
          תוכן הפוסט
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-y leading-relaxed"
        />

        {changed && (
          <p className="text-sm text-brand-600 mt-2">
            ערכת את הטקסט. האישור יישמר עם השינויים שלך.
          </p>
        )}

        {error && <p className="text-red-600 text-sm mt-4">{error}</p>}

        <button
          onClick={approve}
          disabled={submitting || !text.trim()}
          className="w-full mt-6 bg-brand-600 text-white py-3 rounded-lg font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'בשליחה...' : changed ? 'אישור עם השינויים' : 'אישור הפוסט'}
        </button>
      </div>
    </div>
  )
}
