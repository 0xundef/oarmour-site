import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Allow access in development without authentication
  if (process.env.NODE_ENV === "development" || !process.env.NEXTAUTH_SECRET) {
    // Check if user is trying to access dashboard
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      // Allow access in development
      return NextResponse.next();
    }
    return NextResponse.next();
  }

  // Use authentication in production
  return withAuth(
    request,
    {
      pages: {
        signIn: '/',
      },
    }
  );
}

export const config = { matcher: ["/dashboard/:path*"] };