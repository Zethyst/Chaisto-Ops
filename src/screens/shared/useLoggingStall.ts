import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { authService } from '../../services/authService';

type Stall = { id: string; name: string };

/**
 * Resolves which stall an expense or wastage entry is filed against.
 *
 * Staff carry their assigned stall on their account. Admins and moderators do
 * not — they oversee every stall — so they pick one, rather than the entry
 * being silently attributed to whichever stall happens to come back first.
 */
export function useLoggingStall() {
  const { user } = useSelector((s: RootState) => s.auth);
  const isAdmin = user?.role === 'admin' || user?.role === 'moderator';

  const [stalls, setStalls] = useState<Stall[]>([]);
  const [selectedStallId, setSelectedStallId] = useState<string | null>(user?.stallId ?? null);
  const [loadingStalls, setLoadingStalls] = useState(isAdmin);

  useEffect(() => {
    if (!isAdmin) return;
    authService.getStalls()
      .then((list) => {
        setStalls(list);
        setSelectedStallId(prev => prev ?? list[0]?.id ?? null);
      })
      .catch(() => { /* surfaced as the "no stall" guard when saving */ })
      .finally(() => setLoadingStalls(false));
  }, [isAdmin]);

  return {
    isAdmin,
    stalls,
    loadingStalls,
    selectedStallId,
    setSelectedStallId,
    /** Blocks a save that would otherwise be rejected by the server */
    missingStallMessage: selectedStallId
      ? null
      : isAdmin
        ? 'Pick a stall to log this against.'
        : 'Your account has no stall assigned — ask an admin to assign one.',
  };
}
