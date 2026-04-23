import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { isDedicatedAdminEmail } from "@/lib/adminAccess";
import { reportError } from "@/lib/errorHandling";
import { clearAppStorage, clearAuthStorage } from "@/lib/storage";

type Profile = Tables<"profiles">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRequestRef = useRef(0);

  const loadProfile = useCallback(async (nextUser: User | null) => {
    const requestId = ++profileRequestRef.current;

    if (!nextUser) {
      setProfile(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", nextUser.id)
        .maybeSingle();

      if (error) {
        reportError("Erro ao carregar perfil:", error, { devOnly: true });
        if (profileRequestRef.current === requestId) {
          setProfile(null);
        }
        return;
      }

      if (profileRequestRef.current === requestId) {
        setProfile(data);
      }
    } catch (error) {
      reportError("Falha ao carregar perfil:", error, { devOnly: true });
      if (profileRequestRef.current === requestId) {
        setProfile(null);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const LAST_USER_KEY = "studyflow.last-user-id";

    const handleUserSwitch = (nextUserId: string | null) => {
      if (!nextUserId) return;
      const lastUserId = window.localStorage.getItem(LAST_USER_KEY);
      if (lastUserId && lastUserId !== nextUserId) {
        // Different user logging in — clear stale local data
        clearAppStorage();
      }
      window.localStorage.setItem(LAST_USER_KEY, nextUserId);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;

      if (event === "SIGNED_IN") {
        handleUserSwitch(nextSession?.user?.id ?? null);
      }

      // If we get a SIGNED_OUT or TOKEN_REFRESHED with no session, clear stale data
      if (event === "SIGNED_OUT") {
        clearAppStorage();
      }
      if (event === "TOKEN_REFRESHED" && !nextSession) {
        clearAuthStorage();
        clearAppStorage();
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      void loadProfile(nextSession?.user ?? null);
      setLoading(false);
    });

    // Initial session check with error recovery
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        reportError("Sessão corrompida, limpando estado:", error, { devOnly: true });
        clearAuthStorage();
        clearAppStorage();
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      if (loading) {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        void loadProfile(data.session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    clearAppStorage();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin: Boolean(profile?.is_admin) && isDedicatedAdminEmail(user?.email),
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
