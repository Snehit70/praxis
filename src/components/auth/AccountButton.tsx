import { UserButton } from '@clerk/clerk-react';

/** Clerk's account menu, themed to the Praxis palette so its popover sits in the frame. */
const appearance = {
  variables: {
    colorBackground: '#0E1530',
    colorText: '#F1EAD9',
    colorTextSecondary: 'rgba(241,234,217,0.65)',
    colorPrimary: '#7AA7E6',
    colorNeutral: '#F1EAD9',
    borderRadius: '0.75rem',
    fontFamily: '"Geist Variable", "Inter", sans-serif',
  },
  // Style objects, not classes: Clerk's CSS is unlayered and would beat Tailwind's.
  elements: {
    userButtonPopoverCard: {
      border: '1px solid rgba(255,255,255,0.15)',
      backgroundColor: 'rgba(14,21,48,0.92)',
      boxShadow: '0 24px 48px -12px rgba(0,0,0,0.55)',
      backdropFilter: 'blur(16px)',
    },
    userButtonPopoverActionButton: { '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' } },
    userButtonPopoverActionButtonText: { color: '#F1EAD9' },
    userButtonPopoverActionButtonIcon: { color: 'rgba(241,234,217,0.7)' },
    userPreviewMainIdentifier: { color: '#F1EAD9', fontWeight: 500 },
    userPreviewSecondaryIdentifier: { color: 'rgba(241,234,217,0.65)' },
    userButtonPopoverFooter: {
      backgroundImage: 'none',
      backgroundColor: 'transparent',
      borderTop: '1px solid rgba(255,255,255,0.1)',
    },
  },
};

export function AccountButton() {
  return (
    <UserButton
      afterSignOutUrl="/"
      userProfileMode="navigation"
      userProfileUrl="/profile"
      appearance={appearance}
    />
  );
}
