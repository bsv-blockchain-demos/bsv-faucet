import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { fetchUser, fetchUsers } from '@/lib/prisma';
import { columns } from './columns';
import { DataTable } from './data-table';
import { AlertCircle } from 'lucide-react';

const UsersPage = async () => {
  const user = await fetchUser();

  if (!user || user.role !== 'admin') {
    return (
      <Card className="mx-auto mt-8 w-full max-w-md">
        <CardHeader>
          <CardTitle>Unauthorized Access</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You do not have permission to view this page. This area is
              restricted to administrators only.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const users = await fetchUsers(user);

  return (
    <section className="rounded-[20px] border bg-card p-7">
      <div className="mb-[22px]">
        <h1 className="font-display text-[26px] font-semibold leading-tight">
          Users
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Manage user accounts and view their details.
        </p>
      </div>
      <DataTable columns={columns} data={users} />
    </section>
  );
};

export default UsersPage;
