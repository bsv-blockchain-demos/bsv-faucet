import type { SignIn } from '@clerk/nextjs';
import type { ComponentProps } from 'react';

type Appearance = NonNullable<ComponentProps<typeof SignIn>['appearance']>;

/**
 * The Clerk widget embedded in AuthCard. Its own card and header are hidden
 * so the tabs sit directly above the form, and its footer ("Don't have an
 * account? Sign up") stays.
 *
 * The colour variables point at the theme's CSS variables. The standalone
 * widget sits on its own white card, but this one is transparent over the
 * faucet's card, so Clerk's light-theme defaults would be unreadable in dark
 * mode.
 */
export const embeddedClerkAppearance: Appearance = {
  variables: {
    colorPrimary: 'hsl(var(--primary))',
    colorBackground: 'hsl(var(--card))',
    colorText: 'hsl(var(--foreground))',
    colorTextSecondary: 'hsl(var(--muted-foreground))',
    colorInputBackground: 'hsl(var(--card))',
    colorInputText: 'hsl(var(--foreground))',
    colorNeutral: 'hsl(var(--foreground))',
    colorDanger: 'hsl(var(--negative))',
    borderRadius: '0.75rem',
    fontFamily: 'var(--font-noto-sans), sans-serif'
  },
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none border-0',
    // m-0: Clerk offsets the inner card by -1px, and cardBox hides overflow,
    // which shaves the left edge off the first label and input. px-1 keeps
    // the inputs' focus rings clear of the same clipping.
    card: 'w-full shadow-none border-0 bg-transparent m-0 px-1 py-0',
    header: 'hidden',
    formButtonPrimary: 'rounded-full text-[15px] normal-case',
    // Links follow the brand's link colour (cyan in dark), not the primary.
    footerActionLink: 'text-link hover:text-link'
  }
};
