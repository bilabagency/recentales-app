"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

interface Reservation {
  id: string;
  reserved_by: string;
  reserved_by_name: string;
  start_date: string;
  end_date: string;
  description: string | null;
  created_at: string;
}

const supabase = createClient();

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DAY_NAMES = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export default function ReservasPage() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: res }, { data: { user } }] = await Promise.all([
      supabase.from("house_reservations").select("*").order("start_date"),
      supabase.auth.getUser(),
    ]);

    setReservations((res as Reservation[] | null) || []);

    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (profile) setUserName(profile.full_name);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const getReservationForDate = (date: string): Reservation | undefined => {
    return reservations.find((r) => isDateInRange(date, r.start_date, r.end_date));
  };

  const hasOverlap = (start: string, end: string): Reservation | undefined => {
    return reservations.find((r) =>
      start <= r.end_date && end >= r.start_date
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !startDate || !endDate) return;
    setError("");

    if (endDate < startDate) {
      setError("La fecha de fin debe ser posterior a la de inicio.");
      return;
    }

    const overlap = hasOverlap(startDate, endDate);
    if (overlap) {
      setError(`Esas fechas se superponen con la reserva de ${overlap.reserved_by_name}.`);
      return;
    }

    setSaving(true);
    const { data, error: dbErr } = await supabase
      .from("house_reservations")
      .insert({
        reserved_by: userId,
        reserved_by_name: userName,
        start_date: startDate,
        end_date: endDate,
        description: description.trim() || null,
      })
      .select()
      .single();

    if (dbErr) {
      setError("Error al guardar. Intentá de nuevo.");
    } else if (data) {
      setReservations((prev) => [...prev, data as Reservation].sort((a, b) => a.start_date.localeCompare(b.start_date)));
      setShowForm(false);
      setStartDate("");
      setEndDate("");
      setDescription("");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("house_reservations").delete().eq("id", id);
    setReservations((prev) => prev.filter((r) => r.id !== id));
  };

  // Calendar rendering
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const todayStr = dateStr(now.getFullYear(), now.getMonth(), now.getDate());

  // Assign colors to reservations for the calendar
  const resColors = ["bg-emerald-600/30 text-emerald-300", "bg-amber-500/30 text-amber-300", "bg-blue-500/30 text-blue-300", "bg-purple-500/30 text-purple-300", "bg-red-500/30 text-red-300", "bg-teal-500/30 text-teal-300"];

  const getResColor = (resId: string): string => {
    const idx = reservations.findIndex((r) => r.id === resId);
    return resColors[idx % resColors.length];
  };

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Upcoming reservations (from today)
  const upcoming = reservations.filter((r) => r.end_date >= todayStr);

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">La Casa</h2>
          <p className="text-sm text-slate-400">Reservas para eventos no familiares</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Reservar
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Desde</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base [color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Hasta</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base [color-scheme:dark]" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Motivo (opcional)</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Cumpleaños, asado con amigos..." className="w-full px-3 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base" />
          </div>
          {error && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-medium rounded-xl text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold rounded-xl text-sm">{saving ? "Guardando..." : "Confirmar"}</button>
          </div>
        </form>
      )}

      {/* Calendar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 text-slate-400 hover:text-slate-200 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h3 className="text-slate-100 font-semibold text-sm">{MONTH_NAMES[viewMonth]} {viewYear}</h3>
          <button onClick={nextMonth} className="p-2 text-slate-400 hover:text-slate-200 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] text-slate-500 font-medium py-1">{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = dateStr(viewYear, viewMonth, day);
            const isToday = date === todayStr;
            const reservation = getReservationForDate(date);

            return (
              <div
                key={day}
                className={`relative text-center py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  reservation
                    ? getResColor(reservation.id)
                    : isToday
                    ? "bg-slate-800 text-slate-100 ring-1 ring-emerald-500"
                    : "text-slate-400 hover:bg-slate-800/50"
                }`}
                title={reservation ? `${reservation.reserved_by_name}${reservation.description ? ` - ${reservation.description}` : ""}` : undefined}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        {reservations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-800">
            {upcoming.slice(0, 6).map((r) => (
              <div key={r.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium ${getResColor(r.id)}`}>
                <span>{r.reserved_by_name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming reservations list */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-300">
          {upcoming.length > 0 ? "Próximas reservas" : ""}
        </h3>
        {upcoming.length === 0 && !showForm && (
          <div className="text-center py-6">
            <p className="text-slate-500 text-sm">No hay reservas próximas.</p>
            <p className="text-slate-600 text-xs mt-1">Usá el botón Reservar para agendar fechas.</p>
          </div>
        )}
        {upcoming.map((r) => {
          const isOwner = r.reserved_by === userId;
          const startD = new Date(r.start_date + "T12:00:00");
          const endD = new Date(r.end_date + "T12:00:00");
          const days = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          return (
            <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${getResColor(r.id)}`}>
                      {r.reserved_by_name.slice(0, 2).toUpperCase()}
                    </div>
                    <p className="text-slate-100 font-medium text-sm">{r.reserved_by_name}</p>
                  </div>
                  <p className="text-slate-400 text-xs">
                    {startD.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} — {endD.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                    <span className="text-slate-500 ml-1">({days} {days === 1 ? "día" : "días"})</span>
                  </p>
                  {r.description && (
                    <p className="text-slate-500 text-xs mt-1">{r.description}</p>
                  )}
                </div>
                {isOwner && (
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
