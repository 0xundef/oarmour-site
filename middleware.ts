import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Use authentication in production
export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    pages: {
      signIn: '/signin',
    },
  }
);

export const config = { matcher: ["/dashboard/:path*"] };
