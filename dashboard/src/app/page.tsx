import { getAllPersonas } from '@/lib/personas'
import Link from 'next/link'

const statusLabel: Record<string, { label: string; color: string }> = {
  draft: { label: 'טיוטה', color: 'bg-yellow-100 text-yellow-800' },
  ready: { label: 'מוכן', color: 'bg-green-100 text-green-800' },
  validated: { label: 'מאומת', color: 'bg-blue-100 text-blue-800' },
}

export default function Home() {
  const personas = getAllPersonas()
  const totalPosts = personas.reduce((sum, p) => sum + p.postCount, 0)

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">לוח הבקרה</h1>
        <div className="flex gap-6 text-sm text-gray-500">
          <span>{personas.length} שגרירים פעילים</span>
          <span>{totalPosts} פוסטים סה"כ</span>
        </div>
      </div>

      {/* Analytics bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">פוסטים לפי שגריר</h2>
        <div className="space-y-3">
          {personas.map((p) => (
            <div key={p.slug} className="flex items-center gap-3">
              <span className="text-sm text-gray-700 w-28 shrink-0 text-right">{p.name}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="bg-brand-500 h-2 rounded-full transition-all"
                  style={{ width: totalPosts > 0 ? `${(p.postCount / totalPosts) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700 w-6 text-center">{p.postCount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ambassador cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {personas.map((persona) => {
          const status = statusLabel[persona.trainingStatus] ?? { label: persona.trainingStatus, color: 'bg-gray-100 text-gray-600' }
          return (
            <Link
              key={persona.slug}
              href={`/ambassador/${persona.slug}`}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
            >
              {/* Photo */}
              <div className="h-48 bg-gray-100 overflow-hidden">
                {persona.imagePath ? (
                  <img
                    src={persona.imagePath}
                    alt={persona.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">👤</div>
                )}
              </div>

              {/* Info */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{persona.name}</h3>
                    <p className="text-sm text-gray-500">{persona.role}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{persona.company}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                {persona.personalityWords && (
                  <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
                    {persona.personalityWords}
                  </p>
                )}

                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-gray-500">
                    {persona.postCount} {persona.postCount === 1 ? 'פוסט' : 'פוסטים'}
                  </span>
                  <span className="text-brand-600 text-sm font-medium group-hover:underline">
                    צפה בפרופיל &rarr;
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
