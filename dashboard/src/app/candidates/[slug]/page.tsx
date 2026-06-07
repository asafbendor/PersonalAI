'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface QuestionDef {
  id: string
  text: string
}
interface SectionDef {
  id: string
  title: string
  questions: QuestionDef[]
}

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

const SECTIONS: SectionDef[] = [
  {
    id: 'identity', title: 'מי אתה', questions: [
      { id: 'q1', text: 'ספר על עצמך כאילו אתה מציג את עצמך לעמית חדש בעבודה' },
      { id: 'q2', text: 'מה התפקיד שלך בפועל, יום-יום' },
      { id: 'q3', text: 'כמה זמן אתה בתפקיד / בארגון, ואיך הגעת לכאן' },
      { id: 'q4', text: 'מה גרם לך לבחור בתחום הזה' },
      { id: 'q5', text: 'שלוש מילים שעמיתים היו מתארים אותך בהן' },
      { id: 'q6', text: 'מה אתה הכי גאה בו בעבודה' },
      { id: 'q7', text: 'מה היית רוצה שאנשים מבחוץ יבינו על העבודה שלך' },
    ]
  },
  {
    id: 'voice', title: 'איך אתה מדבר וכותב', questions: [
      { id: 'q8', text: 'פסקה קצרה על משהו שקרה השבוע, כמו שהיית מספר לחבר' },
      { id: 'q9', text: 'איך אתה פותח הודעה לחבר קרוב' },
      { id: 'q10', text: "שימוש באימוג'ים, ובאילו הקשרים" },
      { id: 'q11', text: 'משפטים קצרים וישירים, או ארוכים ומפורטים' },
      { id: 'q12', text: 'ביטויים או מילות סלנג שחוזרים אצלך' },
      { id: 'q13', text: 'ביטוי "מקצועי" שאתה שומע ומגלגל עיניים ממנו' },
      { id: 'q14', text: 'איך הומור בא לידי ביטוי אצלך בכתיבה' },
      { id: 'q15', text: 'איך תסכול בא לידי ביטוי אצלך בכתיבה' },
      { id: 'q16', text: 'איך אתה מסביר דברים מורכבים, מאיפה מתחיל' },
      { id: 'q17', text: 'איך אתה פותח טקסט: שאלה, קביעה, סיפור, עובדה' },
      { id: 'q18', text: 'איך אתה נוטה לסיים פוסט או הודעה' },
    ]
  },
  {
    id: 'opinions', title: 'דעות וזוויות אישיות', questions: [
      { id: 'q19', text: 'מה הכי מרגיז אותך בתחום שלך שלא מדברים עליו מספיק' },
      { id: 'q20', text: 'הגישה שלך לעבודה במשפט אחד' },
      { id: 'q21', text: 'דעה "לא פופולרית" שיש לך על התחום' },
      { id: 'q22', text: 'משהו שהשתנה בעבודה שלך ויש לך דעה עליו' },
      { id: 'q23', text: 'דוגמה לפוסט שנשמע מזויף, מה הפריע בו' },
      { id: 'q24', text: 'נושא שאתה חוזר ומדבר עליו כי לא מבינים אותו מספיק' },
    ]
  },
  {
    id: 'stories', title: 'סיפורים וחוויות', questions: [
      { id: 'q25', text: 'רגע שגרם לך להרגיש שאתה במקום הנכון' },
      { id: 'q26', text: 'רגע קשה ואיך התמודדת איתו' },
      { id: 'q27', text: 'מקרה שעזרת למישהו ונשאר חרוט בזיכרון' },
      { id: 'q28', text: 'משהו שלמדת מקולגה או מנהל ששינה את דרך העבודה שלך' },
      { id: 'q29', text: 'סיטואציה חוזרת שמסכמת מה שאתה אוהב/לא אוהב בעבודה' },
      { id: 'q30', text: 'רגע של גאווה אמיתית בצוות או בארגון' },
    ]
  },
  {
    id: 'social', title: 'סגנון תקשורת ברשתות', questions: [
      { id: 'q31', text: 'האם פעיל ברשתות, ובאילו' },
      { id: 'q32', text: 'הדבקת פוסטים/הודעות אמיתיות שכתב בעבר' },
      { id: 'q33', text: 'אם אין כאלה: כתיבת פוסט קצר עכשיו על נושא קרוב לליבו' },
      { id: 'q34', text: 'מה גורם לו לעצור ולקרוא פוסט, ומה גורם לגלול הלאה' },
    ]
  },
  {
    id: 'boundaries', title: 'גבולות ואישור', questions: [
      { id: 'q35', text: 'נושאים/מילים שלעולם לא ירצה שייכתבו בשמו' },
      { id: 'q36', text: 'פרטים אישיים/שמות שאסור להזכיר' },
      { id: 'q37', text: 'נושאים רגישים שצריך להימנע מהם לגמרי' },
      { id: 'q38', text: 'אם פוסט "כמעט נכון אבל לא בדיוק הוא", מה יבדוק ראשון' },
      { id: 'q39', text: 'אישור מפורש: כל פוסט יישלח אליו לעיון ואישור לפני פרסום' },
    ]
  },
]

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
