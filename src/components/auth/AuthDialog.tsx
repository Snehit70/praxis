import * as React from "react";
import { SignIn, SignUp, useAuth } from "@clerk/clerk-react";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import loginHand from "@/assets/login-hand.jpeg";

/**
 * Two-pane "take my hand" sign-in / sign-up.
 *
 * Lore: the landing shows Himmel sitting in the field; here he offers his hand —
 * "come with me." Taking it (signing in) begins the journey. The left pane is
 * the reaching-hand still (same blue-uniform Himmel, for continuity) with the
 * narrative line; the right pane embeds Clerk's <SignIn>/<SignUp> on a clean
 * calm surface, their own headers/switch-links hidden so we control the words
 * and the sign-in ↔ sign-up toggle ourselves.
 *
 * Backdrop dim + blur is provided by the shared Dialog.
 */

// Embedded Clerk instance: strip the card chrome (our Dialog is the frame),
// hide Clerk's header + its footer switch link (we drive both), match geometry.
const embeddedAppearance = {
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none", border: "none" },
    card: {
      backgroundColor: "transparent",
      boxShadow: "none",
      border: "none",
      padding: 0,
      backgroundImage: "none",
    },
    header: { display: "none" },
    footerAction: { display: "none" },
    footer: { background: "transparent" },
    formButtonPrimary: "!rounded-xl !text-[0.95rem]",
    // Raised surface so the social button reads as a distinct button against
    // the dark card (Clerk's default is near-transparent and disappears here).
    socialButtonsBlockButton:
      "!rounded-xl !border !border-white/20 !bg-white/[0.08] !text-white/90 transition-colors hover:!bg-white/[0.16] hover:!border-white/30",
    formFieldInput: { borderRadius: "0.6rem" },
  },
} as const;

type Mode = "sign-in" | "sign-up";

const COPY: Record<Mode, { title: string; subtitle: string }> = {
  "sign-in": {
    title: "Sign in to Praxis",
    subtitle: "Welcome back — pick up where you left off.",
  },
  "sign-up": {
    title: "Create your account",
    subtitle: "Take his hand and begin the journey.",
  },
};

function AuthDialog({
  open,
  onOpenChange,
  initialMode = "sign-in",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: Mode;
}) {
  const { isSignedIn } = useAuth();
  const [mode, setMode] = React.useState<Mode>(initialMode);

  // Close once Clerk reports a session — the SPA route guards take over.
  React.useEffect(() => {
    if (open && isSignedIn) onOpenChange(false);
  }, [open, isSignedIn, onOpenChange]);

  const copy = COPY[mode];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      labelledBy="auth-title"
      className="sm:max-w-3xl"
    >
      <DialogClose onClose={() => onOpenChange(false)} />

      <div className="flex flex-col md:grid md:grid-cols-[0.92fr_1fr]">
        {/* ── Invitation pane ── */}
        <div className="relative h-44 shrink-0 overflow-hidden md:h-auto">
          <img
            src={loginHand}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          {/* Legibility scrim (bottom for copy) + blend toward the form pane */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden bg-gradient-to-r from-transparent via-transparent to-card md:block"
          />
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
            <p className="font-display text-3xl italic leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] md:text-4xl">
              Come with me.
            </p>
            <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-white/75 drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)]">
              The practice is the journey — it begins here.
            </p>
          </div>
        </div>

        {/* ── Form pane ── */}
        <div className="bg-card px-6 py-8 sm:px-8">
          <h2
            id="auth-title"
            className="font-display text-2xl font-normal tracking-tight text-foreground"
          >
            {copy.title}
          </h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>

          {mode === "sign-in" ? (
            <SignIn
              routing="virtual"
              fallbackRedirectUrl="/home"
              appearance={embeddedAppearance}
            />
          ) : (
            <SignUp
              routing="virtual"
              fallbackRedirectUrl="/home"
              appearance={embeddedAppearance}
            />
          )}

          {/* Our own sign-in ↔ sign-up toggle (Clerk's is hidden) */}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "sign-in" ? (
              <>
                Don&rsquo;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("sign-up")}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("sign-in")}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Drop-in replacement for Clerk's <SignInButton mode="modal">: wraps a single
 * trigger element and opens the two-pane AuthDialog on click. Self-contained —
 * the dialog (and the embedded Clerk form) only mount while open.
 */
export function SignInTrigger({
  children,
  mode = "sign-in",
}: {
  children: React.ReactElement;
  mode?: Mode;
}) {
  const [open, setOpen] = React.useState(false);
  const child = React.Children.only(children) as React.ReactElement<{
    onClick?: (e: React.MouseEvent) => void;
  }>;
  return (
    <>
      {React.cloneElement(child, {
        onClick: (e: React.MouseEvent) => {
          child.props.onClick?.(e);
          setOpen(true);
        },
      })}
      {open && (
        <AuthDialog open={open} onOpenChange={setOpen} initialMode={mode} />
      )}
    </>
  );
}
