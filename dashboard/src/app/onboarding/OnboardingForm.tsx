'use client'

import { useState } from 'react'
import {
  QUESTIONNAIRE_SECTIONS as SECTIONS,
  TOTAL_QUESTIONS,
  type QuestionnaireQuestion as Question,
} from '@/lib/questionnaire'

// step 0 = intro/basic info, steps 1..N = sections, last step = review
// Rendered by page.tsx only when storage is healthy, see the note there.
export default function OnboardingForm() {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [englishName, setEnglishName] = useState('')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [choices, setChoices] = useState<Record<string, string[]>>({})
  const [details, setDetails] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [error, setError] = useState('')

  const totalSteps = SECTIONS.length + 2 // intro + sections + review
  const lastStep = totalSteps - 1

  const setAnswer = (id: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [id]: value }))

  // Choice questions keep their selections and their optional detail text in
  // separate state, then compose into the single string stored per question id.
  // Everything downstream (storage, review page, persona draft) keeps seeing a
  // plain string and needs no knowledge that choices exist.
  const compose = (selected: string[], detail: string) => {
    const head = selected.join(', ')
    const tail = detail.trim()
    if (head && tail) return `${head}\n\n${tail}`
    return head || tail
  }

  const isSelected = (id: string, option: string) => (choices[id] ?? []).includes(option)

  const showDetail = (q: Question) => {
    const selected = choices[q.id] ?? []
    if (!q.detailPrompt || selected.length === 0) return false
    if (!q.detailWhen) return true
    return selected.some((s) => q.detailWhen!.includes(s))
  }

  const applyChoice = (q: Question, selected: string[], detail: string) => {
    setChoices((prev) => ({ ...prev, [q.id]: selected }))
    setDetails((prev) => ({ ...prev, [q.id]: detail }))
    setAnswer(q.id, compose(selected, detail))
  }

  const toggleOption = (q: Question, option: string) => {
    const current = choices[q.id] ?? []
    const next =
      q.kind === 'multi'
        ? current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option]
        : current.includes(option)
        ? []
        : [option]

    // Dropping the trigger option should drop the now-irrelevant detail too,
    // otherwise a stale "כן" explanation survives under a "לא" answer.
    const keepDetail = next.length > 0 && (!q.detailWhen || next.some((s) => q.detailWhen!.includes(s)))
    applyChoice(q, next, keepDetail ? details[q.id] ?? '' : '')
  }

  const setDetail = (q: Question, value: string) =>
    applyChoice(q, choices[q.id] ?? [], value)

  const answeredCount = Object.values(answers).filter((a) => a && a.trim().length > 0).length

  const goNext = () => {
    setError('')
    if (step === 0 && !name.trim()) {
      setError('נא למלא שם לפני שממשיכים')
      return
    }
    if (step === 0 && !englishName.trim()) {
      setError('נא למלא שם באנגלית לפני שממשיכים, הוא משמש ליצירת קישור נקי במערכת')
      return
    }
    setStep((s) => Math.min(s + 1, lastStep))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const goBack = () => {
    setError('')
    setStep((s) => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, englishName, role, company, email, answers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה')
      setSubmitted(data.slug)
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-2">תודה רבה!</h1>
        <p className="text-gray-600 leading-relaxed">
          התשובות שלך נשמרו במערכת. הן ישמשו לבניית פרופיל קול אישי (Voice DNA) שיאפשר
          לכתוב תוכן בשמך, באופן אותנטי. כל פוסט שייכתב יישלח אליך לעיון ואישור לפני פרסום,
          שום דבר לא יוצא לאוויר בלי אישורך. אפשר לסגור את החלון הזה.
        </p>
      </div>
    )
  }

  // progress percentage
  const progressPct = Math.round((step / lastStep) * 100)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">שאלון הכרות לשגרירות דיגיטלית</h1>
          <span className="text-sm text-gray-500">
            שלב {step + 1} מתוך {totalSteps}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {step > 0 && step <= SECTIONS.length && (
          <p className="text-sm text-gray-500 mt-2">
            ענית עד כה על {answeredCount} מתוך {TOTAL_QUESTIONS} שאלות (אפשר לדלג על שאלות ולחזור אליהן)
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {/* Step 0: Intro + basic info */}
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold mb-2">לפני שמתחילים</h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              כדי לכתוב בשמך באופן אמיתי, אנחנו צריכים להכיר אותך, לא רק את התפקיד שלך.
              ככל שתענה/י ביותר פירוט ובשפה שלך (לא "מנוסחת"), כך התאום הדיגיטלי שייווצר ידבר
              ויכתוב יותר כמוך. אין תשובות נכונות או לא נכונות, ואפשר להשאיר שאלות ריקות
              ולחזור אליהן מאוחר יותר. בסוף התהליך תקבל/י אפשרות לעיין בכל פוסט שייכתב בשמך,
              ותאשר/י או תתקן/י לפני פרסום.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  placeholder="לדוגמה: דנה כהן"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  שם באנגלית (אותיות לטיניות) *
                </label>
                <input
                  type="text"
                  value={englishName}
                  onChange={(e) => setEnglishName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none ltr text-left"
                  placeholder="For example: Dana Cohen"
                  dir="ltr"
                />
                <p className="text-xs text-gray-400 mt-1">
                  משמש ליצירת קישור נקי לפרופיל שלך במערכת (כמו example.com/dana-cohen)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תפקיד</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  placeholder="לדוגמה: אחות מחלקה פנימית"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ארגון / מוסד</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                  placeholder="לדוגמה: כללית, סורוקה"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל (לא חובה)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none ltr text-left"
                  placeholder="name@example.com"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        )}

        {/* Steps 1..N: Sections */}
        {step >= 1 && step <= SECTIONS.length && (
          <div>
            {(() => {
              const section = SECTIONS[step - 1]
              return (
                <>
                  <h2 className="text-xl font-bold mb-1">
                    חלק {step}: {section.title}
                  </h2>
                  <p className="text-gray-500 mb-6">{section.description}</p>
                  <div className="space-y-6">
                    {section.questions.map((q, idx) => (
                      <div key={q.id}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {idx + 1}. {q.text}
                        </label>

                        {q.kind === 'choice' || q.kind === 'multi' ? (
                          <>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {(q.options ?? []).map((option) => {
                                const on = isSelected(q.id, option)
                                return (
                                  <button
                                    type="button"
                                    key={option}
                                    onClick={() => toggleOption(q, option)}
                                    className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                                      on
                                        ? 'bg-brand-600 text-white border-brand-600'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-brand-300'
                                    }`}
                                  >
                                    {on ? '✓ ' : ''}
                                    {option}
                                  </button>
                                )
                              })}
                            </div>
                            {q.kind === 'multi' && (
                              <p className="text-xs text-gray-400 mt-1">אפשר לבחור יותר מאחד</p>
                            )}
                            {showDetail(q) && (
                              <textarea
                                value={details[q.id] || ''}
                                onChange={(e) => setDetail(q, e.target.value)}
                                rows={2}
                                className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-y"
                                placeholder={q.detailPrompt || 'אפשר להוסיף כאן, לא חובה'}
                              />
                            )}
                          </>
                        ) : (
                          <textarea
                            value={answers[q.id] || ''}
                            onChange={(e) => setAnswer(q.id, e.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-y"
                            placeholder="אפשר לכתוב כאן בחופשיות, אין תשובה נכונה..."
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* Last step: Review */}
        {step === lastStep && (
          <div>
            <h2 className="text-xl font-bold mb-2">סקירה ושליחה</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              ענית על {answeredCount} מתוך {TOTAL_QUESTIONS} שאלות. אפשר לחזור אחורה ולהשלים
              שאלות שדילגת עליהן, או לשלוח עכשיו ולהשלים בהמשך.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{name || 'ללא שם'}</span>
                <span className="text-gray-500">{role}{role && company ? ' · ' : ''}{company}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${Math.round((answeredCount / TOTAL_QUESTIONS) * 100)}%` }}
                />
              </div>
            </div>
            <ul className="space-y-1 text-sm text-gray-600 mb-6">
              {SECTIONS.map((s, i) => {
                const sectionAnswered = s.questions.filter(
                  (q) => answers[q.id] && answers[q.id].trim().length > 0
                ).length
                return (
                  <li key={s.id} className="flex justify-between border-b border-gray-100 py-1">
                    <span>חלק {i + 1}: {s.title}</span>
                    <span className="text-gray-400">{sectionAnswered}/{s.questions.length}</span>
                  </li>
                )
              })}
            </ul>
            <div className="flex justify-center">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="text-center bg-brand-600 text-white px-10 py-3 rounded-lg font-medium shadow-sm hover:bg-brand-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'בשליחה...' : 'שליחת התשובות'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-red-600 text-sm mt-4">{error}</p>}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={goBack}
            disabled={step === 0}
            className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            הקודם
          </button>
          {step < lastStep && (
            <button
              onClick={goNext}
              className="px-5 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
            >
              הבא
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
