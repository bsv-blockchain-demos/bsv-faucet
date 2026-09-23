import { describe, expect, it } from 'vitest';
import {
  MOBILE_SIGN_IN_PATH,
  backToAuthPath,
  mobileSignInHref,
  walletRelayRewrites
} from '@/lib/walletRelay';

describe('walletRelayRewrites', () => {
  it('adds no routes when the relay address is not configured', () => {
    expect(walletRelayRewrites(undefined)).toEqual([]);
    expect(walletRelayRewrites('')).toEqual([]);
  });

  it("puts the browser's relay path and the phone's lookup behind the origin", () => {
    expect(walletRelayRewrites('https://relay.bsvfaucet.com')).toEqual([
      {
        source: '/wallet-relay/api/:path*',
        destination: 'https://relay.bsvfaucet.com/api/:path*'
      },
      {
        source: '/api/session/:id',
        destination: 'https://relay.bsvfaucet.com/api/session/:id'
      }
    ]);
  });

  it('tolerates a trailing slash on the relay address', () => {
    const [browser] = walletRelayRewrites('http://localhost:3021/');
    expect(browser?.destination).toBe('http://localhost:3021/api/:path*');
  });
});

describe('mobileSignInHref', () => {
  it('is the bare page for a plain sign-in', () => {
    expect(mobileSignInHref('sign-in', '/dashboard')).toBe(MOBILE_SIGN_IN_PATH);
  });

  it('carries the mode and a non-default redirect target', () => {
    expect(mobileSignInHref('sign-up', '/dashboard')).toBe(
      '/sign-in-mobile?mode=sign-up'
    );
    expect(mobileSignInHref('sign-in', '/settings?tab=wallet')).toBe(
      '/sign-in-mobile?redirect_url=%2Fsettings%3Ftab%3Dwallet'
    );
  });

  it('links back to the page the user came from', () => {
    expect(backToAuthPath('sign-in')).toBe('/sign-in');
    expect(backToAuthPath('sign-up')).toBe('/sign-up');
  });
});
