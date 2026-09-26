'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange
}: TablePaginationProps) {
  if (totalPages <= 1) return null;

  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-4 px-1 pt-4">
      <div className="text-[13px] tabular-nums text-muted-foreground">
        Showing {start}-{end} of {totalItems}
      </div>
      <div className="flex items-center gap-1">
        <PageButton
          label="Previous page"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
        >
          <ChevronLeft />
        </PageButton>
        <div className="px-2.5 text-[13px] tabular-nums text-muted-foreground">
          Page <span className="font-medium text-foreground">{page + 1}</span>{' '}
          of {totalPages}
        </div>
        <PageButton
          label="Next page"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
        >
          <ChevronRight />
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  label,
  onClick,
  disabled,
  children
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}
