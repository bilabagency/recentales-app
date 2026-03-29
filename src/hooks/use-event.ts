"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Event } from "@/types/database";

const supabase = createClient();

export function useEvent() {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEvent = useCallback(async () => {
    setLoading(true);

    // Use maybeSingle instead of single to avoid error when no rows
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching event:", error.message);
    }

    setEvent(data || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const createEvent = async (name: string, startDate: string, endDate: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get profile name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const { data, error } = await supabase
      .from("events")
      .insert({ name, start_date: startDate, end_date: endDate, created_by: user.id })
      .select()
      .single();

    if (!error && data) {
      await supabase.from("attendees").insert({
        event_id: data.id,
        profile_id: user.id,
        added_by: user.id,
        name: profile?.full_name || user.email?.split("@")[0] || "Organizador",
        is_registered_user: true,
      });

      setEvent(data);
    }
    return data;
  };

  const updateEvent = async (id: string, updates: Partial<Event>) => {
    const { data, error } = await supabase
      .from("events")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) setEvent(data);
    return data;
  };

  return { event, loading, createEvent, updateEvent, refetch: fetchEvent };
}
