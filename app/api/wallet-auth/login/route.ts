import { walletLoginRoute } from '@/lib/walletAuthServer';

// Public in middleware.ts: the caller is signed out by definition. The proof
// in the body is what authenticates the request.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return walletLoginRoute(req);
}
