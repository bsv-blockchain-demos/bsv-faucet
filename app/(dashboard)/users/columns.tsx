'use client';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
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
      <div className="flex items-center gap-2">
        <Avatar>
          <AvatarImage src={row.original.imageUrl} />
          <AvatarFallback>{row.original.username}</AvatarFallback>
        </Avatar>
        <div className="flex justify-start flex-col">
          <span>{row.original.username}</span>
          <span>{row.original.email}</span>
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
    cell: ({ row }) => <div className="capitalize">{row.original.role}</div>
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
    cell: ({ row }) => row.original.createdAt.toLocaleString()
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
    cell: ({ row }) => Number(row.original.withdrawn).toLocaleString()
  },
  {
    accessorKey: 'paused',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Paused
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (row.original.paused ? 'Paused' : 'Active')
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
