"use client";

import { useEffect, useState } from "react";
import { useEvent } from "@/hooks/use-event";
import { useAttendees } from "@/hooks/use-attendees";
import { createClient } from "@/lib/supabase";
import type { Drink } from "@/types/database";

export default function BebidasPage() {
  const { event, loading: eventLoading } = useEvent();
  const { attendees, loading: attLoading } = useAttendees(event?.id);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState("");
  const [drinkName, setDrinkName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("litros");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!event) { setLoading(false); return; }
    const supabase = createClient();
    supabase
      .from("drinks")
      .select("*")
      .eq("event_id", event.id)
      .then(({ data }: { data: Drink[] | null }) => {
        setDrinks(data || []);
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5m4.75-11.396c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19 14.5m-4.75-11.396c.251.023.501.05.75.082M19 14.5l-1.572 4.088a2.25 2.25 0 01-2.084 1.412H8.656a2.25 2.25 0 01-2.084-1.412L5 14.5m14 0H5" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-tierra-100 mb-2">Sin evento activo</h2>
        <p className="text-tierra-400 text-sm">Primero creá un evento.</p>
      </div>
    );
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("drinks")
      .insert({
        event_id: event.id,
        attendee_id: selectedAttendee,
        drink_name: drinkName,
        quantity: parseFloat(quantity),
        unit,
      })
      .select()
      .single();
    if (data) setDrinks((prev) => [...prev, data]);
    setDrinkName("");
    setQuantity("");
    setShowForm(false);
    setSaving(false);
  };

  const removeDrink = async (id: string) => {
    const supabase = createClient();
    await supabase.from("drinks").delete().eq("id", id);
    setDrinks((prev) => prev.filter((d) => d.id !== id));
  };

  // Consolidado
  const consolidated = drinks.reduce<Record<string, { quantity: number; unit: string }>>((acc, d) => {
    const key = `${d.drink_name.toLowerCase()}_${d.unit}`;
    if (!acc[key]) acc[key] = { quantity: 0, unit: d.unit };
    acc[key].quantity += Number(d.quantity);
    return acc;
  }, {});

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-tierra-100">Bebidas</h2>
          <p className="text-sm text-tierra-400">Estimación por persona</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-campo-600 hover:bg-campo-500 text-white font-medium rounded-xl transition-colors text-sm"
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
            <label className="block text-sm font-medium text-tierra-300 mb-2">Quién trae</label>
            <select
              value={selectedAttendee}
              onChange={(e) => setSelectedAttendee(e.target.value)}
              required
              className="w-full px-4 py-3 bg-tierra-800 border border-tierra-700 rounded-xl text-tierra-100 focus:outline-none focus:ring-2 focus:ring-campo-500 text-base"
            >
              <option value="">Elegir persona...</option>
              {attendees.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-tierra-300 mb-2">Bebida</label>
            <input
              type="text"
              value={drinkName}
              onChange={(e) => setDrinkName(e.target.value)}
              placeholder="Ej: Vino tinto, Cerveza, Fernet..."
              required
              className="w-full px-4 py-3 bg-tierra-800 border border-tierra-700 rounded-xl text-tierra-100 placeholder-tierra-500 focus:outline-none focus:ring-2 focus:ring-campo-500 text-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-tierra-300 mb-2">Cantidad</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ej: 3"
                required
                className="w-full px-4 py-3 bg-tierra-800 border border-tierra-700 rounded-xl text-tierra-100 placeholder-tierra-500 focus:outline-none focus:ring-2 focus:ring-campo-500 text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-tierra-300 mb-2">Unidad</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-4 py-3 bg-tierra-800 border border-tierra-700 rounded-xl text-tierra-100 focus:outline-none focus:ring-2 focus:ring-campo-500 text-base"
              >
                <option value="litros">Litros</option>
                <option value="botellas">Botellas</option>
                <option value="cajas">Cajas</option>
                <option value="packs">Packs</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 bg-tierra-800 hover:bg-tierra-700 text-tierra-300 font-medium rounded-xl transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 bg-campo-600 hover:bg-campo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors">{saving ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      )}

      {/* Consolidado */}
      {Object.keys(consolidated).length > 0 && (
        <div className="bg-tierra-900 border border-tierra-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-400 mb-3">Total consolidado</p>
          <div className="space-y-2">
            {Object.entries(consolidated).map(([key, val]) => (
              <div key={key} className="flex justify-between py-1.5 border-b border-tierra-800 last:border-0">
                <span className="text-tierra-300 text-sm capitalize">{key.split("_")[0]}</span>
                <span className="text-tierra-100 font-medium text-sm">{val.quantity} {val.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual list */}
      {drinks.length > 0 && (
        <div className="space-y-2">
          {drinks.map((d) => {
            const att = attendees.find((a) => a.id === d.attendee_id);
            return (
              <div key={d.id} className="bg-tierra-900 border border-tierra-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-tierra-100 text-sm font-medium capitalize">{d.drink_name}</p>
                  <p className="text-tierra-400 text-xs">{att?.name} — {d.quantity} {d.unit}</p>
                </div>
                <button onClick={() => removeDrink(d.id)} className="p-2 text-tierra-500 hover:text-red-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {drinks.length === 0 && !showForm && (
        <div className="text-center py-8">
          <p className="text-tierra-400 text-sm">Todavía no hay bebidas cargadas.</p>
        </div>
      )}
    </div>
  );
}
