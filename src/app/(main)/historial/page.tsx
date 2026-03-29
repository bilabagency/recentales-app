"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { EventHistory, Event } from "@/types/database";

export default function HistorialPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [history, setHistory] = useState<EventHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("events").select("*").eq("is_active", false).order("end_date", { ascending: false }),
      supabase.from("event_history").select("*").order("snapshot_date", { ascending: false }),
    ]).then(([{ data: evts }, { data: hist }]) => {
      setEvents(evts || []);
      setHistory(hist || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-6 space-y-4">
      <h2 className="text-xl font-bold text-slate-100">Historial</h2>

      {events.length === 0 && history.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-100 mb-2">Sin historial</h3>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            Cuando cierres un evento, sus datos se guardarán acá para consultarlos en el futuro.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => {
            const snap = history.find((h) => h.event_id === evt.id);
            return (
              <div key={evt.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-slate-100 font-semibold mb-1">{evt.name}</h3>
                <p className="text-xs text-slate-400 mb-2">{evt.start_date} — {evt.end_date}</p>
                {snap && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-slate-800 rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-slate-100">${snap.total_expenses?.toLocaleString("es-AR") || "0"}</p>
                      <p className="text-xs text-slate-400">Total gastado</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-amber-400">${snap.per_person_average?.toLocaleString("es-AR") || "0"}</p>
                      <p className="text-xs text-slate-400">Por persona</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
