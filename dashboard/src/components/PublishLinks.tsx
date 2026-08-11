'use client'

import { useState } from 'react'

// Quick links to publish an approved post.
//
// Important limitation, and the reason every button copies first: only X and
// LinkedIn accept post text through a URL. Facebook and Instagram deliberately
// do not let a link prefill a composer with text, there is no supported way to
// do it and any trick that appears to work will break. So the honest flow is
// the same everywhere: copy the text, open the composer, paste.
//
// Shown only for approved posts. Offering a one-click publish on an unapproved
// post would make the whole approval gate decorative.

const X_LIMIT = 280

interface Target {
  id: string
  label: string
  emoji: string
  // Builds the composer URL. Receives the post text for the platforms that
  // support prefilling, ignores it for the ones that do not.
  url: (text: string) => string
  prefills: boolean
}

const TARGETS: Target[] = [
  {
    id: 'linkedin',
    label: 'לינקדאין',
    emoji: '💼',
    url: (t) => `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(t)}`,
    prefills: true,
  },
  {
    id: 'x',
    label: 'X (טוויטר)',
    emoji: '𝕏',
    url: (t) => `https://x.com/intent/post?text=${encodeURIComponent(t)}`,
    prefills: true,
  },
  {
    id: 'facebook',
    label: 'פייסבוק',
    emoji: '📘',
    url: () => 'https://www.facebook.com/',
    prefills: false,
  },
  {
    id: 'instagram',
    label: 'אינסטגרם',
    emoji: '📷',
    url: () => 'https://www.instagram.com/',
    prefills: false,
  },
]

export default function PublishLinks({ text }: { text: string }) {
  const [copied, setCopied] = useState<string | null>(null)

  const openTarget = async (target: Target) => {
    // Copy first in every case: on the platforms that cannot be prefilled this
    // is the whole mechanism, and on the others it is a harmless safety net.
    try {
      await navigator.clipboard.writeText(text)
      setCopied(target.id)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard can be blocked; opening the composer is still useful.
    }
    window.open(target.url(text), '_blank', 'noopener,noreferrer')
  }

  const tooLongForX = text.length > X_LIMIT

  return (
    <div className="mt-3">
      <p className="text-xs text-gray-500 mb-2">
        פרסום. כל כפתור מעתיק את הטקסט ופותח את הרשת בלשונית חדשה.
      </p>
      <div className="flex flex-wrap gap-2">
        {TARGETS.map((target) => (
          <button
            key={target.id}
            onClick={() => openTarget(target)}
            className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:border-brand-300 hover:text-brand-600 transition-colors flex items-center gap-1.5"
            title={
              target.prefills
                ? 'הטקסט ייטען אוטומטית בחלון הכתיבה'
                : 'הרשת הזו לא מאפשרת טעינה אוטומטית של טקסט, צריך להדביק'
            }
          >
            <span>{target.emoji}</span>
            <span>{copied === target.id ? 'הועתק, נפתח...' : target.label}</span>
            {!target.prefills && <span className="text-gray-300">(הדבקה)</span>}
          </button>
        ))}
      </div>
      {tooLongForX && (
        <p className="text-xs text-amber-600 mt-2">
          הפוסט ארוך מ-{X_LIMIT} תווים, ב-X יהיה צורך לקצר אותו.
        </p>
      )}
    </div>
  )
}
