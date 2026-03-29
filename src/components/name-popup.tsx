"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import { createClient } from "@/lib/supabase";

interface NamePopupProps {
  open: boolean;
  onClose: (newName?: string) => void;
  currentName: string;
  userId: string;
  isFirstTime: boolean;
}

export default function NamePopup({
  open,
  onClose,
  currentName,
  userId,
  isFirstTime,
}: NamePopupProps) {
  const [name, setName] = useState(isFirstTime ? "" : currentName);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const supabase = createClient();
    const trimmed = name.trim();

    // Update profile
    await supabase
      .from("profiles")
      .update({ full_name: trimmed })
      .eq("id", userId);

    // Update all attendee records linked to this user
    await supabase
      .from("attendees")
      .update({ name: trimmed })
      .eq("profile_id", userId);

    setSaving(false);
    onClose(trimmed);
  };

  return (
    <Modal
      open={open}
      onClose={isFirstTime ? () => {} : () => onClose()}
      title={isFirstTime ? "¡Bienvenido/a!" : "Cambiar nombre"}
    >
      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <p className="text-slate-400 text-sm mb-4">
            {isFirstTime
              ? "¿Cómo te llamás? Así te van a ver los demás."
              : "Modificá tu nombre. Se actualiza en todo el evento."}
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            required
            autoFocus
            className="w-full px-4 py-3.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg text-center"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-base"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>

        {!isFirstTime && (
          <button
            type="button"
            onClick={() => onClose()}
            className="w-full py-3 text-slate-500 hover:text-slate-300 font-medium transition-colors text-sm"
          >
            Cancelar
          </button>
        )}
      </form>
    </Modal>
  );
}
