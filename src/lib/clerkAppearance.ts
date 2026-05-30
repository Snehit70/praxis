import { dark } from '@clerk/themes';

/**
 * Global Praxis palette for Clerk (warm dark + blue accent, Geist body).
 *
 * The sign-in surface itself is our two-pane <AuthDialog>, which embeds
 * <SignIn> and passes per-instance appearance to strip Clerk's card chrome and
 * hide its header. This baseline only sets colours/typography that every Clerk
 * element inherits.
 */
export const clerkAppearance = {
  baseTheme: dark,
  layout: {
    logoPlacement: 'none' as const,
  },
  variables: {
    colorPrimary: '#62aef0',
    colorTextOnPrimaryBackground: '#0d1f33',
    colorBackground: '#262422',
    colorText: 'rgba(255, 255, 255, 0.92)',
    colorTextSecondary: '#b0a89f',
    colorInputBackground: 'rgba(255, 255, 255, 0.06)',
    colorInputText: 'rgba(255, 255, 255, 0.92)',
    colorNeutral: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '0.6rem',
    fontFamily: '"Geist Variable", "Inter", sans-serif',
  },
};
