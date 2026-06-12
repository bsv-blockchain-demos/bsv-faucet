export type DepositTransaction = {
  date: string
  txid: string
  beefTx: string
  vout: number
  txType: 'deposit'
  amount: number
}

const mockDepositHistory: DepositTransaction[] = [
  {
    date: '2023-05-15T10:30:00',
    txid: '1a2b3c4d5e6f7g8h9i0j',
    beefTx: 'beef1234567890abcdef',
    vout: 0,
    txType: 'deposit',
    amount: 1000000
  },
  {
    date: '2023-05-14T14:45:00',
    txid: '2b3c4d5e6f7g8h9i0j1a',
    beefTx: 'beef0987654321fedcba',
    vout: 1,
    txType: 'deposit',
    amount: 500000
  },
  {
    date: '2023-05-13T09:15:00',
    txid: '3c4d5e6f7g8h9i0j1a2b',
    beefTx: 'beef2468135790acegik',
    vout: 2,
    txType: 'deposit',
    amount: 750000
  }
]

// Returns the treasury deposit history. Currently mock data; replace the body
// with the real source when available. Callable directly from server
// components and route handlers, so no self-referential HTTP fetch is needed.
export async function getDepositHistory(): Promise<DepositTransaction[]> {
  return mockDepositHistory
}
