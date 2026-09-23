import type { ReactNode } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WalletDetection = 'checking' | 'detected' | 'not-detected';

const BSV_DESKTOP_URL = 'https://desktop.bsvb.tech/';
const BSV_BROWSER_URL = 'https://mobile.bsvb.tech';

// nowrap so a product name never breaks across two lines.
const linkClass =
  'whitespace-nowrap font-medium text-link underline-offset-2 hover:underline';

function InstallLine() {
  return (
    <>
      Install{' '}
      <a
        href={BSV_DESKTOP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        BSV Desktop
      </a>{' '}
      for PC{' '}
      {/* Kept together, so on a narrow screen the wrap falls before "or". */}
      <span className="whitespace-nowrap">
        or{' '}
        <a
          href={BSV_BROWSER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          BSV Browser
        </a>{' '}
        for mobile.
      </span>
    </>
  );
}

/**
 * Splits "Could not connect to your wallet. Make sure your BSV wallet is
 * running." into a title and a hint, so the panel can set the first sentence
 * apart. The wording itself stays exactly as written.
 */
function splitMessage(message: string): { title: string; hint: string | null } {
  const end = message.indexOf('. ');
  if (end === -1) return { title: message.replace(/\.$/, ''), hint: null };
  return { title: message.slice(0, end), hint: message.slice(end + 2) };
}

/**
 * A panel with an icon beside a bold title and an optional body underneath.
 * The body runs the full width of the panel rather than sitting in a column
 * beside the icon, so the install line fits on one line at 13px.
 */
function Panel({
  tone,
  icon,
  title,
  children,
  role,
  live
}: {
  tone: 'neutral' | 'negative';
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  role?: string;
  live?: 'polite';
}) {
  return (
    <div
      role={role}
      aria-live={live}
      className={cn(
        'flex flex-col gap-1 rounded-2xl px-4 py-3',
        tone === 'negative' ? 'bg-negative/10' : 'bg-muted'
      )}
    >
      <p
        className={cn(
          'flex items-center gap-2 text-sm font-medium leading-5',
          tone === 'negative' ? 'text-negative' : 'text-foreground'
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex shrink-0',
            tone === 'negative' ? 'text-negative' : 'text-muted-foreground'
          )}
        >
          {icon}
        </span>
        {title}
      </p>
      {children && (
        <p className="text-[13px] leading-5 text-muted-foreground">
          {children}
        </p>
      )}
    </div>
  );
}

/**
 * The feedback under the wallet button, as one element whose look follows
 * the state: a quiet line while checking, a green status bar when a wallet
 * is found, a soft panel with install links when none is, and a red-tinted
 * panel when the last attempt failed. An error takes the place of the
 * detection status rather than stacking a second box under it.
 */
export function WalletFeedback({
  detection,
  error
}: {
  detection: WalletDetection;
  error: string | null;
}) {
  if (error) {
    const { title, hint } = splitMessage(error);
    return (
      <Panel
        role="alert"
        tone="negative"
        icon={<AlertTriangle className="h-[18px] w-[18px]" />}
        title={title}
      >
        {hint}
        {detection === 'not-detected' && (
          <span className="mt-1 block">
            <InstallLine />
          </span>
        )}
      </Panel>
    );
  }

  if (detection === 'not-detected') {
    return (
      <Panel
        live="polite"
        tone="neutral"
        icon={<Download className="h-[18px] w-[18px]" />}
        title="No BSV wallet detected"
      >
        <InstallLine />
      </Panel>
    );
  }

  if (detection === 'detected') {
    // The brand's positive status colours, green text on a light green fill,
    // at the full width of the panels the other states show here, so the
    // card keeps its shape whichever state it is in.
    return (
      <p
        aria-live="polite"
        className="flex items-center justify-center gap-2 rounded-2xl bg-positive/10 px-4 py-3 text-[13px] font-medium text-positive"
      >
        <span aria-hidden className="h-2 w-2 rounded-full bg-positive" />
        BSV wallet detected on this computer
      </p>
    );
  }

  return (
    <p
      aria-live="polite"
      className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground"
    >
      <span
        aria-hidden
        className="h-2 w-2 rounded-full bg-muted-foreground/50 motion-safe:animate-pulse"
      />
      Checking for a BSV wallet…
    </p>
  );
}
