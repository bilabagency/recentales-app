"use client";

import { useState, useEffect, useCallback } from "react";
import { useEvent } from "@/hooks/use-event";
import { createClient } from "@/lib/supabase";
import { getEventDays, formatDate } from "@/lib/utils";
import AttendancePopup from "@/components/attendance-popup";
import type { Attendee, AttendanceDay } from "@/types/database";

export default function EventoPage() {
  const { event, loading, createEvent, updateEvent } = useEvent();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Attendance popup
  const [showPopup, setShowPopup] = useState(false);
  const [myAttendee, setMyAttendee] = useState<Attendee | null>(null);
  const [myDays, setMyDays] = useState<AttendanceDay[]>([]);
  const [allAttendees, setAllAttendees] = useState<Attendee[]>([]);
  const [allDays, setAllDays] = useState<AttendanceDay[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Vos");
  const [checkingAttendance, setCheckingAttendance] = useState(true);

  const checkAttendance = useCallback(async () => {
    if (!event) { setCheckingAttendance(false); return; }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCheckingAttendance(false); return; }
    setUserId(user.id);

    // Get user profile name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (profile) setUserName(profile.full_name);

    // Get all attendees and days for this event
    const [{ data: attendees }, { data: days }] = await Promise.all([
      supabase.from("attendees").select("*").eq("event_id", event.id),
      supabase.from("attendance_days").select("*").eq("event_id", event.id),
    ]);

    const attList = (attendees || []) as Attendee[];
    const dayList = (days || []) as AttendanceDay[];
    setAllAttendees(attList);
    setAllDays(dayList);

    // Find if user is already an attendee
    const me = attList.find(
      (a) => a.profile_id === user.id || (a.added_by === user.id && a.is_registered_user)
    );
    setMyAttendee(me || null);

    if (me) {
      const myAttDays = dayList.filter((d) => d.attendee_id === me.id);
      setMyDays(myAttDays);
      // If no days selected yet, show popup
      if (myAttDays.length === 0) {
        setShowPopup(true);
      }
    } else {
      // User not yet attending — show popup
      setShowPopup(true);
    }

    setCheckingAttendance(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  useEffect(() => {
    if (!loading) {
      if (event) {
        checkAttendance();
      } else {
        setCheckingAttendance(false);
      }
    }
  }, [event, loading, checkAttendance]);

  const handleConfirmAttendance = async (data: {
    myDays: { date: string; part: "full" | "morning" | "afternoon" }[];
    isVegetarian: boolean;
    guests: { name: string; isVegetarian: boolean; days: { date: string; part: "full" | "morning" | "afternoon" }[] }[];
  }) => {
    if (!event || !userId) return;
    const supabase = createClient();

    let attendeeId = myAttendee?.id;

    // Create or update my attendee record
    if (!myAttendee) {
      const { data: newAtt } = await supabase
        .from("attendees")
        .insert({
          event_id: event.id,
          profile_id: userId,
          added_by: userId,
          name: userName,
          is_vegetarian: data.isVegetarian,
          is_registered_user: true,
        })
        .select()
        .single();
      if (newAtt) attendeeId = newAtt.id;
    } else {
      await supabase
        .from("attendees")
        .update({ is_vegetarian: data.isVegetarian })
        .eq("id", myAttendee.id);
    }

    if (!attendeeId) return;

    // Delete old days and insert new ones
    await supabase.from("attendance_days").delete().eq("attendee_id", attendeeId);

    if (data.myDays.length > 0) {
      // Try with day_part first, fallback without it
      const rows = data.myDays.map((d) => ({
        attendee_id: attendeeId,
        event_id: event.id,
        date: d.date,
        day_part: d.part,
      }));
      const { error: insError } = await supabase.from("attendance_days").insert(rows);
      if (insError) {
        // Retry without day_part (column might not exist yet)
        await supabase.from("attendance_days").insert(
          data.myDays.map((d) => ({
            attendee_id: attendeeId,
            event_id: event.id,
            date: d.date,
          }))
        );
      }
    }

    // Add guests
    for (const guest of data.guests) {
      const { data: guestAtt } = await supabase
        .from("attendees")
        .insert({
          event_id: event.id,
          added_by: userId,
          name: guest.name,
          is_vegetarian: guest.isVegetarian,
        })
        .select()
        .single();

      if (guestAtt && guest.days.length > 0) {
        const guestRows = guest.days.map((d) => ({
          attendee_id: guestAtt.id,
          event_id: event.id,
          date: d.date,
          day_part: d.part,
        }));
        const { error: gErr } = await supabase.from("attendance_days").insert(guestRows);
        if (gErr) {
          await supabase.from("attendance_days").insert(
            guest.days.map((d) => ({
              attendee_id: guestAtt.id,
              event_id: event.id,
              date: d.date,
            }))
          );
        }
      }
    }

    setShowPopup(false);
    checkAttendance();
  };

  if (loading || checkingAttendance) {
    return (
      <div className="py-8 flex justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await createEvent(name, startDate, endDate);
    setSaving(false);
    setCreating(false);
    setName("");
    setStartDate("");
    setEndDate("");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    setSaving(true);
    await updateEvent(event.id, { name, start_date: startDate, end_date: endDate });
    setSaving(false);
    setEditing(false);
  };

  const startEditing = () => {
    if (!event) return;
    setName(event.name);
    setStartDate(event.start_date);
    setEndDate(event.end_date);
    setEditing(true);
  };

  // No active event
  if (!event && !creating) {
    return (
      <div className="py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600/20 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Sin evento activo</h2>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            Creá un nuevo evento para empezar a organizar la juntada.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-xl transition-colors text-base"
        >
          Crear evento
        </button>
      </div>
    );
  }

  // Create / Edit form
  if (creating || editing) {
    return (
      <div className="py-6">
        <h2 className="text-xl font-bold text-slate-100 mb-6">
          {editing ? "Editar evento" : "Nuevo evento"}
        </h2>
        <form onSubmit={editing ? handleEdit : handleCreate} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del evento</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Pascuas 2026" required className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Llegada</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full px-3 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base [color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Partida</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full px-3 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base [color-scheme:dark]" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setCreating(false); setEditing(false); }} className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors">{saving ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      </div>
    );
  }

  // Show active event
  const days = getEventDays(event!.start_date, event!.end_date);
  const confirmedCount = allAttendees.length;
  const myConfirmedDays = myDays.length;

  // Count people per day
  const peoplePerDay = (date: string) =>
    allDays.filter((d) => d.date === date).length;

  return (
    <div className="py-6 space-y-4">
      {/* Attendance popup */}
      <AttendancePopup
        open={showPopup}
        onClose={() => setShowPopup(false)}
        eventName={event!.name}
        days={days}
        userName={userName}
        initialDays={myDays.map((d) => ({ date: d.date, part: (d.day_part || "full") as "full" | "morning" | "afternoon" }))}
        initialVegetarian={myAttendee?.is_vegetarian || false}
        onConfirm={handleConfirmAttendance}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-100">{event!.name}</h2>
        <button onClick={startEditing} className="text-sm text-emerald-500 hover:text-emerald-400 font-medium transition-colors">Editar</button>
      </div>

      {/* My status */}
      <div className="bg-emerald-600/10 border border-emerald-600/20 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-400 font-medium text-sm">Tu asistencia</p>
            <p className="text-slate-100 text-sm mt-0.5">
              {myConfirmedDays > 0
                ? `${myConfirmedDays} ${myConfirmedDays === 1 ? "día confirmado" : "días confirmados"}`
                : "Sin confirmar"}
            </p>
          </div>
          <button
            onClick={() => setShowPopup(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {myConfirmedDays > 0 ? "Modificar" : "Confirmar"}
          </button>
        </div>
      </div>

      {/* Event info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-400">Fechas</p>
            <p className="text-slate-100 font-medium">{formatDate(event!.start_date)} — {formatDate(event!.end_date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-400">Confirmados</p>
            <p className="text-slate-100 font-medium">{confirmedCount} {confirmedCount === 1 ? "persona" : "personas"}</p>
          </div>
        </div>
      </div>

      {/* People per day */}
      {allDays.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-sm text-slate-400 mb-3">Personas por día</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((day) => (
              <div key={day} className="flex flex-col items-center min-w-[3.5rem] px-2 py-2 bg-slate-800 rounded-lg">
                <span className="text-xs text-slate-400">{formatDate(day).split(" ")[0]}</span>
                <span className="text-lg font-bold text-slate-100">{peoplePerDay(day)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Who's coming */}
      {allAttendees.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-sm text-slate-400 mb-3">¿Quiénes vienen?</p>
          <div className="flex flex-wrap gap-2">
            {allAttendees.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg"
              >
                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-[10px] uppercase">
                  {att.name.slice(0, 2)}
                </div>
                <span className="text-slate-300 text-sm">{att.name}</span>
                {att.is_vegetarian && (
                  <span className="text-emerald-400 text-xs">V</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
