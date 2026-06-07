import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  // Protect any authenticated route. Unauthed users will be redirected
  // to /login?callbackUrl=<original-path>.
  matcher: ['/dashboard/:path*', '/chat/:path*'],
};
