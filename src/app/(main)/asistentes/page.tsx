"use client";

import { useState } from "react";
import { useEvent } from "@/hooks/use-event";
import { useAttendees } from "@/hooks/use-attendees";
import { getEventDays, formatDateShort } from "@/lib/utils";

export default function AsistentesPage() {
  const { event, loading: eventLoading } = useEvent();
  const { attendees, attendanceDays, loading, addAttendee, removeAttendee, toggleVegetarian } = useAttendees(event?.id);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [isVeg, setIsVeg] = useState(false);
  const [adding, setAdding] = useState(false);

  if (eventLoading || loading) {
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-tierra-100 mb-2">Sin evento activo</h2>
        <p className="text-tierra-400 text-sm">Primero creá un evento en la pestaña Evento.</p>
      </div>
    );
  }

  const days = getEventDays(event.start_date, event.end_date);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    await addAttendee(name.trim(), isVeg);
    setName("");
    setIsVeg(false);
    setShowForm(false);
    setAdding(false);
  };

  const getDayPart = (attendeeId: string, date: string) => {
    const found = attendanceDays.find((d) => d.attendee_id === attendeeId && d.date === date);
    return found ? (found.day_part || "full") : null;
  };

  const presentCount = (date: string) =>
    attendanceDays.filter((d) => d.date === date).length;

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-tierra-100">Asistentes</h2>
          <p className="text-sm text-tierra-400">{attendees.length} personas</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-campo-600 hover:bg-campo-500 active:bg-campo-700 text-white font-medium rounded-xl transition-colors text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Agregar
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-tierra-900 border border-tierra-800 rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-tierra-300 mb-2">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Tía Marta"
              required
              autoFocus
              className="w-full px-4 py-3 bg-tierra-800 border border-tierra-700 rounded-xl text-tierra-100 placeholder-tierra-500 focus:outline-none focus:ring-2 focus:ring-campo-500 focus:border-transparent text-base"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setIsVeg(!isVeg)}
              className={`w-11 h-6 rounded-full transition-colors relative ${isVeg ? "bg-campo-600" : "bg-tierra-700"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isVeg ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </div>
            <span className="text-tierra-300 text-sm">Vegetariano/a</span>
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-3 bg-tierra-800 hover:bg-tierra-700 text-tierra-300 font-medium rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={adding}
              className="flex-1 py-3 bg-campo-600 hover:bg-campo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
            >
              {adding ? "Agregando..." : "Agregar"}
            </button>
          </div>
        </form>
      )}

      {/* Day summary */}
      {attendees.length > 0 && days.length > 0 && (
        <div className="bg-tierra-900 border border-tierra-800 rounded-xl p-4">
          <p className="text-sm text-tierra-400 mb-3">Personas por día</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((day) => (
              <div key={day} className="flex flex-col items-center min-w-[3.5rem] px-2 py-2 bg-tierra-800 rounded-lg">
                <span className="text-xs text-tierra-400">{formatDateShort(day)}</span>
                <span className="text-lg font-bold text-tierra-100">{presentCount(day)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendee list */}
      <div className="space-y-3">
        {attendees.map((att) => (
          <div key={att.id} className="bg-tierra-900 border border-tierra-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-tierra-800 flex items-center justify-center text-tierra-300 font-bold text-sm uppercase">
                  {att.name.slice(0, 2)}
                </div>
                <div>
                  <p className="text-tierra-100 font-medium">{att.name}</p>
                  <div className="flex items-center gap-2">
                    {att.is_vegetarian && (
                      <span className="text-xs text-campo-400">Vegetariano/a</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleVegetarian(att.id, att.is_vegetarian)}
                  className={`p-2 rounded-lg transition-colors ${att.is_vegetarian ? "text-campo-500 bg-campo-600/10" : "text-tierra-500 hover:text-tierra-300"}`}
                  title={att.is_vegetarian ? "Es vegetariano/a" : "No es vegetariano/a"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </button>
                <button
                  onClick={() => removeAttendee(att.id)}
                  className="p-2 text-tierra-500 hover:text-red-400 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Day indicators */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {days.map((day) => {
                const part = getDayPart(att.id, day);
                const colorClass = part === "full"
                  ? "bg-campo-600/20 text-campo-400 border-campo-600/30"
                  : part === "morning"
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : part === "afternoon"
                  ? "bg-campo-700/20 text-campo-300 border-campo-700/30"
                  : "bg-tierra-800 text-tierra-500 border-transparent";
                return (
                  <div
                    key={day}
                    className={`flex flex-col items-center min-w-[3rem] px-1.5 py-1.5 rounded-lg text-xs border ${colorClass}`}
                  >
                    <span>{formatDateShort(day)}</span>
                    {part && part !== "full" && (
                      <span className="text-[9px] opacity-70">{part === "morning" ? "AM" : "PM"}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {attendees.length === 0 && (
        <div className="text-center py-8">
          <p className="text-tierra-400 text-sm">
            Todavía no hay nadie. ¡Agregá asistentes!
          </p>
        </div>
      )}
    </div>
  );
}
