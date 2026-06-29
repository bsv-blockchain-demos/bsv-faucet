'use client';
import { ColumnDef } from '@tanstack/react-table';
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
import { ArrowUpDown, MoreHorizontal } from 'lucide-react';
import { User } from '@/lib/prisma';
import { useToast } from '@/hooks/use-toast';
import { togglePauseUser, deleteUser, changeUserRole } from './actions';
import { Role } from '@/prisma/generated/client';

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        ID
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.id}</span>
    )
  },
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Email
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={row.original.imageUrl} />
          <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
            {row.original.username?.charAt(0)?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium leading-tight">
            {row.original.username}
          </span>
          <span className="truncate text-[13px] text-muted-foreground">
            {row.original.email}
          </span>
        </div>
      </div>
    )
  },
  {
    accessorKey: 'role',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Role
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Badge variant="muted" className="capitalize">
        {row.original.role}
      </Badge>
    )
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Date registered
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.createdAt.toLocaleString()}
      </span>
    )
  },
  {
    accessorKey: 'withdrawn',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Withdrawn
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {Number(row.original.withdrawn).toLocaleString()}
      </span>
    )
  },
  {
    accessorKey: 'paused',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Status
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
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
