import { findByToken } from '@/lib/approvals'
import ReviewForm from './ReviewForm'

// The ambassador's view. Public, no account, no nav, and it shows exactly one
// post: whatever the token points at. Same reasoning as /onboarding, a page
// shared outside the organisation must not hint that an admin area exists.
export const dynamic = 'force-dynamic'

export default function ReviewPage({ params }: { params: { token: string } }) {
  const target = findByToken(params.token)

  if (!target) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-2xl font-bold mb-2">הקישור אינו תקף</h1>
        <p className="text-gray-600 leading-relaxed">
          ייתכן שכבר אישרת את הפוסט הזה, או שהקישור פג. אפשר לפנות למי ששלח/ה לך אותו
          ולבקש קישור חדש.
        </p>
      </div>
    )
  }

  if (target.post.status === 'approved') {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-2">הפוסט כבר אושר</h1>
        <p className="text-gray-600 leading-relaxed">
          תודה. אין צורך בפעולה נוספת.
        </p>
      </div>
    )
  }

  return (
    <ReviewForm
      token={params.token}
      personaName={target.personaName}
      topic={target.post.topic}
      platform={target.post.platform}
      content={target.post.content}
    />
  )
}
