import AdminTreasuryHistory from '@/components/adminTreasuryHistory/AdminTreasuryHistory';
import TreasuryDepositHistory from '@/components/adminTreasuryHistory/TreasuryDepositHistory';
import { fetchUser } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const user = await fetchUser();

  if (!user || user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="stagger flex flex-col gap-7">
      <div>
        <h1 className="font-display text-[26px] font-semibold leading-tight">
          Admin
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Treasury overview and deposit history.
        </p>
      </div>

      <AdminTreasuryHistory />
      <TreasuryDepositHistory />
    </div>
  );
}
