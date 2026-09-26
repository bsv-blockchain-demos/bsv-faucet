'use client';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ArrowUpDown, Copy, MoreHorizontal } from 'lucide-react';
import { User } from '@/lib/prisma';
import { toast, useToast } from '@/hooks/use-toast';
import { togglePauseUser, deleteUser, changeUserRole } from './actions';
import { Role } from '@/prisma/generated/client';
import { avatarInitials, truncateIdentityKey } from '@/lib/walletAuth';

// The negative margin cancels the button's own padding, so the label sits on
// the cell's padding edge and lines up with the values below it.
function SortHeader({
  column,
  label
}: {
  column: Column<User, unknown>;
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      className="-ml-2.5 h-8 gap-1.5 px-2.5 text-[13px] [&_svg]:size-3.5"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {label}
      <ArrowUpDown />
    </Button>
  );
}

// The cell shows a truncated value, but the button copies it in full.
function CopyButton({ value, label }: { value: string; label: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'Copied to clipboard', description: `${label} copied` });
    } catch {
      toast({
        title: 'Error',
        description: `Failed to copy ${label.toLowerCase()}`,
        variant: 'destructive'
      });
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${label.toLowerCase()}`}
      className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Copy className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">Copy {label.toLowerCase()}</span>
    </button>
  );
}

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => <SortHeader column={column} label="ID" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.id}</span>
    )
  },
  {
    // Wallet accounts have no email, so the column (and the filter above the
    // table, which targets it by id) falls back to the identity key.
    id: 'email',
    accessorFn: (user) => user.email ?? user.identityKey ?? '',
    // w-full takes whatever width the other columns leave, and max-w-0 stops
    // long values from widening the table, so they truncate instead of
    // forcing a horizontal scroll.
    meta: { className: 'w-full max-w-0' },
    header: ({ column }) => <SortHeader column={column} label="Email" />,
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={row.original.imageUrl} />
          <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
            {avatarInitials(row.original)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate font-medium leading-tight">
              {row.original.username}
            </span>
            <CopyButton value={row.original.username} label="Username" />
          </div>
          {row.original.email ? (
            <div className="flex min-w-0 items-center gap-1">
              <span className="truncate text-[13px] text-muted-foreground">
                {row.original.email}
              </span>
              <CopyButton value={row.original.email} label="Email" />
            </div>
          ) : row.original.identityKey ? (
            <div className="flex min-w-0 items-center gap-1">
              <span className="truncate text-[13px] text-muted-foreground">
                {truncateIdentityKey(row.original.identityKey)}
              </span>
              <CopyButton
                value={row.original.identityKey}
                label="Identity key"
              />
            </div>
          ) : null}
        </div>
      </div>
    )
  },
  {
    accessorKey: 'authMethod',
    header: ({ column }) => <SortHeader column={column} label="Auth" />,
    cell: ({ row }) => (
      <Badge variant="brand">
        {row.original.authMethod === 'wallet' ? 'Wallet' : 'Email'}
      </Badge>
    )
  },
  {
    accessorKey: 'role',
    header: ({ column }) => <SortHeader column={column} label="Role" />,
    cell: ({ row }) => (
      <Badge variant="muted" className="capitalize">
        {row.original.role}
      </Badge>
    )
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <SortHeader column={column} label="Date registered" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {row.original.createdAt.toLocaleDateString()}
      </span>
    )
  },
  {
    accessorKey: 'withdrawn',
    header: ({ column }) => <SortHeader column={column} label="Withdrawn" />,
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {Number(row.original.withdrawn).toLocaleString()}
      </span>
    )
  },
  {
    accessorKey: 'paused',
    header: ({ column }) => <SortHeader column={column} label="Status" />,
    cell: ({ row }) =>
      row.original.paused ? (
        <Badge variant="muted">Paused</Badge>
      ) : (
        <Badge variant="positive">
          <span className="h-1.5 w-1.5 rounded-full bg-positive" />
          Active
        </Badge>
      )
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const { toast } = useToast();
      const availableRoles = ['user', 'admin'];

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Change Role</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {availableRoles.map((role) => (
                  <DropdownMenuItem
                    key={role}
                    onClick={async () => {
                      try {
                        const selectedRole: Role = Role[role as keyof typeof Role];
                        const result = await changeUserRole(row.original.userId, selectedRole);
                        if (result.success) {
                          toast({
                            title: 'Role Updated',
                            description: `User role has been changed to ${role}.`
                          });
                        } else {
                          throw new Error('Failed to change user role');
                        }
                      } catch (error) {
                        toast({
                          title: 'Error',
                          description: 'Failed to change user role. Please try again.',
                          variant: 'destructive'
                        });
                      }
                    }}
                  >
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              onClick={async () => {
                try {
                  await togglePauseUser(row.original.id);
                  toast({
                    title: `User ${
                      row.original.paused ? 'unpaused' : 'paused'
                    }`,
                    description: `User has been ${
                      row.original.paused ? 'unpaused' : 'paused'
                    } successfully.`
                  });
                } catch (error) {
                  toast({
                    title: 'Error',
                    description: `Failed to ${
                      row.original.paused ? 'unpause' : 'pause'
                    } user. Please try again.`,
                    variant: 'destructive'
                  });
                }
              }}
            >
              {row.original.paused ? 'Unpause' : 'Pause'} account
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                try {
                  await deleteUser(row.original.id);
                  toast({
                    title: 'User deleted',
                    description: 'User has been deleted successfully.'
                  });
                } catch (error) {
                  toast({
                    title: 'Error',
                    description: 'Failed to delete user. Please try again.',
                    variant: 'destructive'
                  });
                }
              }}
            >
              Delete account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
  }
];
