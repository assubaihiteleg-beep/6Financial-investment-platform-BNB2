import React, { useState } from "react";
import { Agent } from "./AgentManagement";

export interface FilterState {
  search: string;
  status: "all" | "active" | "disabled";
  feeStatus: "all" | "unpaid" | "partial" | "paid";
  agentId: "all" | "unassigned" | number;
  sortBy: "newest" | "oldest" | "profits_desc" | "fees_desc" | "name_asc";
}

export const defaultFilterState: FilterState = {
  search: "",
  status: "all",
  feeStatus: "all",
  agentId: "all",
  sortBy: "newest",
};

export function BeneficiaryFilterBar({
  filters,
  onChange,
  agents,
  isAgentView,
  totalCount,
  filteredCount,
}: {
  filters: FilterState;
  onChange: (updater: (prev: FilterState) => FilterState) => void;
  agents: Agent[];
  isAgentView?: boolean;
  totalCount: number;
  filteredCount: number;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isFiltered =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.feeStatus !== "all" ||
    filters.agentId !== "all" ||
    filters.sortBy !== "newest";

  const activeFiltersCount =
    (filters.search !== "" ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0) +
    (filters.feeStatus !== "all" ? 1 : 0) +
    (filters.agentId !== "all" ? 1 : 0) +
    (filters.sortBy !== "newest" ? 1 : 0);

  return (
    <div className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm mb-4 text-right overflow-hidden transition-all duration-200" dir="rtl">
      {/* Header bar - Clickable to fold/unfold */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="px-4 py-3 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between cursor-pointer hover:bg-gray-100/80 transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="w-7 h-7 rounded-xl bg-white border border-[#cbd5e1] text-[#1e293b] flex items-center justify-center text-[11px] font-bold shadow-xs transition-transform"
            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▼
          </button>
          <span className="text-[12px] font-bold text-[#64748b]">
            {isExpanded ? "طي خيارات الفلترة" : "توسيع خيارات الفلترة والبحث"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              {activeFiltersCount} فلاتر نشطة
            </span>
          )}
          <span className="text-[13px] font-extrabold text-[#1a1f3c]">🔍 البحث والفلترة الاحترافية</span>
        </div>
      </div>

      {/* Body - Collapsible content */}
      {isExpanded ? (
        <div className="p-4 flex flex-col gap-3.5">
          {/* Search Input Bar */}
          <div className="relative">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onChange((p) => ({ ...p, search: e.target.value }))}
              placeholder="بحث فوري بالاسم، اسم المستخدم، الهاتف، أو الآيبان..."
              className="w-full pl-10 pr-10 py-3 rounded-2xl border border-[#cbd5e1] bg-[#f8fafc] text-[#1a1f3c] text-[13px] font-bold outline-none focus:border-[#2952e3] focus:bg-white transition-all shadow-inner"
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            {filters.search && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange((p) => ({ ...p, search: "" }));
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 text-[#475569] flex items-center justify-center text-[11px] font-bold hover:bg-gray-300"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Row: Status Chips & Fee Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#f1f5f9]">
            {/* Status Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <span className="text-[11px] font-bold text-[#64748b] ml-1">الحالة:</span>
              {(["all", "active", "disabled"] as const).map((s) => {
                const active = filters.status === s;
                const label = s === "all" ? "الكل" : s === "active" ? "🟢 نشط" : "🔴 معطّل";
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChange((p) => ({ ...p, status: s }))}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                      active
                        ? "bg-[#1a1f3c] text-white shadow-sm"
                        : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Phase/Fees status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#64748b]">الرسوم:</span>
              <select
                value={filters.feeStatus}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    feeStatus: e.target.value as FilterState["feeStatus"],
                  }))
                }
                className="px-2.5 py-1.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#1a1f3c] text-[11px] font-bold outline-none cursor-pointer"
              >
                <option value="all">كافة الرسوم</option>
                <option value="unpaid">● غير مسددة</option>
                <option value="partial">⚡ مسدد جزئياً</option>
                <option value="paid">✓ تم السداد</option>
              </select>
            </div>
          </div>

          {/* Second Row: Agent selector (Admin only) & Sorting */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#f1f5f9]">
            {/* Agent Filter (Only shown to admin) */}
            {!isAgentView ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-[150px]">
                <span className="text-[11px] font-bold text-[#64748b] whitespace-nowrap">الوكيل المسؤول:</span>
                <select
                  value={filters.agentId}
                  onChange={(e) => {
                    const val = e.target.value;
                    onChange((p) => ({
                      ...p,
                      agentId: val === "all" ? "all" : val === "unassigned" ? "unassigned" : Number(val),
                    }));
                  }}
                  className="flex-1 px-2.5 py-1.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#1a1f3c] text-[11px] font-bold outline-none cursor-pointer truncate"
                >
                  <option value="all">كافة الوكلاء</option>
                  <option value="unassigned">بدون وكيل (غير معين)</option>
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.currentBeneficiariesCount ?? 0} مستفيد)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-[11px] font-bold text-[#64748b]">
                عرض المستفيدين المخصصين لك
              </div>
            )}

            {/* Sort selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#64748b] whitespace-nowrap">الترتيب:</span>
              <select
                value={filters.sortBy}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    sortBy: e.target.value as FilterState["sortBy"],
                  }))
                }
                className="px-2.5 py-1.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-[#1a1f3c] text-[11px] font-bold outline-none cursor-pointer"
              >
                <option value="newest">الأحدث تسجيلاً</option>
                <option value="oldest">الأقدم</option>
                <option value="profits_desc">الأعلى أرباحاً</option>
                <option value="fees_desc">الأعلى رسوماً</option>
                <option value="name_asc">أبجدياً (أ - ي)</option>
              </select>
            </div>
          </div>

          {/* Results bar + Clear Filter */}
          <div className="flex items-center justify-between text-[11px] font-bold pt-1 border-t border-[#f1f5f9]">
            <div className="text-[#64748b]">
              عرض <span className="text-[#2952e3] font-extrabold">{filteredCount}</span> من أصل{" "}
              <span className="text-[#1a1f3c] font-extrabold">{totalCount}</span> مستفيد
            </div>

            {isFiltered && (
              <button
                type="button"
                onClick={() => onChange(() => defaultFilterState)}
                className="text-[11px] font-extrabold text-[#ef4444] hover:underline flex items-center gap-1"
              >
                <span>إعادة ضبط الفلاتر</span>
                <span>✕</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Collapsed bar preview */
        <div className="px-4 py-2 bg-white flex items-center justify-between text-[11px] font-bold text-[#64748b]">
          <div>
            عرض <span className="text-[#2952e3] font-extrabold">{filteredCount}</span> من{" "}
            <span className="text-[#1a1f3c] font-extrabold">{totalCount}</span> مستفيد
          </div>
          {filters.search && (
            <span className="text-[10px] text-[#2952e3] font-bold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              بحث: "{filters.search}"
            </span>
          )}
        </div>
      )}
    </div>
  );
}
