import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { getProfile } from '@/lib/api';
import { AVATARS } from '@/lib/avatars';

/** Open the Praxis profile using its selected avatar. */
export function AccountButton() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [avatarKey, setAvatarKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getProfile(getToken).then((profile) => {
        if (active) setAvatarKey(profile.avatarKey);
      }).catch(() => {
        if (active) setAvatarKey(null);
      });
    };
    refresh();
    window.addEventListener('praxis:profile-updated', refresh);
    return () => {
      active = false;
      window.removeEventListener('praxis:profile-updated', refresh);
    };
  }, [getToken, user?.id]);

  const avatar = AVATARS.find((item) => item.key === avatarKey);
  return (
    <Link to="/profile" aria-label="Your profile" className="flex size-9 items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-black/30 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
      {avatar ? <img src={avatar.src} alt="" className="h-full w-full object-cover object-top" /> : <UserRound className="size-5" aria-hidden="true" />}
    </Link>
  );
}
