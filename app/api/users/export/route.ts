import { fetchUser, fetchUsers } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { stringify as csvStringifySync } from 'csv-stringify/sync';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await fetchUser();
  if (!user || user.role !== 'admin') {
    return new NextResponse(null, {
      status: 403,
      statusText: 'Unauthorized'
    });
  }
  const users = await fetchUsers(user);
  const usersCsv = users.map((user) => {
    const result: Record<string, any> = {};
    result['ID'] = user.id;
    result['User ID'] = user.userId;
    result['Email'] = user.email ?? '';
    result['Username'] = user.username;
    result['Auth'] = user.authMethod === 'wallet' ? 'Wallet' : 'Email';
    result['Identity key'] = user.identityKey ?? '';
    result['Role'] = user.role;
    result['Date registered'] = user.createdAt.toLocaleString();
    result['Withdrawn'] = user.withdrawn.toString();
    result['Paused'] = user.paused ? 'Paused' : 'Active';
    return result;
  });
  const csvString = csvStringifySync(usersCsv, {
    header: true,
    delimiter: ';'
  });
  return new NextResponse(csvString, {
    headers: { 'Content-Disposition': 'attachment; filename="users.csv"' }
  });
}
