import React, { useState, useEffect, useCallback } from "react";
import { Agent, AgentChangePasswordModal } from "./AgentManagement";
import { BeneficiaryFilterBar, FilterState, defaultFilterState } from "./BeneficiaryFilterBar";

export interface Beneficiary {
  id: string;
  username: string;
  name: string;
  profits: string;
  subscription: string;
  fees: string;
  accountHolder: string;
  iban: string;
  phone: string;
  status: "active" | "disabled";
  loginTitle: string;
  loginSlug: string;
  telegramLink: string;
  withdrawalFeeStatus: "unpaid" | "paid" | "partial";
  withdrawalFeePaidAt: string | null;
  plainPassword: string;
  phase1Visible: boolean;
  phase2Visible: boolean;
  liberationFee: string;
  liberationFeeStatus: "unpaid" | "paid" | "partial";
  liberationFeePaidAt: string | null;
  transactionFee: string;
  transactionFeeStatus: "unpaid" | "paid" | "partial";
  transactionFeePaidAt: string | null;
  phase3Visible: boolean;
  agentId?: number | null;
  agentName?: string | null;
  createdAt?: string;
}

export type BeneficiaryFormData = Omit<Beneficiary, "id"> & { password: string };

interface AgentDashboardProps {
  initialAgent: Agent;
  onLogout: () => void;
  onViewBeneficiary: (beneficiaryId: string, agent: Agent) => void;
  UserFormModalComponent: React.ComponentType<{
    mode: "create" | "edit";
    initial: BeneficiaryFormData;
    onSave: (data: BeneficiaryFormData) => Promise<void> | void;
    onClose: () => void;
    isAgent?: boolean;
  }>;
}

export function AgentDashboard({
  initialAgent,
  onLogout,
  onViewBeneficiary,
  UserFormModalComponent,
}: AgentDashboardProps) {
  const [agent, setAgent] = useState<Agent>(initialAgent);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(defaultFilterState);
  const [showPassId, setShowPassId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showChangePass, setShowChangePass] = useState(false);
  const [modalState, setModalState] = useState<
    | { type: "none" }
    | { type: "create" }
    | { type: "edit"; beneficiary: Beneficiary }
  >({ type: "none" });

  // 1. Refresh agent profile & linked beneficiaries
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch latest agent info (quota, permissions, status)
      const agentRes = await fetch(`/api/agents/${initialAgent.id}`);
      if (agentRes.ok) {
        const freshAgent = (await agentRes.json()) as Agent;
        setAgent(freshAgent);
      }

      // Fetch only beneficiaries linked to this agent
      const benRes = await fetch(`/api/beneficiaries?agentId=${initialAgent.id}`);
      if (benRes.ok) {
        const raw = (await benRes.json()) as Array<{
          id: number;
          username: string;
          name: string;
          profits: string;
          subscription: string;
          fees: string;
          accountHolder: string;
          iban: string;
          phone: string;
          status: string;
          loginTitle?: string;
          loginSlug?: string;
          telegramLink?: string;
          withdrawalFeeStatus?: string;
          withdrawalFeePaidAt?: string | null;
          plainPassword?: string;
          phase1Visible?: boolean;
          phase2Visible?: boolean;
          liberationFee?: string;
          liberationFeeStatus?: string;
          liberationFeePaidAt?: string | null;
          transactionFee?: string;
          transactionFeeStatus?: string;
          transactionFeePaidAt?: string | null;
          phase3Visible?: boolean;
          agentId?: number | null;
          agentName?: string | null;
          createdAt?: string;
        }>;

        const mapped: Beneficiary[] = raw.map((u) => ({
          id: String(u.id),
          username: u.username,
          name: u.name,
          profits: u.profits,
          subscription: u.subscription,
          fees: u.fees,
          accountHolder: u.accountHolder,
          iban: u.iban,
          phone: u.phone,
          status: (u.status === "disabled" ? "disabled" : "active") as "active" | "disabled",
          loginTitle: u.loginTitle ?? "",
          loginSlug: u.loginSlug ?? "",
          telegramLink: u.telegramLink ?? "",
          withdrawalFeeStatus:
            u.withdrawalFeeStatus === "paid"
              ? "paid"
              : u.withdrawalFeeStatus === "partial"
              ? "partial"
              : "unpaid",
          withdrawalFeePaidAt: u.withdrawalFeePaidAt ?? null,
          plainPassword: u.plainPassword ?? "",
          phase1Visible: u.phase1Visible ?? false,
          phase2Visible: u.phase2Visible ?? false,
          liberationFee: u.liberationFee ?? "0",
          liberationFeeStatus:
            u.liberationFeeStatus === "paid"
              ? "paid"
              : u.liberationFeeStatus === "partial"
              ? "partial"
              : "unpaid",
          liberationFeePaidAt: u.liberationFeePaidAt ?? null,
          transactionFee: u.transactionFee ?? "0",
          transactionFeeStatus:
            u.transactionFeeStatus === "paid"
              ? "paid"
              : u.transactionFeeStatus === "partial"
              ? "partial"
              : "unpaid",
          transactionFeePaidAt: u.transactionFeePaidAt ?? null,
          phase3Visible: u.phase3Visible ?? false,
          agentId: u.agentId ?? null,
          agentName: u.agentName ?? null,
          createdAt: u.createdAt,
        }));
        setBeneficiaries(mapped);
      }
    } catch (err) {
      console.error("Error loading agent dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [initialAgent.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Quota computations
  const currentCount = beneficiaries.length;
  const quota = agent.maxBeneficiariesQuota;
  const isQuotaReached = currentCount >= quota;
  const quotaPct = quota > 0 ? Math.min(100, Math.round((currentCount / quota) * 100)) : 100;

  // Filter & sort
  const filteredBeneficiaries = beneficiaries
    .filter((b) => {
      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        const matchName = b.name.toLowerCase().includes(q);
        const matchUser = b.username.toLowerCase().includes(q);
        const matchPhone = (b.phone || "").toLowerCase().includes(q);
        const matchIban = (b.iban || "").toLowerCase().includes(q);
        if (!matchName && !matchUser && !matchPhone && !matchIban) return false;
      }
      if (filters.status !== "all" && b.status !== filters.status) return false;
      if (filters.feeStatus !== "all") {
        const statuses = [b.withdrawalFeeStatus, b.liberationFeeStatus, b.transactionFeeStatus];
        if (filters.feeStatus === "unpaid" && !statuses.includes("unpaid")) return false;
        if (filters.feeStatus === "partial" && !statuses.includes("partial")) return false;
        if (filters.feeStatus === "paid" && !statuses.includes("paid")) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (filters.sortBy === "newest") return Number(b.id) - Number(a.id);
      if (filters.sortBy === "oldest") return Number(a.id) - Number(b.id);
      if (filters.sortBy === "name_asc") return a.name.localeCompare(b.name, "ar");
      if (filters.sortBy === "profits_desc") {
        const pA = parseFloat(a.profits.replace(/,/g, "")) || 0;
        const pB = parseFloat(b.profits.replace(/,/g, "")) || 0;
        return pB - pA;
      }
      if (filters.sortBy === "fees_desc") {
        const fA = parseFloat(a.fees.replace(/,/g, "")) || 0;
        const fB = parseFloat(b.fees.replace(/,/g, "")) || 0;
        return fB - fA;
      }
      return 0;
    });

  // Create Beneficiary
  async function handleCreateBeneficiary(data: BeneficiaryFormData) {
    if (isQuotaReached) {
      alert(`عذراً، لقد استنفدت حصتك (${quota} مستفيدين). يرجى مراجعة الإدارة لزيادة الحصة.`);
      return;
    }
    try {
      const res = await fetch("/api/beneficiaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          agentId: agent.id,
          isAgentCreator: true,
        }),
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "فشل إنشاء المستفيد");
      }
      setModalState({ type: "none" });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشلت العملية");
    }
  }

  // Edit Beneficiary (enforces protected fields)
  async function handleEditBeneficiary(data: BeneficiaryFormData) {
    if (modalState.type !== "edit") return;
    const targetId = modalState.beneficiary.id;
    try {
      const res = await fetch(`/api/beneficiaries/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          isAgentEditor: true,
          editorAgentId: agent.id,
        }),
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "فشل تعديل بيانات المستفيد");
      }
      setModalState({ type: "none" });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشلت العملية");
    }
  }

  function copyUrl(userId: string, url: string) {
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedId(userId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const [collapsedCardIds, setCollapsedCardIds] = useState<Record<string, boolean>>({});

  function toggleCard(id: string) {
    setCollapsedCardIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="max-w-md mx-auto min-h-screen pb-12 text-right" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Top Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChangePass(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#d0d7e8] text-[#1a1f3c] text-[11px] font-bold shadow-sm hover:bg-gray-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>تغيير كلمة المرور</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#d0d7e8] text-[#dc2626] text-[11px] font-bold shadow-sm hover:bg-red-50 transition-colors"
            >
              <span>خروج</span>
            </button>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                وكيل معتمد
              </span>
              <h1 className="text-[18px] font-extrabold text-[#1a1f3c] leading-tight">
                {agent.name}
              </h1>
            </div>
            <p className="text-[11px] text-[#64748b] font-medium" dir="ltr" style={{ textAlign: "right" }}>
              @{agent.username}
            </p>
          </div>
        </div>
      </div>

      {/* Quota Progress Banner */}
      <div className="px-4 mb-4">
        <div
          className="rounded-3xl p-4 text-white relative overflow-hidden shadow-lg"
          style={{
            background: isQuotaReached
              ? "linear-gradient(135deg,#7f1d1d 0%,#b91c1c 60%,#ef4444 100%)"
              : "linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#2563eb 100%)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/20">
              {isQuotaReached ? "⚠️ اكتملت الحصة" : "حصة المستفيدين المتاحة"}
            </span>
            <div className="flex items-baseline gap-1" dir="ltr">
              <span className="text-[20px] font-extrabold">{currentCount}</span>
              <span className="text-white/60 text-[13px] font-bold">/ {quota}</span>
              <span className="text-white/70 text-[11px] mr-1">مستفيد</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${quotaPct}%`,
                background: isQuotaReached ? "#fca5a5" : "#38bdf8",
              }}
            />
          </div>

          <p className="text-[11px] text-white/80 font-medium">
            {isQuotaReached
              ? "لقد وصلت إلى الحد الأقصى للمستفيدين المصرح لك بإدارتهم. لزيادة العدد تواصل مع الإدارة."
              : `يمكنك إضافة حتى ${quota - currentCount} مستفيدين جدد إلى حسابك.`}
          </p>
        </div>
      </div>

      {/* Permissions notice bar */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-2xl p-3 border border-[#e2e8f0] shadow-sm flex flex-wrap gap-2 items-center justify-between text-[11px] font-semibold text-[#475569]">
          <span className="font-extrabold text-[#1e293b]">الصلاحيات الممنوحة:</span>
          <div className="flex gap-2">
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                agent.canEditBeneficiaries
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-gray-100 text-gray-500 border-gray-200"
              }`}
            >
              {agent.canEditBeneficiaries ? "✓ تعديل البيانات" : "✗ تعديل البيانات"}
            </span>
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                agent.canManagePhases
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-gray-100 text-gray-500 border-gray-200"
              }`}
            >
              {agent.canManagePhases ? "✓ المراحل والبطاقات" : "✗ المراحل والبطاقات"}
            </span>
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                agent.canManageFinancials
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-gray-100 text-gray-500 border-gray-200"
              }`}
            >
              {agent.canManageFinancials ? "✓ العمليات المالية" : "✗ العمليات المالية"}
            </span>
          </div>
        </div>
      </div>

      {/* Action Button: Add Beneficiary */}
      <div className="px-4 mb-4">
        <button
          onClick={() => {
            if (isQuotaReached) {
              alert(`عذراً، لقد استنفدت حصتك (${quota} مستفيدين). يرجى التواصل مع الإدارة.`);
              return;
            }
            setModalState({ type: "create" });
          }}
          disabled={isQuotaReached}
          className="w-full py-3.5 rounded-2xl text-white font-bold text-[14px] shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: isQuotaReached
              ? "#94a3b8"
              : "linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#3b82f6 100%)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>إضافة مستفيد جديد</span>
          {isQuotaReached && <span className="text-[11px]">(مكتمل)</span>}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="px-4">
        <BeneficiaryFilterBar
          filters={filters}
          onChange={setFilters}
          agents={[agent]}
          isAgentView={true}
          totalCount={beneficiaries.length}
          filteredCount={filteredBeneficiaries.length}
        />
      </div>

      {/* Beneficiaries List */}
      <div className="px-4 flex flex-col gap-4">
        {loading ? (
          <div className="bg-white rounded-3xl p-10 text-center text-[#64748b] border border-[#e2e8f0]">
            <p className="font-bold text-[13px]">جارٍ تحميل المستفيدين...</p>
          </div>
        ) : filteredBeneficiaries.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center text-[#8892a4] border border-[#e2e8f0]">
            <div className="text-[36px] mb-2">👥</div>
            <p className="font-extrabold text-[14px] text-[#1a1f3c]">لا يوجد مستفيدون مطابقون</p>
            <p className="text-[11px] text-[#64748b] mt-1">
              {beneficiaries.length === 0
                ? 'اضغط على "إضافة مستفيد جديد" للبدء في إدارة المستفيدين التابعين لك.'
                : "حاول تغيير معايير البحث أو تصفية الفلاتر أعلاه."}
            </p>
          </div>
        ) : (
          filteredBeneficiaries.map((b) => {
            const clientUrl = b.loginSlug
              ? `${window.location.origin}${import.meta.env.BASE_URL}client/${b.loginSlug}`
              : "";
            const isCopied = copiedId === b.id;
            const isCollapsed = Boolean(collapsedCardIds[b.id]);

            return (
              <div
                key={b.id}
                className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm overflow-hidden transition-all duration-200"
              >
                {/* Collapsible Card Header */}
                <div
                  onClick={() => toggleCard(b.id)}
                  className="p-4 bg-white border-b border-[#f1f5f9] flex items-center justify-between cursor-pointer hover:bg-gray-50/80 transition-colors select-none"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="w-7 h-7 rounded-xl bg-[#f1f5f9] text-[#1e293b] flex items-center justify-center text-[11px] font-bold shadow-xs transition-transform"
                      style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)" }}
                    >
                      ▼
                    </button>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                        b.status === "active"
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          : "bg-red-50 text-red-500 border border-red-200"
                      }`}
                    >
                      {b.status === "active" ? "نشط" : "معطّل"}
                    </span>
                  </div>

                  <div className="text-right flex-1 pr-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewBeneficiary(b.id, agent);
                        }}
                        className="text-[15px] font-extrabold text-[#2952e3] leading-snug hover:underline text-right"
                      >
                        {b.name}
                      </button>
                    </div>
                    <p className="text-[11px] text-[#8892a4] font-medium" dir="ltr" style={{ textAlign: "right" }}>
                      @{b.username}
                    </p>
                  </div>
                </div>

                {/* Collapsible Card Body */}
                {!isCollapsed && (
                  <div className="p-4 pt-3 flex flex-col gap-3 border-t border-gray-50">
                    {/* Password reveal */}
                    <div className="text-right">
                      <label className="block text-[10px] font-bold text-[#8892a4] mb-1">كلمة المرور</label>
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#f8f9fc] border border-[#e8eaf0]">
                        <button
                          onClick={() => setShowPassId(showPassId === b.id ? null : b.id)}
                          className="text-[#8892a4] hover:text-[#5a6282]"
                        >
                          {showPassId === b.id ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </button>
                        <span className="text-[12px] font-semibold text-[#1a1f3c]" dir="ltr">
                          {showPassId === b.id
                            ? b.plainPassword || <span className="text-[#8892a4] italic text-[11px]">لم تُضبط بعد</span>
                            : "••••••••"}
                        </span>
                      </div>
                    </div>

                    {/* Financial Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl p-2 text-center bg-emerald-50 border border-emerald-100">
                        <p className="font-extrabold text-[13px] text-emerald-700 leading-none">{b.profits}</p>
                        <p className="text-[8px] font-bold text-emerald-600 mt-1">الأرباح (ر.س)</p>
                      </div>
                      <div className="rounded-xl p-2 text-center bg-blue-50 border border-blue-100">
                        <p className="font-extrabold text-[13px] text-blue-700 leading-none">{b.subscription}</p>
                        <p className="text-[8px] font-bold text-blue-600 mt-1">الاشتراك (ر.س)</p>
                      </div>
                      <div className="rounded-xl p-2 text-center bg-rose-50 border border-rose-100">
                        <p className="font-extrabold text-[13px] text-rose-700 leading-none">{b.fees}</p>
                        <p className="text-[8px] font-bold text-rose-600 mt-1">رسوم السحب</p>
                      </div>
                    </div>

                    {/* Bank info */}
                    <div className="rounded-2xl p-3 text-right" style={{ background: "linear-gradient(135deg,#5b21b6,#7c3aed)" }}>
                      <p className="text-white/60 text-[9px] font-medium mb-0.5">اسم صاحب الحساب</p>
                      <p className="text-white font-bold text-[12px] leading-snug mb-1">{b.accountHolder}</p>
                      <p className="text-white/60 text-[9px] font-medium mb-0.5">رقم الإيبان</p>
                      <p className="text-white font-bold text-[11px]" dir="ltr" style={{ textAlign: "right", letterSpacing: "0.05em" }}>
                        {b.iban}
                      </p>
                    </div>

                    {/* Login Link */}
                    {b.loginSlug && (
                      <div className="rounded-xl p-2.5 bg-gray-50 border border-gray-200 text-right flex items-center justify-between gap-2">
                        <button
                          onClick={() => copyUrl(b.id, clientUrl)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors flex-shrink-0"
                          style={{
                            background: isCopied ? "#dcfce7" : "#eff6ff",
                            color: isCopied ? "#15803d" : "#2563eb",
                            borderColor: isCopied ? "#86efac" : "#bfdbfe",
                          }}
                        >
                          {isCopied ? "تم النسخ ✓" : "نسخ الرابط"}
                        </button>
                        <p className="text-[11px] text-[#475569] font-medium truncate flex-1 text-left" dir="ltr">
                          {clientUrl}
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => onViewBeneficiary(b.id, agent)}
                        className="flex-1 py-2.5 rounded-xl text-white font-bold text-[12px] shadow-sm transition-opacity active:opacity-90 flex items-center justify-center gap-1.5"
                        style={{ background: "linear-gradient(135deg,#1e3a8a,#2563eb)" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span>عرض والتحكم</span>
                      </button>

                      <button
                        onClick={() => {
                          if (!agent.canEditBeneficiaries) {
                            alert("ليس لديك صلاحية لتعديل بيانات المستفيدين. مخصصة من قبل الإدارة.");
                            return;
                          }
                          setModalState({ type: "edit", beneficiary: b });
                        }}
                        disabled={!agent.canEditBeneficiaries}
                        className="flex-1 py-2.5 rounded-xl font-bold text-[12px] border transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: "#eff6ff",
                          color: "#2563eb",
                          borderColor: "#bfdbfe",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>تعديل البيانات</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Change Password Modal */}
      {showChangePass && (
        <AgentChangePasswordModal
          agentId={agent.id}
          onClose={() => setShowChangePass(false)}
        />
      )}

      {/* Create / Edit Beneficiary Modal */}
      {modalState.type === "create" && (
        <UserFormModalComponent
          mode="create"
          isAgent={true}
          initial={{
            username: "",
            password: "",
            name: "",
            profits: "0",
            subscription: "1,000",
            fees: "0",
            accountHolder: "",
            iban: "",
            phone: "",
            status: "active",
            loginTitle: "",
            loginSlug: "",
            telegramLink: "",
            withdrawalFeeStatus: "unpaid",
            withdrawalFeePaidAt: null,
            liberationFee: "0",
            liberationFeeStatus: "unpaid",
            liberationFeePaidAt: null,
            transactionFee: "0",
            transactionFeeStatus: "unpaid",
            transactionFeePaidAt: null,
            plainPassword: "",
            phase1Visible: false,
            phase2Visible: false,
            phase3Visible: false,
          }}
          onSave={handleCreateBeneficiary}
          onClose={() => setModalState({ type: "none" })}
        />
      )}

      {modalState.type === "edit" && modalState.beneficiary && (
        <UserFormModalComponent
          mode="edit"
          isAgent={true}
          initial={{
            username: modalState.beneficiary.username,
            password: "",
            name: modalState.beneficiary.name,
            profits: modalState.beneficiary.profits,
            subscription: modalState.beneficiary.subscription,
            fees: modalState.beneficiary.fees,
            accountHolder: modalState.beneficiary.accountHolder,
            iban: modalState.beneficiary.iban,
            phone: modalState.beneficiary.phone,
            status: modalState.beneficiary.status,
            loginTitle: modalState.beneficiary.loginTitle ?? "",
            loginSlug: modalState.beneficiary.loginSlug ?? "",
            telegramLink: modalState.beneficiary.telegramLink ?? "",
            withdrawalFeeStatus: modalState.beneficiary.withdrawalFeeStatus ?? "unpaid",
            withdrawalFeePaidAt: modalState.beneficiary.withdrawalFeePaidAt ?? null,
            liberationFee: modalState.beneficiary.liberationFee ?? "0",
            liberationFeeStatus: modalState.beneficiary.liberationFeeStatus ?? "unpaid",
            liberationFeePaidAt: modalState.beneficiary.liberationFeePaidAt ?? null,
            transactionFee: modalState.beneficiary.transactionFee ?? "0",
            transactionFeeStatus: modalState.beneficiary.transactionFeeStatus ?? "unpaid",
            transactionFeePaidAt: modalState.beneficiary.transactionFeePaidAt ?? null,
            plainPassword: modalState.beneficiary.plainPassword ?? "",
            phase1Visible: modalState.beneficiary.phase1Visible ?? false,
            phase2Visible: modalState.beneficiary.phase2Visible ?? false,
            phase3Visible: modalState.beneficiary.phase3Visible ?? false,
          }}
          onSave={handleEditBeneficiary}
          onClose={() => setModalState({ type: "none" })}
        />
      )}
    </div>
  );
}
