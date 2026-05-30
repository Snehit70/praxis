import { dark } from '@clerk/themes';
import loginHand from '@/assets/login-hand.jpeg';

/**
 * Praxis theming for Clerk's sign-in modal: the warm dark palette + blue accent
 * used across the app, the Instrument Serif display face for the title, and the
 * "reaching hand" still as the full card background (form sits on top, with a
 * gradient scrim for legibility — tune the rgba stops below).
 */
export const clerkAppearance = {
  baseTheme: dark,
  layout: {
    logoPlacement: 'none' as const,
  },
  variables: {
    colorPrimary: '#62aef0',
    colorTextOnPrimaryBackground: '#0d1f33',
    colorBackground: '#211f1d',
    colorText: 'rgba(255, 255, 255, 0.92)',
    colorTextSecondary: '#b0a89f',
    colorInputBackground: 'rgba(255, 255, 255, 0.06)',
    colorInputText: 'rgba(255, 255, 255, 0.92)',
    colorNeutral: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '0.6rem',
    fontFamily: '"Geist Variable", "Inter", sans-serif',
  },
  elements: {
    // Full-card background: the reaching-hand still under a top-light /
    // bottom-dark scrim so the form stays legible while the hand shows through.
    card: {
      overflow: 'hidden' as const,
      backgroundImage: `linear-gradient(to bottom, rgba(22, 20, 18, 0.12) 0%, rgba(22, 20, 18, 0.28) 50%, rgba(22, 20, 18, 0.6) 100%), url(${loginHand})`,
      backgroundSize: 'cover' as const,
      backgroundPosition: 'center 30%',
      backgroundRepeat: 'no-repeat' as const,
    },
    headerTitle: {
      fontFamily: '"Instrument Serif", Georgia, serif',
      fontWeight: 400,
      fontSize: '1.7rem',
      letterSpacing: '-0.01em',
    },
  },
};
