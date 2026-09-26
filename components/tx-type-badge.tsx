import { ArrowDown, ArrowUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Deposits add to the treasury and withdrawals take from it, so the arrow and
// colour follow the treasury balance.
export function TxTypeBadge({ txType }: { txType: string }) {
  return txType === 'deposit' ? (
    <Badge variant="positive">
      <ArrowUp className="h-3 w-3" aria-hidden />
      Deposit
    </Badge>
  ) : (
    <Badge variant="negative">
      <ArrowDown className="h-3 w-3" aria-hidden />
      Withdraw
    </Badge>
  );
}
