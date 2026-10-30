import React, { useState, useEffect } from "react";
import {
  getFirestoreCustomPhases,
  saveFirestoreCustomPhase,
  deleteFirestoreCustomPhase,
} from "../lib/firestoreService";

export interface CustomPhase {
  id: number;
  name: string;
  description?: string | null;
  defaultAmount?: string | null;
  failureMessage: string;
  failureTitle: string | null;
  cardColor: string | null;
  sortOrder: number;
  status?: "active" | "frozen";
  isFrozen?: boolean;
  usersCount?: number;
}

interface CustomPhasesManagementModalProps {
  onClose: () => void;
  onRefresh?: () => Promise<void> | void;
}

export function CustomPhasesManagementModal({
  onClose,
  onRefresh,
}: CustomPhasesManagementModalProps) {
  const [phases, setPhases] = useState<CustomPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Sub-modals
  const [editModal, setEditModal] = useState<{
    mode: "create" | "edit";
    phase?: CustomPhase;
  } | null>(null);

  const [deleteWarning, setDeleteWarning] = useState<{
    phase: CustomPhase;
    usage?: { usersCount: number; transactionsCount: number; canSafelyDelete: boolean };
    loading: boolean;
  } | null>(null);

  // Form states for Create/Edit
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formFailureMsg, setFormFailureMsg] = useState("");
  const [formFailureTitle, setFormFailureTitle] = useState("");
  const [formCardColor, setFormCardColor] = useState("#1a1f3c");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadPhases = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/phases");
      if (res.ok) {
        const data = await res.json();
        setPhases(data);
        return;
      }
    } catch {
      // API unreachable, proceed to Firestore fallback
    }

    try {
      const direct = await getFirestoreCustomPhases();
      setPhases(direct as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل المراحل");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPhases();
  }, []);

  function openCreateModal() {
    setFormName("");
    setFormDesc("");
    setFormAmount("0");
    setFormFailureMsg("تم تعليق حسابكم مؤقتاً لاستكمال متطلبات هذه المرحلة.");
    setFormFailureTitle("مرحلة تدقيق مطلوبة");
    setFormCardColor("#2952e3");
    setFormSortOrder(phases.length + 1);
    setFormError("");
    setEditModal({ mode: "create" });
  }

  function openEditModal(phase: CustomPhase) {
    setFormName(phase.name);
    setFormDesc(phase.description || "");
    setFormAmount(phase.defaultAmount || "0");
    setFormFailureMsg(phase.failureMessage || "");
    setFormFailureTitle(phase.failureTitle || "");
    setFormCardColor(phase.cardColor || "#1a1f3c");
    setFormSortOrder(phase.sortOrder || 0);
    setFormError("");
    setEditModal({ mode: "edit", phase });
  }

  async function handleSavePhase(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!formName.trim()) { setFormError("اسم المرحلة مطلوب"); return; }
    if (!formFailureMsg.trim()) { setFormError("رسالة التوضيح/الفشل مطلوبة"); return; }

    setFormSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim() || null,
        defaultAmount: formAmount.trim() || "0",
        failureMessage: formFailureMsg.trim(),
        failureTitle: formFailureTitle.trim() || null,
        cardColor: formCardColor || null,
        sortOrder: Number(formSortOrder) || 0,
      };

      let savedDirect = false;
      if (editModal?.mode === "create") {
        try {
          const res = await fetch("/api/phases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const d = await res.json();
            await saveFirestoreCustomPhase({ ...payload, id: d.id });
            savedDirect = true;
          }
        } catch {
          // continue to fallback
        }
        if (!savedDirect) {
          await saveFirestoreCustomPhase(payload);
        }
      } else if (editModal?.mode === "edit" && editModal.phase) {
        try {
          const res = await fetch(`/api/phases/${editModal.phase.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            await saveFirestoreCustomPhase({ id: editModal.phase.id, ...payload });
            savedDirect = true;
          }
        } catch {
          // continue to fallback
        }
        if (!savedDirect) {
          await saveFirestoreCustomPhase({ id: editModal.phase.id, ...payload });
        }
      }

      setEditModal(null);
      await loadPhases();
      void onRefresh?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "فشلت العملية");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleToggleFreeze(phase: CustomPhase) {
    try {
      const newStatus = phase.status === "frozen" ? "active" : "frozen";
      let synced = false;
      try {
        const res = await fetch(`/api/phases/${phase.id}/toggle-freeze`, { method: "PATCH" });
        if (res.ok) synced = true;
      } catch {
        // continue
      }
      await saveFirestoreCustomPhase({ ...phase, status: newStatus, isFrozen: newStatus === "frozen" });
      await loadPhases();
      void onRefresh?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشلت العملية");
    }
  }

  async function openDeleteCheck(phase: CustomPhase) {
    setDeleteWarning({ phase, loading: true });
    try {
      const res = await fetch(`/api/phases/${phase.id}/usage`);
      const usage = await res.json();
      setDeleteWarning({ phase, usage, loading: false });
    } catch {
      setDeleteWarning({ phase, usage: { usersCount: 0, transactionsCount: 0, canSafelyDelete: true }, loading: false });
    }
  }

  async function confirmDeletePhase() {
    if (!deleteWarning) return;
    try {
      try {
        await fetch(`/api/phases/${deleteWarning.phase.id}`, { method: "DELETE" });
      } catch {
        // continue
      }
      await deleteFirestoreCustomPhase(deleteWarning.phase.id);
      setDeleteWarning(null);
      await loadPhases();
      void onRefresh?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشلت عملية الحذف");
    }

  }

  const filteredPhases = phases.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(10,15,40,0.6)", backdropFilter: "blur(4px)", fontFamily: "'Cairo', sans-serif" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        style={{ animation: "popIn 0.25s cubic-bezier(.175,.885,.32,1.275)" }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b border-[#eef0f6] flex items-center justify-between"
          style={{ background: "linear-gradient(135deg,#1a1f3c,#2952e3)" }}
        >
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            ✕
          </button>
          <div className="text-right">
            <h3 className="text-[17px] font-extrabold text-white">إدارة المراحل المخصصة</h3>
            <p className="text-white/70 text-[11px]">التحكم الكامل في مراحل التدقيق وتجميدها ومتابعة ارتباطها بالمستفيدين</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في أسماء أو وصف المراحل..."
            className="flex-1 min-w-[200px] px-3.5 py-2 rounded-xl border border-[#cbd5e1] text-[12px] font-bold text-right outline-none focus:border-[#2952e3]"
            dir="rtl"
          />

          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl text-white font-bold text-[12px] shadow-sm flex items-center gap-1.5 transition-transform active:scale-95"
            style={{ background: "linear-gradient(135deg,#0f7a38,#22c55e)" }}
          >
            <span>+</span>
            <span>إضافة مرحلة جديدة</span>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-3 px-4 py-2.5 rounded-xl bg-red-50 text-red-700 text-[12px] font-bold text-center border border-red-200">
            {error}
          </div>
        )}

        {/* Phase List */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {loading ? (
            <div className="text-center py-12 text-[#64748b] text-[13px] font-bold">
              جارٍ تحميل المراحل...
            </div>
          ) : filteredPhases.length === 0 ? (
            <div className="text-center py-12 text-[#94a3b8]">
              <div className="text-[36px] mb-2">📑</div>
              <p className="text-[14px] font-bold text-[#1a1f3c]">لا توجد مراحل مطابقة</p>
              <p className="text-[11px] text-[#64748b] mt-1">اضغط على زر "إضافة مرحلة جديدة" لإنشاء أول مرحلة مخصصة.</p>
            </div>
          ) : (
            filteredPhases.map((phase) => {
              const isFrozen = phase.status === "frozen" || phase.isFrozen;
              const color = phase.cardColor || "#2952e3";

              return (
                <div
                  key={phase.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isFrozen
                      ? "bg-slate-50 border-slate-300 opacity-80"
                      : "bg-white border-[#e2e8f0] shadow-xs hover:border-[#cbd5e1]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left Actions */}
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleFreeze(phase)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                            isFrozen
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                              : "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                          }`}
                        >
                          {isFrozen ? "إلغاء التجميد ⚡" : "تجميد ❄️"}
                        </button>

                        <button
                          onClick={() => openEditModal(phase)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                        >
                          تعديل
                        </button>

                        <button
                          onClick={() => openDeleteCheck(phase)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                        >
                          حذف
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-[#64748b] bg-gray-100 px-2 py-0.5 rounded">
                          👥 {phase.usersCount ?? 0} مستفيد مرتبط
                        </span>
                        {phase.defaultAmount && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {phase.defaultAmount} ر.س
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Info */}
                    <div className="flex items-start gap-3 text-right flex-1 min-w-0">
                      <div
                        className="w-4 h-10 rounded-full flex-shrink-0 mt-1"
                        style={{ background: color }}
                        title={`لون البطاقة: ${color}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[14px] font-extrabold text-[#1a1f3c] truncate">{phase.name}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                              isFrozen
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {isFrozen ? "مجمّدة" : "نشطة"}
                          </span>
                        </div>

                        {phase.description && (
                          <p className="text-[11px] text-[#64748b] mt-0.5 line-clamp-1">{phase.description}</p>
                        )}

                        <p className="text-[10px] text-[#94a3b8] mt-1 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                          نص الرسالة: <span className="text-[#475569]">{phase.failureMessage}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between text-[11px] text-[#64748b] font-bold">
          <span>إجمالي المراحل: {phases.length}</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-200 text-[#1e293b] hover:bg-gray-300 font-bold text-[12px]"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* ── Sub-Modal: Create / Edit Phase ── */}
      {editModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center px-4"
          style={{ background: "rgba(10,15,40,0.75)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !formSubmitting) setEditModal(null); }}
        >
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-3 text-right max-h-[85vh] overflow-y-auto">
            <h3 className="text-[16px] font-extrabold text-[#1a1f3c] text-center">
              {editModal.mode === "create" ? "إنشاء مرحلة مخصصة جديدة" : "تعديل المرحلة المخصصة"}
            </h3>

            {formError && (
              <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-[11px] font-bold text-center border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSavePhase} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#1e293b] mb-1">اسم المرحلة *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: رسوم فك التجميد البنكي"
                  className="w-full px-3 py-2 rounded-xl border border-[#cbd5e1] text-[12px] font-bold text-right outline-none"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1e293b] mb-1">وصف المرحلة (داخلي للإدارة)</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="مرحلة تأكيدية تطلب سداد رسوم تدقيق..."
                  className="w-full px-3 py-2 rounded-xl border border-[#cbd5e1] text-[12px] font-bold text-right outline-none"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1e293b] mb-1">المبلغ الافتراضي (ر.س)</label>
                <input
                  type="text"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="5000"
                  className="w-full px-3 py-2 rounded-xl border border-[#cbd5e1] text-[12px] font-bold text-center outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1e293b] mb-1">عنوان رسالة الفشل / التنبيه</label>
                <input
                  type="text"
                  value={formFailureTitle}
                  onChange={(e) => setFormFailureTitle(e.target.value)}
                  placeholder="مرحلة إضافية مطلوبة"
                  className="w-full px-3 py-2 rounded-xl border border-[#cbd5e1] text-[12px] font-bold text-right outline-none"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1e293b] mb-1">نص رسالة الفشل المعروضة للمستفيد *</label>
                <textarea
                  rows={3}
                  value={formFailureMsg}
                  onChange={(e) => setFormFailureMsg(e.target.value)}
                  placeholder="يرجى سداد المبلغ المطلوب لاستكمال سحب الأرباح بنجاح..."
                  className="w-full px-3 py-2 rounded-xl border border-[#cbd5e1] text-[12px] font-bold text-right outline-none"
                  dir="rtl"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formCardColor}
                  onChange={(e) => setFormCardColor(e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-[#cbd5e1]"
                />
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-[#1e293b] mb-1">لون البطاقة المخصصة</label>
                  <input
                    type="text"
                    value={formCardColor}
                    onChange={(e) => setFormCardColor(e.target.value)}
                    placeholder="#2952e3"
                    className="w-full px-3 py-1.5 rounded-xl border border-[#cbd5e1] text-[12px] font-bold text-left outline-none"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  disabled={formSubmitting}
                  className="flex-1 py-2.5 rounded-xl border border-[#cbd5e1] text-[#475569] font-bold text-[12px]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-[12px]"
                  style={{ background: "linear-gradient(135deg,#0f7a38,#22c55e)" }}
                >
                  {formSubmitting ? "جارٍ الحفظ..." : "حفظ المرحلة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Sub-Modal: Delete Phase Safety Warning ── */}
      {deleteWarning && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center px-4"
          style={{ background: "rgba(10,15,40,0.75)", backdropFilter: "blur(4px)" }}
        >
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-3 text-right">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-[22px]">
              ⚠️
            </div>
            <h3 className="text-[16px] font-extrabold text-[#1a1f3c] text-center">
              تأكيد حذف المرحلة
            </h3>
            <p className="text-[12px] text-[#475569] text-center leading-relaxed">
              هل أنت متأكد من رغبتك في حذف المرحلة: <br />
              <strong className="text-[#1a1f3c] text-[13px]">"{deleteWarning.phase.name}"</strong>؟
            </p>

            {deleteWarning.loading ? (
              <div className="text-center py-2 text-[11px] text-[#64748b]">جارٍ فحص استخدام المرحلة...</div>
            ) : deleteWarning.usage && deleteWarning.usage.usersCount > 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                <strong>تحذير أمان:</strong> هذه المرحلة مرتبطة حالياً بـ{" "}
                <span className="font-extrabold text-red-600">{deleteWarning.usage.usersCount} مستفيد</span>.
                حذف المرحلة سيؤدي إلى حذف ارتباطها وسجلاتها المالية من حسابات هؤلاء المستفيدين.
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-bold text-center">
                ✓ هذه المرحلة غير مرتبطة بأي مستفيد حالياً، يمكن حذفها بأمان.
              </div>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setDeleteWarning(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#cbd5e1] text-[#475569] font-bold text-[12px]"
              >
                تراجع
              </button>
              <button
                onClick={confirmDeletePhase}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-[12px] hover:bg-red-700"
              >
                تأكيد الحذف نهائياً
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
