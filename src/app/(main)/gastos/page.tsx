"use client";

import { useEffect, useState } from "react";
import { useEvent } from "@/hooks/use-event";
import { createClient } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import type { Expense } from "@/types/database";

interface ExpenseSplit {
  id: string;
  expense_id: string;
  attendee_id: string;
  share_amount: number | null;
  is_excluded: boolean;
  is_custom_amount: boolean;
}

interface Attendee {
  id: string;
  name: string;
  event_id: string;
  profile_id: string | null;
  added_by: string;
  is_vegetarian: boolean;
  is_registered_user: boolean;
  created_at: string;
}

type Tab = "gastos" | "balance";
type SplitMode = "equal" | "percentage" | "custom";

const categoryLabels: Record<string, string> = {
  comida: "Comida",
  bebida: "Bebida",
  leña: "Leña",
  transporte: "Transporte",
  otros: "Otros",
};

const splitModeLabels: Record<SplitMode, string> = {
  equal: "Partes iguales",
  percentage: "Porcentaje",
  custom: "Montos",
};

export default function GastosPage() {
  const { event, loading: eventLoading } = useEvent();
  const [activeTab, setActiveTab] = useState<Tab>("gastos");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [paidBy, setPaidBy] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("otros");
  const [expenseDate, setExpenseDate] = useState("");
  const [includedAttendees, setIncludedAttendees] = useState<Set<string>>(new Set());
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!event) { setLoading(false); return; }
    const supabase = createClient();
    let cancelled = false;

    Promise.all([
      supabase.from("attendees").select("*").eq("event_id", event.id).order("name")
        .then(({ data }: { data: Attendee[] | null }) => data || []),
      supabase.from("expenses").select("*").eq("event_id", event.id).order("created_at", { ascending: false })
        .then(({ data }: { data: Expense[] | null }) => data || []),
      supabase.from("expense_splits").select("*, expenses!inner(event_id)").eq("expenses.event_id", event.id)
        .then(({ data }: { data: ExpenseSplit[] | null }) => data || []),
    ]).then(([a, e, s]: [Attendee[], Expense[], ExpenseSplit[]]) => {
      if (cancelled) return;
      setAttendees(a);
      setExpenses(e);
      setSplits(s);
      setIncludedAttendees(new Set(a.map((x) => x.id)));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [event]);

  const openForm = () => {
    setIncludedAttendees(new Set(attendees.map((a) => a.id)));
    setPaidBy("");
    setDescription("");
    setAmount("");
    setCategory("otros");
    setExpenseDate("");
    setSplitMode("equal");
    setPercentages({});
    setCustomAmounts({});
    setShowForm(true);
  };

  const toggleAttendee = (id: string) => {
    setIncludedAttendees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Calculate shares based on mode
  const calculateShares = (): Record<string, number> => {
    const parsedAmount = parseFloat(amount) || 0;
    const included = attendees.filter((a) => includedAttendees.has(a.id));
    const shares: Record<string, number> = {};

    if (splitMode === "equal") {
      const share = included.length > 0 ? parsedAmount / included.length : 0;
      included.forEach((a) => { shares[a.id] = share; });
    } else if (splitMode === "percentage") {
      included.forEach((a) => {
        const pct = parseFloat(percentages[a.id] || "0");
        shares[a.id] = (pct / 100) * parsedAmount;
      });
    } else {
      included.forEach((a) => {
        shares[a.id] = parseFloat(customAmounts[a.id] || "0");
      });
    }

    return shares;
  };

  // Validation helpers
  const totalPercentage = () => {
    return attendees
      .filter((a) => includedAttendees.has(a.id))
      .reduce((sum, a) => sum + (parseFloat(percentages[a.id] || "0")), 0);
  };

  const totalCustom = () => {
    return attendees
      .filter((a) => includedAttendees.has(a.id))
      .reduce((sum, a) => sum + (parseFloat(customAmounts[a.id] || "0")), 0);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (includedAttendees.size === 0) return;
    setSaving(true);
    const supabase = createClient();

    const parsedAmount = parseFloat(amount);
    const shares = calculateShares();

    const { data: expenseData } = await supabase
      .from("expenses")
      .insert({
        event_id: event!.id,
        paid_by: paidBy,
        description,
        amount: parsedAmount,
        category,
        date: expenseDate || event!.start_date,
      })
      .select()
      .single();

    if (expenseData) {
      const splitRows = attendees.map((a) => ({
        expense_id: expenseData.id,
        attendee_id: a.id,
        share_amount: includedAttendees.has(a.id) ? (shares[a.id] || 0) : null,
        is_excluded: !includedAttendees.has(a.id),
        is_custom_amount: splitMode !== "equal",
      }));

      const { data: splitsData } = await supabase
        .from("expense_splits")
        .insert(splitRows)
        .select();

      setExpenses((prev) => [expenseData, ...prev]);
      if (splitsData) setSplits((prev) => [...prev, ...splitsData]);
    }

    setShowForm(false);
    setSaving(false);
  };

  const removeExpense = async (id: string) => {
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setSplits((prev) => prev.filter((s) => s.expense_id !== id));
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-100 mb-2">Sin evento activo</h2>
        <p className="text-slate-400 text-sm">Primero creá un evento.</p>
      </div>
    );
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const perPerson = attendees.length > 0 ? total / attendees.length : 0;

  const getSplitCount = (expenseId: string) =>
    splits.filter((s) => s.expense_id === expenseId && !s.is_excluded).length;

  const calculateBalances = () => {
    const balances: Record<string, { paid: number; owed: number }> = {};
    attendees.forEach((a) => { balances[a.id] = { paid: 0, owed: 0 }; });
    expenses.forEach((exp) => {
      if (balances[exp.paid_by]) balances[exp.paid_by].paid += Number(exp.amount);
    });
    splits.forEach((split) => {
      if (!split.is_excluded && split.share_amount !== null && balances[split.attendee_id]) {
        balances[split.attendee_id].owed += Number(split.share_amount);
      }
    });
    return balances;
  };

  const calculateSimplifiedDebts = () => {
    const balances = calculateBalances();
    const netBalances: { id: string; name: string; net: number }[] = [];
    attendees.forEach((a) => {
      const b = balances[a.id];
      if (b) {
        const net = b.paid - b.owed;
        if (Math.abs(net) > 0.01) netBalances.push({ id: a.id, name: a.name, net });
      }
    });

    const creditors = netBalances.filter((b) => b.net > 0).sort((a, b) => b.net - a.net);
    const debtors = netBalances.filter((b) => b.net < 0).sort((a, b) => a.net - b.net);
    const transactions: { from: string; to: string; amount: number }[] = [];
    let ci = 0, di = 0;
    const creditAmounts = creditors.map((c) => c.net);
    const debtAmounts = debtors.map((d) => Math.abs(d.net));

    while (ci < creditors.length && di < debtors.length) {
      const t = Math.min(creditAmounts[ci], debtAmounts[di]);
      if (t > 0.01) transactions.push({ from: debtors[di].name, to: creditors[ci].name, amount: Math.round(t * 100) / 100 });
      creditAmounts[ci] -= t;
      debtAmounts[di] -= t;
      if (creditAmounts[ci] < 0.01) ci++;
      if (debtAmounts[di] < 0.01) di++;
    }
    return transactions;
  };

  const includedList = attendees.filter((a) => includedAttendees.has(a.id));
  const parsedAmount = parseFloat(amount) || 0;

  return (
    <div className="py-6 space-y-4">
      {/* Tabs */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
        {(["gastos", "balance"] as Tab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === tab ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
            {tab === "gastos" ? "Gastos" : "Balance"}
          </button>
        ))}
      </div>

      {/* Tab: Gastos */}
      {activeTab === "gastos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Gastos</h2>
              <p className="text-sm text-slate-400">{expenses.length} gastos cargados</p>
            </div>
            <button onClick={openForm} className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Agregar
            </button>
          </div>

          {expenses.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-100">${total.toLocaleString("es-AR")}</p>
                  <p className="text-xs text-slate-400">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-400">${Math.round(perPerson).toLocaleString("es-AR")}</p>
                  <p className="text-xs text-slate-400">Por persona</p>
                </div>
              </div>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Quién pagó</label>
                <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base">
                  <option value="">Elegir persona...</option>
                  {attendees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Descripción</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Asado del sábado" required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Monto ($)</label>
                  <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Categoría</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base">
                    {Object.entries(categoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Fecha</label>
                <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base [color-scheme:dark]" />
              </div>

              {/* Split mode selector */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Cómo se divide</label>
                <div className="flex bg-slate-800 rounded-xl p-1">
                  {(["equal", "percentage", "custom"] as SplitMode[]).map((mode) => (
                    <button key={mode} type="button" onClick={() => setSplitMode(mode)} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${splitMode === mode ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                      {splitModeLabels[mode]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Participantes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Participantes ({includedAttendees.size} de {attendees.length})
                </label>

                {splitMode === "equal" && (
                  <div className="flex flex-wrap gap-2">
                    {attendees.map((a) => (
                      <button key={a.id} type="button" onClick={() => toggleAttendee(a.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${includedAttendees.has(a.id) ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-500 border border-slate-700"}`}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}

                {splitMode === "percentage" && (
                  <div className="space-y-2">
                    {attendees.map((a) => {
                      const included = includedAttendees.has(a.id);
                      return (
                        <div key={a.id} className="flex items-center gap-2">
                          <button type="button" onClick={() => toggleAttendee(a.id)} className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${included ? "bg-emerald-600 border-emerald-600" : "border-slate-700"}`}>
                            {included && <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </button>
                          <span className={`flex-1 text-sm ${included ? "text-slate-100" : "text-slate-500"}`}>{a.name}</span>
                          {included && (
                            <div className="flex items-center gap-1">
                              <input type="number" step="1" min="0" max="100" value={percentages[a.id] || ""} onChange={(e) => setPercentages({ ...percentages, [a.id]: e.target.value })} placeholder="0" className="w-16 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                              <span className="text-slate-500 text-xs">%</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className={`text-xs font-medium mt-1 ${Math.abs(totalPercentage() - 100) < 0.1 ? "text-emerald-400" : "text-amber-400"}`}>
                      Total: {totalPercentage()}% {Math.abs(totalPercentage() - 100) < 0.1 ? "" : `(debe ser 100%)`}
                    </div>
                    {parsedAmount > 0 && includedList.length > 0 && (
                      <div className="bg-slate-800/50 rounded-lg p-2 space-y-1">
                        {includedList.map((a) => {
                          const pct = parseFloat(percentages[a.id] || "0");
                          return <p key={a.id} className="text-xs text-slate-400">{a.name}: ${Math.round((pct / 100) * parsedAmount).toLocaleString("es-AR")}</p>;
                        })}
                      </div>
                    )}
                  </div>
                )}

                {splitMode === "custom" && (
                  <div className="space-y-2">
                    {attendees.map((a) => {
                      const included = includedAttendees.has(a.id);
                      return (
                        <div key={a.id} className="flex items-center gap-2">
                          <button type="button" onClick={() => toggleAttendee(a.id)} className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${included ? "bg-emerald-600 border-emerald-600" : "border-slate-700"}`}>
                            {included && <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </button>
                          <span className={`flex-1 text-sm ${included ? "text-slate-100" : "text-slate-500"}`}>{a.name}</span>
                          {included && (
                            <div className="flex items-center gap-1">
                              <span className="text-slate-500 text-xs">$</span>
                              <input type="number" step="0.01" min="0" value={customAmounts[a.id] || ""} onChange={(e) => setCustomAmounts({ ...customAmounts, [a.id]: e.target.value })} placeholder="0" className="w-20 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm text-right focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className={`text-xs font-medium mt-1 ${Math.abs(totalCustom() - parsedAmount) < 0.1 ? "text-emerald-400" : "text-amber-400"}`}>
                      Total: ${totalCustom().toLocaleString("es-AR")} {parsedAmount > 0 && Math.abs(totalCustom() - parsedAmount) >= 0.1 ? `(debe ser $${parsedAmount.toLocaleString("es-AR")})` : ""}
                    </div>
                  </div>
                )}

                {includedAttendees.size === 0 && (
                  <p className="text-red-400 text-xs mt-1">Seleccioná al menos un participante</p>
                )}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={saving || includedAttendees.size === 0} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors">{saving ? "Guardando..." : "Guardar"}</button>
              </div>
            </form>
          )}

          {/* Expense list */}
          <div className="space-y-2">
            {expenses.map((exp) => {
              const payer = attendees.find((a) => a.id === exp.paid_by);
              const count = getSplitCount(exp.id);
              return (
                <div key={exp.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-100 font-medium text-sm">{exp.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{payer?.name || "?"} · {formatDate(exp.date)} · {categoryLabels[exp.category || "otros"]}</p>
                      {count > 0 && <p className="text-xs text-slate-500 mt-0.5">entre {count} persona{count !== 1 ? "s" : ""}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span className="text-slate-100 font-bold text-sm whitespace-nowrap">${Number(exp.amount).toLocaleString("es-AR")}</span>
                      <button onClick={() => removeExpense(exp.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {expenses.length === 0 && !showForm && (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">Todavía no hay gastos cargados.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Balance */}
      {activeTab === "balance" && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-100">Balance</h2>
          {expenses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">No hay gastos para calcular el balance.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-300">Resumen por persona</h3>
                {(() => {
                  const balances = calculateBalances();
                  return attendees.map((a) => {
                    const b = balances[a.id];
                    if (!b) return null;
                    const net = b.paid - b.owed;
                    return (
                      <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-slate-100 font-medium text-sm">{a.name}</p>
                          <span className={`font-bold text-sm ${net > 0.01 ? "text-emerald-400" : net < -0.01 ? "text-red-400" : "text-slate-400"}`}>
                            {net > 0.01 ? "+" : ""}${Math.round(net).toLocaleString("es-AR")}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Pagó: ${Math.round(b.paid).toLocaleString("es-AR")}</span>
                          <span>Debe: ${Math.round(b.owed).toLocaleString("es-AR")}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-300">Deudas simplificadas</h3>
                {(() => {
                  const transactions = calculateSimplifiedDebts();
                  if (transactions.length === 0) {
                    return (
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                        <p className="text-emerald-400 text-sm font-medium">Todas las cuentas están saldadas</p>
                      </div>
                    );
                  }
                  return transactions.map((t, i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-red-400 font-medium text-sm truncate">{t.from}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        <span className="text-emerald-400 font-medium text-sm truncate">{t.to}</span>
                      </div>
                      <span className="text-amber-400 font-bold text-sm ml-3 whitespace-nowrap">${t.amount.toLocaleString("es-AR")}</span>
                    </div>
                  ));
                })()}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
