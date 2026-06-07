import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Pages that anyone can reach without logging in.
// /onboarding is the candidate questionnaire, it must stay public so candidates can fill it out.
const PUBLIC_PAGES = ['/onboarding', '/login']

// API endpoints that must stay reachable without a session.
const PUBLIC_API_EXACT = ['/api/auth/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public pages (and their sub-paths, e.g. /onboarding itself has none, but keep it future proof)
  if (PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Candidate questionnaire submission must work without a session
  if (pathname === '/api/candidates' && request.method === 'POST') {
    return NextResponse.next()
  }

  if (PUBLIC_API_EXACT.includes(pathname)) {
    return NextResponse.next()
  }

  const isAuthed = request.cookies.get('dashboard_auth')?.value === process.env.DASHBOARD_PASSWORD

  if (isAuthed) {
    return NextResponse.next()
  }

  // Not authenticated: API routes get a 401 JSON response, pages get redirected to /login
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 })
  }

  // Build the redirect from nextUrl (resolved via forwarded-host headers), not request.url.
  // Behind Railway's reverse proxy, request.url can resolve to the app's internal address
  // (e.g. http://localhost:8080/...), which would send the browser to an unreachable host
  // and look exactly like the site being blocked.
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  loginUrl.searchParams.set('redirect', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Run on everything except static assets and Next internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
