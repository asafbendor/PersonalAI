import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { password } = await req.json()
    const expected = process.env.DASHBOARD_PASSWORD

    if (!expected) {
      return NextResponse.json(
        { error: 'לא הוגדרה סיסמה למערכת (DASHBOARD_PASSWORD חסר ב-Variables)' },
        { status: 500 }
      )
    }

    if (password !== expected) {
      return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 })
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set('dashboard_auth', expected, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    return res
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set('dashboard_auth', '', { path: '/', maxAge: 0 })
  return res
}
