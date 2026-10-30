import React, { useState } from "react";

export interface Agent {
  id: number;
  username: string;
  plainPassword?: string;
  name: string;
  status: "active" | "frozen" | "disabled";
  maxBeneficiariesQuota: number;
  // Granular permissions
  canViewBeneficiaries?: boolean;
  canAddBeneficiaries?: boolean;
  canEditBeneficiaries: boolean;
  canDeleteBeneficiaries?: boolean;
  canManageProfits?: boolean;
  canManageFees?: boolean;
  canPayFees?: boolean;
  canManageFinancials?: boolean;
  canManagePhases: boolean;
  canPayPhases?: boolean;
  canSendNotifications?: boolean;
  canViewAccountInfo?: boolean;
  canEditAccountInfo?: boolean;
  currentBeneficiariesCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BeneficiaryItem {
  id: string;
  name: string;
  username: string;
  agentId?: number | null;
  agentName?: string | null;
  agentIds?: number[];
  agentNames?: string[];
}

interface AgentFormModalProps {
  mode: "create" | "edit";
  initialAgent?: Agent | null;
  onSave: (agentData: Partial<Agent> & { password?: string }) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

export function AgentFormModal({ mode, initialAgent, onSave, onClose, loading }: AgentFormModalProps) {
  const [name, setName] = useState(initialAgent?.name ?? "");
  const [username, setUsername] = useState(initialAgent?.username ?? "");
  const [password, setPassword] = useState(initialAgent?.plainPassword ?? "");
  const [showPass, setShowPass] = useState(false);
  const [quota, setQuota] = useState(initialAgent?.maxBeneficiariesQuota ?? 5);
  const [status, setStatus] = useState<"active" | "frozen" | "disabled">(initialAgent?.status ?? "active");
  const [error, setError] = useState("");

  // Granular Permissions States
  const [canViewBeneficiaries, setCanViewBeneficiaries] = useState(initialAgent?.canViewBeneficiaries ?? true);
  const [canAddBeneficiaries, setCanAddBeneficiaries] = useState(initialAgent?.canAddBeneficiaries ?? true);
  const [canEditBeneficiaries, setCanEditBeneficiaries] = useState(initialAgent?.canEditBeneficiaries ?? true);
  const [canDeleteBeneficiaries, setCanDeleteBeneficiaries] = useState(initialAgent?.canDeleteBeneficiaries ?? false);

  const [canManageProfits, setCanManageProfits] = useState(initialAgent?.canManageProfits ?? (initialAgent?.canManageFinancials ?? false));
  const [canManageFees, setCanManageFees] = useState(initialAgent?.canManageFees ?? (initialAgent?.canManageFinancials ?? false));
  const [canPayFees, setCanPayFees] = useState(initialAgent?.canPayFees ?? (initialAgent?.canManageFinancials ?? false));

  const [canManagePhases, setCanManagePhases] = useState(initialAgent?.canManagePhases ?? false);
  const [canPayPhases, setCanPayPhases] = useState(initialAgent?.canPayPhases ?? false);

  const [canSendNotifications, setCanSendNotifications] = useState(initialAgent?.canSendNotifications ?? true);
  const [canViewAccountInfo, setCanViewAccountInfo] = useState(initialAgent?.canViewAccountInfo ?? true);
  const [canEditAccountInfo, setCanEditAccountInfo] = useState(initialAgent?.canEditAccountInfo ?? false);

  function applyPreset(preset: "all" | "none" | "standard") {
    if (preset === "all") {
      setCanViewBeneficiaries(true);
      setCanAddBeneficiaries(true);
      setCanEditBeneficiaries(true);
      setCanDeleteBeneficiaries(true);
      setCanManageProfits(true);
      setCanManageFees(true);
      setCanPayFees(true);
      setCanManagePhases(true);
      setCanPayPhases(true);
      setCanSendNotifications(true);
      setCanViewAccountInfo(true);
      setCanEditAccountInfo(true);
    } else if (preset === "none") {
      setCanViewBeneficiaries(false);
      setCanAddBeneficiaries(false);
      setCanEditBeneficiaries(false);
      setCanDeleteBeneficiaries(false);
      setCanManageProfits(false);
      setCanManageFees(false);
      setCanPayFees(false);
      setCanManagePhases(false);
      setCanPayPhases(false);
      setCanSendNotifications(false);
      setCanViewAccountInfo(false);
      setCanEditAccountInfo(false);
    } else if (preset === "standard") {
      setCanViewBeneficiaries(true);
      setCanAddBeneficiaries(true);
      setCanEditBeneficiaries(true);
      setCanDeleteBeneficiaries(false);
      setCanManageProfits(false);
      setCanManageFees(false);
      setCanPayFees(false);
      setCanManagePhases(false);
      setCanPayPhases(false);
      setCanSendNotifications(true);
      setCanViewAccountInfo(true);
      setCanEditAccountInfo(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("اسم الوكيل مطلوب"); return; }
    if (!username.trim()) { setError("اسم المستخدم مطلوب"); return; }
    if (mode === "create" && !password.trim()) { setError("كلمة المرور مطلوبة"); return; }
    if (quota < 0) { setError("حصة المستفيدين يجب أن تكون 0 أو أكثر"); return; }

    try {
      await onSave({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        password: password.trim() || undefined,
        maxBeneficiariesQuota: Number(quota),
        status,
        canViewBeneficiaries,
        canAddBeneficiaries,
        canEditBeneficiaries,
        canDeleteBeneficiaries,
        canManageProfits,
        canManageFees,
        canPayFees,
        canManageFinancials: canManageProfits || canManageFees || canPayFees,
        canManagePhases,
        canPayPhases,
        canSendNotifications,
        canViewAccountInfo,
        canEditAccountInfo,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشلت العملية");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(10,15,40,0.6)", backdropFilter: "blur(4px)", fontFamily: "'Cairo', sans-serif" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        style={{ animation: "popIn 0.25s cubic-bezier(.175,.885,.32,1.275)" }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b border-[#eef0f6] flex items-center justify-between"
          style={{ background: "linear-gradient(135deg,#1a1f3c,#2952e3)" }}
        >
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            ✕
          </button>
          <div className="text-right">
            <h3 className="text-[16px] font-extrabold text-white">
              {mode === "create" ? "إضافة وكيل جديد" : "تعديل بيانات وصلاحيات الوكيل"}
            </h3>
            <p className="text-white/70 text-[11px]">حدد بيانات الدخول والحصة والصلاحيات التفصيلية</p>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 flex flex-col gap-4 text-right">
          {error && (
            <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px] font-bold text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-bold text-[#1e293b] mb-1.5">اسم الوكيل الكامل *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: تركي بن عبدالرحمن"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#1a1f3c] text-[13px] font-bold outline-none focus:border-[#2952e3] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-[#1e293b] mb-1.5">اسم المستخدم (Username) *</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="agent_turki"
              dir="ltr"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#1a1f3c] text-[13px] font-bold outline-none focus:border-[#2952e3] transition-colors text-right"
            />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-[#1e293b] mb-1.5">
              كلمة المرور {mode === "edit" ? "(اتركها فارغة إذا لم ترغب في التغيير)" : "*"}
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                dir="ltr"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#1a1f3c] text-[13px] font-bold outline-none focus:border-[#2952e3] transition-colors text-right"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#1e293b] text-[13px]"
              >
                {showPass ? "إخفاء" : "إظهار"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-bold text-[#1e293b] mb-1.5">
              حصة المستفيدين (الحد الأقصى للإضافة والإسناد) *
            </label>
            <input
              type="number"
              min="0"
              value={quota}
              onChange={(e) => setQuota(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#1a1f3c] text-[14px] font-extrabold outline-none focus:border-[#2952e3] transition-colors text-center"
            />
            <p className="text-[10px] text-[#64748b] mt-1">
              الحد الأقصى لعدد المستفيدين المسموح للوكيل بإدارتهم وإضافتهم.
            </p>
          </div>

          {/* Status buttons */}
          <div>
            <label className="block text-[12px] font-bold text-[#1e293b] mb-1.5">حالة الحساب</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus("active")}
                className={`py-2 rounded-xl text-[12px] font-bold transition-all border ${
                  status === "active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-500/20"
                    : "bg-[#f8fafc] text-[#64748b] border-[#cbd5e1]"
                }`}
              >
                🟢 نشط
              </button>
              <button
                type="button"
                onClick={() => setStatus("frozen")}
                className={`py-2 rounded-xl text-[12px] font-bold transition-all border ${
                  status === "frozen"
                    ? "bg-amber-50 text-amber-700 border-amber-300 ring-2 ring-amber-500/20"
                    : "bg-[#f8fafc] text-[#64748b] border-[#cbd5e1]"
                }`}
              >
                ❄️ مجمّد
              </button>
              <button
                type="button"
                onClick={() => setStatus("disabled")}
                className={`py-2 rounded-xl text-[12px] font-bold transition-all border ${
                  status === "disabled"
                    ? "bg-red-50 text-red-700 border-red-300 ring-2 ring-red-500/20"
                    : "bg-[#f8fafc] text-[#64748b] border-[#cbd5e1]"
                }`}
              >
                🔴 معطّل
              </button>
            </div>
          </div>

          {/* Granular Permissions Section */}
          <div className="rounded-2xl p-4 bg-[#f8fafc] border border-[#e2e8f0] flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
              <span className="text-[13px] font-extrabold text-[#1a1f3c]">الصلاحيات التفصيلية:</span>
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => applyPreset("all")}
                  className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold hover:bg-blue-100"
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("standard")}
                  className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-bold hover:bg-gray-200"
                >
                  قياسي
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("none")}
                  className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold hover:bg-red-100"
                >
                  إلغاء
                </button>
              </div>
            </div>

            {/* 1. Beneficiaries Data Section */}
            <div className="p-3 rounded-xl bg-white border border-[#e2e8f0] flex flex-col gap-2">
              <p className="text-[11px] font-extrabold text-[#2952e3]">📁 إدارة المستفيدين والبيانات</p>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canViewBeneficiaries}
                  onChange={(e) => setCanViewBeneficiaries(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2952e3]"
                />
                <span className="text-[11px] font-bold text-[#334155]">عرض بيانات المستفيدين المسندين</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canAddBeneficiaries}
                  onChange={(e) => setCanAddBeneficiaries(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2952e3]"
                />
                <span className="text-[11px] font-bold text-[#334155]">إضافة مستفيدين جدد (ضمن الحصة)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canEditBeneficiaries}
                  onChange={(e) => setCanEditBeneficiaries(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2952e3]"
                />
                <span className="text-[11px] font-bold text-[#334155]">تعديل بيانات المستفيدين</span>
              </label>
              <p className="text-[9px] text-[#64748b] pr-6 leading-tight">
                * ملاحظة: الحقول الحساسة (الاسم، الآيبان، صاحب الحساب، اسم المستخدم) مقفلة تلقائياً.
              </p>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canDeleteBeneficiaries}
                  onChange={(e) => setCanDeleteBeneficiaries(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600"
                />
                <span className="text-[11px] font-bold text-red-700">حذف المستفيدين (صلاحية حساسة)</span>
              </label>
            </div>

            {/* 2. Financial Operations Section */}
            <div className="p-3 rounded-xl bg-white border border-[#e2e8f0] flex flex-col gap-2">
              <p className="text-[11px] font-extrabold text-emerald-700">💰 العمليات المالية والسداد</p>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canManageProfits}
                  onChange={(e) => setCanManageProfits(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600"
                />
                <span className="text-[11px] font-bold text-[#334155]">إضافة وتعديل الأرباح</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canManageFees}
                  onChange={(e) => setCanManageFees(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600"
                />
                <span className="text-[11px] font-bold text-[#334155]">إضافة وتعديل الرسوم بمختلف أنواعها</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canPayFees}
                  onChange={(e) => setCanPayFees(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600"
                />
                <span className="text-[11px] font-bold text-[#334155]">تأكيد وسداد الرسوم (كلياً أو جزئياً)</span>
              </label>
            </div>

            {/* 3. Custom Phases Section */}
            <div className="p-3 rounded-xl bg-white border border-[#e2e8f0] flex flex-col gap-2">
              <p className="text-[11px] font-extrabold text-purple-700">📑 المراحل المخصصة والبطاقات</p>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canManagePhases}
                  onChange={(e) => setCanManagePhases(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <span className="text-[11px] font-bold text-[#334155]">إدارة وإظهار المراحل وتحديد مبالغها</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canPayPhases}
                  onChange={(e) => setCanPayPhases(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <span className="text-[11px] font-bold text-[#334155]">تأكيد سداد رسوم المراحل المخصصة</span>
              </label>
            </div>

            {/* 4. Account Info & Notifications */}
            <div className="p-3 rounded-xl bg-white border border-[#e2e8f0] flex flex-col gap-2">
              <p className="text-[11px] font-extrabold text-amber-700">🔔 الحساب والإشعارات</p>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canSendNotifications}
                  onChange={(e) => setCanSendNotifications(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600"
                />
                <span className="text-[11px] font-bold text-[#334155]">إرسال وتحديث إشعارات المستفيد</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canViewAccountInfo}
                  onChange={(e) => setCanViewAccountInfo(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600"
                />
                <span className="text-[11px] font-bold text-[#334155]">الاطلاع على بيانات الحساب البنكي ومحافظ USDT</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canEditAccountInfo}
                  onChange={(e) => setCanEditAccountInfo(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600"
                />
                <span className="text-[11px] font-bold text-[#334155]">تعديل بيانات الحساب البنكي والإيداع</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl border border-[#cbd5e1] text-[#475569] font-bold text-[13px] hover:bg-gray-50 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl text-white font-bold text-[13px] transition-opacity active:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#1a1f3c,#2952e3)" }}
            >
              {loading ? "جارٍ الحفظ..." : mode === "create" ? "إنشاء الوكيل" : "حفظ التعديلات"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Assign Beneficiaries to a specific Agent (Admin View)
 */
export function AssignBeneficiariesModal({
  agent,
  beneficiaries,
  onSave,
  onClose,
  loading,
}: {
  agent: Agent;
  beneficiaries: BeneficiaryItem[];
  onSave: (beneficiaryIds: number[]) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>(
    beneficiaries
      .filter((b) => (b.agentIds && b.agentIds.includes(agent.id)) || b.agentId === agent.id)
      .map((b) => Number(b.id))
  );
  const [search, setSearch] = useState("");

  const filtered = beneficiaries.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.username.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(10,15,40,0.6)", backdropFilter: "blur(4px)", fontFamily: "'Cairo', sans-serif" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
        <div
          className="px-5 py-4 border-b border-[#eef0f6] flex items-center justify-between"
          style={{ background: "linear-gradient(135deg,#1a1f3c,#2952e3)" }}
        >
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
            ✕
          </button>
          <div className="text-right">
            <h3 className="text-[16px] font-extrabold text-white">إسناد مستفيدين للوكيل</h3>
            <p className="text-white/70 text-[11px]">{agent.name} (@{agent.username})</p>
          </div>
        </div>

        <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو اسم المستخدم..."
            className="w-full px-3.5 py-2 rounded-xl border border-[#cbd5e1] text-[12px] font-bold text-right outline-none"
            dir="rtl"
          />
          <div className="flex items-center justify-between mt-2 text-[11px] font-bold text-[#64748b]">
            <span>تم تحديد: {selectedIds.length} مستفيد</span>
            <span>الحصة القصوى: {agent.maxBeneficiariesQuota}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {filtered.length === 0 ? (
            <p className="text-center text-[12px] text-[#94a3b8] py-8">لا يوجد مستفيدون مطابقون</p>
          ) : (
            filtered.map((b) => {
              const numId = Number(b.id);
              const isChecked = selectedIds.includes(numId);
              const otherAgents = (b.agentNames || []).filter((n) => n !== agent.name);

              return (
                <div
                  key={b.id}
                  onClick={() => toggle(numId)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isChecked
                      ? "bg-blue-50/70 border-[#2952e3]"
                      : "bg-white border-[#e2e8f0] hover:bg-[#f8fafc]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-4 h-4 rounded text-[#2952e3] cursor-pointer"
                  />
                  <div className="text-right flex-1 pr-3">
                    <p className="text-[13px] font-bold text-[#1a1f3c] leading-tight">{b.name}</p>
                    <p className="text-[11px] text-[#64748b] mt-0.5" dir="ltr" style={{ textAlign: "right" }}>
                      @{b.username}
                    </p>
                    {otherAgents.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-[9px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                          مسند أيضاً إلى: {otherAgents.join("، ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-[#e2e8f0] flex gap-2.5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-[#cbd5e1] text-[#475569] font-bold text-[13px]"
          >
            إلغاء
          </button>
          <button
            onClick={() => void onSave(selectedIds)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-[13px]"
            style={{ background: "linear-gradient(135deg,#0f7a38,#22c55e)" }}
          >
            {loading ? "جارٍ الحفظ..." : `حفظ التعيين (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Assign Multiple Agents to a single Beneficiary (Admin or Beneficiary Card View)
 */
export function AssignAgentsToBeneficiaryModal({
  beneficiary,
  agents,
  onSave,
  onClose,
  loading,
}: {
  beneficiary: { id: string; name: string; username: string; agentIds?: number[]; agentNames?: string[]; agentId?: number | null };
  agents: Agent[];
  onSave: (agentIds: number[]) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}) {
  const initialIds = beneficiary.agentIds && beneficiary.agentIds.length > 0
    ? beneficiary.agentIds
    : beneficiary.agentId ? [beneficiary.agentId] : [];

  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>(initialIds);
  const [error, setError] = useState("");

  function toggleAgent(agentId: number) {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  }

  async function handleSave() {
    setError("");
    try {
      await onSave(selectedAgentIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشلت العملية");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(10,15,40,0.6)", backdropFilter: "blur(4px)", fontFamily: "'Cairo', sans-serif" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
        <div
          className="px-5 py-4 border-b border-[#eef0f6] flex items-center justify-between"
          style={{ background: "linear-gradient(135deg,#1a1f3c,#2952e3)" }}
        >
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
            ✕
          </button>
          <div className="text-right">
            <h3 className="text-[16px] font-extrabold text-white">إسناد الوكلاء للمستفيد</h3>
            <p className="text-white/70 text-[11px]">{beneficiary.name} (@{beneficiary.username})</p>
          </div>
        </div>

        <div className="p-4 bg-[#f8fafc] border-b border-[#e2e8f0]">
          <p className="text-[12px] text-[#475569] font-medium leading-relaxed">
            يمكنك إسناد هذا المستفيد إلى وكيل واحد أو عدة وكلاء في آن واحد. سيتمكن الوكلاء المختارون من متابعة الحساب وفقاً لصلاحياتهم وحصصهم.
          </p>
          <div className="flex items-center justify-between mt-2 text-[11px] font-bold text-[#64748b]">
            <span>الوكلاء المحددون: {selectedAgentIds.length}</span>
            <span>إجمالي الوكلاء المتاحين: {agents.length}</span>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-red-50 text-red-700 text-[12px] font-bold text-center border border-red-200">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {agents.length === 0 ? (
            <p className="text-center text-[12px] text-[#94a3b8] py-8">لا يوجد وكلاء مسجلون حالياً</p>
          ) : (
            agents.map((ag) => {
              const isSelected = selectedAgentIds.includes(ag.id);
              const count = ag.currentBeneficiariesCount ?? 0;
              const quota = ag.maxBeneficiariesQuota;
              const isQuotaReached = !isSelected && count >= quota;

              return (
                <div
                  key={ag.id}
                  onClick={() => {
                    if (isQuotaReached) return;
                    toggleAgent(ag.id);
                  }}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                    isQuotaReached
                      ? "opacity-60 bg-gray-50 border-gray-200 cursor-not-allowed"
                      : isSelected
                      ? "bg-blue-50/70 border-[#2952e3] cursor-pointer"
                      : "bg-white border-[#e2e8f0] hover:bg-[#f8fafc] cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isQuotaReached}
                    onChange={() => {}}
                    className="w-4 h-4 rounded text-[#2952e3] cursor-pointer"
                  />
                  <div className="text-right flex-1 pr-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#64748b] bg-gray-100 px-2 py-0.5 rounded-lg">
                        {count} / {quota} مستفيد
                      </span>
                      <p className="text-[13px] font-bold text-[#1a1f3c]">{ag.name}</p>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        ag.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      }`}>
                        {ag.status === "active" ? "نشط" : "مجمّد"}
                      </span>
                      <p className="text-[11px] text-[#64748b]" dir="ltr">@{ag.username}</p>
                    </div>
                    {isQuotaReached && (
                      <p className="text-[10px] text-red-600 font-bold mt-1 text-right">⚠️ الحصة مكتملة لهذا الوكيل</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-[#e2e8f0] flex gap-2.5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-[#cbd5e1] text-[#475569] font-bold text-[13px]"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-white font-bold text-[13px]"
            style={{ background: "linear-gradient(135deg,#0f7a38,#22c55e)" }}
          >
            {loading ? "جارٍ الحفظ..." : `تأكيد الإسناد (${selectedAgentIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AgentChangePasswordModal({
  agentId,
  onClose,
}: {
  agentId: number;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) { setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    if (newPassword !== confirmPassword) { setError("كلمتا المرور غير متطابقتين"); return; }

    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل تغيير كلمة المرور");
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشلت العملية");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(10,15,40,0.6)", backdropFilter: "blur(4px)", fontFamily: "'Cairo', sans-serif" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl">
        <h3 className="text-[16px] font-extrabold text-[#1a1f3c] text-center mb-1">تغيير كلمة المرور</h3>
        <p className="text-[11px] text-[#64748b] text-center mb-4">أدخل كلمة المرور الحالية والجديدة</p>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 text-red-700 text-[11px] font-bold text-center">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-bold text-center">
            ✓ تم تغيير كلمة المرور بنجاح
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-3 text-right">
          <div>
            <label className="block text-[11px] font-bold text-[#475569] mb-1">كلمة المرور الحالية</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#cbd5e1] text-[13px] font-bold text-right outline-none"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#475569] mb-1">كلمة المرور الجديدة</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#cbd5e1] text-[13px] font-bold text-right outline-none"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#475569] mb-1">تأكيد كلمة المرور الجديدة</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#cbd5e1] text-[13px] font-bold text-right outline-none"
              dir="ltr"
            />
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-[#cbd5e1] text-[#475569] font-bold text-[12px]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 py-2.5 rounded-xl text-white font-bold text-[12px]"
              style={{ background: "linear-gradient(135deg,#1a1f3c,#2952e3)" }}
            >
              {loading ? "جارٍ الحفظ..." : "حفظ التغيير"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
