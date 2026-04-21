import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Define which routes require authentication
  const isProtected = 
    request.nextUrl.pathname === '/' || // <-- WE ADDED THE DASHBOARD HERE!
    request.nextUrl.pathname.startsWith('/inventory') ||
    request.nextUrl.pathname.startsWith('/pos') ||
    request.nextUrl.pathname.startsWith('/settings') ||
    request.nextUrl.pathname.startsWith('/staff') ||
    request.nextUrl.pathname.startsWith('/analytics');

  // 1. Kick unauthenticated users back to login
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. Handle authenticated users
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('requires_password_change, role')
      .eq('id', user.id)
      .single();

    const needsChange = profile?.requires_password_change;

    // INTERCEPTOR: Force them to the update-password screen
    if (needsChange && request.nextUrl.pathname !== '/update-password') {
      return NextResponse.redirect(new URL('/update-password', request.url));
    }

    // Protect the update-password route from users who don't need it
    if (!needsChange && request.nextUrl.pathname === '/update-password') {
      const destination = profile?.role === 'Cashier' ? '/pos' : '/';
      return NextResponse.redirect(new URL(destination, request.url));
    }
    
    // Redirect logged-in users away from the login screen
    if (request.nextUrl.pathname === '/login') {
      const destination = profile?.role === 'Cashier' ? '/pos' : '/';
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return supabaseResponse;
}

// Only run the proxy on app routes (ignore static files and images)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};