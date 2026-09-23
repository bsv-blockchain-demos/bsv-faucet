import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// '/' is the public marketing landing page (unauthenticated entry).
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  // Wallet sign-in: the login and server-key routes are called while signed
  // out. Without this, auth.protect() bounces the login request to /sign-in
  // and nobody can sign in with a wallet.
  '/api/wallet-auth(.*)'
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)'
  ]
};