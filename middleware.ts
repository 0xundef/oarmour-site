import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Use authentication in production
export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        if (!token) return false;
        if ((token as { blocked?: boolean }).blocked) return false;
        return true;
      },
    },
    pages: {
      signIn: '/signin',
    },
  }
);

export const config = { matcher: ["/dashboard/:path*"] };
