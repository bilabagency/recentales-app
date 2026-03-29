"use client";

import { useEffect, useState, useCallback } from "react";
import { useEvent } from "@/hooks/use-event";
import { createClient } from "@/lib/supabase";
import { getEventDays, formatDate } from "@/lib/utils";
import type { Meal, Attendee } from "@/types/database";

interface DishProposal {
  id: string;
  event_id: string;
  proposed_by: string;
  meal_date: string;
  meal_type: string;
  name: string;
  description: string | null;
  is_vegetarian: boolean;
  created_at: string;
}

interface DishVote {
  id: string;
  dish_id: string;
  attendee_id: string;
  created_at: string;
}

const mealLabels: Record<string, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
};

const mealOrder = ["desayuno", "almuerzo", "merienda", "cena"];

type Tab = "resumen" | "platos" | "favoritos";

export default function ComidasPage() {
  const { event, loading: eventLoading } = useEvent();
  const [activeTab, setActiveTab] = useState<Tab>("resumen");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [proposals, setProposals] = useState<DishProposal[]>([]);
  const [votes, setVotes] = useState<DishVote[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [currentAttendeeId, setCurrentAttendeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state (sin fecha)
  const [formMealType, setFormMealType] = useState("almuerzo");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsVegetarian, setFormIsVegetarian] = useState(false);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    if (!event) { setLoading(false); return; }

    const [mealsRes, proposalsRes, votesRes, attendeesRes, userRes] = await Promise.all([
      supabase.from("meals").select("*").eq("event_id", event.id),
      supabase.from("dish_proposals").select("*").eq("event_id", event.id).order("created_at", { ascending: true }),
      supabase.from("dish_votes").select("*"),
      supabase.from("attendees").select("*").eq("event_id", event.id),
      supabase.auth.getUser(),
    ]);

    setMeals((mealsRes.data as Meal[] | null) || []);
    setProposals((proposalsRes.data as DishProposal[] | null) || []);

    const allAttendees = (attendeesRes.data as Attendee[] | null) || [];
    setAttendees(allAttendees);

    const proposalIds = new Set(((proposalsRes.data as DishProposal[] | null) || []).map((p) => p.id));
    const allVotes = (votesRes.data as DishVote[] | null) || [];
    setVotes(allVotes.filter((v) => proposalIds.has(v.dish_id)));

    const userId = userRes.data?.user?.id;
    if (userId) {
      const myAttendee = allAttendees.find(
        (a) => (a.profile_id === userId) || (a.added_by === userId && a.is_registered_user)
      );
      setCurrentAttendeeId(myAttendee?.id || null);
    }

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmitProposal = async () => {
    if (!event || !currentAttendeeId || !formName.trim()) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from("dish_proposals")
      .insert({
        event_id: event.id,
        proposed_by: currentAttendeeId,
        meal_date: event.start_date, // required by DB, but we don't show it
        meal_type: formMealType,
        name: formName.trim(),
        description: formDescription.trim() || null,
        is_vegetarian: formIsVegetarian,
      })
      .select()
      .single();

    if (!error && data) {
      setProposals((prev) => [...prev, data as DishProposal]);
      setFormName("");
      setFormDescription("");
      setFormIsVegetarian(false);
      setShowForm(false);
    }
    setSubmitting(false);
  };

  const handleToggleVote = async (dishId: string) => {
    if (!currentAttendeeId) return;

    const existingVote = votes.find(
      (v) => v.dish_id === dishId && v.attendee_id === currentAttendeeId
    );

    if (existingVote) {
      await supabase.from("dish_votes").delete().eq("id", existingVote.id);
      setVotes((prev) => prev.filter((v) => v.id !== existingVote.id));
    } else {
      const { data } = await supabase
        .from("dish_votes")
        .insert({ dish_id: dishId, attendee_id: currentAttendeeId })
        .select()
        .single();
      if (data) {
        setVotes((prev) => [...prev, data as DishVote]);
      }
    }
  };

  const handleDeleteProposal = async (proposalId: string) => {
    await supabase.from("dish_proposals").delete().eq("id", proposalId);
    setProposals((prev) => prev.filter((p) => p.id !== proposalId));
    setVotes((prev) => prev.filter((v) => v.dish_id !== proposalId));
  };

  if (eventLoading || loading) {
    return (
      <div className="py-8 flex justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="py-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.871V6.75m-6 1.5V6.75m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-100 mb-2">Sin evento activo</h2>
        <p className="text-slate-400 text-sm">Primero creá un evento en la pestaña Evento.</p>
      </div>
    );
  }

  const days = getEventDays(event.start_date, event.end_date);

  const getMeal = (date: string, type: string) =>
    meals.find((m) => m.date === date && m.meal_type === type);

  const getAttendeeName = (attendeeId: string) =>
    attendees.find((a) => a.id === attendeeId)?.name || "?";

  const getVoteCount = (dishId: string) =>
    votes.filter((v) => v.dish_id === dishId).length;

  const hasVoted = (dishId: string) =>
    currentAttendeeId ? votes.some((v) => v.dish_id === dishId && v.attendee_id === currentAttendeeId) : false;

  // Group proposals by meal_type
  const proposalsByType: Record<string, DishProposal[]> = {};
  for (const p of proposals) {
    if (!proposalsByType[p.meal_type]) proposalsByType[p.meal_type] = [];
    proposalsByType[p.meal_type].push(p);
  }

  // Top voted per category (at least 1 vote, sorted by votes desc)
  const topByType: Record<string, DishProposal[]> = {};
  for (const type of mealOrder) {
    const items = proposalsByType[type] || [];
    const sorted = [...items]
      .map((p) => ({ ...p, voteCount: getVoteCount(p.id) }))
      .filter((p) => p.voteCount > 0)
      .sort((a, b) => b.voteCount - a.voteCount);
    if (sorted.length > 0) topByType[type] = sorted;
  }

  const renderDishCard = (proposal: DishProposal, showDelete: boolean) => {
    const voteCount = getVoteCount(proposal.id);
    const voted = hasVoted(proposal.id);
    const isOwner = proposal.proposed_by === currentAttendeeId;

    return (
      <div key={proposal.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
        {/* Vote button */}
        <button
          onClick={() => handleToggleVote(proposal.id)}
          disabled={!currentAttendeeId}
          className={`flex flex-col items-center min-w-[2.5rem] py-1.5 rounded-lg transition-colors ${
            voted
              ? "bg-amber-500/20 text-amber-400"
              : "bg-slate-800 text-slate-500 hover:text-slate-300"
          } disabled:opacity-40`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={voted ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className="text-xs font-bold mt-0.5">{voteCount}</span>
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-50 font-medium text-sm">{proposal.name}</span>
            {proposal.is_vegetarian && (
              <span className="text-[10px] text-emerald-400 bg-emerald-600/10 px-1.5 py-0.5 rounded-full font-medium">VEG</span>
            )}
          </div>
          {proposal.description && (
            <p className="text-slate-500 text-xs mt-0.5 truncate">{proposal.description}</p>
          )}
          <p className="text-slate-600 text-[11px] mt-0.5">{getAttendeeName(proposal.proposed_by)}</p>
        </div>

        {/* Delete */}
        {showDelete && isOwner && (
          <button
            onClick={() => handleDeleteProposal(proposal.id)}
            className="p-1.5 text-slate-600 hover:text-red-400 transition-colors shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="py-6 space-y-4">
      <h2 className="text-xl font-bold text-slate-100">Comidas</h2>

      {/* Tabs */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
        {([
          { key: "resumen" as Tab, label: "Resumen" },
          { key: "platos" as Tab, label: "Platos" },
          { key: "favoritos" as Tab, label: "Favoritos" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-emerald-600 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ====== Tab: Resumen ====== */}
      {activeTab === "resumen" && (
        <>
          {meals.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
              <p className="text-slate-400 text-sm">
                Todavía no hay datos. Marcá los días de cada asistente en Gente.
              </p>
            </div>
          ) : (
            days.map((day) => {
              const dayMeals = mealOrder.map((type) => getMeal(day, type)).filter(Boolean);
              if (dayMeals.length === 0) return null;
              return (
                <div key={day} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-sm font-semibold text-emerald-400 mb-3">{formatDate(day)}</p>
                  <div className="space-y-2">
                    {mealOrder.map((type) => {
                      const meal = getMeal(day, type);
                      if (!meal || meal.total_people === 0) return null;
                      return (
                        <div key={type} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                          <span className="text-slate-300 text-sm">{mealLabels[type]}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-100 font-medium text-sm">{meal.total_people} personas</span>
                            {meal.vegetarian_count > 0 && (
                              <span className="text-xs text-emerald-400 bg-emerald-600/10 px-2 py-0.5 rounded-full">{meal.vegetarian_count} veg</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {/* ====== Tab: Platos ====== */}
      {activeTab === "platos" && (
        <>
          {/* Add button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-xl text-sm transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Proponer plato
            </button>
          )}

          {/* Inline form */}
          {showForm && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Momento</label>
                <select
                  value={formMealType}
                  onChange={(e) => setFormMealType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {mealOrder.map((type) => (
                    <option key={type} value={type}>{mealLabels[type]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Nombre del plato</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Asado, Empanadas, Ensalada..."
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-3 text-base placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Descripción (opcional)</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detalles, ingredientes..."
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-3 text-base placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer py-1">
                <div
                  onClick={() => setFormIsVegetarian(!formIsVegetarian)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${formIsVegetarian ? "bg-emerald-600" : "bg-slate-700"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formIsVegetarian ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                </div>
                <span className="text-slate-400 text-sm">Vegetariano</span>
              </label>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowForm(false); setFormName(""); setFormDescription(""); setFormIsVegetarian(false); }}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-medium rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitProposal}
                  disabled={submitting || !formName.trim() || !currentAttendeeId}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  {submitting ? "Guardando..." : "Agregar"}
                </button>
              </div>
            </div>
          )}

          {/* Proposals grouped by meal type */}
          {proposals.length === 0 && !showForm ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">Todavía no hay platos propuestos.</p>
            </div>
          ) : (
            mealOrder.map((type) => {
              const items = proposalsByType[type];
              if (!items || items.length === 0) return null;
              return (
                <div key={type} className="space-y-2">
                  <h3 className="text-sm font-semibold text-amber-400 pt-1">{mealLabels[type]}</h3>
                  {items.map((p) => renderDishCard(p, true))}
                </div>
              );
            })
          )}
        </>
      )}

      {/* ====== Tab: Favoritos ====== */}
      {activeTab === "favoritos" && (
        <>
          {Object.keys(topByType).length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <p className="text-slate-400 text-sm">Todavía no hay votos.</p>
              <p className="text-slate-600 text-xs mt-1">Votá platos en la pestaña Platos.</p>
            </div>
          ) : (
            mealOrder.map((type) => {
              const items = topByType[type];
              if (!items) return null;
              return (
                <div key={type} className="space-y-2">
                  <h3 className="text-sm font-semibold text-amber-400 pt-1">{mealLabels[type]}</h3>
                  {items.map((p, i) => (
                    <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
                      {/* Rank */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${
                        i === 0 ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-500"
                      }`}>
                        {i + 1}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-50 font-medium text-sm">{p.name}</span>
                          {p.is_vegetarian && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-600/10 px-1.5 py-0.5 rounded-full font-medium">VEG</span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-slate-500 text-xs mt-0.5 truncate">{p.description}</p>
                        )}
                      </div>
                      {/* Votes */}
                      <div className="flex items-center gap-1 text-amber-400 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" stroke="none">
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span className="text-sm font-bold">{getVoteCount(p.id)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
