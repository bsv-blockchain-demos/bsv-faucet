export type WalletDetection = 'checking' | 'detected' | 'not-detected';

const BSV_DESKTOP_URL = 'https://desktop.bsvb.tech/';
const BSV_BROWSER_URL = 'https://mobile.bsvb.tech';

const linkClass = 'font-medium text-link underline-offset-2 hover:underline';

/** The wallet detection line beneath the wallet button, with install links. */
export function WalletStatusNote({ detection }: { detection: WalletDetection }) {
  return (
    <p
      aria-live="polite"
      className="flex items-center justify-center gap-2 text-center text-[13px] text-muted-foreground"
    >
      {detection === 'checking' && <span>Checking for a BSV wallet…</span>}
      {detection === 'detected' && (
        <>
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full bg-positive"
          />
          <span>BSV wallet detected on this computer.</span>
        </>
      )}
      {detection === 'not-detected' && (
        <span>
          No BSV wallet detected. Install{' '}
          <a
            href={BSV_DESKTOP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            BSV Desktop
          </a>{' '}
          for PC or{' '}
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
      )}
    </p>
  );
}
