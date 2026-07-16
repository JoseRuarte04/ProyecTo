import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  specialty: string | null;
  license_number: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Último userId para el que ya se pidió el perfil. Evita re-consultarlo
  // en cada TOKEN_REFRESHED (p.ej. al volver de otra pestaña), donde
  // supabase-js entrega una `session` nueva pero el usuario es el mismo.
  const profileUserId = useRef<string | null>(null);

  const fetchProfile = async (userId: string, authEmail?: string | null) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, specialty, license_number, avatar_url")
      .eq("id", userId)
      .single();
    if (!data) return;
    // El cambio de email se confirma en auth.users y no hay trigger que lo
    // propague a profiles: reconciliar acá (puede confirmarse en otra pestaña).
    if (authEmail && data.email !== authEmail) {
      await supabase.from("profiles").update({ email: authEmail }).eq("id", userId);
      data.email = authEmail;
    }
    setProfile(data);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          // USER_UPDATED llega al confirmar cambio de email o password:
          // hay que re-fetchear aunque el userId no haya cambiado.
          if (profileUserId.current !== session.user.id || _event === "USER_UPDATED") {
            profileUserId.current = session.user.id;
            setTimeout(() => fetchProfile(session.user.id, session.user.email), 0);
          }
        } else {
          profileUserId.current = null;
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        profileUserId.current = session.user.id;
        fetchProfile(session.user.id, session.user.email);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user.id, session.user.email);
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
