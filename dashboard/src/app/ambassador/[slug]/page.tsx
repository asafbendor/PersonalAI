'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import PublishLinks from '@/components/PublishLinks'

interface Post {
  slug: string
  filename: string
  date: string
  topic: string
  platform: string
  goal: string
  status: string
  content: string
  originalContent?: string
  edited: boolean
  approvedAt: string
}

interface PersonaFull {
  slug: string
  name: string
  role: string
  company: string
  trainingStatus: string
  lastUpdated: string
  personalityWords: string
  imagePath: string | null
  hasVideo: boolean
  postCount: number
  isRuntime: boolean
  profileContent: string
  samples: { filename: string; content: string }[]
}

type Tab = 'posts' | 'profile' | 'samples' | 'media'

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pending: 'bg-orange-100 text-orange-700 border-orange-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  published: 'bg-blue-100 text-blue-700 border-blue-200',
}

const statusLabels: Record<string, string> = {
  draft: 'טיוטה',
  pending: 'ממתין לאישור',
  approved: 'מאושר',
  published: 'פורסם',
}

export default function AmbassadorPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [persona, setPersona] = useState<PersonaFull | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('posts')
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Send a post to the ambassador for approval, and hold the resulting link
  // so the operator can copy it. Keyed by post slug.
  const [sendingSlug, setSendingSlug] = useState<string | null>(null)
  const [reviewLinks, setReviewLinks] = useState<Record<string, string>>({})
  const [copiedLinkSlug, setCopiedLinkSlug] = useState<string | null>(null)
  const [sendError, setSendError] = useState('')
  // Which approved-and-edited posts have their comparison expanded
  const [showingOriginal, setShowingOriginal] = useState<Record<string, boolean>>({})
  // Voice rules drafted from an ambassador's edit, awaiting the operator's review
  const [lessonSlug, setLessonSlug] = useState<string | null>(null)
  const [lessons, setLessons] = useState<Record<string, string>>({})

  const generateLesson = async (post: Post) => {
    setLessonSlug(post.slug)
    try {
      const res = await fetch('/api/posts/voice-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaSlug: slug, filename: post.filename }),
      })
      const data = await res.json()
      setLessons((prev) => ({
        ...prev,
        [post.slug]: res.ok ? data.lesson : `שגיאה: ${data.error}`,
      }))
    } catch (e) {
      setLessons((prev) => ({ ...prev, [post.slug]: `שגיאה: ${String(e)}` }))
    } finally {
      setLessonSlug(null)
    }
  }

  const sendForApproval = async (post: Post) => {
    setSendingSlug(post.slug)
    setSendError('')
    try {
      const res = await fetch('/api/posts/send-for-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaSlug: slug, filename: post.filename }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בשליחה')
      setReviewLinks((prev) => ({
        ...prev,
        [post.slug]: `${window.location.origin}/review/${data.token}`,
      }))
      setPosts((prev) =>
        prev.map((p) => (p.slug === post.slug ? { ...p, status: 'pending' } : p))
      )
    } catch (e) {
      setSendError(String(e))
    } finally {
      setSendingSlug(null)
    }
  }

  // Delete persona
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Edit profile
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaveError, setProfileSaveError] = useState('')

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageUploadError, setImageUploadError] = useState('')

  const loadPersona = () => {
    return Promise.all([
      fetch(`/api/personas/${slug}`).then((r) => r.json()),
      fetch(`/api/posts/${slug}`).then((r) => r.json()),
    ]).then(([p, posts]) => {
      setPersona(p)
      setPosts(Array.isArray(posts) ? posts : [])
      setLoading(false)
    })
  }

  useEffect(() => {
    loadPersona()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSlug(id)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  const startEditingProfile = () => {
    if (!persona) return
    setProfileDraft(persona.profileContent)
    setProfileSaveError('')
    setEditingProfile(true)
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    setProfileSaveError('')
    try {
      const res = await fetch(`/api/personas/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileMarkdown: profileDraft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירת הפרופיל')
      setEditingProfile(false)
      await loadPersona()
    } catch (e) {
      setProfileSaveError(String(e))
    } finally {
      setSavingProfile(false)
    }
  }

  const deletePersona = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/personas/${slug}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה במחיקת הפרסונה')
      router.push('/')
    } catch (e) {
      setDeleteError(String(e))
      setDeleting(false)
    }
  }

  const onPickImage = () => fileInputRef.current?.click()

  const onImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    setImageUploadError('')
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch(`/api/personas/${slug}/image`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בהעלאת התמונה')
      await loadPersona()
    } catch (e) {
      setImageUploadError(String(e))
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (loading) return <div className="text-center py-20 text-gray-400">טוען...</div>
  if (!persona) return <div className="text-center py-20 text-gray-400">פרסונה לא נמצאה</div>

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'posts', label: 'פוסטים', count: posts.length },
    { id: 'profile', label: 'פרופיל' },
    { id: 'samples', label: 'דוגמאות', count: persona.samples.length },
    { id: 'media', label: 'מדיה' },
  ]

  return (
    <div>
      {/* Back */}
      <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 mb-6 inline-block">
        &larr; חזרה לדשבורד
      </Link>

      {/* Hero */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="flex flex-col md:flex-row">
          {/* Photo */}
          <div className="w-full md:w-56 h-56 shrink-0 bg-gray-100 relative group">
            {persona.imagePath ? (
              <img src={persona.imagePath} alt={persona.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl text-gray-200">👤</div>
            )}
            {persona.isRuntime && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={onImageSelected}
                />
                <button
                  onClick={onPickImage}
                  disabled={uploadingImage}
                  className="absolute bottom-2 inset-x-2 bg-black/60 text-white text-xs py-1.5 rounded-lg hover:bg-black/75 transition-colors disabled:opacity-50"
                >
                  {uploadingImage ? 'בהעלאת תמונה...' : '📷 העלאה / החלפה של תמונה'}
                </button>
              </>
            )}
          </div>

          {/* Details */}
          <div className="p-6 flex-1">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{persona.name}</h1>
                <p className="text-gray-600 mt-0.5">{persona.role}</p>
                <p className="text-gray-400 text-sm">{persona.company}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/generate?personas=${slug}`}
                  className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
                >
                  + יצירת פוסט
                </Link>
                {persona.isRuntime && (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="text-sm px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    🗑 מחיקת פרסונה
                  </button>
                )}
              </div>
            </div>
            {imageUploadError && <p className="text-red-600 text-xs mt-2">{imageUploadError}</p>}

            {persona.personalityWords && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 mb-1">אישיות</p>
                <p className="text-sm text-gray-700">{persona.personalityWords}</p>
              </div>
            )}

            <div className="flex gap-4 mt-4 text-sm text-gray-500">
              <span>{posts.length} פוסטים</span>
              <span>{persona.samples.length} דוגמאות</span>
              <span>עודכן {persona.lastUpdated}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmingDelete && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
          <p className="text-red-800 font-medium mb-1">למחוק את {persona.name} לצמיתות?</p>
          <p className="text-red-700 text-sm mb-4">
            הפעולה תמחק את הפרופיל, התמונה והדוגמאות של הפרסונה מהמערכת ולא ניתנת לביטול.
            הפוסטים שכבר נכתבו בשמה יישארו כתיעוד, אך הפרסונה עצמה לא תהיה זמינה עוד ליצירת תוכן חדש.
          </p>
          {deleteError && <p className="text-red-600 text-sm mb-3">{deleteError}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={deletePersona}
              disabled={deleting}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleting ? 'במחיקה...' : 'כן, למחוק לצמיתות'}
            </button>
            <button
              onClick={() => { setConfirmingDelete(false); setDeleteError('') }}
              disabled={deleting}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors text-sm"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white border border-b-white border-gray-200 text-brand-700 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="mr-1.5 text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Posts tab */}
      {activeTab === 'posts' && (
        <div className="space-y-4">
          {posts.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg mb-3">אין פוסטים עדיין</p>
              <Link
                href={`/generate?personas=${slug}`}
                className="text-brand-600 text-sm hover:underline"
              >
                יצירת פוסט ראשון &rarr;
              </Link>
            </div>
          )}
          {posts.map((post) => (
            <div key={post.slug} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">{post.date}</span>
                  {post.platform && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {post.platform}
                    </span>
                  )}
                  {post.topic && (
                    <span className="text-sm font-medium text-gray-700">{post.topic}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {post.status && (
                    <span className={`text-xs border px-2 py-0.5 rounded-full ${statusColors[post.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {statusLabels[post.status] ?? post.status}
                    </span>
                  )}
                  {post.edited && (
                    <span className="text-xs border border-purple-200 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      נערך על ידי השגריר/ה
                    </span>
                  )}
                  <button
                    onClick={() => copyToClipboard(post.content, post.slug)}
                    className="text-xs text-gray-400 hover:text-brand-600 transition-colors px-2 py-1 rounded border border-gray-200 hover:border-brand-300"
                  >
                    {copiedSlug === post.slug ? '✓ הועתק' : 'העתקה'}
                  </button>
                </div>
              </div>
              <div className="text-gray-800 whitespace-pre-wrap leading-relaxed text-sm">
                {post.content}
              </div>

              {/* Approval: the promise made in the questionnaire's last question */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                {post.status !== 'approved' && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => sendForApproval(post)}
                      disabled={sendingSlug === post.slug}
                      className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                    >
                      {sendingSlug === post.slug
                        ? 'ביצירת קישור...'
                        : post.status === 'pending'
                        ? 'הצגת קישור האישור שוב'
                        : 'שליחה לאישור השגריר/ה'}
                    </button>
                    {post.status === 'pending' && !reviewLinks[post.slug] && (
                      <span className="text-xs text-gray-400">
                        כבר נשלח. אפשר להציג את הקישור שוב.
                      </span>
                    )}
                  </div>
                )}

                {reviewLinks[post.slug] && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-2">
                      הקישור האישי לשגריר/ה. כל מי שמחזיק/ה בו יכול/ה לראות ולאשר את הפוסט הזה,
                      אז כדאי לשלוח אותו ישירות ולא בקבוצה.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={reviewLinks[post.slug]}
                        dir="ltr"
                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-left font-mono"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(reviewLinks[post.slug])
                          setCopiedLinkSlug(post.slug)
                          setTimeout(() => setCopiedLinkSlug(null), 2000)
                        }}
                        className="text-xs border border-gray-200 px-3 py-1.5 rounded hover:border-brand-300 hover:text-brand-600 transition-colors shrink-0"
                      >
                        {copiedLinkSlug === post.slug ? '✓ הועתק' : 'העתקה'}
                      </button>
                    </div>
                  </div>
                )}

                {post.status === 'approved' && <PublishLinks text={post.content} />}

                {post.status === 'approved' && (
                  <div className="text-xs text-gray-500 mt-3">
                    אושר
                    {post.approvedAt
                      ? ` ב-${new Date(post.approvedAt).toLocaleString('he-IL')}`
                      : ''}
                    {post.originalContent && (
                      <>
                        {' · '}
                        <button
                          onClick={() =>
                            setShowingOriginal((prev) => ({
                              ...prev,
                              [post.slug]: !prev[post.slug],
                            }))
                          }
                          className="text-brand-600 hover:underline"
                        >
                          {showingOriginal[post.slug]
                            ? 'הסתרת הגרסה המקורית'
                            : 'הצגת מה שונה מהגרסה שנוצרה'}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {showingOriginal[post.slug] && post.originalContent && (
                  <div className="mt-3 bg-purple-50 border border-purple-100 rounded-lg p-3">
                    <p className="text-xs text-purple-700 font-medium mb-2">
                      הגרסה שנוצרה במקור, לפני העריכה
                    </p>
                    <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                      {post.originalContent}
                    </div>
                    <p className="text-xs text-purple-600 mt-3 mb-2">
                      ההבדל בין שתי הגרסאות הוא החומר הכי מדויק לשיפור פרופיל הקול.
                    </p>
                    <button
                      onClick={() => generateLesson(post)}
                      disabled={lessonSlug === post.slug}
                      className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {lessonSlug === post.slug
                        ? 'בהפקת הלקח...'
                        : lessons[post.slug]
                        ? 'הפקה מחדש'
                        : 'הפקת כללי כתיבה מהעריכה'}
                    </button>

                    {lessons[post.slug] && (
                      <div className="mt-3">
                        <p className="text-xs text-purple-700 mb-1">
                          טיוטה לעיון. אפשר לערוך כאן, ואז להעתיק ולהוסיף לפרופיל דרך טאב
                          &quot;פרופיל&quot;. הפרופיל לא משתנה מעצמו.
                        </p>
                        <textarea
                          value={lessons[post.slug]}
                          onChange={(e) =>
                            setLessons((prev) => ({ ...prev, [post.slug]: e.target.value }))
                          }
                          rows={7}
                          className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-purple-300"
                        />
                        <button
                          onClick={() => copyToClipboard(lessons[post.slug], `lesson-${post.slug}`)}
                          className="text-xs border border-purple-200 px-3 py-1.5 rounded hover:bg-purple-100 transition-colors mt-1"
                        >
                          {copiedSlug === `lesson-${post.slug}` ? '✓ הועתק' : 'העתקה'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {sendError && post.slug === sendingSlug && (
                <p className="text-red-600 text-xs mt-2">{sendError}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {persona.isRuntime ? (
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-400">
                {editingProfile ? 'עריכת הפרופיל, השינויים יישמרו במערכת מיד עם השמירה' : 'אפשר לערוך את הפרופיל ישירות מכאן'}
              </span>
              {!editingProfile ? (
                <button
                  onClick={startEditingProfile}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  ✏️ עריכת פרופיל
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingProfile(false); setProfileSaveError('') }}
                    disabled={savingProfile}
                    className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="text-sm px-4 py-1.5 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    {savingProfile ? 'בשמירה...' : '💾 שמירת שינויים'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-4">
              פרסונה זו מנוהלת דרך הקוד (git), עריכה ישירה אינה זמינה דרך המערכת.
            </p>
          )}

          {profileSaveError && <p className="text-red-600 text-sm mb-3">{profileSaveError}</p>}

          {editingProfile ? (
            <textarea
              value={profileDraft}
              onChange={(e) => setProfileDraft(e.target.value)}
              rows={26}
              dir="ltr"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm leading-relaxed resize-y outline-none focus:ring-2 focus:ring-brand-500"
            />
          ) : (
            <div className="prose prose-sm max-w-none text-gray-700 ltr" dir="rtl">
              <ReactMarkdown>{persona.profileContent}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* Samples tab */}
      {activeTab === 'samples' && (
        <div className="space-y-4">
          {persona.samples.map((sample, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-xs text-gray-400 mb-3 font-mono">{sample.filename}</p>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {sample.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Media tab */}
      {activeTab === 'media' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {persona.imagePath && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <img src={persona.imagePath} alt={persona.name} className="w-full object-cover" />
              <div className="p-3 text-xs text-gray-400">תמונת פרופיל</div>
            </div>
          )}
          {persona.hasVideo && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <video
                src={`/api/image/${slug}/video.mp4`}
                controls
                className="w-full"
              />
              <div className="p-3 text-xs text-gray-400">סרטון</div>
            </div>
          )}
          {!persona.imagePath && !persona.hasVideo && (
            <div className="col-span-2 text-center py-16 text-gray-400">אין מדיה</div>
          )}
        </div>
      )}
    </div>
  )
}
