'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-col items-center gap-4 p-6 text-center md:p-10">
      <AlertTriangle className="h-8 w-8 text-muted-foreground" />
      <h1 className="font-display text-[26px] font-semibold">
        Something went wrong
      </h1>
      <p className="max-w-md text-muted-foreground">
        This page could not be loaded. Try again, and if the problem continues,
        check back in a few minutes.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
