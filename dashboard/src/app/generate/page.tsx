'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface PersonaMeta {
  slug: string
  name: string
  role: string
  company: string
  imagePath: string | null
}

interface GeneratedResult {
  slug: string
  post: string
  personaName?: string
  editing?: string
  saved?: boolean
}

const PLATFORMS = ['פייסבוק', 'לינקדאין', 'אינסטגרם', 'טוויטר/X']
const TONE_OPTIONS = ['', 'יותר אישי', 'עם נתונים', 'קצר וממוקד', 'השראתי']

function GenerateForm() {
  const searchParams = useSearchParams()
  const preselected = searchParams.get('personas')?.split(',') ?? []

  const [personas, setPersonas] = useState<PersonaMeta[]>([])
  const [selected, setSelected] = useState<string[]>(preselected)
  const [platform, setPlatform] = useState('פייסבוק')
  const [topic, setTopic] = useState('')
  const [marketingAngle, setMarketingAngle] = useState('')
  const [toneVariant, setToneVariant] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<GeneratedResult[]>([])
  const [error, setError] = useState('')
  const [savingSlug, setSavingSlug] = useState<string | null>(null)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/personas')
      .then((r) => r.json())
      .then((data) => setPersonas(Array.isArray(data) ? data : []))
  }, [])

  const togglePersona = (slug: string) => {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  const handleGenerate = async () => {
    if (!selected.length || !topic.trim()) {
      setError('בחר לפחות שגריר אחד והזן נושא')
      return
    }
    setError('')
    setLoading(true)
    setResults([])

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaSlugs: selected, platform, topic, marketingAngle, toneVariant }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const enriched = data.results.map((r: { slug: string; post: string }) => ({
        ...r,
        personaName: personas.find((p) => p.slug === r.slug)?.name ?? r.slug,
        editing: r.post,
        saved: false,
      }))
      setResults(enriched)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (result: GeneratedResult) => {
    setSavingSlug(result.slug)
    try {
      const res = await fetch('/api/posts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaSlug: result.slug,
          topic,
          platform,
          goal: marketingAngle,
          content: result.editing ?? result.post,
        }),
      })
      if (!res.ok) throw new Error('שגיאה בשמירה')
      setResults((prev) => prev.map((r) => (r.slug === result.slug ? { ...r, saved: true } : r)))
    } catch (e) {
      alert(String(e))
    } finally {
      setSavingSlug(null)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSlug(id)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  return (
    <div>
      <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 mb-6 inline-block">
        &larr; חזרה לדשבורד
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">יצירת פוסט חדש</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            {/* Persona selection */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-3 block">בחר שגרירים</label>
              <div className="space-y-2">
                {personas.map((p) => (
                  <label
                    key={p.slug}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected.includes(p.slug)
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(p.slug)}
                      onChange={() => togglePersona(p.slug)}
                      className="hidden"
                    />
                    {p.imagePath && (
                      <img src={p.imagePath} alt={p.name} className="w-9 h-9 rounded-full object-cover" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.role}</p>
                    </div>
                    {selected.includes(p.slug) && <span className="mr-auto text-brand-600 text-sm">✓</span>}
                  </label>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">פלטפורמה</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((pl) => (
                  <button
                    key={pl}
                    onClick={() => setPlatform(pl)}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                      platform === pl
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {pl}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                נושא הפוסט <span className="text-red-400">*</span>
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="למשל: עבודה בכללית בזמן מלחמה"
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Marketing angle */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">זווית שיווקית</label>
              <textarea
                value={marketingAngle}
                onChange={(e) => setMarketingAngle(e.target.value)}
                placeholder="למשל: לגרום לאנשים לרצות לעבוד בכללית"
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Tone */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">טון (אופציונלי)</label>
              <select
                value={toneVariant}
                onChange={(e) => setToneVariant(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t || 'ברירת מחדל'}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'מייצר...' : `צור פוסט${selected.length > 1 ? ` (${selected.length} שגרירים)` : ''}`}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-5">
          {loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-3xl mb-3 animate-pulse">✍️</div>
              <p className="text-gray-500 text-sm">
                {selected.length > 1
                  ? `מייצר ${selected.length} פוסטים במקביל...`
                  : 'מייצר פוסט...'}
              </p>
            </div>
          )}

          {results.length === 0 && !loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              <p className="text-lg mb-2">הפוסטים שייווצרו יופיעו כאן</p>
              <p className="text-sm">בחר שגריר, הזן נושא ולחץ על "צור פוסט"</p>
            </div>
          )}

          {results.map((result) => (
            <div key={result.slug} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{result.personaName}</span>
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{platform}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(result.editing ?? result.post, result.slug)}
                    className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg text-gray-500 hover:text-brand-600 hover:border-brand-300 transition-colors"
                  >
                    {copiedSlug === result.slug ? '✓ הועתק' : 'העתק'}
                  </button>
                  <button
                    onClick={() => handleSave(result)}
                    disabled={result.saved || savingSlug === result.slug}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      result.saved
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50'
                    }`}
                  >
                    {result.saved ? '✓ נשמר' : savingSlug === result.slug ? 'שומר...' : 'שמור'}
                  </button>
                </div>
              </div>

              {/* Editable content */}
              <textarea
                value={result.editing ?? result.post}
                onChange={(e) =>
                  setResults((prev) =>
                    prev.map((r) => (r.slug === result.slug ? { ...r, editing: e.target.value } : r))
                  )
                }
                rows={12}
                className="w-full p-5 text-sm text-gray-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-inset"
                dir="rtl"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-400">טוען...</div>}>
      <GenerateForm />
    </Suspense>
  )
}
