'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'

interface Post {
  slug: string
  filename: string
  date: string
  topic: string
  platform: string
  goal: string
  status: string
  content: string
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
  profileContent: string
  samples: { filename: string; content: string }[]
}

type Tab = 'posts' | 'profile' | 'samples' | 'media'

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  published: 'bg-blue-100 text-blue-700 border-blue-200',
}

export default function AmbassadorPage() {
  const params = useParams()
  const slug = params.slug as string

  const [persona, setPersona] = useState<PersonaFull | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('posts')
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/personas/${slug}`).then((r) => r.json()),
      fetch(`/api/posts/${slug}`).then((r) => r.json()),
    ]).then(([p, posts]) => {
      setPersona(p)
      setPosts(Array.isArray(posts) ? posts : [])
      setLoading(false)
    })
  }, [slug])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSlug(id)
    setTimeout(() => setCopiedSlug(null), 2000)
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
          <div className="w-full md:w-56 h-56 shrink-0 bg-gray-100">
            {persona.imagePath ? (
              <img src={persona.imagePath} alt={persona.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl text-gray-200">👤</div>
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
              <Link
                href={`/generate?personas=${slug}`}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                + יצירת פוסט
              </Link>
            </div>

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
                צור פוסט ראשון &rarr;
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
                      {post.status === 'draft' ? 'טיוטה' : post.status === 'approved' ? 'מאושר' : 'פורסם'}
                    </span>
                  )}
                  <button
                    onClick={() => copyToClipboard(post.content, post.slug)}
                    className="text-xs text-gray-400 hover:text-brand-600 transition-colors px-2 py-1 rounded border border-gray-200 hover:border-brand-300"
                  >
                    {copiedSlug === post.slug ? '✓ הועתק' : 'העתק'}
                  </button>
                </div>
              </div>
              <div className="text-gray-800 whitespace-pre-wrap leading-relaxed text-sm">
                {post.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="prose prose-sm max-w-none text-gray-700 ltr" dir="rtl">
            <ReactMarkdown>{persona.profileContent}</ReactMarkdown>
          </div>
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
