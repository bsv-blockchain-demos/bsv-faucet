import { ClientUser, ClientTransaction } from '@/lib/prisma';
import { TableRow, TableCell } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const LatestTransactionsTableRow = ({
  user,
  transaction,
  showBeef = true
}: {
  user: ClientUser;
  transaction: ClientTransaction;
  showBeef?: boolean;
}) => {
  const isDeposit = transaction.txType === 'deposit';

  return (
    <TableRow>
      <TableCell className="max-w-40 truncate">
        <a
          href={`https://test.whatsonchain.com/tx/${transaction.txid}`}
          className="text-blue-500 hover:brightness-150"
          target="_blank"
          rel="noopener noreferrer"
        >
          {transaction.txid.substring(0, 8)}...
        </a>
      </TableCell>
      <TableCell suppressHydrationWarning>
        {new Date(transaction.date).toLocaleString()}
      </TableCell>
      {user.role === 'admin' && (
        <TableCell>
          {transaction.txType === 'deposit'
            ? 'Admin - Treasury Wallet'
            : transaction.user && (
                <div className="flex items-center gap-2">
                  <Avatar>
                    <AvatarImage src={transaction.user.imageUrl} />
                    <AvatarFallback>{transaction.user.username}</AvatarFallback>
                  </Avatar>
                  <div className="flex justify-start flex-col">
                    <span>{transaction.user.username}</span>
                    <span>{transaction.user.email}</span>
                  </div>
                </div>
              )}
        </TableCell>
      )}
      <TableCell className="max-w-40 truncate">
        {showBeef ? (
          <a
            href={`https://beef.xn--nda.network/${transaction.beefTx.txid}`}
            className="text-blue-500 hover:brightness-150"
            target="_blank"
            rel="noopener noreferrer"
          >
            View BEEF
          </a>
        ) : (
          'N/A'
        )}
      </TableCell>
      <TableCell>{transaction.txType}</TableCell>
      <TableCell>{transaction.amount.toLocaleString()}</TableCell>
    </TableRow>
  );
};

export default LatestTransactionsTableRow;
