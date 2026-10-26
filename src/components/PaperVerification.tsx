import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/ui/state-panel';

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
const api = () => (window as Window & { turnstile?: Turnstile }).turnstile;
let scriptPromise: Promise<void> | null = null;
function loadScript() {
  if (api()) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => fail(), 15_000);
    function fail() {
      window.clearTimeout(timer);
      script.remove();
      scriptPromise = null;
      reject(new Error('Verification could not load. Check your connection or content blocker, then retry.'));
    }
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => { window.clearTimeout(timer); resolve(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Shown only before loading a new paper, never inside an active practice run. */
export function PaperVerification({ siteKey, binding, onVerified, onBack }: {
  siteKey: string; binding: string; onVerified: (token: string) => void; onBack: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let widget: string | undefined;
    loadScript().then(() => {
      if (!active || !host.current) return;
      if (!api()) throw new Error('Verification could not load. Please retry.');
      widget = api()!.render(host.current, {
        sitekey: siteKey, action: 'paper-access', cData: binding, theme: 'dark', size: 'flexible',
        callback: (token: string) => { if (active) onVerifiedRef.current(token); },
        'expired-callback': () => { if (active) setError('Verification expired. Please retry.'); },
        'error-callback': () => { if (active) setError('Verification could not complete. Please retry.'); },
      });
    }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; if (widget !== undefined) api()?.remove(widget); };
  }, [siteKey, binding, retry]);
  return <StatePanel compact title="A quick check before your next paper"
    description="Several papers were opened recently. Verify below to continue."
    actions={<div className="flex w-full flex-col items-center gap-4">
      <div ref={host} className="w-full max-w-sm" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}>Go back</Button>
        {error && <Button onClick={() => { setError(''); setRetry((value) => value + 1); }}>Retry verification</Button>}
      </div>
    </div>} />;
}
