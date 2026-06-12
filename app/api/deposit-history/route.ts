import { NextResponse } from 'next/server'
import { getDepositHistory } from '@/lib/depositHistory'

// Re-exported for backwards compatibility with existing imports.
export type { DepositTransaction } from '@/lib/depositHistory'

export async function GET() {
  return NextResponse.json(await getDepositHistory())
}
