'use client'

import { useEffect, useRef, useState } from 'react'

interface Stats {
  files: number
  candidates: number
  personas: number
  posts: number
  bytes: number
}

interface StoredSnapshot {
  filename: string
  createdAt: string
  bytes: number
}

export default function BackupPanel() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [latest, setLatest] = useState<StoredSnapshot | null>(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [replaceMode, setReplaceMode] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = async () => {
    const res = await fetch('/api/backup/status')
    if (!res.ok) return
    const data = await res.json()
    setStats(data.current)
    setLatest(data.latest)
  }

  useEffect(() => {
    // The monthly snapshot has no scheduler behind it. It is triggered here,
    // on an admin visiting the dashboard, which happens far more often than
    // once a month. The endpoint itself decides whether one is actually due.
    fetch('/api/backup/status', { method: 'POST' })
      .then(() => load())
      .catch(() => load())
  }, [])

  const runImport = async (file: File) => {
    setImporting(true)
    setMessage(null)
    try {
      const snapshot = JSON.parse(await file.text())
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot, mode: replaceMode ? 'replace' : 'merge' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בייבוא')

      const parts = [`נכתבו ${data.written} קבצים`]
      if (data.skipped) parts.push(`${data.skipped} דולגו כי כבר היו קיימים`)
      if (data.rejected?.length) parts.push(`${data.rejected.length} נדחו כלא תקינים`)
      setMessage({ ok: true, text: parts.join(', ') + '. כדאי לרענן את הדף.' })
      load()
    } catch (e) {
      setMessage({ ok: false, text: String(e) })
    } finally {
      setImporting(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('he-IL')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
      <h2 className="text-sm font-semibold text-gray-500 mb-1 uppercase tracking-wide">
        גיבוי הנתונים
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        תשובות מועמדים, פרסונות שנוצרו באפליקציה, ופוסטים עם סטטוס האישור, קיימים רק על
        השרת ולא בשום מקום אחר. הקובץ שיורד מכיל את כולם.
      </p>

      {stats && (
        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
          <span>{stats.candidates} מועמדים</span>
          <span>{stats.personas} פרסונות</span>
          <span>{stats.posts} פוסטים</span>
          <span className="text-gray-400">
            {stats.files} קבצים, {Math.max(1, Math.round(stats.bytes / 1024))} KB
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/api/backup/export"
          className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
        >
          הורדת גיבוי
        </a>

        <button
          onClick={() => fileInput.current?.click()}
          disabled={importing}
          className="text-sm border border-gray-300 px-4 py-2 rounded-lg text-gray-600 hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-50"
        >
          {importing ? 'בייבוא...' : 'ייבוא מקובץ'}
        </button>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) runImport(f)
          }}
        />

        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={replaceMode}
            onChange={(e) => setReplaceMode(e.target.checked)}
          />
          לדרוס קבצים קיימים
        </label>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        ייבוא רגיל רק משלים קבצים חסרים ולא נוגע בקיימים, כך שייבוא של גיבוי ישן לא
        יכול למחוק עבודה חדשה. סימון &quot;לדרוס&quot; מיועד לשחזור מלא אחרי תקלה.
      </p>

      {message && (
        <p className={`text-sm mt-3 ${message.ok ? 'text-green-700' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
        {latest ? (
          <>גיבוי אוטומטי אחרון על השרת: {fmtDate(latest.createdAt)} ({latest.filename})</>
        ) : (
          <>טרם נוצר גיבוי אוטומטי על השרת</>
        )}
        <p className="text-gray-400 mt-1">
          הגיבוי האוטומטי רץ פעם בחודש ונשמר על אותו שרת. הוא מגן מפני מחיקה בטעות, אבל
          לא מפני אובדן השרת עצמו. בשביל זה צריך להוריד את הקובץ ולשמור אותו ב-git.
        </p>
      </div>
    </div>
  )
}
