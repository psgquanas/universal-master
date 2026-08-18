import { unregisterStoredPushToken } from "@/lib/push-tokens";
import { supabase } from "@/lib/supabase";
import { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";

type SignUpDetails = {
  fullName: string;
  phone?: string; // stored as metadata only — not used for auth or OTP
  gender: string;
  username?: string;
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ error: Error | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    details: SignUpDetails,
  ) => Promise<{ needsEmailVerification: boolean; error: Error | null }>;
  verifyEmailOtp: (
    email: string,
    token: string,
  ) => Promise<{ verified: boolean; error: Error | null }>;
  resendEmailVerification: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.warn("[auth] could not restore session", error);
      if (active) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setIsLoading(false);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signUpWithEmail = async (
    email: string,
    password: string,
    details: SignUpDetails,
  ) => {
    const normalizedEmail = email.trim().toLowerCase();
    console.log("[auth] signUp → sending request for", normalizedEmail);
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: details.fullName,
          ...(details.phone ? { phone: details.phone } : {}),
          gender: details.gender,
          ...(details.username ? { username: details.username } : {}),
        },
      },
    });
    if (error) {
      console.warn("[auth] signUp → error", error.message);
      return { needsEmailVerification: false, error };
    }
    // If session is returned immediately, Supabase auto-confirmed the user
    // (email confirmations are OFF in the dashboard — turn them ON).
    const confirmed = Boolean(data.session);
    console.log(
      "[auth] signUp → success | user:",
      data.user?.id,
      "| auto-confirmed (no OTP sent):",
      confirmed,
    );
    return { needsEmailVerification: !confirmed, error: null };
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    return { verified: Boolean(data.session && data.user), error };
  };

  const resendEmailVerification = async (email: string) => {
    console.log("[auth] resend → sending OTP to", email.trim().toLowerCase());
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
    });
    if (error) console.warn("[auth] resend → error", error.message);
    else console.log("[auth] resend → OTP sent successfully");
    return { error };
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await unregisterStoredPushToken().catch((error) =>
      console.warn("[notifications] token cleanup failed", error),
    );
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        signInWithEmail,
        signUpWithEmail,
        verifyEmailOtp,
        resendEmailVerification,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
