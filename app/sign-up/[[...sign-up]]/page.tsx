import { SignUp } from '@clerk/nextjs';
import { ThemeToggle } from '../../(dashboard)/theme-toggle';

export default function Page() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle />
      </div>
      <SignUp
        forceRedirectUrl="/api/sign-up"
        appearance={{
          variables: {
            colorPrimary: '#1B1EA9',
            borderRadius: '0.75rem',
            fontFamily: 'var(--font-noto-sans), sans-serif'
          },
          elements: {
            rootBox: 'flex w-full justify-center',
            card: 'rounded-[20px] border border-border shadow-soft',
            logoImage: { borderRadius: '14px' },
            headerTitle: {
              fontFamily: "'Chillax', sans-serif",
              fontSize: '24px',
              fontWeight: 600
            },
            formButtonPrimary: 'rounded-full text-[15px] normal-case'
          }
        }}
      />
    </div>
  );
}
