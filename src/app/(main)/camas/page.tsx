"use client";

import { useEffect, useState } from "react";
import { useEvent } from "@/hooks/use-event";
import { useAttendees } from "@/hooks/use-attendees";
import { createClient } from "@/lib/supabase";
import type { Bed } from "@/types/database";

export default function CamasPage() {
  const { event, loading: eventLoading } = useEvent();
  const { attendees, loading: attLoading } = useAttendees(event?.id);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!event) { setLoading(false); return; }
    const supabase = createClient();
    supabase
      .from("beds")
      .select("*")
      .eq("event_id", event.id)
      .order("bed_type")
      .then(({ data }: { data: Bed[] | null }) => {
        setBeds(data || []);
        setLoading(false);
      });
  }, [event]);

  if (eventLoading || attLoading || loading) {
    return (
      <div className="py-8 flex justify-center">
        <div className="w-8 h-8 border-2 border-campo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="py-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-tierra-800 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-tierra-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-tierra-100 mb-2">Sin evento activo</h2>
        <p className="text-tierra-400 text-sm">Primero creá un evento.</p>
      </div>
    );
  }

  const totalCapacity = beds.reduce((sum, b) => {
    const perBed = b.bed_type === "double" ? 2 : 1;
    return sum + perBed * b.count;
  }, 0);

  const totalPeople = attendees.length;
  const needTents = totalPeople > totalCapacity;
  const missingSpots = totalPeople - totalCapacity;

  return (
    <div className="py-6 space-y-4">
      <h2 className="text-xl font-bold text-tierra-100">Camas</h2>

      {/* Alert */}
      {needTents && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-amber-400 font-semibold text-sm">
              Faltan {missingSpots} {missingSpots === 1 ? "lugar" : "lugares"}
            </p>
            <p className="text-amber-400/70 text-sm">
              ¡Traigan carpas!
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-tierra-900 border border-tierra-800 rounded-xl p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-tierra-100">{totalCapacity}</p>
            <p className="text-xs text-tierra-400">Lugares disponibles</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${needTents ? "text-amber-400" : "text-campo-400"}`}>{totalPeople}</p>
            <p className="text-xs text-tierra-400">Asistentes</p>
          </div>
        </div>
      </div>

      {/* Bed list */}
      <div className="space-y-2">
        {beds.map((b) => (
          <div key={b.id} className="bg-tierra-900 border border-tierra-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${b.bed_type === "double" ? "bg-amber-500/20" : "bg-campo-600/20"}`}>
                <span className={`text-lg font-bold ${b.bed_type === "double" ? "text-amber-400" : "text-campo-400"}`}>
                  {b.bed_type === "double" ? "D" : "S"}
                </span>
              </div>
              <div>
                <p className="text-tierra-100 font-medium text-sm">{b.label || (b.bed_type === "double" ? "Cama doble" : "Cama simple")}</p>
                <p className="text-xs text-tierra-400">
                  {b.count} {b.count === 1 ? "cama" : "camas"} — {b.bed_type === "double" ? b.count * 2 : b.count} {b.bed_type === "double" ? "personas" : (b.count === 1 ? "persona" : "personas")}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {beds.length === 0 && (
        <div className="text-center py-8">
          <p className="text-tierra-400 text-sm">No hay camas cargadas. Se crean automáticamente al crear un evento.</p>
        </div>
      )}
    </div>
  );
}
