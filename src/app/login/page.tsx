"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Email o contraseña incorrectos.");
    } else {
      router.push("/evento");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-tierra-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-campo-500/15 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-campo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-tierra-50 mb-1">Recentales</h1>
          <p className="text-tierra-400 text-base">
            Organizador de juntadas en el campo
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-tierra-200 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full px-4 py-3.5 bg-tierra-900 border border-tierra-700 rounded-xl text-tierra-50 placeholder-tierra-500 focus:outline-none focus:ring-2 focus:ring-campo-500 focus:border-transparent text-base"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-tierra-200 mb-2">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              required
              className="w-full px-4 py-3.5 bg-tierra-900 border border-tierra-700 rounded-xl text-tierra-50 placeholder-tierra-500 focus:outline-none focus:ring-2 focus:ring-campo-500 focus:border-transparent text-base"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-campo-500 hover:bg-campo-400 active:bg-campo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-base mt-2"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-center text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
