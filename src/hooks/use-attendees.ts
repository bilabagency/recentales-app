"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Attendee, AttendanceDay } from "@/types/database";

const supabase = createClient();

export function useAttendees(eventId: string | undefined) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendanceDays, setAttendanceDays] = useState<AttendanceDay[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAttendees = useCallback(async () => {
    if (!eventId) { setLoading(false); return; }
    setLoading(true);

    const [{ data: att }, { data: days }] = await Promise.all([
      supabase.from("attendees").select("*").eq("event_id", eventId).order("created_at"),
      supabase.from("attendance_days").select("*").eq("event_id", eventId),
    ]);

    setAttendees(att || []);
    setAttendanceDays(days || []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  const addAttendee = async (name: string, isVegetarian: boolean) => {
    if (!eventId) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("attendees")
      .insert({
        event_id: eventId,
        added_by: user.id,
        name,
        is_vegetarian: isVegetarian,
      })
      .select()
      .single();

    if (!error && data) {
      setAttendees((prev) => [...prev, data]);
    }
    return data;
  };

  const removeAttendee = async (id: string) => {
    await supabase.from("attendees").delete().eq("id", id);
    setAttendees((prev) => prev.filter((a) => a.id !== id));
    setAttendanceDays((prev) => prev.filter((d) => d.attendee_id !== id));
  };

  const toggleDay = async (attendeeId: string, date: string) => {
    if (!eventId) return;
    const existing = attendanceDays.find(
      (d) => d.attendee_id === attendeeId && d.date === date
    );

    if (existing) {
      await supabase.from("attendance_days").delete().eq("id", existing.id);
      setAttendanceDays((prev) => prev.filter((d) => d.id !== existing.id));
    } else {
      const { data } = await supabase
        .from("attendance_days")
        .insert({ attendee_id: attendeeId, event_id: eventId, date })
        .select()
        .single();

      if (data) setAttendanceDays((prev) => [...prev, data]);
    }
  };

  const toggleVegetarian = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("attendees")
      .update({ is_vegetarian: !current })
      .eq("id", id);

    if (!error) {
      setAttendees((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_vegetarian: !current } : a))
      );
    }
  };

  return {
    attendees,
    attendanceDays,
    loading,
    addAttendee,
    removeAttendee,
    toggleDay,
    toggleVegetarian,
    refetch: fetchAttendees,
  };
}
