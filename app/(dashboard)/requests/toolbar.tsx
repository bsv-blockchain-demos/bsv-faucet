'use client';
import { useState } from 'react';
import { Search, Download } from 'lucide-react';

const Toolbar = () => {
  const [search, setSearch] = useState('');
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="relative w-[320px] max-w-full">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search requests"
          className="h-11 w-full rounded-xl border-[1.5px] border-input bg-card pl-11 pr-4 text-sm text-foreground"
        />
      </div>
      <a
        className="sbtn inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-primary px-[18px] text-sm font-medium text-primary"
        href="/api/requests/export"
      >
        <Download className="h-[17px] w-[17px]" />
        Export to CSV
      </a>
    </div>
  );
};

export default Toolbar;
