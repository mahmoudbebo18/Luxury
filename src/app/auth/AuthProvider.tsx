// Session + own account summary for the whole app; route guards for members, company admins and admins.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { PageLoader } from '../components/PageLoader';

export type AccountStatus = 'active' | 'expired' | 'suspended' | 'none';

/** What my_account() returns. */
export type Account = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  lang: 'ar' | 'en';
  role: 'member' | 'admin';
  signup_kind: 'individual' | 'business' | 'invite';
  member_no: string | null;
  member_code: string;
  status: AccountStatus;
  created_at: string;
  membership: { id: string; kind: 'individual' | 'corporate'; starts_at: string; expires_at: string; company: string | null } | null;
  last_expires_at: string | null;
  next_starts_at: string | null;
  companies: { id: string; name: string; card_name: string }[];
  reminder_days: number;
};

type Ctx = {
  session: Session | null;
  ready: boolean;
  /** True after arriving from a password-recovery email link (only then may /reset set a password). */
  recovery: boolean;
  account: Account | null | undefined; // undefined while loading
  isAdmin: boolean;
  isCompanyAdmin: boolean;
  refreshAccount: () => Promise<unknown>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

// supabase-js reads the recovery link from the URL hash before React subscribes, so remember it here.
const arrivedWithRecovery = /type=recovery/.test(location.hash);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(arrivedWithRecovery);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      setSession(next);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const { data: account, refetch } = useQuery({
    queryKey: ['account', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_account');
      if (error) throw error;
      return (data ?? null) as unknown as Account | null;
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        ready,
        recovery,
        account: userId ? account : null,
        isAdmin: account?.role === 'admin',
        isCompanyAdmin: (account?.companies.length ?? 0) > 0,
        refreshAccount: refetch,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

function useLoginRedirect() {
  const location = useLocation();
  return `/login?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready, account } = useAuth();
  const login = useLoginRedirect();
  if (!ready) return <PageLoader />;
  if (!session) return <Navigate to={login} replace />;
  if (account === undefined) return <PageLoader />;
  return <>{children}</>;
}

/** Member pages (card, services, payments): the admin account is not a membership, so it goes to /admin. */
export function RequireMember({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  return <RequireAuth>{isAdmin ? <Navigate to="/admin" replace /> : children}</RequireAuth>;
}

export function RequireCompanyAdmin({ children }: { children: ReactNode }) {
  const { isCompanyAdmin, isAdmin, account } = useAuth();
  return (
    <RequireAuth>
      {account && !isCompanyAdmin && !isAdmin ? <Navigate to="/account" replace /> : children}
    </RequireAuth>
  );
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, account } = useAuth();
  return <RequireAuth>{account && !isAdmin ? <Navigate to="/account" replace /> : children}</RequireAuth>;
}
