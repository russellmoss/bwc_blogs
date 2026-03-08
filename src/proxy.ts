import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Protect all routes EXCEPT:
     * - /login (auth page)
     * - /api/auth (NextAuth routes)
     * - /api/health (health check)
     * - /api/capture (public lead capture from Wix)
     * - /_next, /favicon.ico, etc. (static assets)
     */
    "/((?!login|api/auth|api/health|api/capture|api/rag|api/cron|_next|favicon.ico).*)",
  ],
};
