import Link from 'next/link';
import { Zap, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { BsvLogo } from '@/components/icons';
import { ThemeToggle } from './(dashboard)/theme-toggle';

export const dynamic = 'force-dynamic';

const navLinks = [
  { label: 'How it works', href: '#how', external: false },
  { label: 'Why BSV', href: '#why', external: false },
  { label: 'Docs', href: 'https://docs.bsvblockchain.org/', external: true },
  { label: 'Hub', href: 'https://hub.bsvblockchain.org/', external: true }
];

const pillars = [
  {
    Icon: Zap,
    title: 'Instant payouts',
    body: 'Request testnet BSV and receive it in seconds, with near-instant settlement and no waiting on confirmations to keep building.'
  },
  {
    Icon: SlidersHorizontal,
    title: 'Fair limits',
    body: 'Up to 10,000,000 satoshis per request with a 24-hour cooldown, so the faucet stays topped up for everyone.'
  },
  {
    Icon: RefreshCw,
    title: 'Give back',
    body: 'Done testing? Send unused coins back to the faucet address in one click and keep the sandbox healthy.'
  }
];

const steps = [
  {
    n: '01',
    title: 'Sign in',
    body: 'Create an account or sign in with your email. It takes less than a minute.'
  },
  {
    n: '02',
    title: 'Paste your address',
    body: 'Drop in any BSV testnet address and choose how many satoshis you need.'
  },
  {
    n: '03',
    title: 'Receive BSV',
    body: 'Coins land almost instantly. Track every payout in your dashboard.'
  }
];

const footerLinks = [
  { label: 'Docs', href: 'https://docs.bsvblockchain.org/' },
  { label: 'Hub', href: 'https://hub.bsvblockchain.org/' },
  { label: 'X', href: 'https://x.com/BSVAssociation' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/bsvassociation/' },
  { label: 'YouTube', href: 'https://www.youtube.com/@BSVAssociation_' }
];

export default function LandingPage() {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-20 flex items-center gap-6 border-b bg-[var(--topbar)] px-[clamp(20px,5vw,56px)] py-4 backdrop-blur-[12px]">
        <Link href="/" className="flex items-center gap-3">
          <BsvLogo className="h-[38px] w-[38px] rounded-[10px]" />
          <span className="font-display text-[18px] font-semibold tracking-[0.2px]">
            BSV Faucet
          </span>
        </Link>
        <nav className="ml-4 hidden items-center gap-7 min-[880px]:flex">
          {navLinks.map((l) =>
            l.external ? (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ) : (
              <a
                key={l.label}
                href={l.href}
                className="text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            )
          )}
        </nav>
        <div className="flex-1" />
        <ThemeToggle />
        <Link
          href="/sign-in"
          className="sbtn inline-flex h-[42px] items-center rounded-full border-[1.5px] border-primary px-5 text-sm font-medium text-primary"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-primary px-[clamp(20px,5vw,56px)] pb-[clamp(72px,10vw,120px)] pt-[clamp(56px,9vw,104px)] text-white">
        <div className="relative mx-auto max-w-[1180px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-[7px] text-[13px] font-medium">
            <span className="h-[7px] w-[7px] rounded-full bg-[#00E6FF] shadow-[0_0_10px_#00E6FF]" />
            BSV Blockchain · Testnet Faucet
          </div>
          <h1 className="mb-[22px] max-w-[16ch] font-display text-[clamp(36px,5.6vw,64px)] font-semibold leading-[1.05] tracking-[-0.5px]">
            Fund your build with testnet BSV in seconds.
          </h1>
          <p className="mb-9 max-w-[60ch] text-[clamp(16px,1.6vw,19px)] leading-[1.6] text-white/80">
            Built on Bitcoin&rsquo;s original design, an electronic cash system
            made to scale without artificial limits. Request testnet coins
            instantly, build your application, and send what you don&rsquo;t use
            back to the faucet.
          </p>
          <div className="mb-14 flex flex-wrap gap-3.5">
            <Link
              href="/sign-in"
              className="pbtn shine-loop inline-flex h-[52px] items-center rounded-full bg-white px-[30px] text-base font-semibold text-primary shadow-[0_14px_34px_-10px_rgba(0,0,0,0.45)]"
            >
              Get testnet BSV
            </Link>
            <a
              href="https://docs.bsvblockchain.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[52px] items-center rounded-full border-[1.5px] border-white/45 px-[26px] text-base font-medium text-white transition-colors hover:bg-white/10"
            >
              Read the docs
            </a>
          </div>
          <div className="grid max-w-[680px] grid-cols-3 gap-5 max-[620px]:grid-cols-1">
            {[
              { figure: '10M', label: 'satoshis max per request' },
              { figure: '~Instant', label: 'settlement on testnet' },
              { figure: '24h', label: 'cooldown between requests' }
            ].map((s) => (
              <div key={s.label} className="border-t border-white/20 pt-4">
                <div className="font-display text-[clamp(24px,3vw,32px)] font-semibold">
                  {s.figure}
                </div>
                <div className="mt-1 text-sm text-white/70">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section
        id="why"
        className="mx-auto max-w-[1180px] scroll-mt-24 px-[clamp(20px,5vw,56px)] py-[clamp(56px,8vw,96px)]"
      >
        <h2 className="mb-3.5 max-w-[18ch] font-display text-[clamp(26px,3.4vw,38px)] font-semibold tracking-[-0.3px]">
          Why builders fund on BSV testnet
        </h2>
        <p className="mb-11 max-w-[62ch] text-[17px] leading-[1.6] text-muted-foreground">
          The same protocol stability and scale that powers BSV mainnet, in a
          safe sandbox for your application.
        </p>
        <div className="grid grid-cols-3 gap-[22px] max-[880px]:grid-cols-2 max-[620px]:grid-cols-1">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="lift rounded-[20px] border bg-card px-[26px] py-[30px]"
            >
              <div className="mb-5 inline-flex h-[50px] w-[50px] items-center justify-center rounded-[14px] bg-accent text-accent-foreground">
                <p.Icon className="h-6 w-6" strokeWidth={1.7} />
              </div>
              <h3 className="mb-2 font-display text-[20px] font-semibold">
                {p.title}
              </h3>
              <p className="text-[15px] leading-[1.6] text-muted-foreground">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-24 bg-muted">
        <div className="mx-auto max-w-[1180px] px-[clamp(20px,5vw,56px)] py-[clamp(56px,8vw,96px)]">
          <h2 className="mb-11 font-display text-[clamp(26px,3.4vw,38px)] font-semibold tracking-[-0.3px]">
            Three steps to your first coins
          </h2>
          <div className="grid grid-cols-3 gap-[22px] max-[880px]:grid-cols-2 max-[620px]:grid-cols-1">
            {steps.map((st) => (
              <div
                key={st.n}
                className="relative overflow-hidden rounded-[20px] border bg-card px-[26px] py-[30px]"
              >
                <div className="pointer-events-none absolute right-[22px] top-[18px] z-0 font-display text-[56px] font-semibold leading-none text-accent">
                  {st.n}
                </div>
                <h3 className="relative z-[1] mb-2 pr-14 font-display text-[20px] font-semibold">
                  {st.title}
                </h3>
                <p className="relative max-w-[34ch] text-[15px] leading-[1.6] text-muted-foreground">
                  {st.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="px-[clamp(20px,5vw,56px)] py-[clamp(20px,5vw,56px)]">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-7 rounded-[28px] bg-primary px-[clamp(28px,5vw,64px)] py-[clamp(40px,6vw,72px)] text-white">
          <div>
            <h2 className="mb-2 font-display text-[clamp(24px,3vw,34px)] font-semibold tracking-[-0.3px]">
              Ready to start building?
            </h2>
            <p className="max-w-[48ch] text-base leading-[1.6] text-white/80">
              Sign in and request your first testnet BSV in under a minute.
            </p>
          </div>
          <Link
            href="/sign-in"
            className="pbtn shine-loop inline-flex h-[52px] shrink-0 items-center rounded-full bg-white px-8 text-base font-semibold text-primary shadow-[0_14px_34px_-10px_rgba(0,0,0,0.45)]"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-[clamp(20px,5vw,56px)] py-9">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <BsvLogo className="h-8 w-8 rounded-[9px]" />
            <span className="text-sm text-muted-foreground">
              © {year} BSV Blockchain. All rights reserved.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-[22px]">
            {footerLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            <a
              href="https://bsvassociation.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-link hover:underline"
            >
              BSV Association
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
