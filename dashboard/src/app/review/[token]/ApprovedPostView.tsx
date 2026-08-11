'use client'

import { useState } from 'react'
import PublishLinks from '@/components/PublishLinks'

// What the ambassador sees once they have approved.
//
// The first version of this screen showed a thank-you and nothing else, on the
// reasoning that a leaked link should not keep exposing the post. That was the
// wrong trade: the ambassador is the person who publishes, so hiding the text
// at the exact moment they need to copy it broke the whole flow, and the risk
// it guarded against was their own post being seen by someone who already had
// their link. The text stays. Only editing is closed.
export default function ApprovedPostView({
  content,
  edited,
}: {
  content: string
  edited?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-2xl font-bold mb-2">הפוסט אושר</h1>
          <p className="text-gray-600 leading-relaxed">
            {edited
              ? 'השינויים שלך נשמרו, והם גם עוזרים לנו לדייק את הכתיבה בשמך בפעם הבאה.'
              : 'תודה על האישור.'}
            {' '}זה הנוסח הסופי, מוכן לפרסום.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-5 whitespace-pre-wrap leading-relaxed text-gray-800 text-sm">
          {content}
        </div>

        <div className="flex justify-center mt-4">
          <button
            onClick={copy}
            className="text-center bg-brand-600 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition-colors"
          >
            {copied ? '✓ הועתק' : 'העתקת הטקסט'}
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <PublishLinks text={content} />
        </div>

        <p className="text-xs text-gray-400 mt-6 text-center">
          אפשר לחזור לקישור הזה בכל שלב ולהעתיק שוב. לשינוי נוסף בטקסט, כדאי לפנות
          למי ששלח/ה לך את הקישור.
        </p>
      </div>
    </div>
  )
}
