"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import NamePopup from "@/components/name-popup";

const supabase = createClient();

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
}

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNamePopup, setShowNamePopup] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data as UserProfile);
        // Check if name is still the default (email prefix)
        const emailPrefix = (data as UserProfile).email.split("@")[0];
        if ((data as UserProfile).full_name === emailPrefix) {
          setIsFirstTime(true);
          setShowNamePopup(true);
        }
      }
      setLoading(false);
    };
    loadProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-tierra-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-campo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-tierra-950/95 backdrop-blur-sm border-b border-tierra-800/50 z-50">
        <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-campo-500/15 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-campo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h1 className="text-base font-bold text-tierra-50 leading-tight">Recentales</h1>
          </div>

          <div className="flex items-center gap-1">
            {/* Profile name — tap to edit */}
            <button
              onClick={() => {
                setIsFirstTime(false);
                setShowNamePopup(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-tierra-400 hover:text-tierra-200 hover:bg-tierra-800/50 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-tierra-800 flex items-center justify-center text-tierra-300 font-bold text-[10px] uppercase">
                {profile?.full_name?.slice(0, 2) || "?"}
              </div>
              <span className="text-xs font-medium max-w-[80px] truncate hidden sm:inline">
                {profile?.full_name || ""}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-tierra-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="text-tierra-600 hover:text-tierra-400 transition-colors p-2"
              title="Cerrar sesión"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Content — only render pages after name is set */}
      <main className="pt-16 pb-20 px-4 max-w-lg mx-auto min-h-screen">
        {isFirstTime && showNamePopup ? null : children}
      </main>

      {/* Name popup */}
      {profile && (
        <NamePopup
          open={showNamePopup}
          onClose={(newName?: string) => {
            if (newName && profile) {
              setProfile({ ...profile, full_name: newName });
              setIsFirstTime(false);
            }
            setShowNamePopup(false);
          }}
          currentName={profile.full_name}
          userId={profile.id}
          isFirstTime={isFirstTime}
        />
      )}
    </>
  );
}
