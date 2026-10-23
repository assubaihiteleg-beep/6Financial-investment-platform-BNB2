import { useState, useEffect, useCallback } from "react";
import {
  Agent,
  AgentFormModal,
  AssignBeneficiariesModal,
  AgentChangePasswordModal,
} from "./components/AgentManagement";
import {
  BeneficiaryFilterBar,
  FilterState,
  defaultFilterState,
} from "./components/BeneficiaryFilterBar";
import { AgentDashboard } from "./components/AgentDashboard";

/* ─── Types ─────────────────────────────────────────────────── */
interface User {
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

interface CustomPhase {
  id: number;
  name: string;
  failureMessage: string;
  failureTitle: string | null;
  cardColor: string | null;
  sortOrder: number;
}

interface UserCustomPhase {
  id: number;
  userId: number;
  phaseId: number;
  amount: string;
  status: "unpaid" | "paid" | "partial";
  paidAt: string | null;
  visible: boolean;
}

interface Notification {
  id: number;
  beneficiaryId: number;
  type: "profits_added" | "fees_paid" | "liberation_fee_paid" | "transaction_fee_paid" | "deposit_ready" | string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface AdminDepositNotif {
  id: number;
  beneficiaryId: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  beneficiaryName: string;
  beneficiaryUsername: string;
}

interface FinancialTransaction {
  id: number;
  beneficiaryId: number;
  type: string;
  amount: string;
  description: string;
  createdAt: string;
}

interface DepositMethods {
  id: number;
  beneficiaryId: number;
  bankAccountName: string;
  bankIban: string;
  bankName: string;
  usdtWalletAddress: string;
  usdtNetwork: string;
}

type View =
  | { page: "login" }
  | { page: "client-login"; slug: string }
  | { page: "admin" }
  | { page: "agent"; agent: Agent }
  | { page: "user"; userId: string; fromAdmin?: boolean; fromAgent?: boolean; currentAgent?: Agent };

const STORAGE_KEY = "financial_platform_users";

/* ─── API helper ────────────────────────────────────────────── */
// The API lives at the root /api path (shared proxy routes /api → api-server)
// Do NOT prepend BASE_URL here — that would produce /financial-platform/api/...
async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

type ApiUser = Omit<User, "id" | "status" | "withdrawalFeeStatus" | "liberationFeeStatus" | "transactionFeeStatus"> & {
  id: number;
  status: string;
  withdrawalFeeStatus?: string;
  liberationFeeStatus?: string;
  transactionFeeStatus?: string;
  phase1Visible?: boolean;
  phase2Visible?: boolean;
  phase3Visible?: boolean;
  agentId?: number | null;
  agentName?: string | null;
  createdAt?: string;
};

function mapApiUser(u: ApiUser): User {
  return {
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
    withdrawalFeeStatus: u.withdrawalFeeStatus === "paid" ? "paid" : u.withdrawalFeeStatus === "partial" ? "partial" : "unpaid",
    withdrawalFeePaidAt: u.withdrawalFeePaidAt ?? null,
    plainPassword: u.plainPassword ?? "",
    phase1Visible: u.phase1Visible ?? false,
    phase2Visible: u.phase2Visible ?? false,
    liberationFee: u.liberationFee ?? "0",
    liberationFeeStatus: u.liberationFeeStatus === "paid" ? "paid" : u.liberationFeeStatus === "partial" ? "partial" : "unpaid",
    liberationFeePaidAt: u.liberationFeePaidAt ?? null,
    transactionFee: u.transactionFee ?? "0",
    transactionFeeStatus: u.transactionFeeStatus === "paid" ? "paid" : u.transactionFeeStatus === "partial" ? "partial" : "unpaid",
    transactionFeePaidAt: u.transactionFeePaidAt ?? null,
    phase3Visible: u.phase3Visible ?? false,
    agentId: u.agentId ?? null,
    agentName: u.agentName ?? null,
    createdAt: u.createdAt,
  };
}

function getClientSlugFromUrl(): string | null {
  const path = window.location.pathname;
  const match = path.match(/\/client\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

function makeCardGradient(hex: string | null): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return "linear-gradient(135deg,#1e3a5f 0%,#2952e3 40%,#4f8ef7 80%,#60a5fa 100%)";
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r * 0.55), dg = Math.round(g * 0.55), db = Math.round(b * 0.55);
  const lr = Math.round(r + (255 - r) * 0.28), lg = Math.round(g + (255 - g) * 0.28), lb = Math.round(b + (255 - b) * 0.28);
  return `linear-gradient(135deg,rgb(${dr},${dg},${db}) 0%,rgb(${r},${g},${b}) 50%,rgb(${lr},${lg},${lb}) 100%)`;
}

function interpolatePhaseMessage(msg: string, name: string, amount: string): string {
  return msg
    .replace(/\[[^\]]*اسم المستفيد[^\]]*\]/g, name)
    .replace(/\[[^\]]*مبلغ[^\]]*\]/g, amount);
}

function isPast24h(paidAt: string | null): boolean {
  if (!paidAt) return false;
  return Date.now() - new Date(paidAt).getTime() >= 24 * 60 * 60 * 1000;
}

/* ─── Mock Data (fallback, no passwords) ─────────────────────── */
const initialUsers: User[] = [];


/* ─── SVG Icons ──────────────────────────────────────────────── */
const Icon = {
  TrendingUp: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Dollar: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  AlertCircle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  CreditCard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Logout: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
  Ban: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  Eye: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  CheckCircle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  Copy: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  CopyDone: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Lock: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  User: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Gift: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  ),
  Receipt: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="14" y2="14" />
    </svg>
  ),
};

/* ─── Card Icon Button ───────────────────────────────────────── */
function CardIconBtn({ children, bg = "rgba(255,255,255,0.25)" }: { children: React.ReactNode; bg?: string }) {
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ background: bg }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LOGIN PAGE
═══════════════════════════════════════════════════════════════ */
function LoginPage({ onLogin }: { onLogin: (view: View) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/unified-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        setError(data.error || "اسم المستخدم أو كلمة المرور غير صحيحة");
        return;
      }

      if (data.role === "admin") {
        onLogin({ page: "admin" });
      } else if (data.role === "agent") {
        onLogin({ page: "agent", agent: data.agent });
      } else if (data.role === "beneficiary") {
        onLogin({ page: "user", userId: String(data.id) });
      } else {
        setError("بيانات الدخول غير معروفة");
      }
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-5"
      style={{
        background: "linear-gradient(160deg,#1a1f3c 0%,#2952e3 50%,#7c3aed 100%)",
        fontFamily: "'Cairo', sans-serif",
      }}
      dir="rtl"
    >
      {/* Background circles */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-10" style={{ background: "rgba(255,255,255,0.3)" }} />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-10" style={{ background: "rgba(255,255,255,0.2)" }} />
        <div className="absolute top-1/2 left-1/4 w-40 h-40 rounded-full opacity-5" style={{ background: "rgba(255,255,255,0.4)" }} />
      </div>
      <div className="w-full max-w-sm relative z-10">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.25)" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <h1 className="text-[24px] font-extrabold text-white leading-tight">منصة الاستثمار المالية</h1>
          <p className="text-white/60 text-[13px] font-medium mt-1">سجّل دخولك للمتابعة</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          <h2 className="text-[17px] font-extrabold text-[#1a1f3c] text-center mb-6">تسجيل الدخول</h2>

          {/* Error message */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-2xl text-center text-[12px] font-bold"
              style={{ background: "#fef2f2", color: "#dc2626", border: "1.5px solid #fecaca" }}>
              {error}
            </div>
          )}

          {/* Username */}
          <div className="mb-4">
            <label className="block text-[12px] font-bold text-[#5a6282] mb-2 text-right">اسم المستخدم</label>
            <div className="relative">
              <div className="absolute top-1/2 -translate-y-1/2 right-3 text-[#8892a4]">
                <Icon.User />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="أدخل اسم المستخدم"
                className="w-full pl-4 pr-11 py-3 rounded-2xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[13px] font-semibold text-right outline-none transition-all"
                style={{ direction: "ltr", textAlign: "right" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#2952e3"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(41,82,227,0.1)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="block text-[12px] font-bold text-[#5a6282] mb-2 text-right">كلمة المرور</label>
            <div className="relative">
              <div className="absolute top-1/2 -translate-y-1/2 right-3 text-[#8892a4]">
                <Icon.Lock />
              </div>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="أدخل كلمة المرور"
                className="w-full pl-10 pr-11 py-3 rounded-2xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[13px] font-semibold text-right outline-none transition-all"
                style={{ direction: "ltr", textAlign: "right" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#2952e3"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(41,82,227,0.1)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute top-1/2 -translate-y-1/2 left-3 text-[#8892a4] hover:text-[#5a6282] transition-colors"
              >
                {showPass ? <Icon.EyeOff /> : <Icon.Eye />}
              </button>
            </div>
          </div>

          {/* Login button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-[15px] shadow-lg transition-opacity active:opacity-90 disabled:opacity-70"
            style={{ background: "linear-gradient(135deg,#2952e3 0%,#7c3aed 100%)" }}
          >
            {loading ? "جارٍ التحقق..." : "تسجيل الدخول"}
          </button>
        </div>

        <p className="text-center text-white/40 text-[11px] font-medium mt-6">المنصة المالية © 2026</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CLIENT LOGIN PAGE (beneficiary-specific URL)
═══════════════════════════════════════════════════════════════ */
function ClientLoginPage({ slug, onLogin }: { slug: string; onLogin: (view: View) => void }) {
  const [beneficiary, setBeneficiary] = useState<User | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<ApiUser>(`/beneficiaries/by-slug/${encodeURIComponent(slug)}`)
      .then((u) => setBeneficiary(mapApiUser(u)))
      .catch(() => setNotFound(true));
  }, [slug]);

  async function handleLogin() {
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/beneficiary/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (res.status === 403) {
        setError("هذا الحساب معطّل. تواصل مع الإدارة");
        return;
      }
      if (!res.ok) {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة");
        return;
      }
      const { id } = await res.json() as { id: number };
      onLogin({ page: "user", userId: String(id) });
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  }

  if (notFound) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-5"
        style={{
          background: "linear-gradient(160deg,#1a1f3c 0%,#2952e3 50%,#7c3aed 100%)",
          fontFamily: "'Cairo', sans-serif",
        }}
        dir="rtl"
      >
        <div className="text-center text-white">
          <p className="text-[22px] font-extrabold mb-2">الصفحة غير موجودة</p>
          <p className="text-white/60 text-[14px]">هذا الرابط غير صحيح أو تم حذفه</p>
        </div>
      </div>
    );
  }

  if (!beneficiary) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(160deg,#1a1f3c 0%,#2952e3 50%,#7c3aed 100%)",
          fontFamily: "'Cairo', sans-serif",
        }}
      >
        <div style={{
          width: 40, height: 40, border: "4px solid rgba(255,255,255,0.2)",
          borderTopColor: "white", borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-5"
      style={{
        background: "linear-gradient(160deg,#1a1f3c 0%,#2952e3 50%,#7c3aed 100%)",
        fontFamily: "'Cairo', sans-serif",
      }}
      dir="rtl"
    >
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-10" style={{ background: "rgba(255,255,255,0.3)" }} />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-10" style={{ background: "rgba(255,255,255,0.2)" }} />
        <div className="absolute top-1/2 left-1/4 w-40 h-40 rounded-full opacity-5" style={{ background: "rgba(255,255,255,0.4)" }} />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.25)" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <h1 className="text-[22px] font-extrabold text-white leading-tight">{beneficiary.loginTitle || beneficiary.name}</h1>
          <p className="text-white/60 text-[13px] font-medium mt-1">سجّل دخولك للمتابعة</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          <h2 className="text-[17px] font-extrabold text-[#1a1f3c] text-center mb-6">تسجيل الدخول</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-2xl text-center text-[12px] font-bold"
              style={{ background: "#fef2f2", color: "#dc2626", border: "1.5px solid #fecaca" }}>
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[12px] font-bold text-[#5a6282] mb-2 text-right">اسم المستخدم</label>
            <div className="relative">
              <div className="absolute top-1/2 -translate-y-1/2 right-3 text-[#8892a4]">
                <Icon.User />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="أدخل اسم المستخدم"
                className="w-full pl-4 pr-11 py-3 rounded-2xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[13px] font-semibold text-right outline-none transition-all"
                style={{ direction: "ltr", textAlign: "right" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#2952e3"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(41,82,227,0.1)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-[12px] font-bold text-[#5a6282] mb-2 text-right">كلمة المرور</label>
            <div className="relative">
              <div className="absolute top-1/2 -translate-y-1/2 right-3 text-[#8892a4]">
                <Icon.Lock />
              </div>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="أدخل كلمة المرور"
                className="w-full pl-10 pr-11 py-3 rounded-2xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[13px] font-semibold text-right outline-none transition-all"
                style={{ direction: "ltr", textAlign: "right" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#2952e3"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(41,82,227,0.1)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute top-1/2 -translate-y-1/2 left-3 text-[#8892a4] hover:text-[#5a6282] transition-colors"
              >
                {showPass ? <Icon.EyeOff /> : <Icon.Eye />}
              </button>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-[15px] shadow-lg transition-opacity active:opacity-90 disabled:opacity-70"
            style={{ background: "linear-gradient(135deg,#2952e3 0%,#7c3aed 100%)" }}
          >
            {loading ? "جارٍ التحقق..." : "تسجيل الدخول"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHANGE CREDENTIALS MODAL
═══════════════════════════════════════════════════════════════ */

function ChangeCredentialsModal({ onClose, userId, currentUsername, onSaved }: {
  onClose: () => void;
  userId: string;
  currentUsername: string;
  onSaved: () => Promise<void>;
}) {
  const [username, setUsername] = useState(currentUsername);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setError("");
    if (!username.trim()) { setError("اسم المستخدم مطلوب"); return; }
    if (password && password !== confirmPassword) { setError("كلمة المرور غير متطابقة"); return; }
    if (password && password.length < 6) { setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    setLoading(true);
    try {
      const body: { username: string; password?: string } = { username: username.trim() };
      if (password) body.password = password;
      await apiFetch(`/beneficiaries/${userId}`, { method: "PUT", body: JSON.stringify(body) });
      await onSaved();
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشلت العملية");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{ background: "rgba(10,15,40,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
        style={{ fontFamily: "'Cairo', sans-serif" }} dir="rtl">
        <div className="px-6 pt-7 pb-4">
          <div className="flex items-center justify-end gap-2 mb-1">
            <h3 className="text-[18px] font-extrabold text-[#1a1f3c]">تعديل بيانات الدخول</h3>
            <span className="text-[20px]">🔐</span>
          </div>
          <p className="text-[12px] text-[#8892a4] font-medium">يمكنك تغيير اسم المستخدم أو كلمة المرور</p>
        </div>
        <div className="h-px bg-[#f0f2f7] mx-5" />
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-[13px] font-bold text-[#1a1f3c] mb-2 text-right">اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-[13px] font-semibold text-right outline-none transition-all"
              style={{ border: "1.5px solid #e2e8f0", background: "white", color: "#1a1f3c" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#2952e3"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
            />
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#1a1f3c] mb-2 text-right">كلمة المرور الجديدة</label>
            <input
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="اتركها فارغة إذا لا تريد التغيير"
              className="w-full px-4 py-3 rounded-2xl text-[13px] font-semibold text-right outline-none transition-all"
              style={{ border: "1.5px solid #e2e8f0", background: "white", color: "#1a1f3c" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#2952e3"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
            />
          </div>
          {password && (
            <div>
              <label className="block text-[13px] font-bold text-[#1a1f3c] mb-2 text-right">تأكيد كلمة المرور</label>
              <input
                type="password"
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد إدخال كلمة المرور"
                className="w-full px-4 py-3 rounded-2xl text-[13px] font-semibold text-right outline-none transition-all"
                style={{ border: "1.5px solid #e2e8f0", background: "white", color: "#1a1f3c" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#2952e3"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
              />
            </div>
          )}
          {error && (
            <div className="rounded-2xl px-4 py-3 text-right text-[12px] font-bold text-[#dc2626]"
              style={{ background: "#fff0f0", border: "1.5px solid #fecaca" }}>
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-2xl px-4 py-3 text-right text-[12px] font-bold text-[#16a34a]"
              style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}>
              تم الحفظ بنجاح ✅
            </div>
          )}
        </div>
        <div className="flex gap-3 px-5 pb-6">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-3.5 rounded-2xl font-bold text-[14px] transition-colors hover:bg-[#f3f5fa]"
            style={{ border: "1.5px solid #e2e8f0", color: "#5a6282", background: "white" }}>
            إلغاء
          </button>
          <button onClick={() => void handleSave()} disabled={loading}
            className="flex-1 py-3.5 rounded-2xl text-white font-bold text-[14px] shadow-lg active:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg,#2952e3 0%,#7c3aed 100%)", opacity: loading ? 0.7 : 1 }}>
            {loading ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   USER DASHBOARD
═══════════════════════════════════════════════════════════════ */

function hours24Passed(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() >= 24 * 60 * 60 * 1000;
}

function WithdrawModal({ onClose, maxAmount, iban, fees, userName, withdrawalFeeStatus, hasPreviousPayment, user, customPhases, userCustomPhases }: {
  onClose: () => void;
  maxAmount: string;
  iban: string;
  fees: string;
  userName: string;
  withdrawalFeeStatus: "unpaid" | "paid" | "partial";
  hasPreviousPayment: boolean;
  user: User;
  customPhases: CustomPhase[];
  userCustomPhases: UserCustomPhase[];
}) {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "result">("form");
  const [submitTime, setSubmitTime] = useState("");

  const profitsNum = parseFloat(maxAmount.replace(/,/g, "")) || 0;
  const amountNum = parseFloat(amount.replace(/,/g, "")) || 0;

  // مرحلة نشطة = مرئية + لم تكتمل معالجتها (لم تمر 24 ساعة بعد السداد)
  const phase1Blocking = user.phase1Visible && !(user.liberationFeeStatus === "paid" && isPast24h(user.liberationFeePaidAt));
  const phase2Active = user.phase2Visible && !(user.withdrawalFeeStatus === "paid" && isPast24h(user.withdrawalFeePaidAt));
  const phase3Active = user.phase3Visible && !(user.transactionFeeStatus === "paid" && isPast24h(user.transactionFeePaidAt));

  const visibleCustomPhase = (() => {
    // نتجاهل المراحل التي اكتملت معالجتها (مسدد + مرور 24 ساعة)
    const blockingUcps = userCustomPhases.filter(
      (ucp) => ucp.visible && !(ucp.status === "paid" && isPast24h(ucp.paidAt))
    );
    if (blockingUcps.length === 0) return null;
    const sorted = [...blockingUcps].sort((a, b) => {
      const pa = customPhases.find((p) => p.id === a.phaseId);
      const pb = customPhases.find((p) => p.id === b.phaseId);
      return (pb?.sortOrder ?? 0) - (pa?.sortOrder ?? 0);
    });
    const ucp = sorted[0];
    return { ucp, phase: customPhases.find((p) => p.id === ucp.phaseId) };
  })();

  const currentFeeLabel = visibleCustomPhase
    ? (visibleCustomPhase.phase?.name ?? "رسوم إضافية")
    : phase3Active
    ? "مبلغ المعاملة"
    : phase2Active
    ? "رسوم السحب"
    : "رسوم التحرير";

  const currentFeeAmount = visibleCustomPhase
    ? visibleCustomPhase.ucp.amount
    : phase3Active
    ? user.transactionFee
    : phase2Active
    ? fees
    : user.liberationFee;

  const feesNum = parseFloat((currentFeeAmount ?? "0").replace(/,/g, "")) || 0;
  const netAmount = amountNum - feesNum;

  function getFailureMessage() {
    // مرحلة مخصصة لم تكتمل بعد
    if (visibleCustomPhase) {
      const phaseName = visibleCustomPhase.phase?.name ?? "الرسوم الإضافية";
      const failureMsg = visibleCustomPhase.phase?.failureMessage;
      if (visibleCustomPhase.ucp.status === "paid") {
        return `عزيز العميل / ${userName} ✅ تم تأكيد سداد ${phaseName} بنجاح\nيرجى الإنتظار سوف يقوم النظام بمعالجة طلبك خلال أقل من 24 ساعة`;
      }
      return failureMsg
        ? interpolatePhaseMessage(failureMsg, userName, visibleCustomPhase.ucp.amount)
        : `عزيز العميل / ${userName} 🚨 تعذر عملية سحب الأرباح يرجى دفع مبلغ ${phaseName} "${visibleCustomPhase.ucp.amount}" ريال بعد السداد يتم تحرير الأرباح بنجاح ✅`;
    }
    // المرحلة الثالثة: مبلغ المعاملة (لم تكتمل بعد)
    if (phase3Active) {
      if (user.transactionFeeStatus === "paid") {
        return `عزيز العميل / ${userName} 🚨 تم تأكيد دفع معاملة تأكيد تحويل الأرباح بنجاح ✅\n يرجى الإنتظار سوف يقوم النظام\n بإتمام عملية سحب الأرباح  خلال أقل من 24 ساعة\nويتم سحب  أرباحك بنجاح ✅ \nنشكر تفهمكم و تعاونكم معنا`;
      }
      return `عزيزي العميل/ ${userName}\nتعذر سحب  الأرباح\nالمتبقي عليكم دفع مبلغ  المعاملة "${user.transactionFee}" ريال لنتمكن من تأكيد تحويل أرباحك بنجاح\n🛑ملاحظة هامة 🚸♨️ الغرض من المعاملة\nمعاملات تسجيل الخروج من الشركة ضمن المتطلبات المتفق عليها🤝👍`;
    }
    // المرحلة الثانية: رسوم السحب (لم تكتمل بعد)
    if (phase2Active) {
      if (user.withdrawalFeeStatus === "paid") {
        return `عزيز العميل / ${userName} 🚨 تم تأكيد سداد رسوم السحب بنجاح ✅\n يرجى الإنتظار سوف يقوم النظام\n بتحرير الأرباح خلال أقل من 24 ساعة\nويتم سحب ارباحك بنجاح ✅`;
      }
      return `عزيز العميل / ${userName} 🚨 تعذر عملية سحب الأرباح يرجى دفع ${user.withdrawalFeeStatus === "partial" ? "المبلغ المتبقي لرسوم السحب" : "مبلغ رسوم السحب"} "${fees}" ريال بعد السداد يتم تحرير الأرباح بنجاح ✅`;
    }
    // المرحلة الأولى: رسوم التحرير (لم تكتمل بعد)
    if (phase1Blocking) {
      if (profitsNum === 0) {
        return `عزيز العميل / ${userName} 🚨 لم يتم إضافة الأرباح الى حسابك اذا كنت مشترك جديد يرجى الانتظار حتى يتم إضافة ارباح الاشتراك الى حسابك و يتم سحب ارباحك بنجاح ✅`;
      }
      if (user.liberationFeeStatus === "paid") {
        return `عزيز العميل / ${userName} 🚨 تعذر تحويل أرباح بعد سداد رسوم التحرير يرجى الإنتظار سوف يقوم النظام بتحرير حسابك وتفعيل سحب الاموال خلال اقل من 24 ساعة\nويتم سحب ارباحك بنجاح ✅`;
      }
      if (user.liberationFee === "0" || user.liberationFee === "") {
        return `عزيز العميل / ${userName} 🚨 لم يتم إضافة رسوم تحرير الأرباح الى حسابك يرجى الانتظار حتى يتم إضافة رسوم التحرير ويتم سحب ارباحك بنجاح ✅`;
      }
      return `عزيز العميل / ${userName} 🚨 تعذر عملية سحب الأرباح يرجى دفع ${user.liberationFeeStatus === "partial" ? "المبلغ المتبقي لرسوم تحرير الأرباح" : "مبلغ رسوم تحرير الأرباح"} "${user.liberationFee}" ريال بعد السداد يتم تحرير الأرباح بنجاح ✅`;
    }
    // كل المراحل اكتملت — رسالة افتراضية
    if (profitsNum === 0) {
      return `عزيز العميل / ${userName} 🚨 لم يتم إضافة الأرباح الى حسابك يرجى الانتظار`;
    }
    return `عزيز العميل / ${userName} 🚨 تعذر عملية سحب الأرباح يرجى التواصل مع الدعم`;
  }

  function formatNum(n: number) {
    return n.toLocaleString("en-US");
  }

  if (step === "confirm") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-5"
        style={{ background: "rgba(10,15,40,0.6)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
          style={{ fontFamily: "'Cairo', sans-serif" }} dir="rtl">
          <div className="px-6 pt-7 pb-5">
            <h3 className="text-[19px] font-extrabold text-[#1a1f3c] text-right leading-snug">تأكيد السحب</h3>
            <p className="text-[12px] text-[#8892a4] font-medium mt-1 text-right">تأكد من صحة البيانات قبل المتابعة</p>
          </div>
          <div className="h-px bg-[#f0f2f7] mx-5" />
          <div className="px-6 py-5 flex flex-col gap-0">
            <div className="flex items-center justify-between py-3 border-b border-[#f3f5fa]">
              <div className="flex items-baseline gap-1" dir="ltr">
                <span className="text-[16px] font-extrabold text-[#1a1f3c]">{formatNum(amountNum)}</span>
                <span className="text-[12px] font-bold text-[#1a1f3c]">ر.س</span>
              </div>
              <span className="text-[13px] font-semibold text-[#5a6282]">مبلغ السحب :</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[#f3f5fa]">
              <div className="flex items-baseline gap-1" dir="ltr">
                <span className="text-[16px] font-extrabold text-[#ef4444]">{formatNum(feesNum)}</span>
                <span className="text-[12px] font-bold text-[#ef4444]">ر.س</span>
              </div>
              <span className="text-[13px] font-semibold text-[#5a6282]">{currentFeeLabel} :</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[#f3f5fa]">
              <div className="flex items-baseline gap-1" dir="ltr">
                <span className="text-[16px] font-extrabold text-[#16a34a]">{formatNum(amountNum)}</span>
                <span className="text-[12px] font-bold text-[#16a34a]">ر.س</span>
              </div>
              <span className="text-[13px] font-semibold text-[#5a6282]">المبلغ الصافي :</span>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <span className="text-[13px] font-bold text-[#1a1f3c] leading-relaxed" dir="ltr" style={{ textAlign: "left", letterSpacing: "0.04em" }}>
                {iban}
              </span>
              <span className="text-[13px] font-semibold text-[#5a6282] whitespace-nowrap mt-0.5">رقم الإيبان :</span>
            </div>
          </div>
          <div className="flex gap-3 px-5 pb-6">
            <button onClick={() => setStep("form")}
              className="flex-1 py-3.5 rounded-2xl font-bold text-[14px] transition-colors hover:bg-[#f3f5fa]"
              style={{ border: "1.5px solid #e2e8f0", color: "#5a6282", background: "white" }}>
              رجوع
            </button>
            <button
              onClick={() => {
                const now = new Date();
                const pad = (n: number) => String(n).padStart(2, "0");
                const h = now.getHours();
                const period = h >= 12 ? "م" : "ص";
                const h12 = h % 12 || 12;
                const timeStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${h12}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${period}`;
                setSubmitTime(timeStr);
                setStep("result");
              }}
              className="flex-1 py-3.5 rounded-2xl text-white font-bold text-[14px] shadow-lg active:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(135deg,#c8005a 0%,#f0196e 60%,#ff4d88 100%)" }}>
              تأكيد السحب
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "result") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-5"
        style={{ background: "rgba(10,15,40,0.6)" }}>
        <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
          style={{ fontFamily: "'Cairo', sans-serif" }} dir="rtl">
          <div className="px-6 pt-7 pb-6 flex flex-col gap-5">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <h3 className="text-[18px] font-extrabold text-[#dc2626]">فشل في السحب</h3>
                <span className="text-[18px]">⚠️</span>
              </div>
              <p className="text-[12px] text-[#8892a4] font-medium">لم يتم إتمام عملية السحب</p>
            </div>
            <div className="rounded-2xl p-4 text-right" style={{ background: "#fff0f0", border: "1.5px solid #fecaca" }}>
              <p className="text-[13px] font-extrabold text-[#1a1f3c] mb-2">سبب الفشل:</p>
              <p className="text-[13px] font-medium text-[#374151] leading-relaxed">
                {getFailureMessage()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-extrabold text-[#1a1f3c] mb-3">تفاصيل المحاولة:</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#374151]">
                    {amountNum > 0 ? formatNum(amountNum) : maxAmount} ر.س
                  </span>
                  <span className="text-[12px] text-[#8892a4] font-medium">المبلغ المطلوب:</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#374151]">{currentFeeAmount} ر.س</span>
                  <span className="text-[12px] text-[#8892a4] font-medium">{currentFeeLabel}:</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#374151]" dir="ltr">{submitTime}</span>
                  <span className="text-[12px] text-[#8892a4] font-medium">الوقت:</span>
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="w-full py-4 rounded-2xl text-white font-bold text-[15px] mt-1 active:opacity-90 transition-opacity"
              style={{ background: "#111827" }}>
              إغلاق
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{ background: "rgba(10,15,40,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
        style={{ fontFamily: "'Cairo', sans-serif" }} dir="rtl">
        <div className="px-6 pt-7 pb-1 flex items-center justify-end gap-2">
          <h3 className="text-[18px] font-extrabold text-[#1a1f3c]">سحب الأموال</h3>
          <span className="text-[20px] font-black text-[#c8005a] leading-none">$</span>
        </div>
        <p className="px-6 pb-5 text-[12px] text-[#8892a4] font-medium text-right">أدخل مبلغ السحب ورقم الإيبان</p>
        <div className="px-6 pb-6 flex flex-col gap-4">
          <div>
            <label className="block text-[13px] font-bold text-[#1a1f3c] mb-2 text-right">مبلغ السحب (ر.س)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="أدخل المبلغ"
              className="w-full px-4 py-3 rounded-2xl text-[13px] font-semibold text-right outline-none transition-all"
              style={{ border: "1.5px solid #e2e8f0", background: "white", color: "#1a1f3c" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#f0196e"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }} />
            <p className="text-[11px] text-[#8892a4] font-medium mt-2 text-right">الحد الأقصى : {maxAmount} ر.س</p>
          </div>
          <div>
            <label className="block text-[13px] font-bold text-[#1a1f3c] mb-2 text-right">رقم الإيبان</label>
            <div className="w-full px-4 py-3.5 rounded-2xl text-[15px] font-bold text-center" dir="ltr"
              style={{ border: "1.5px solid #e2e8f0", background: "white", color: "#1a1f3c", letterSpacing: "0.05em" }}>
              {iban}
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl"
            style={{ background: "#fef9ec", border: "1.5px solid #f5d97a" }}>
            <span className="text-[18px] leading-none">⚠️</span>
            <span className="text-[13px] font-bold text-[#92400e]">{currentFeeLabel} : {currentFeeAmount} ر.س</span>
          </div>
          {amountNum > profitsNum && profitsNum > 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-right"
              style={{ background: "#fff0f0", border: "1.5px solid #fecaca" }}>
              <span className="text-[16px]">🚫</span>
              <p className="text-[12px] font-bold text-[#dc2626]">
                مبلغ السحب يتجاوز أرباحك ({maxAmount} ر.س)
              </p>
            </div>
          )}
          <div className="flex gap-3 mt-1">
            <button
              onClick={() => { if (amountNum > 0 && amountNum <= profitsNum) setStep("confirm"); else if (amountNum > profitsNum) return; }}
              disabled={!amount || amountNum <= 0 || amountNum > profitsNum}
              className="flex-1 py-3.5 rounded-2xl text-white font-bold text-[14px] shadow-lg active:opacity-90 transition-opacity disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#c8005a 0%,#f0196e 60%,#ff4d88 100%)" }}>
              متابعة
            </button>
            <button onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl font-bold text-[14px] transition-colors hover:bg-[#f3f5fa]"
              style={{ border: "1.5px solid #e2e8f0", color: "#5a6282", background: "white" }}>
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function openTelegramDirect(link: string) {
  // Extract username from any format: @user / t.me/user / https://t.me/user / username
  let username = link.trim();
  const match = username.match(/(?:t\.me\/|tg:\/\/resolve\?domain=)([A-Za-z0-9_]+)/);
  if (match) {
    username = match[1];
  } else if (username.startsWith("@")) {
    username = username.slice(1);
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // On mobile: https://t.me/ is a Universal/App Link → opens Telegram app directly
    window.open(`https://t.me/${username}`, "_blank");
  } else {
    // On desktop: try tg:// via hidden iframe so we don't navigate away from the page
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "display:none;width:0;height:0;border:none;";
    iframe.src = `tg://resolve?domain=${username}`;
    document.body.appendChild(iframe);
    // Fallback to web only if the app didn't open (page still visible)
    setTimeout(() => {
      document.body.removeChild(iframe);
      if (!document.hidden) {
        window.open(`https://t.me/${username}`, "_blank");
      }
    }, 1800);
  }
}

function UserDashboard({
  user,
  onLogout,
  onBack,
  onRefreshUser,
  isAgent,
  currentAgent,
}: {
  user: User;
  onLogout: () => void;
  onBack?: () => void;
  onRefreshUser?: () => Promise<void>;
  isAgent?: boolean;
  currentAgent?: Agent;
}) {
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositStep, setDepositStep] = useState<"choose" | "bank" | "usdt">("choose");
  const [depositMethods, setDepositMethods] = useState<DepositMethods | null>(null);
  const [depositMethodsLoading, setDepositMethodsLoading] = useState(false);
  const [depositRequestSent, setDepositRequestSent] = useState<"bank" | "usdt" | null>(null);
  const [depositCopied, setDepositCopied] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupNotif, setPopupNotif] = useState<Notification | null>(null);
  const [adminModal, setAdminModal] = useState<{ type: "add-profits" | "add-fees" | "pay-fees" | "add-liberation-fee" | "pay-liberation-fee" | "add-transaction-fee" | "pay-transaction-fee" | "add-custom-phase-amount" | "pay-custom-phase"; phaseId?: number } | null>(null);
  const [payAmountInput, setPayAmountInput] = useState("");
  const [addProfitAmt, setAddProfitAmt] = useState("");
  const [addFeesAmt, setAddFeesAmt] = useState("");
  const [addLiberationAmt, setAddLiberationAmt] = useState("");
  const [addTransactionAmt, setAddTransactionAmt] = useState("");
  const [addCustomPhaseAmt, setAddCustomPhaseAmt] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [showTransactionLog, setShowTransactionLog] = useState(false);
  const [transactionLog, setTransactionLog] = useState<FinancialTransaction[]>([]);
  const [undoTxId, setUndoTxId] = useState<number | null>(null);
  const [undoLoading, setUndoLoading] = useState(false);
  const [customPhases, setCustomPhases] = useState<CustomPhase[]>([]);
  const [userCustomPhases, setUserCustomPhases] = useState<UserCustomPhase[]>([]);
  const [isBankCardCollapsed, setIsBankCardCollapsed] = useState(false);
  const [isAccountInfoCollapsed, setIsAccountInfoCollapsed] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const loadCustomPhases = useCallback(async () => {
    try {
      const uid = Number(user.id);
      const [phases, userPhases] = await Promise.all([
        apiFetch<CustomPhase[]>("/phases"),
        apiFetch<UserCustomPhase[]>(`/beneficiaries/${uid}/custom-phases`),
      ]);
      setCustomPhases(phases);
      setUserCustomPhases(userPhases);
    } catch { /* silent */ }
  }, [user.id]);

  const loadDepositMethods = useCallback(async () => {
    try {
      const uid = Number(user.id);
      const data = await apiFetch<DepositMethods | null>(`/beneficiaries/${uid}/deposit-methods`);
      setDepositMethods(data);
    } catch { /* silent */ }
  }, [user.id]);

  useEffect(() => {
    if (onBack) return;
    const uid = Number(user.id);
    if (!uid) return;

    const fetchNotifs = () => {
      apiFetch<Notification[]>(`/beneficiaries/${uid}/notifications`)
        .then((data) => {
          setNotifications((prev) => {
            // detect genuinely new unread notifications vs what we had before
            const prevIds = new Set(prev.map((n) => n.id));
            const newUnread = data.filter((n) => !n.isRead && !prevIds.has(n.id));
            if (newUnread.length > 0) {
              setPopupNotif(newUnread[0]);
              setShowPopup(true);
            }
            return data;
          });
        })
        .catch(() => {});
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 20_000);
    return () => clearInterval(interval);
  }, [user.id, onBack]);

  useEffect(() => {
    void loadCustomPhases();
  }, [loadCustomPhases]);

  useEffect(() => {
    void loadDepositMethods();
  }, [loadDepositMethods]);

  async function markRead(id: number) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch { /* silent */ }
  }

  function openNotifPanel() {
    setShowNotifPanel(true);
    notifications.filter((n) => !n.isRead).forEach((n) => void markRead(n.id));
  }

  async function dismissPopup() {
    if (popupNotif) await markRead(popupNotif.id);
    const remaining = notifications.filter((n) => !n.isRead && n.id !== popupNotif?.id);
    if (remaining.length > 0) { setPopupNotif(remaining[0]); }
    else { setShowPopup(false); setPopupNotif(null); }
  }

  async function loadTransactionLog() {
    try {
      const uid = Number(user.id);
      const data = await apiFetch<FinancialTransaction[]>(`/beneficiaries/${uid}/transactions`);
      setTransactionLog(data);
      setShowTransactionLog(true);
    } catch { alert("فشل تحميل سجل العمليات"); }
  }

  async function handleUndoTransaction(txId: number) {
    setUndoLoading(true);
    try {
      await apiFetch(`/transactions/${txId}/undo`, { method: "DELETE" });
      setTransactionLog((prev) => prev.filter((t) => t.id !== txId));
      setUndoTxId(null);
      await onRefreshUser?.();
    } catch {
      alert("فشل التراجع عن العملية");
    } finally {
      setUndoLoading(false);
    }
  }

  async function handleAdminFinancial() {
    if (!adminModal) return;
    setAdminLoading(true);
    try {
      const uid = Number(user.id);
      if (adminModal.type === "add-profits") {
        const amt = parseInt(addProfitAmt.replace(/,/g, ""), 10);
        if (!amt || amt <= 0) { alert("أدخل مبلغاً صحيحاً"); return; }
        await apiFetch(`/beneficiaries/${uid}/add-profits`, { method: "POST", body: JSON.stringify({ amount: amt }) });
        setAddProfitAmt("");
      } else if (adminModal.type === "add-fees") {
        const amt = parseInt(addFeesAmt.replace(/,/g, ""), 10);
        if (!amt || amt <= 0) { alert("أدخل مبلغاً صحيحاً"); return; }
        await apiFetch(`/beneficiaries/${uid}/add-fees`, { method: "POST", body: JSON.stringify({ amount: amt }) });
        setAddFeesAmt("");
      } else if (adminModal.type === "pay-fees") {
        const amt = payAmountInput ? parseFloat(payAmountInput.replace(/,/g, "")) : undefined;
        await apiFetch(`/beneficiaries/${uid}/pay-fees`, {
          method: "POST",
          body: amt && amt > 0 ? JSON.stringify({ paidAmount: amt }) : undefined,
        });
        setPayAmountInput("");
      } else if (adminModal.type === "add-liberation-fee") {
        const amt = parseInt(addLiberationAmt.replace(/,/g, ""), 10);
        if (!amt || amt <= 0) { alert("أدخل مبلغاً صحيحاً"); return; }
        await apiFetch(`/beneficiaries/${uid}/add-liberation-fee`, { method: "POST", body: JSON.stringify({ amount: amt }) });
        setAddLiberationAmt("");
      } else if (adminModal.type === "pay-liberation-fee") {
        const amt = payAmountInput ? parseFloat(payAmountInput.replace(/,/g, "")) : undefined;
        await apiFetch(`/beneficiaries/${uid}/pay-liberation-fee`, {
          method: "POST",
          body: amt && amt > 0 ? JSON.stringify({ paidAmount: amt }) : undefined,
        });
        setPayAmountInput("");
      } else if (adminModal.type === "add-transaction-fee") {
        const amt = parseInt(addTransactionAmt.replace(/,/g, ""), 10);
        if (!amt || amt <= 0) { alert("أدخل مبلغاً صحيحاً"); return; }
        await apiFetch(`/beneficiaries/${uid}/add-transaction-fee`, { method: "POST", body: JSON.stringify({ amount: amt }) });
        setAddTransactionAmt("");
      } else if (adminModal.type === "pay-transaction-fee") {
        const amt = payAmountInput ? parseFloat(payAmountInput.replace(/,/g, "")) : undefined;
        await apiFetch(`/beneficiaries/${uid}/pay-transaction-fee`, {
          method: "POST",
          body: amt && amt > 0 ? JSON.stringify({ paidAmount: amt }) : undefined,
        });
        setPayAmountInput("");
      } else if (adminModal.type === "add-custom-phase-amount") {
        const amt = parseInt(addCustomPhaseAmt.replace(/,/g, ""), 10);
        if (!amt || amt <= 0 || !adminModal.phaseId) { alert("أدخل مبلغاً صحيحاً"); return; }
        await apiFetch(`/beneficiaries/${uid}/custom-phases/${adminModal.phaseId}/set-amount`, { method: "POST", body: JSON.stringify({ amount: amt }) });
        setAddCustomPhaseAmt("");
        await loadCustomPhases();
      } else if (adminModal.type === "pay-custom-phase") {
        if (!adminModal.phaseId) return;
        const amt = payAmountInput ? parseFloat(payAmountInput.replace(/,/g, "")) : undefined;
        await apiFetch(`/beneficiaries/${uid}/custom-phases/${adminModal.phaseId}/pay`, {
          method: "POST",
          body: amt && amt > 0 ? JSON.stringify({ paidAmount: amt }) : undefined,
        });
        setPayAmountInput("");
        await loadCustomPhases();
      }
      await onRefreshUser?.();
      setAdminModal(null);
    } catch (e) {
      alert("فشلت العملية: " + (e instanceof Error ? e.message : "خطأ"));
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleTogglePhase1() {
    const uid = Number(user.id);
    setAdminLoading(true);
    try {
      await apiFetch(`/beneficiaries/${uid}/phase-visibility`, { method: "PATCH", body: JSON.stringify({ phase1Visible: !user.phase1Visible }) });
      await onRefreshUser?.();
    } catch (e) { alert("فشلت العملية: " + (e instanceof Error ? e.message : "خطأ")); }
    finally { setAdminLoading(false); }
  }

  async function handleTogglePhase2() {
    const uid = Number(user.id);
    setAdminLoading(true);
    try {
      await apiFetch(`/beneficiaries/${uid}/phase-visibility`, { method: "PATCH", body: JSON.stringify({ phase2Visible: !user.phase2Visible }) });
      await onRefreshUser?.();
    } catch (e) { alert("فشلت العملية: " + (e instanceof Error ? e.message : "خطأ")); }
    finally { setAdminLoading(false); }
  }

  async function handleTogglePhase3() {
    const uid = Number(user.id);
    setAdminLoading(true);
    try {
      await apiFetch(`/beneficiaries/${uid}/phase-visibility`, { method: "PATCH", body: JSON.stringify({ phase3Visible: !user.phase3Visible }) });
      await onRefreshUser?.();
    } catch (e) { alert("فشلت العملية: " + (e instanceof Error ? e.message : "خطأ")); }
    finally { setAdminLoading(false); }
  }

  async function handleToggleCustomPhase(phaseId: number) {
    const uid = Number(user.id);
    const ucp = userCustomPhases.find((p) => p.phaseId === phaseId);
    const newVisible = !(ucp?.visible ?? false);
    setAdminLoading(true);
    try {
      await apiFetch(`/beneficiaries/${uid}/custom-phases/${phaseId}/visibility`, { method: "PATCH", body: JSON.stringify({ visible: newVisible }) });
      await Promise.all([loadCustomPhases(), onRefreshUser?.()]);
    } catch (e) { alert("فشلت العملية: " + (e instanceof Error ? e.message : "خطأ")); }
    finally { setAdminLoading(false); }
  }

  function fmtNotifDate(iso: string) {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }),
      time: d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
    };
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="text-right">
            <h1 className="text-[19px] font-extrabold text-[#1a1f3c] leading-tight tracking-tight">المنصة المالية</h1>
            <p className="text-[11px] text-[#5a6282] mt-1 leading-snug font-medium">مرحباً، {user.name}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              {!onBack && (
                <button
                  onClick={openNotifPanel}
                  className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-[#d0d7e8] shadow-sm hover:bg-gray-50 transition-colors"
                  style={{ color: unreadCount > 0 ? "#2952e3" : "#8892a4" }}>
                  <Icon.Bell />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              )}
              <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#d0d7e8] text-[11px] font-semibold shadow-sm hover:bg-gray-50 transition-colors" style={{ color: "#2952e3" }}>
                <span className="text-[9px]">الريال السعودي (ر.س)</span>
              </button>
              {!onBack && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-[#d0d7e8] shadow-sm hover:bg-gray-50 transition-colors"
                  style={{ color: "#5a6282" }}
                  title="إعدادات الحساب">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </button>
              )}
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-[#d0d7e8] text-[#1a1f3c] text-[11px] font-semibold shadow-sm hover:bg-gray-50 transition-colors">
                <Icon.Logout />
                <span>تسجيل الخروج</span>
              </button>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold shadow-sm transition-colors"
                style={{ background: "linear-gradient(135deg,#2952e3,#7c3aed)", color: "white" }}>
                <Icon.ArrowLeft />
                <span>قائمة المستفيدين</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Admin Financial Management Section ──────────────── */}
      {onBack && (
        <section className="px-4 mb-1" dir="rtl">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px bg-[#e2e8f0]" />
            <span className="text-[11px] font-extrabold text-[#5a6282] px-2">إدارة الحساب المالي</span>
            <div className="flex-1 h-px bg-[#e2e8f0]" />
          </div>
          <div className="flex flex-col gap-3">

            {/* Add Profits */}
            <div className="bg-white rounded-2xl p-4 border border-[#e2e8f0] shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#dcfce7" }}>
                  <Icon.Gift />
                </div>
                <p className="font-bold text-[13px] text-[#1a1f3c]">إضافة أرباح</p>
              </div>
              <div className="mb-2 text-[10px] text-[#8892a4] font-semibold">الأرباح الحالية: <span className="text-[#16a34a] font-extrabold">{user.profits} ر.س</span></div>
              <input
                type="number"
                value={addProfitAmt}
                onChange={(e) => setAddProfitAmt(e.target.value)}
                placeholder="المبلغ المراد إضافته..."
                className="w-full px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[13px] font-semibold text-right outline-none focus:border-[#16a34a] mb-3"
                dir="rtl"
              />
              <button
                onClick={() => { if (addProfitAmt && Number(addProfitAmt) > 0) setAdminModal({ type: "add-profits" }); }}
                className="w-full py-2.5 rounded-xl text-white font-bold text-[13px] transition-opacity active:opacity-90"
                style={{ background: "linear-gradient(135deg,#0f7a38,#22c55e)" }}>
                إضافة الأرباح
              </button>
            </div>

            {/* Add Fees */}
            <div className="bg-white rounded-2xl p-4 border border-[#e2e8f0] shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#fef3c7" }}>
                  <Icon.Receipt />
                </div>
                <p className="font-bold text-[13px] text-[#1a1f3c]">إضافة رسوم</p>
              </div>
              <div className="mb-2 text-[10px] text-[#8892a4] font-semibold">الرسوم الحالية: <span className="text-[#ef4444] font-extrabold">{user.fees} ر.س</span></div>
              <input
                type="number"
                value={addFeesAmt}
                onChange={(e) => setAddFeesAmt(e.target.value)}
                placeholder="مبلغ الرسوم المراد إضافته..."
                className="w-full px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[13px] font-semibold text-right outline-none focus:border-[#d97706] mb-3"
                dir="rtl"
              />
              <button
                onClick={() => { if (addFeesAmt && Number(addFeesAmt) > 0) setAdminModal({ type: "add-fees" }); }}
                className="w-full py-2.5 rounded-xl text-white font-bold text-[13px] transition-opacity active:opacity-90"
                style={{ background: "linear-gradient(135deg,#d97706,#f59e0b)" }}>
                إضافة الرسوم
              </button>
            </div>

            {/* Pay Fees */}
            <div className="bg-white rounded-2xl p-4 border border-[#e2e8f0] shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#fef2f2" }}>
                  <Icon.AlertCircle />
                </div>
                <p className="font-bold text-[13px] text-[#1a1f3c]">رسوم السحب — المرحلة الثانية</p>
              </div>
              <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${
                  user.withdrawalFeeStatus === "paid"
                    ? "bg-green-100 text-green-700"
                    : user.withdrawalFeeStatus === "partial"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-600"
                }`}>
                  {user.withdrawalFeeStatus === "paid"
                    ? "✓ تم السداد"
                    : user.withdrawalFeeStatus === "partial"
                    ? "⚡ مسدد جزئياً (المتبقي)"
                    : "● غير مسددة"}
                </span>
                <span className="font-extrabold text-[15px] text-[#ef4444]">{user.fees} ر.س</span>
              </div>
              {user.withdrawalFeePaidAt && (
                <div className="mb-2 text-[10px] text-[#8892a4] font-semibold text-right">
                  تاريخ السداد: {new Date(user.withdrawalFeePaidAt).toLocaleString("ar-SA")}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPayAmountInput(user.fees ? user.fees.replace(/,/g, "") : "");
                    setAdminModal({ type: "pay-fees" });
                  }}
                  disabled={user.fees === "0" || user.withdrawalFeeStatus === "paid"}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-[13px] transition-opacity active:opacity-90 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#c8005a,#f0196e)" }}>
                  تأكيد سداد رسوم السحب
                </button>
                <button
                  onClick={() => void handleTogglePhase2()}
                  disabled={adminLoading}
                  className="px-3 py-2.5 rounded-xl text-white font-bold text-[12px] transition-opacity active:opacity-90 disabled:opacity-50"
                  style={{ background: user.phase2Visible ? "linear-gradient(135deg,#16a34a,#22c55e)" : "linear-gradient(135deg,#6b7280,#9ca3af)", minWidth: 70 }}>
                  {user.phase2Visible ? "🟢 ظاهر" : "⚫ مخفي"}
                </button>
              </div>
            </div>

            {/* Liberation Fee — Phase 2 (Admin Only) */}
            <div className="bg-white rounded-2xl p-4 border border-[#e2e8f0] shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#fdf2f8" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <p className="font-bold text-[13px] text-[#1a1f3c]">رسوم تحرير الأرباح — المرحلة الأولى</p>
              </div>
              <div className="mb-2 text-[10px] text-[#8892a4] font-semibold">الرسوم الحالية: <span className="text-[#8B1A1A] font-extrabold">{user.liberationFee} ر.س</span></div>
              <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl" style={{ background: "#fdf2f8", border: "1px solid #f5c6d8" }}>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${
                  user.liberationFeeStatus === "paid"
                    ? "bg-green-100 text-green-700"
                    : user.liberationFeeStatus === "partial"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-600"
                }`}>
                  {user.liberationFeeStatus === "paid"
                    ? "✓ تم السداد"
                    : user.liberationFeeStatus === "partial"
                    ? "⚡ مسدد جزئياً (المتبقي)"
                    : "● غير مسددة"}
                </span>
                <span className="font-extrabold text-[15px]" style={{ color: "#8B1A1A" }}>{user.liberationFee} ر.س</span>
              </div>
              {user.liberationFeePaidAt && (
                <div className="mb-2 text-[10px] text-[#8892a4] font-semibold text-right">
                  تاريخ السداد: {new Date(user.liberationFeePaidAt).toLocaleString("ar-SA")}
                </div>
              )}
              <input
                type="number"
                value={addLiberationAmt}
                onChange={(e) => setAddLiberationAmt(e.target.value)}
                placeholder="مبلغ رسوم التحرير..."
                className="w-full px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[13px] font-semibold text-right outline-none mb-2"
                dir="rtl"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { if (addLiberationAmt && Number(addLiberationAmt) > 0) setAdminModal({ type: "add-liberation-fee" }); }}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-[12px] transition-opacity active:opacity-90"
                  style={{ background: "linear-gradient(135deg,#7a1a1a,#8B1A1A)" }}>
                  إضافة رسوم التحرير
                </button>
                <button
                  onClick={() => {
                    setPayAmountInput(user.liberationFee ? user.liberationFee.replace(/,/g, "") : "");
                    setAdminModal({ type: "pay-liberation-fee" });
                  }}
                  disabled={user.liberationFee === "0" || user.liberationFeeStatus === "paid"}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-[12px] transition-opacity active:opacity-90 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#c8005a,#f0196e)" }}>
                  تأكيد السداد
                </button>
                <button
                  onClick={() => void handleTogglePhase1()}
                  disabled={adminLoading}
                  className="px-3 py-2.5 rounded-xl text-white font-bold text-[12px] transition-opacity active:opacity-90 disabled:opacity-50"
                  style={{ background: user.phase1Visible ? "linear-gradient(135deg,#16a34a,#22c55e)" : "linear-gradient(135deg,#6b7280,#9ca3af)", minWidth: 70 }}>
                  {user.phase1Visible ? "🟢 ظاهر" : "⚫ مخفي"}
                </button>
              </div>
            </div>

            {/* Transaction Fee — Phase 3 (Admin Only) */}
            <div className="bg-white rounded-2xl p-4 border border-[#e2e8f0] shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#fff8e1" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                </div>
                <p className="font-bold text-[13px] text-[#1a1f3c]">مبلغ المعاملة — المرحلة الثالثة</p>
              </div>
              <div className="mb-2 text-[10px] text-[#8892a4] font-semibold">المبلغ الحالي: <span className="text-[#92400e] font-extrabold">{user.transactionFee} ر.س</span></div>
              <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl" style={{ background: "#fff8e1", border: "1px solid #fde68a" }}>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${
                  user.transactionFeeStatus === "paid"
                    ? "bg-green-100 text-green-700"
                    : user.transactionFeeStatus === "partial"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-yellow-100 text-yellow-700"
                }`}>
                  {user.transactionFeeStatus === "paid"
                    ? "✓ تم السداد"
                    : user.transactionFeeStatus === "partial"
                    ? "⚡ مسدد جزئياً (المتبقي)"
                    : "● غير مسددة"}
                </span>
                <span className="font-extrabold text-[15px] text-[#92400e]">{user.transactionFee} ر.س</span>
              </div>
              {user.transactionFeePaidAt && (
                <div className="mb-2 text-[10px] text-[#8892a4] font-semibold text-right">
                  تاريخ السداد: {new Date(user.transactionFeePaidAt).toLocaleString("ar-SA")}
                </div>
              )}
              <input
                type="number"
                value={addTransactionAmt}
                onChange={(e) => setAddTransactionAmt(e.target.value)}
                placeholder="مبلغ المعاملة..."
                className="w-full px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[13px] font-semibold text-right outline-none mb-2"
                dir="rtl"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { if (addTransactionAmt && Number(addTransactionAmt) > 0) setAdminModal({ type: "add-transaction-fee" }); }}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-[12px] transition-opacity active:opacity-90"
                  style={{ background: "linear-gradient(135deg,#92400e,#d97706)" }}>
                  إضافة مبلغ المعاملة
                </button>
                <button
                  onClick={() => {
                    setPayAmountInput(user.transactionFee ? user.transactionFee.replace(/,/g, "") : "");
                    setAdminModal({ type: "pay-transaction-fee" });
                  }}
                  disabled={user.transactionFee === "0" || user.transactionFeeStatus === "paid"}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-[12px] transition-opacity active:opacity-90 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#0f7a38,#22c55e)" }}>
                  تأكيد السداد
                </button>
                <button
                  onClick={() => void handleTogglePhase3()}
                  disabled={adminLoading}
                  className="px-3 py-2.5 rounded-xl text-white font-bold text-[12px] transition-opacity active:opacity-90 disabled:opacity-50"
                  style={{ background: user.phase3Visible ? "linear-gradient(135deg,#16a34a,#22c55e)" : "linear-gradient(135deg,#6b7280,#9ca3af)", minWidth: 70 }}>
                  {user.phase3Visible ? "🟢 ظاهر" : "⚫ مخفي"}
                </button>
              </div>
            </div>

            {/* Custom Phases — Per-User Admin Controls */}
            {customPhases.map((phase) => {
              const ucp = userCustomPhases.find((p) => p.phaseId === phase.id);
              const accentColor = phase.cardColor || "#2952e3";
              const accentBg = phase.cardColor ? `${phase.cardColor}18` : "#f0f4ff";
              return (
                <div key={phase.id} className="bg-white rounded-2xl p-4 border border-[#e2e8f0] shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: accentBg }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <p className="font-bold text-[13px] text-[#1a1f3c]">{phase.name} — مرحلة مخصصة</p>
                  </div>
                  <div className="mb-2 text-[10px] text-[#8892a4] font-semibold">
                    المبلغ الحالي: <span className="font-extrabold" style={{ color: accentColor }}>{ucp?.amount ?? "0"} ر.س</span>
                  </div>
                  <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl"
                    style={{ background: accentBg, border: `1px solid ${accentColor}33` }}>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${
                      ucp?.status === "paid"
                        ? "bg-green-100 text-green-700"
                        : ucp?.status === "partial"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-600"
                    }`}>
                      {ucp?.status === "paid"
                        ? "✓ تم السداد"
                        : ucp?.status === "partial"
                        ? "⚡ مسدد جزئياً (المتبقي)"
                        : "● غير مسددة"}
                    </span>
                    <span className="font-extrabold text-[15px]" style={{ color: accentColor }}>{ucp?.amount ?? "0"} ر.س</span>
                  </div>
                  <input
                    type="number"
                    value={addCustomPhaseAmt}
                    onChange={(e) => setAddCustomPhaseAmt(e.target.value)}
                    placeholder="مبلغ المرحلة المخصصة..."
                    className="w-full px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[13px] font-semibold text-right outline-none mb-2"
                    dir="rtl"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (addCustomPhaseAmt && Number(addCustomPhaseAmt) > 0) setAdminModal({ type: "add-custom-phase-amount", phaseId: phase.id }); }}
                      className="flex-1 py-2.5 rounded-xl text-white font-bold text-[12px] transition-opacity active:opacity-90"
                      style={{ background: `linear-gradient(135deg,${accentColor},${accentColor}cc)` }}>
                      إضافة المبلغ
                    </button>
                    <button
                      onClick={() => {
                        setPayAmountInput(ucp?.amount ? ucp.amount.replace(/,/g, "") : "");
                        setAdminModal({ type: "pay-custom-phase", phaseId: phase.id });
                      }}
                      disabled={!ucp?.amount || ucp?.amount === "0" || ucp?.status === "paid"}
                      className="flex-1 py-2.5 rounded-xl text-white font-bold text-[12px] transition-opacity active:opacity-90 disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg,#c8005a,#f0196e)" }}>
                      تأكيد السداد
                    </button>
                    <button
                      onClick={() => void handleToggleCustomPhase(phase.id)}
                      disabled={adminLoading}
                      className="px-3 py-2.5 rounded-xl text-white font-bold text-[12px] transition-opacity active:opacity-90 disabled:opacity-50"
                      style={{ background: ucp?.visible ? "linear-gradient(135deg,#16a34a,#22c55e)" : "linear-gradient(135deg,#6b7280,#9ca3af)", minWidth: 70 }}>
                      {ucp?.visible ? "🟢 ظاهر" : "⚫ مخفي"}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Financial Transaction Log Button */}
            <button
              onClick={() => void loadTransactionLog()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-bold text-[13px] transition-opacity active:opacity-90"
              style={{ background: "linear-gradient(135deg,#1a1f3c,#2952e3)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              سجل العمليات المالية
            </button>

          </div>
        </section>
      )}

      <main className="flex flex-col gap-5 pb-8">
        {/* Financial Operations */}
        <section className="px-4">
          <h2 className="text-[15px] font-bold text-[#1a1f3c] mb-3.5 text-right">العمليات المالية</h2>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowWithdraw(true)}
              className="w-full flex items-center justify-center gap-3 px-6 py-[14px] rounded-2xl text-white font-bold text-[14px] shadow-md active:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(135deg,#c8005a 0%,#f0196e 50%,#ff4d88 100%)" }}>
              <Icon.ArrowLeft /><span>سحب الأموال</span>
            </button>
            <button
              onClick={() => {
                setDepositStep("choose");
                setDepositRequestSent(null);
                setShowDepositModal(true);
              }}
              className="w-full flex items-center justify-center gap-3 px-6 py-[14px] rounded-2xl text-white font-bold text-[14px] shadow-md active:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(135deg,#0f7a38 0%,#16a34a 50%,#22c55e 100%)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
              </svg>
              <span>إيداع الأموال</span>
            </button>
          </div>
        </section>

        {/* Account Overview */}
        <section className="px-4">
          <h2 className="text-[15px] font-bold text-[#1a1f3c] mb-4 text-right">نظرة عامة على الحساب</h2>
          <div className="flex flex-col gap-4">
            {/* Profits */}
            <div className="rounded-3xl p-5 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg,#0b7a44 0%,#0fa558 40%,#14c46a 70%,#2dd87e 100%)" }}>
              <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-20" style={{ background: "rgba(255,255,255,0.3)" }} />
              <div className="flex items-start justify-between mb-7 relative z-10">
                <CardIconBtn><Icon.TrendingUp /></CardIconBtn>
                <span className="bg-white/25 text-white text-[10px] font-bold px-3 py-1 rounded-lg">12.5%+</span>
              </div>
              <div className="text-right relative z-10">
                <p className="text-white/80 text-[11px] font-medium mb-1">أرباح الاشتراك</p>
                <p className="text-white font-extrabold leading-none" style={{ fontSize: "1.95rem" }}>
                  {user.profits} <span className="text-[19px]">ر.س</span>
                </p>
                <p className="text-white/70 text-[11px] font-medium mt-2">متاح للسحب الفوري</p>
              </div>
            </div>

            {/* Subscription */}
            <div className="rounded-3xl p-5 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg,#2952e3 0%,#4f46e5 40%,#7c3aed 100%)" }}>
              <div className="absolute -bottom-10 -right-6 w-40 h-40 rounded-full opacity-10" style={{ background: "rgba(255,255,255,0.5)" }} />
              <div className="flex items-start justify-between mb-7 relative z-10">
                <CardIconBtn bg="rgba(255,255,255,0.22)"><Icon.Dollar /></CardIconBtn>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 block shadow-sm shadow-emerald-300 mt-1" />
              </div>
              <div className="text-right relative z-10">
                <p className="text-white/80 text-[11px] font-medium mb-1">مبلغ الاشتراك</p>
                <p className="text-white font-extrabold leading-none" style={{ fontSize: "1.95rem" }}>
                  {user.subscription} <span className="text-[19px]">ر.س</span>
                </p>
                <p className="text-white/70 text-[11px] font-medium mt-2">اشتراك نشط</p>
              </div>
            </div>

            {/* Liberation Fee Card — Phase 1 */}
            {user.phase1Visible && (() => {
              const paid = user.liberationFeeStatus === "paid";
              const isPartial = !paid && user.liberationFeeStatus === "partial";
              const done = paid && isPast24h(user.liberationFeePaidAt);
              const bg = done
                ? "linear-gradient(135deg,#166534 0%,#16a34a 60%,#22c55e 100%)"
                : paid
                ? "linear-gradient(135deg,#1e4d8c 0%,#2563eb 60%,#3b82f6 100%)"
                : isPartial
                ? "linear-gradient(135deg,#78350f 0%,#92400e 40%,#b45309 70%,#d97706 100%)"
                : "linear-gradient(135deg,#4a0a0a 0%,#7a1212 40%,#8B1A1A 70%,#a52020 100%)";
              return (
                <div className="rounded-3xl p-5 relative overflow-hidden" style={{ background: bg }}>
                  <div className="absolute -bottom-8 -left-6 w-36 h-36 rounded-full opacity-15" style={{ background: "rgba(255,255,255,0.3)" }} />
                  <div className="flex items-start justify-between mb-7 relative z-10">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                      style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
                      {done ? <Icon.CheckCircle /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                    </div>
                    <span className="text-white text-[10px] font-bold px-3 py-1 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.2)" }}>
                      {done ? "✅ تمت المعالجة" : paid ? "✅ تم السداد" : isPartial ? "⚡ مسدد جزئياً (متبقي)" : "⚠️ مطلوب"}
                    </span>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="text-white/80 text-[11px] font-medium mb-1">رسوم تحرير الأرباح</p>
                    {done ? (
                      <>
                        <p className="text-white font-extrabold text-[20px] leading-snug">تم سداد رسوم تحرير الأرباح ✔</p>
                        <p className="text-white/80 text-[11px] font-medium mt-2">تم ✔ معالجة طلبك بنجاح</p>
                      </>
                    ) : (
                      <>
                        <p className="text-white font-extrabold leading-none" style={{ fontSize: "1.95rem" }}>
                          {user.liberationFee} <span className="text-[19px]">ر.س</span>
                        </p>
                        <p className="text-white/70 text-[11px] font-medium mt-2">
                          {paid ? "جاري معالجة طلبك" : isPartial ? "تم سداد دفعة جزئية — المتبقي مطلوب للسداد" : "مطلوبة لتحرير الأرباح"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Withdrawal Fee Card — Phase 2 (shown when admin activates) */}
            {user.phase2Visible && (() => {
              const paid = user.withdrawalFeeStatus === "paid";
              const isPartial = !paid && user.withdrawalFeeStatus === "partial";
              const done = paid && isPast24h(user.withdrawalFeePaidAt);
              const bg = done
                ? "linear-gradient(135deg,#166534 0%,#16a34a 60%,#22c55e 100%)"
                : paid
                ? "linear-gradient(135deg,#1e4d8c 0%,#2563eb 60%,#3b82f6 100%)"
                : isPartial
                ? "linear-gradient(135deg,#b45309 0%,#d97706 40%,#f59e0b 70%,#fbbf24 100%)"
                : "linear-gradient(135deg,#c41e1e 0%,#e83030 30%,#f05a1a 70%,#f97316 100%)";
              return (
                <div className="rounded-3xl p-5 relative overflow-hidden" style={{ background: bg }}>
                  <div className="absolute -bottom-8 -left-6 w-36 h-36 rounded-full opacity-10" style={{ background: "rgba(255,255,255,0.4)" }} />
                  <div className="flex items-start justify-between mb-7 relative z-10">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                      style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.2)" }}>
                      {done ? <Icon.CheckCircle /> : <Icon.AlertCircle />}
                    </div>
                    <span className="text-white text-[10px] font-bold px-3 py-1 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
                      {done ? "✅ تمت المعالجة" : paid ? "✅ تم السداد" : isPartial ? "⚡ مسدد جزئياً (متبقي)" : "🔴 مطلوب"}
                    </span>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="text-white/80 text-[11px] font-medium mb-1">رسوم السحب</p>
                    {done ? (
                      <>
                        <p className="text-white font-extrabold text-[20px] leading-snug">تم سداد رسوم السحب ✔</p>
                        <p className="text-white/80 text-[11px] font-medium mt-2">تم ✔ معالجة طلبك بنجاح</p>
                      </>
                    ) : (
                      <>
                        <p className="text-white font-extrabold leading-none" style={{ fontSize: "1.95rem" }}>
                          {user.fees} <span className="text-[19px]">ر.س</span>
                        </p>
                        <p className="text-white/70 text-[11px] font-medium mt-2">
                          {paid ? "جاري معالجة طلبك" : isPartial ? "تم سداد دفعة جزئية — المتبقي مطلوب للسداد" : "يرجى سداد رسوم السحب"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Transaction Fee Card — Phase 3 (shown when admin activates) */}
            {user.phase3Visible && (() => {
              const paid = user.transactionFeeStatus === "paid";
              const isPartial = !paid && user.transactionFeeStatus === "partial";
              const done = paid && isPast24h(user.transactionFeePaidAt);
              const bg = done
                ? "linear-gradient(135deg,#166534 0%,#16a34a 60%,#22c55e 100%)"
                : paid
                ? "linear-gradient(135deg,#1e4d8c 0%,#2563eb 60%,#3b82f6 100%)"
                : isPartial
                ? "linear-gradient(135deg,#78350f 0%,#92400e 40%,#b45309 70%,#d97706 100%)"
                : "linear-gradient(135deg,#78350f 0%,#92400e 40%,#b45309 70%,#d97706 100%)";
              return (
                <div className="rounded-3xl p-5 relative overflow-hidden" style={{ background: bg }}>
                  <div className="absolute -bottom-8 -left-6 w-36 h-36 rounded-full opacity-10" style={{ background: "rgba(255,255,255,0.4)" }} />
                  <div className="flex items-start justify-between mb-7 relative z-10">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                      style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
                      {done ? <Icon.CheckCircle /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
                    </div>
                    <span className="text-white text-[10px] font-bold px-3 py-1 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
                      {done ? "✅ تمت المعالجة" : paid ? "✅ تم السداد" : isPartial ? "⚡ مسدد جزئياً (متبقي)" : "⚠️ مطلوب"}
                    </span>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="text-white/80 text-[11px] font-medium mb-1">مبلغ المعاملة</p>
                    {done ? (
                      <>
                        <p className="text-white font-extrabold text-[20px] leading-snug">تم دفع مبلغ المعاملة ✔</p>
                        <p className="text-white/80 text-[11px] font-medium mt-2">تم ✔ معالجة طلبك بنجاح</p>
                      </>
                    ) : (
                      <>
                        <p className="text-white font-extrabold leading-none" style={{ fontSize: "1.95rem" }}>
                          {user.transactionFee} <span className="text-[19px]">ر.س</span>
                        </p>
                        <p className="text-white/70 text-[11px] font-medium mt-2">
                          {paid ? "جاري معالجة طلبك" : isPartial ? "تم سداد دفعة جزئية — المتبقي مطلوب للسداد" : "مطلوب لإتمام تحويل الأرباح"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Custom Phase Cards */}
            {customPhases.map((phase) => {
              const ucp = userCustomPhases.find((p) => p.phaseId === phase.id);
              if (!ucp?.visible) return null;
              const paid = ucp.status === "paid";
              const isPartial = !paid && ucp.status === "partial";
              const done = paid && isPast24h(ucp.paidAt);
              const bg = done
                ? "linear-gradient(135deg,#166534 0%,#16a34a 60%,#22c55e 100%)"
                : paid
                ? "linear-gradient(135deg,#1e4d8c 0%,#2563eb 60%,#3b82f6 100%)"
                : makeCardGradient(phase.cardColor);
              return (
                <div key={phase.id} className="rounded-3xl p-5 relative overflow-hidden" style={{ background: bg }}>
                  <div className="absolute -bottom-8 -left-6 w-36 h-36 rounded-full opacity-10" style={{ background: "rgba(255,255,255,0.4)" }} />
                  <div className="flex items-start justify-between mb-7 relative z-10">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                      style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)" }}>
                      {done ? <Icon.CheckCircle /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                    </div>
                    <span className="text-white text-[10px] font-bold px-3 py-1 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
                      {done ? "✅ تمت المعالجة" : paid ? "✅ تم السداد" : isPartial ? "⚡ مسدد جزئياً (متبقي)" : "⚠️ مطلوب"}
                    </span>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="text-white/80 text-[11px] font-medium mb-1">{phase.name}</p>
                    {done ? (
                      <>
                        <p className="text-white font-extrabold text-[20px] leading-snug">تم دفع مبلغ {phase.name} ✔</p>
                        <p className="text-white/80 text-[11px] font-medium mt-2">تم ✔ معالجة طلبك بنجاح</p>
                      </>
                    ) : (
                      <>
                        <p className="text-white font-extrabold leading-none" style={{ fontSize: "1.95rem" }}>
                          {ucp.amount} <span className="text-[19px]">ر.س</span>
                        </p>
                        <p className="text-white/70 text-[11px] font-medium mt-2">
                          {paid ? "جاري معالجة طلبك" : isPartial ? "تم سداد دفعة جزئية — المتبقي مطلوب للسداد" : "مطلوب لإتمام تحويل الأرباح"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Bank Card */}
            <div className="rounded-3xl p-5 relative overflow-hidden transition-all"
              style={{ background: "linear-gradient(135deg,#5b21b6 0%,#7c3aed 40%,#9333ea 80%,#a855f7 100%)" }}>
              <div className="absolute -bottom-10 -right-8 w-44 h-44 rounded-full opacity-10 pointer-events-none" style={{ background: "rgba(255,255,255,0.5)" }} />
              <div
                onClick={() => setIsBankCardCollapsed((v) => !v)}
                className="flex items-center justify-between cursor-pointer relative z-10 select-none"
              >
                <div className="flex items-center gap-2">
                  <CardIconBtn bg="rgba(255,255,255,0.22)"><Icon.CreditCard /></CardIconBtn>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white bg-white/20 transition-transform duration-200 ${isBankCardCollapsed ? "rotate-180" : ""}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/80 text-[11px] font-semibold">متصل</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 block" />
                </div>
              </div>

              {!isBankCardCollapsed && (
                <div className="text-right relative z-10 space-y-3.5 mt-4 pt-3 border-t border-white/10">
                  <div>
                    <p className="text-white/60 text-[10px] font-medium mb-0.5">اسم صاحب الحساب</p>
                    <p className="text-white font-bold text-[17px] leading-snug">{user.accountHolder}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-[10px] font-medium mb-1">رقم الإيبان</p>
                    <p className="text-white font-bold text-[15px] leading-snug" dir="ltr"
                      style={{ textAlign: "right", letterSpacing: "0.07em" }}>
                      {user.iban}
                    </p>
                  </div>
                  <p className="text-white/60 text-[10px] font-medium">حساب بنكي مربوط</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Account Info */}
        <section className="px-4 pb-8">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#e2e8f0] transition-all">
            <div
              onClick={() => setIsAccountInfoCollapsed((v) => !v)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[#64748b] bg-gray-100 transition-transform duration-200 ${isAccountInfoCollapsed ? "rotate-180" : ""}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
              <div className="text-right">
                <h2 className="text-[17px] font-bold text-[#1a1f3c]">معلومات الحساب</h2>
                <p className="text-[11px] text-[#8892a4] mt-0.5 font-medium">تفاصيل حسابك الشخصي</p>
              </div>
            </div>

            {!isAccountInfoCollapsed && (
              <div className="flex flex-col gap-4 mt-4 pt-4 border-t border-[#f1f5f9]">
                {[
                  { label: "اسم العميل", value: user.name },
                  { label: "رقم الإيبان", value: user.iban, ltr: true },
                  { label: "مبلغ الاشتراك", value: `${user.subscription} ر.س` },
                  { label: "رقم الهاتف", value: user.phone, ltr: true },
                ].map((f) => (
                  <div key={f.label} className="text-right">
                    <label className="block text-[10px] font-semibold text-[#8892a4] mb-1.5">{f.label}</label>
                    <div
                      className="w-full px-4 py-2.5 rounded-xl bg-[#f3f5fa] border border-[#e2e8f0] text-[#1a1f3c] font-semibold text-[12px]"
                      dir={f.ltr ? "ltr" : "rtl"}
                      style={{ textAlign: f.ltr ? "left" : "right" }}
                    >
                      {f.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ── Popup Notification (on login) ──────────────────── */}
      {showPopup && popupNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ background: "rgba(10,15,40,0.6)", backdropFilter: "blur(5px)", fontFamily: "'Cairo', sans-serif" }}
          dir="rtl">
          <div className="w-full max-w-xs bg-white rounded-3xl overflow-hidden shadow-2xl"
            style={{ animation: "popIn 0.3s cubic-bezier(.175,.885,.32,1.275)" }}>
            <div className="px-5 pt-6 pb-3 text-center"
              style={{ background: popupNotif.type === "profits_added" ? "linear-gradient(135deg,#0f7a38,#22c55e)" : popupNotif.type === "deposit_ready" ? "linear-gradient(135deg,#059669,#10b981)" : "linear-gradient(135deg,#2952e3,#7c3aed)" }}>
              <div className="text-[36px] mb-1">{popupNotif.type === "profits_added" ? "🎉" : popupNotif.type === "deposit_ready" ? "💳" : "📢"}</div>
              <p className="text-white font-extrabold text-[15px]">إشعار جديد</p>
            </div>
            <div className="px-5 py-5">
              <p className="font-extrabold text-[14px] text-[#1a1f3c] mb-3 text-center">{popupNotif.title}</p>
              <div className="rounded-2xl p-4 mb-4 text-right text-[13px] leading-relaxed whitespace-pre-line font-medium text-[#374151]"
                style={{
                  background: popupNotif.type === "profits_added" ? "#f0fdf4" : popupNotif.type === "deposit_ready" ? "#f0fdf4" : "#eff6ff",
                  border: `1.5px solid ${popupNotif.type === "profits_added" ? "#bbf7d0" : popupNotif.type === "deposit_ready" ? "#bbf7d0" : "#bfdbfe"}`
                }}>
                {popupNotif.message}
              </div>
              <button onClick={() => void dismissPopup()}
                className="w-full py-3 rounded-2xl text-white font-bold text-[14px] transition-opacity active:opacity-90"
                style={{ background: popupNotif.type === "profits_added" ? "linear-gradient(135deg,#0f7a38,#22c55e)" : popupNotif.type === "deposit_ready" ? "linear-gradient(135deg,#059669,#10b981)" : "linear-gradient(135deg,#2952e3,#7c3aed)" }}>
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notification Panel ──────────────────────────────── */}
      {showNotifPanel && (
        <div className="fixed inset-0 z-50 flex" dir="rtl"
          style={{ fontFamily: "'Cairo', sans-serif" }}>
          <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={() => setShowNotifPanel(false)} />
          <div className="w-full max-w-sm bg-white h-full overflow-y-auto flex flex-col shadow-2xl"
            style={{ animation: "slideInRight 0.25s ease-out" }}>
            <style>{`@keyframes slideInRight { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }`}</style>
            {/* Panel Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef0f6] sticky top-0 bg-white z-10">
              <button onClick={() => setShowNotifPanel(false)}
                className="w-8 h-8 rounded-full bg-[#f3f5fa] flex items-center justify-center text-[#5a6282]">
                <Icon.X />
              </button>
              <h2 className="font-extrabold text-[16px] text-[#1a1f3c]">الإشعارات</h2>
              <div className="w-8 h-8 rounded-full bg-[#f3f5fa] flex items-center justify-center">
                <Icon.Bell />
              </div>
            </div>
            {/* Notifications list */}
            <div className="flex flex-col gap-0 flex-1">
              {notifications.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-[#8892a4]">
                  <div className="text-[40px] mb-3">🔔</div>
                  <p className="font-bold text-[13px]">لا توجد إشعارات</p>
                </div>
              )}
              {notifications.map((n) => {
                const { date, time } = fmtNotifDate(n.createdAt);
                return (
                  <div key={n.id} className="px-5 py-4 border-b border-[#eef0f6] text-right"
                    style={{ background: n.isRead ? "white" : "#f5f7ff" }}>
                    <div className="flex items-start gap-3">
                      <div className="text-[24px] flex-shrink-0 mt-0.5">
                        {n.type === "profits_added" ? "🎉" : n.type === "deposit_ready" ? "💳" : "📢"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${n.isRead ? "bg-[#f3f5fa] text-[#8892a4]" : "bg-blue-100 text-blue-700"}`}>
                            {n.isRead ? "✓ مقروء" : "● غير مقروء"}
                          </span>
                          <p className="font-extrabold text-[13px] text-[#1a1f3c]">{n.title}</p>
                        </div>
                        <p className="text-[11px] text-[#5a6282] font-medium leading-relaxed whitespace-pre-line mb-2">{n.message}</p>
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[10px] text-[#8892a4] font-medium">{time}</span>
                          <span className="text-[10px] text-[#8892a4]">—</span>
                          <span className="text-[10px] text-[#8892a4] font-medium">{date}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Confirmation Modal ─────────────────────────── */}
      {/* ── Admin Confirmation Modal ─────────────────────────── */}
      {adminModal && (() => {
        const isPayFees = adminModal.type === "pay-fees";
        const isPayLib = adminModal.type === "pay-liberation-fee";
        const isPayTx = adminModal.type === "pay-transaction-fee";
        const isPayCustom = adminModal.type === "pay-custom-phase";
        const isPayModal = isPayFees || isPayLib || isPayTx || isPayCustom;

        const customPhaseObj = isPayCustom ? customPhases.find((p) => p.id === adminModal.phaseId) : null;
        const customUcpObj = isPayCustom ? userCustomPhases.find((p) => p.phaseId === adminModal.phaseId) : null;

        const currentRequiredStr = isPayFees
          ? user.fees
          : isPayLib
          ? user.liberationFee
          : isPayTx
          ? user.transactionFee
          : isPayCustom
          ? (customUcpObj?.amount ?? "0")
          : "0";

        const currentRequiredNum = parseFloat(String(currentRequiredStr).replace(/,/g, "")) || 0;
        const enteredPayNum = parseFloat(payAmountInput.replace(/,/g, "")) || 0;
        const remainingNum = Math.max(0, currentRequiredNum - enteredPayNum);
        const isPartial = isPayModal && enteredPayNum > 0 && enteredPayNum < currentRequiredNum;
        const isFull = isPayModal && enteredPayNum >= currentRequiredNum;
        const isPayInvalid = isPayModal && (isNaN(enteredPayNum) || enteredPayNum <= 0 || enteredPayNum > currentRequiredNum);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(10,15,40,0.6)", backdropFilter: "blur(4px)", fontFamily: "'Cairo', sans-serif" }}
            dir="rtl">
            <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
              style={{ animation: "popIn 0.25s cubic-bezier(.175,.885,.32,1.275)" }}>
              <div className="px-5 py-4 text-center border-b border-[#eef0f6]"
                style={{ background:
                  adminModal.type === "add-profits" ? "linear-gradient(135deg,#0f7a38,#22c55e)"
                  : adminModal.type === "add-fees" ? "linear-gradient(135deg,#d97706,#f59e0b)"
                  : adminModal.type === "add-liberation-fee" || adminModal.type === "pay-liberation-fee" ? "linear-gradient(135deg,#4a0a0a,#8B1A1A)"
                  : adminModal.type === "add-transaction-fee" || adminModal.type === "pay-transaction-fee" ? "linear-gradient(135deg,#78350f,#d97706)"
                  : adminModal.type === "add-custom-phase-amount" || adminModal.type === "pay-custom-phase"
                    ? makeCardGradient(customPhases.find((p) => p.id === adminModal.phaseId)?.cardColor ?? null)
                  : "linear-gradient(135deg,#c8005a,#f0196e)"
                }}>
                <p className="text-white font-extrabold text-[15px]">
                  {adminModal.type === "add-profits" ? "تأكيد إضافة الأرباح"
                    : adminModal.type === "add-fees" ? "تأكيد إضافة الرسوم"
                    : adminModal.type === "pay-fees" ? "سداد رسوم السحب (المرحلة الثانية)"
                    : adminModal.type === "add-liberation-fee" ? "تأكيد إضافة رسوم التحرير"
                    : adminModal.type === "pay-liberation-fee" ? "سداد رسوم التحرير (المرحلة الأولى)"
                    : adminModal.type === "add-transaction-fee" ? "تأكيد إضافة مبلغ المعاملة"
                    : adminModal.type === "pay-transaction-fee" ? "سداد مبلغ المعاملة (المرحلة الثالثة)"
                    : adminModal.type === "add-custom-phase-amount" ? `تأكيد إضافة مبلغ ${customPhases.find((p) => p.id === adminModal.phaseId)?.name ?? "المرحلة"}`
                    : `سداد ${customPhases.find((p) => p.id === adminModal.phaseId)?.name ?? "المرحلة المخصصة"}`}
                </p>
              </div>
              <div className="px-5 py-5">
                {adminModal.type === "add-profits" && (
                  <div className="rounded-2xl p-4 mb-4 text-right" style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}>
                    <p className="text-[12px] font-semibold text-[#374151] mb-1">المبلغ المراد إضافته:</p>
                    <p className="font-extrabold text-[20px] text-[#16a34a]">{Number(addProfitAmt).toLocaleString("en-US")} ر.س</p>
                    <div className="mt-3 flex flex-col gap-1">
                      <p className="text-[11px] text-[#16a34a] font-semibold">✓ تحديث إجمالي الأرباح</p>
                      <p className="text-[11px] text-[#16a34a] font-semibold">✓ إرسال إشعار للمستفيد</p>
                      <p className="text-[11px] text-[#16a34a] font-semibold">✓ تسجيل العملية في السجل المالي</p>
                    </div>
                  </div>
                )}
                {adminModal.type === "add-fees" && (
                  <div className="rounded-2xl p-4 mb-4 text-right" style={{ background: "#fef3c7", border: "1.5px solid #fde68a" }}>
                    <p className="text-[12px] font-semibold text-[#374151] mb-1">مبلغ رسوم السحب:</p>
                    <p className="font-extrabold text-[20px] text-[#d97706]">{Number(addFeesAmt).toLocaleString("en-US")} ر.س</p>
                  </div>
                )}
                {adminModal.type === "add-liberation-fee" && (
                  <div className="rounded-2xl p-4 mb-4 text-right" style={{ background: "#fdf2f8", border: "1.5px solid #f5c6d8" }}>
                    <p className="text-[12px] font-semibold text-[#374151] mb-1">مبلغ رسوم التحرير:</p>
                    <p className="font-extrabold text-[20px]" style={{ color: "#8B1A1A" }}>{Number(addLiberationAmt).toLocaleString("en-US")} ر.س</p>
                  </div>
                )}
                {adminModal.type === "add-transaction-fee" && (
                  <div className="rounded-2xl p-4 mb-4 text-right" style={{ background: "#fff8e1", border: "1.5px solid #fde68a" }}>
                    <p className="text-[12px] font-semibold text-[#374151] mb-1">مبلغ المعاملة:</p>
                    <p className="font-extrabold text-[20px] text-[#92400e]">{Number(addTransactionAmt).toLocaleString("en-US")} ر.س</p>
                  </div>
                )}
                {adminModal.type === "add-custom-phase-amount" && (() => {
                  const ph = customPhases.find((p) => p.id === adminModal.phaseId);
                  const color = ph?.cardColor || "#2952e3";
                  return (
                    <div className="rounded-2xl p-4 mb-4 text-right" style={{ background: `${color}12`, border: `1.5px solid ${color}44` }}>
                      <p className="text-[12px] font-semibold text-[#374151] mb-1">مبلغ {ph?.name ?? "المرحلة المخصصة"}:</p>
                      <p className="font-extrabold text-[20px]" style={{ color }}>{Number(addCustomPhaseAmt).toLocaleString("en-US")} ر.س</p>
                    </div>
                  );
                })()}

                {/* ── Interactive Payment Form (Full or Partial) ── */}
                {isPayModal && (
                  <div className="rounded-2xl p-4 mb-4 text-right"
                    style={{
                      background: isPayFees ? "#fef2f2" : isPayLib ? "#fdf2f8" : isPayTx ? "#fff8e1" : `${customPhaseObj?.cardColor || "#2952e3"}12`,
                      border: `1.5px solid ${isPayFees ? "#fecaca" : isPayLib ? "#f5c6d8" : isPayTx ? "#fde68a" : `${customPhaseObj?.cardColor || "#2952e3"}44`}`
                    }}>
                    {/* Current Required Fee */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/10">
                      <span className="font-extrabold text-[18px]" style={{
                        color: isPayFees ? "#ef4444" : isPayLib ? "#8B1A1A" : isPayTx ? "#92400e" : (customPhaseObj?.cardColor || "#2952e3")
                      }}>
                        {currentRequiredStr} ر.س
                      </span>
                      <span className="text-[12px] font-bold text-[#475569]">المبلغ المطلوب حالياً:</span>
                    </div>

                    {/* Partial Payment Input Field */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <button
                          type="button"
                          onClick={() => setPayAmountInput(String(currentRequiredNum))}
                          className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg bg-white border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc] transition-colors shadow-sm"
                        >
                          كامل المبلغ
                        </button>
                        <label className="text-[12px] font-bold text-[#1e293b]">المبلغ المراد سداده الآن:</label>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          value={payAmountInput}
                          onChange={(e) => setPayAmountInput(e.target.value)}
                          placeholder="أدخل مبلغ السداد..."
                          className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#cbd5e1] bg-white text-[#1a1f3c] text-[15px] font-extrabold text-right outline-none focus:border-[#2952e3] focus:ring-2 focus:ring-[#2952e3]/20 transition-all"
                          dir="rtl"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#64748b]">ر.س</span>
                      </div>
                    </div>

                    {/* Dynamic calculation result */}
                    {isPartial && (
                      <div className="rounded-xl p-3 bg-amber-50 border border-amber-200 mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold text-[15px] text-amber-700">{remainingNum.toLocaleString("en-US")} ر.س</span>
                          <span className="text-[11px] font-bold text-amber-900">المبلغ المتبقي بعد السداد:</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 mt-2">
                          <span>⚡</span>
                          <span>سداد جزئي: ستتحول الحالة إلى "مسدد جزئياً"</span>
                        </div>
                        <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
                          سيصل إشعار للمستفيد بالمبلغ المسدد ({enteredPayNum.toLocaleString("en-US")} ر.س) والمتبقي ({remainingNum.toLocaleString("en-US")} ر.س)، وتتحدث رسالة التنبيه تلقائياً بالمبلغ المتبقي.
                        </p>
                      </div>
                    )}

                    {isFull && (
                      <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200 mb-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                          <span>✓</span>
                          <span>سداد كامل المبلغ (المتبقي: 0 ر.س)</span>
                        </div>
                        <p className="text-[10px] text-emerald-700 mt-1">
                          سيتم اعتماد سداد كامل المبلغ واعتبار المرحلة مكتملة بالكامل والانتقال للمرحلة التالية.
                        </p>
                      </div>
                    )}

                    {isPayInvalid && (
                      <div className="rounded-xl p-2.5 bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold">
                        {enteredPayNum > currentRequiredNum
                          ? `لا يمكن أن يتجاوز مبلغ السداد المبلغ المطلوب (${currentRequiredStr} ر.س)`
                          : "يرجى إدخال مبلغ سداد صحيح أكبر من 0"}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setAdminModal(null)} disabled={adminLoading}
                    className="flex-1 py-2.5 rounded-xl border border-[#e2e8f0] text-[#5a6282] font-bold text-[13px] hover:bg-[#f3f5fa] transition-colors disabled:opacity-50">
                    إلغاء
                  </button>
                  <button
                    onClick={() => void handleAdminFinancial()}
                    disabled={adminLoading || (isPayModal && isPayInvalid)}
                    className="flex-1 py-2.5 rounded-xl text-white font-bold text-[13px] transition-opacity active:opacity-90 disabled:opacity-50"
                    style={{ background: adminModal.type === "add-profits" ? "linear-gradient(135deg,#0f7a38,#22c55e)" : adminModal.type === "add-fees" ? "linear-gradient(135deg,#d97706,#f59e0b)" : adminModal.type === "add-liberation-fee" || adminModal.type === "pay-liberation-fee" ? "linear-gradient(135deg,#4a0a0a,#8B1A1A)" : adminModal.type === "add-transaction-fee" || adminModal.type === "pay-transaction-fee" ? "linear-gradient(135deg,#78350f,#d97706)" : "linear-gradient(135deg,#c8005a,#f0196e)" }}>
                    {adminLoading
                      ? "جارٍ..."
                      : isPayModal
                      ? isPartial
                        ? `تأكيد السداد الجزئي (${enteredPayNum.toLocaleString("en-US")} ر.س)`
                        : "تأكيد السداد بالكامل"
                      : "تأكيد"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Financial Transaction Log Panel ──────────────────── */}
      {showTransactionLog && (
        <div className="fixed inset-0 z-50 flex" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
          <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={() => setShowTransactionLog(false)} />
          <div className="w-full max-w-sm bg-white h-full overflow-y-auto flex flex-col shadow-2xl"
            style={{ animation: "slideInRight 0.25s ease-out" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef0f6] sticky top-0 bg-white z-10"
              style={{ background: "linear-gradient(135deg,#1a1f3c,#2952e3)" }}>
              <button onClick={() => setShowTransactionLog(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: "rgba(255,255,255,0.2)" }}>
                <Icon.X />
              </button>
              <h2 className="font-extrabold text-[15px] text-white">سجل العمليات المالية</h2>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
            </div>
            <div className="flex flex-col flex-1">
              {transactionLog.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-[#8892a4]">
                  <div className="text-[40px] mb-3">📋</div>
                  <p className="font-bold text-[13px]">لا توجد عمليات مسجلة</p>
                </div>
              )}
              {transactionLog.map((tx) => {
                const d = new Date(tx.createdAt);
                const typeLabel: Record<string, { label: string; color: string; bg: string }> = {
                  add_profits: { label: "إضافة أرباح", color: "#16a34a", bg: "#f0fdf4" },
                  add_fees: { label: "إضافة رسوم سحب", color: "#d97706", bg: "#fef3c7" },
                  pay_withdrawal_fees: { label: "سداد رسوم السحب", color: "#c8005a", bg: "#fef2f2" },
                  add_liberation_fee: { label: "إضافة رسوم التحرير", color: "#8B1A1A", bg: "#fdf2f8" },
                  pay_liberation_fee: { label: "سداد رسوم التحرير", color: "#7c3aed", bg: "#f5f3ff" },
                  add_transaction_fee: { label: "إضافة مبلغ المعاملة", color: "#92400e", bg: "#fff8e1" },
                  pay_transaction_fee: { label: "سداد مبلغ المعاملة", color: "#0f7a38", bg: "#dcfce7" },
                };
                const meta = typeLabel[tx.type] ?? { label: tx.type, color: "#5a6282", bg: "#f3f5fa" };
                const isConfirming = undoTxId === tx.id;
                return (
                  <div key={tx.id} className="px-5 py-4 border-b border-[#eef0f6] text-right"
                    style={{ background: isConfirming ? "#fff7f7" : "white", transition: "background 0.2s" }}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: meta.bg, border: `1.5px solid ${meta.color}22` }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-extrabold" style={{ color: meta.color }}>{tx.amount} ر.س</span>
                            {onBack && !isConfirming && (
                              <button
                                onClick={() => setUndoTxId(tx.id)}
                                title="التراجع عن هذه العملية"
                                className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50"
                                style={{ border: "1px solid #fca5a5" }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
                              </button>
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-[#1a1f3c]">{meta.label}</span>
                        </div>
                        <p className="text-[11px] text-[#5a6282] font-medium mb-1">{tx.description}</p>
                        <p className="text-[10px] text-[#8892a4]">{d.toLocaleString("ar-SA")}</p>
                        {isConfirming && (
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button
                              onClick={() => setUndoTxId(null)}
                              disabled={undoLoading}
                              className="px-3 py-1 rounded-lg text-[11px] font-bold text-[#5a6282] border border-[#e2e8f0] hover:bg-[#f3f5fa] transition-colors disabled:opacity-50">
                              إلغاء
                            </button>
                            <button
                              onClick={() => void handleUndoTransaction(tx.id)}
                              disabled={undoLoading}
                              className="px-3 py-1 rounded-lg text-[11px] font-bold text-white transition-opacity active:opacity-80 disabled:opacity-50"
                              style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)" }}>
                              {undoLoading ? "جارٍ..." : "↩ تأكيد التراجع"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <ChangeCredentialsModal
          onClose={() => setShowSettings(false)}
          userId={user.id}
          currentUsername={user.username}
          onSaved={async () => { await onRefreshUser?.(); }}
        />
      )}

      {showWithdraw && (
        <WithdrawModal
          onClose={() => setShowWithdraw(false)}
          maxAmount={user.profits}
          iban={user.iban}
          fees={user.fees}
          userName={user.name}
          withdrawalFeeStatus={user.withdrawalFeeStatus}
          hasPreviousPayment={notifications.some((n) => n.type === "fees_paid")}
          user={user}
          customPhases={customPhases}
          userCustomPhases={userCustomPhases}
        />
      )}

      {/* Deposit Modal */}
      {showDepositModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(10,15,40,0.6)", backdropFilter: "blur(6px)", fontFamily: "'Cairo', sans-serif" }}
          dir="rtl"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowDepositModal(false); setDepositStep("choose"); } }}
        >
          <div
            className="w-full max-w-md rounded-t-3xl overflow-hidden shadow-2xl"
            style={{ background: "white", animation: "slideUp 0.3s cubic-bezier(.175,.885,.32,1.275)", maxHeight: "92vh", overflowY: "auto" }}
          >
            <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(60px); } to { opacity:1; transform:translateY(0); } } @keyframes popIn { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }`}</style>

            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="px-5 pt-3 pb-4 text-right">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { if (depositStep !== "choose") { setDepositStep("choose"); setDepositRequestSent(null); } else { setShowDepositModal(false); } }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-[#8892a4] hover:bg-gray-100 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
                <div>
                  <h2 className="text-[18px] font-extrabold text-[#1a1f3c]">إيداع الأموال</h2>
                  <p className="text-[11px] text-[#8892a4] font-medium mt-0.5">
                    {depositStep === "choose" ? "اختر طريقة الإيداع المناسبة" : depositStep === "bank" ? "الإيداع البنكي" : "إيداع USDT"}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 pb-8">

              {/* STEP: Choose */}
              {depositStep === "choose" && (
                <div className="flex flex-col gap-4">
                  {/* Bank option */}
                  <button
                    onClick={async () => {
                      setDepositMethodsLoading(true);
                      await loadDepositMethods();
                      setDepositMethodsLoading(false);
                      setDepositStep("bank");
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl text-right transition-all active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg,#f0f4ff,#e8f0ff)", border: "2px solid #c7d7ff" }}
                  >
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#2952e3,#4f46e5)" }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeWidth="0"/>
                        <polyline points="9 22 9 12 15 12 15 22" fill="white"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-[15px] font-extrabold text-[#1a1f3c]">إيداع بنكي</p>
                      <p className="text-[11px] text-[#5a6282] font-medium mt-0.5">تحويل بنكي عبر الآيبان أو رقم الحساب</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2952e3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>

                  {/* USDT option */}
                  <button
                    onClick={async () => {
                      setDepositMethodsLoading(true);
                      await loadDepositMethods();
                      setDepositMethodsLoading(false);
                      setDepositStep("usdt");
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl text-right transition-all active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "2px solid #bbf7d0" }}
                  >
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                        <circle cx="12" cy="12" r="10" strokeWidth="0"/>
                        <path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-[15px] font-extrabold text-[#1a1f3c]">عملة USDT</p>
                      <p className="text-[11px] text-[#5a6282] font-medium mt-0.5">إيداع عبر العملة الرقمية USDT / Bitcoin</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>

                  {/* Telegram support */}
                  {user.telegramLink && (
                    <div className="mt-2 p-4 rounded-2xl text-right" style={{ background: "#f0f9ff", border: "1.5px solid #bae6fd" }}>
                      <p className="text-[12px] font-bold text-[#0369a1] mb-2">تواصل مع فريق الدعم</p>
                      <p className="text-[11px] text-[#5a6282] font-medium mb-3">هل تحتاج مساعدة في عملية الإيداع؟ فريق الدعم جاهز لمساعدتك</p>
                      <button
                        onClick={() => { openTelegramDirect(user.telegramLink); }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-bold w-full justify-center transition-opacity active:opacity-80"
                        style={{ background: "linear-gradient(135deg,#0077b5,#0088cc)" }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-2.074 9.763c-.154.7-.566.87-1.148.54l-3.18-2.34-1.534 1.473c-.17.17-.312.312-.64.312l.228-3.233 5.88-5.306c.255-.228-.055-.354-.397-.126L6.91 14.41l-3.13-.978c-.68-.212-.693-.68.142-.998l12.24-4.717c.567-.206 1.063.126.4.531z"/>
                        </svg>
                        <span>تواصل مع الدعم عبر تلجرام</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP: Bank */}
              {depositStep === "bank" && (
                <div>
                  {depositMethodsLoading ? (
                    <div className="flex flex-col items-center py-10 gap-3">
                      <div className="w-10 h-10 rounded-full border-4 border-[#e2e8f0] border-t-[#2952e3] animate-spin" />
                      <p className="text-[12px] text-[#8892a4] font-medium">جارٍ التحميل...</p>
                    </div>
                  ) : depositMethods?.bankIban || depositMethods?.bankAccountName ? (
                    /* Bank data available — show it */
                    <div className="flex flex-col gap-4">
                      <div className="rounded-2xl p-5 text-right"
                        style={{ background: "linear-gradient(135deg,#1e3a8a,#2952e3)", position: "relative", overflow: "hidden" }}>
                        <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full opacity-15" style={{ background: "rgba(255,255,255,0.4)" }} />
                        <p className="text-white/70 text-[11px] font-medium mb-1">بيانات الحساب البنكي</p>
                        <div className="flex flex-col gap-3 mt-3">
                          {depositMethods.bankAccountName && (
                            <div>
                              <p className="text-white/60 text-[10px] font-semibold mb-0.5">اسم صاحب الحساب</p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => { void navigator.clipboard.writeText(depositMethods.bankAccountName); setDepositCopied("bankAccountName"); setTimeout(() => setDepositCopied(null), 2000); }}
                                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95"
                                  style={{ background: depositCopied === "bankAccountName" ? "rgba(134,239,172,0.25)" : "rgba(255,255,255,0.15)" }}
                                  title="نسخ"
                                >
                                  {depositCopied === "bankAccountName"
                                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                  }
                                </button>
                                <p className="text-white font-bold text-[15px] flex-1">{depositMethods.bankAccountName}</p>
                              </div>
                            </div>
                          )}
                          {depositMethods.bankName && (
                            <div>
                              <p className="text-white/60 text-[10px] font-semibold mb-0.5">اسم البنك</p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => { void navigator.clipboard.writeText(depositMethods.bankName); setDepositCopied("bankName"); setTimeout(() => setDepositCopied(null), 2000); }}
                                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95"
                                  style={{ background: depositCopied === "bankName" ? "rgba(134,239,172,0.25)" : "rgba(255,255,255,0.15)" }}
                                  title="نسخ"
                                >
                                  {depositCopied === "bankName"
                                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                  }
                                </button>
                                <p className="text-white font-bold text-[14px] flex-1">{depositMethods.bankName}</p>
                              </div>
                            </div>
                          )}
                          {depositMethods.bankIban && (
                            <div>
                              <p className="text-white/60 text-[10px] font-semibold mb-0.5">رقم الآيبان / الحساب</p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => { void navigator.clipboard.writeText(depositMethods.bankIban); setDepositCopied("bankIban"); setTimeout(() => setDepositCopied(null), 2000); }}
                                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95"
                                  style={{ background: depositCopied === "bankIban" ? "rgba(134,239,172,0.25)" : "rgba(255,255,255,0.15)" }}
                                  title="نسخ"
                                >
                                  {depositCopied === "bankIban"
                                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                  }
                                </button>
                                <p className="text-white font-bold text-[13px] tracking-wider flex-1" dir="ltr" style={{ textAlign: "right" }}>{depositMethods.bankIban}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-2xl text-right" style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}>
                        <p className="text-[12px] font-bold text-[#15803d]">يرجى التحويل على الحساب أعلاه وإرسال إيصال التحويل إلى فريق الدعم</p>
                      </div>
                      {user.telegramLink && (
                        <button
                          onClick={() => openTelegramDirect(user.telegramLink)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-bold text-[13px] transition-opacity active:opacity-80"
                          style={{ background: "linear-gradient(135deg,#0077b5,#0088cc)" }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-2.074 9.763c-.154.7-.566.87-1.148.54l-3.18-2.34-1.534 1.473c-.17.17-.312.312-.64.312l.228-3.233 5.88-5.306c.255-.228-.055-.354-.397-.126L6.91 14.41l-3.13-.978c-.68-.212-.693-.68.142-.998l12.24-4.717c.567-.206 1.063.126.4.531z"/>
                          </svg>
                          <span>إرسال إيصال التحويل عبر تلجرام</span>
                        </button>
                      )}
                    </div>
                  ) : depositRequestSent === "bank" ? (
                    /* Request already sent */
                    <div className="flex flex-col items-center py-8 gap-4 text-center">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg,#f0f9ff,#dbeafe)", border: "2px solid #bae6fd" }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2952e3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-[16px] font-extrabold text-[#1a1f3c]">جارٍ المعالجة</p>
                        <p className="text-[12px] text-[#5a6282] font-medium mt-1.5 leading-relaxed">
                          تم إرسال طلبك إلى المسؤول.<br/>سيتم إرسال بيانات حساب الإيداع إليك في أقرب وقت.
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* No bank data — send request */
                    <div className="flex flex-col gap-4">
                      <div className="p-4 rounded-2xl text-right" style={{ background: "#f8f9fc", border: "1.5px solid #e2e8f0" }}>
                        <div className="flex items-center gap-3 justify-end mb-2">
                          <p className="text-[14px] font-bold text-[#1a1f3c]">بيانات الحساب البنكي</p>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#2952e3,#4f46e5)" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            </svg>
                          </div>
                        </div>
                        <p className="text-[12px] text-[#5a6282] font-medium leading-relaxed">
                          لم يتم تحديد بيانات الحساب البنكي بعد. اضغط على الزر أدناه لطلب بيانات الإيداع من المسؤول وسيتم إرسالها إليك في أقرب وقت.
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await apiFetch(`/beneficiaries/${user.id}/deposit-request`, {
                              method: "POST",
                              body: JSON.stringify({ method: "bank" }),
                            });
                            setDepositRequestSent("bank");
                          } catch { alert("فشل إرسال الطلب، حاول مرة أخرى"); }
                        }}
                        className="w-full py-3.5 rounded-2xl text-white font-bold text-[14px] transition-opacity active:opacity-80"
                        style={{ background: "linear-gradient(135deg,#2952e3,#4f46e5)" }}
                      >
                        طلب بيانات الإيداع البنكي
                      </button>
                      {user.telegramLink && (
                        <button
                          onClick={() => openTelegramDirect(user.telegramLink)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[13px] transition-opacity active:opacity-80"
                          style={{ background: "#f0f9ff", color: "#0369a1", border: "1.5px solid #bae6fd" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-2.074 9.763c-.154.7-.566.87-1.148.54l-3.18-2.34-1.534 1.473c-.17.17-.312.312-.64.312l.228-3.233 5.88-5.306c.255-.228-.055-.354-.397-.126L6.91 14.41l-3.13-.978c-.68-.212-.693-.68.142-.998l12.24-4.717c.567-.206 1.063.126.4.531z"/>
                          </svg>
                          <span>تواصل مع الدعم مباشرةً</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* STEP: USDT */}
              {depositStep === "usdt" && (
                <div>
                  {depositMethodsLoading ? (
                    <div className="flex flex-col items-center py-10 gap-3">
                      <div className="w-10 h-10 rounded-full border-4 border-[#e2e8f0] border-t-[#059669] animate-spin" />
                      <p className="text-[12px] text-[#8892a4] font-medium">جارٍ التحميل...</p>
                    </div>
                  ) : depositMethods?.usdtWalletAddress ? (
                    /* USDT data available — show it */
                    <div className="flex flex-col gap-4">
                      <div className="rounded-2xl p-5 text-right"
                        style={{ background: "linear-gradient(135deg,#064e3b,#059669)", position: "relative", overflow: "hidden" }}>
                        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-15" style={{ background: "rgba(255,255,255,0.4)" }} />
                        <p className="text-white/70 text-[11px] font-medium mb-1">بيانات محفظة USDT</p>
                        <div className="flex flex-col gap-3 mt-3">
                          {depositMethods.usdtNetwork && (
                            <div>
                              <p className="text-white/60 text-[10px] font-semibold mb-0.5">نوع الشبكة</p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => { void navigator.clipboard.writeText(depositMethods.usdtNetwork); setDepositCopied("usdtNetwork"); setTimeout(() => setDepositCopied(null), 2000); }}
                                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95"
                                  style={{ background: depositCopied === "usdtNetwork" ? "rgba(134,239,172,0.25)" : "rgba(255,255,255,0.15)" }}
                                  title="نسخ"
                                >
                                  {depositCopied === "usdtNetwork"
                                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                  }
                                </button>
                                <p className="text-white font-bold text-[15px] flex-1">{depositMethods.usdtNetwork}</p>
                              </div>
                            </div>
                          )}
                          <div>
                            <p className="text-white/60 text-[10px] font-semibold mb-0.5">عنوان المحفظة</p>
                            <div className="flex items-start gap-2">
                              <button
                                onClick={() => { void navigator.clipboard.writeText(depositMethods.usdtWalletAddress); setDepositCopied("usdtWallet"); setTimeout(() => setDepositCopied(null), 2000); }}
                                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95 mt-0.5"
                                style={{ background: depositCopied === "usdtWallet" ? "rgba(134,239,172,0.25)" : "rgba(255,255,255,0.15)" }}
                                title="نسخ"
                              >
                                {depositCopied === "usdtWallet"
                                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                }
                              </button>
                              <p className="text-white font-bold text-[12px] break-all leading-relaxed flex-1" dir="ltr" style={{ textAlign: "right" }}>
                                {depositMethods.usdtWalletAddress}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3.5 rounded-2xl text-right" style={{ background: "#fffbeb", border: "1.5px solid #fde68a" }}>
                        <p className="text-[12px] font-bold text-[#b45309]">تأكد من استخدام الشبكة الصحيحة عند الإيداع لتجنب فقدان الأموال</p>
                      </div>
                    </div>
                  ) : depositRequestSent === "usdt" ? (
                    /* Request already sent */
                    <div className="flex flex-col items-center py-8 gap-4 text-center">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "2px solid #bbf7d0" }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-[16px] font-extrabold text-[#1a1f3c]">جارٍ المعالجة</p>
                        <p className="text-[12px] text-[#5a6282] font-medium mt-1.5 leading-relaxed">
                          تم إرسال طلبك إلى المسؤول.<br/>سيتم إرسال رابط محفظة USDT الخاصة بك خلال ثوانٍ.
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* No USDT data — send request */
                    <div className="flex flex-col gap-4">
                      <div className="p-4 rounded-2xl text-right" style={{ background: "#f8f9fc", border: "1.5px solid #e2e8f0" }}>
                        <div className="flex items-center gap-3 justify-end mb-2">
                          <p className="text-[14px] font-bold text-[#1a1f3c]">بيانات محفظة USDT</p>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                              <circle cx="12" cy="12" r="10" strokeWidth="0"/><path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                          </div>
                        </div>
                        <p className="text-[12px] text-[#5a6282] font-medium leading-relaxed">
                          لم يتم تحديد بيانات محفظة USDT بعد. اضغط على الزر أدناه لطلب رابط الإيداع من المسؤول وسيتم إرساله إليك فوراً.
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await apiFetch(`/beneficiaries/${user.id}/deposit-request`, {
                              method: "POST",
                              body: JSON.stringify({ method: "usdt" }),
                            });
                            setDepositRequestSent("usdt");
                          } catch { alert("فشل إرسال الطلب، حاول مرة أخرى"); }
                        }}
                        className="w-full py-3.5 rounded-2xl text-white font-bold text-[14px] transition-opacity active:opacity-80"
                        style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}
                      >
                        طلب رابط إيداع USDT
                      </button>
                      {user.telegramLink && (
                        <button
                          onClick={() => openTelegramDirect(user.telegramLink)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-[13px] transition-opacity active:opacity-80"
                          style={{ background: "#f0f9ff", color: "#0369a1", border: "1.5px solid #bae6fd" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-2.074 9.763c-.154.7-.566.87-1.148.54l-3.18-2.34-1.534 1.473c-.17.17-.312.312-.64.312l.228-3.233 5.88-5.306c.255-.228-.055-.354-.397-.126L6.91 14.41l-3.13-.978c-.68-.212-.693-.68.142-.998l12.24-4.717c.567-.206 1.063.126.4.531z"/>
                          </svg>
                          <span>تواصل مع الدعم مباشرةً</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN DASHBOARD (BENEFICIARIES)
═══════════════════════════════════════════════════════════════ */

type UserFormData = Omit<User, "id"> & { password: string };

const emptyUser: UserFormData = {
  username: "",
  password: "",
  name: "",
  profits: "",
  subscription: "",
  fees: "",
  accountHolder: "",
  iban: "",
  phone: "",
  status: "active",
  loginTitle: "",
  loginSlug: "",
  withdrawalFeePaidAt: null,
  liberationFee: "0",
  liberationFeeStatus: "unpaid",
  liberationFeePaidAt: null,
  transactionFee: "0",
  transactionFeeStatus: "unpaid",
  transactionFeePaidAt: null,
  telegramLink: "",
  withdrawalFeeStatus: "unpaid",
  plainPassword: "",
  phase1Visible: false,
  phase2Visible: false,
  phase3Visible: false,
};

function UserFormModal({
  mode,
  initial,
  onSave,
  onClose,
  isAgent,
}: {
  mode: "create" | "edit";
  initial: UserFormData;
  onSave: (data: UserFormData) => void;
  onClose: () => void;
  isAgent?: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [showPass, setShowPass] = useState(false);

  function set(key: keyof typeof form, val: string) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  const PROTECTED_FIELDS = ["name", "accountHolder", "username", "iban", "loginSlug"];

  const fields: { key: keyof Omit<User, "id" | "status">; label: string; placeholder: string; ltr?: boolean }[] = [
    { key: "username", label: "اسم المستخدم", placeholder: "username" },
    { key: "name", label: "اسم المستفيد الكامل", placeholder: "عبدالرحمن سعيد..." },
    { key: "accountHolder", label: "اسم صاحب الحساب البنكي", placeholder: "الاسم الكامل" },
    { key: "iban", label: "رقم الإيبان", placeholder: "SA15 8000...", ltr: true },
    { key: "phone", label: "رقم الهاتف", placeholder: "+966 5X XXX XXXX", ltr: true },
    { key: "subscription", label: "مبلغ الاشتراك (ر.س)", placeholder: "1,000" },
    { key: "profits", label: "أرباح الاشتراك (ر.س)", placeholder: "17,400" },
    { key: "fees", label: "رسوم السحب (ر.س)", placeholder: "3,610" },
    { key: "loginTitle", label: "عنوان صفحة تسجيل الدخول", placeholder: "شركة محمد أحمد للاستثمار" },
    { key: "loginSlug", label: "رابط تسجيل الدخول (Slug)", placeholder: "mohammed", ltr: true },
    { key: "telegramLink", label: "رابط تلجرام الإيداع", placeholder: "https://t.me/username", ltr: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(15,20,50,0.55)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-white rounded-t-3xl max-h-[92vh] overflow-y-auto"
        style={{ fontFamily: "'Cairo', sans-serif" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef0f6] sticky top-0 bg-white z-10 rounded-t-3xl">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#f3f5fa] flex items-center justify-center text-[#5a6282] hover:bg-[#e8edf5] transition-colors">
            <Icon.X />
          </button>
          <h3 className="text-[15px] font-bold text-[#1a1f3c]">
            {mode === "create" ? "إضافة مستفيد جديد" : "تعديل بيانات المستفيد"}
          </h3>
          <div className="w-8" />
        </div>

        <div className="px-5 py-5 flex flex-col gap-4" dir="rtl">
          {isAgent && mode === "edit" && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
              🔒 ملاحظة للوكيل: الحقول الأساسية (الاسم، صاحب الحساب، اسم المستخدم، الإيبان، الرابط) محددة ومحمية من قبل الإدارة ولا يمكن تغييرها.
            </div>
          )}

          {/* Password field */}
          <div className="text-right">
            <label className="block text-[11px] font-bold text-[#5a6282] mb-1.5">كلمة المرور</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                dir="ltr"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder={mode === "edit" ? "اتركها فارغة إذا لم ترغب في التغيير" : "أدخل كلمة المرور"}
                className="w-full px-4 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[12px] font-semibold text-right outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] transition-all pr-10"
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute top-1/2 -translate-y-1/2 right-3 text-[#8892a4] hover:text-[#5a6282]">
                {showPass ? <Icon.EyeOff /> : <Icon.Eye />}
              </button>
            </div>
          </div>

          {fields.map((f) => {
            const isLocked = isAgent && mode === "edit" && PROTECTED_FIELDS.includes(f.key);
            return (
              <div key={f.key} className="text-right">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-[#5a6282]">{f.label}</label>
                  {isLocked && (
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                      🔒 محمي للمسؤول
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={form[f.key] as string}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  disabled={isLocked}
                  dir={f.ltr ? "ltr" : "rtl"}
                  className={`w-full px-4 py-2.5 rounded-xl border text-[12px] font-semibold text-right outline-none transition-all ${
                    isLocked
                      ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                      : "bg-[#f8f9fc] text-[#1a1f3c] border-[#e2e8f0] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]"
                  }`}
                  style={f.ltr ? { textAlign: "left", direction: "ltr" } : {}}
                />
              </div>
            );
          })}

          {/* Status */}
          <div className="text-right">
            <label className="block text-[11px] font-bold text-[#5a6282] mb-2">حالة الحساب</label>
            <div className="flex gap-2 justify-end">
              {(["active", "disabled"] as const).map((s) => (
                <button key={s} onClick={() => set("status", s)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
                  style={{
                    background: form.status === s ? (s === "active" ? "#dcfce7" : "#fee2e2") : "#f3f5fa",
                    color: form.status === s ? (s === "active" ? "#16a34a" : "#dc2626") : "#8892a4",
                    border: `1.5px solid ${form.status === s ? (s === "active" ? "#86efac" : "#fca5a5") : "#e2e8f0"}`,
                  }}>
                  {s === "active" ? <><Icon.CheckCircle /><span>نشط</span></> : <><Icon.Ban /><span>معطّل</span></>}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => onSave(form)}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-[14px] mt-2 transition-opacity active:opacity-90"
            style={{ background: "linear-gradient(135deg,#2952e3,#7c3aed)" }}>
            {mode === "create" ? "إضافة المستفيد" : "حفظ التعديلات"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,20,50,0.55)" }} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 text-center" style={{ fontFamily: "'Cairo', sans-serif" }}>
        <p className="text-[14px] font-bold text-[#1a1f3c] mb-5">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-[#e2e8f0] text-[#5a6282] font-semibold text-[12px] hover:bg-[#f3f5fa] transition-colors">
            إلغاء
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-[#ef4444] text-white font-bold text-[12px] hover:opacity-90 transition-opacity">
            تأكيد
          </button>
        </div>
      </div>
    </div>
  );
}

type ModalState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; userId: string }
  | { type: "delete"; userId: string }
  | { type: "disable"; userId: string };

function AdminDashboard({
  users,
  onRefresh,
  onLogout,
  onViewUser,
}: {
  users: User[];
  onRefresh: () => Promise<void>;
  onLogout: () => void;
  onViewUser: (userId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"beneficiaries" | "agents">("beneficiaries");
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [showPassId, setShowPassId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPhases, setShowPhases] = useState(false);
  const [phases, setPhases] = useState<CustomPhase[]>([]);
  const [phaseLoading, setPhaseLoading] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseFailureMessage, setNewPhaseFailureMessage] = useState("");
  const [newPhaseFailureTitle, setNewPhaseFailureTitle] = useState("");
  const [newPhaseCardColor, setNewPhaseCardColor] = useState("");
  const [editPhase, setEditPhase] = useState<CustomPhase | null>(null);
  const [deletePhaseId, setDeletePhaseId] = useState<number | null>(null);

  // Agent Management state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentModal, setAgentModal] = useState<
    | { type: "none" }
    | { type: "create" }
    | { type: "edit"; agent: Agent }
    | { type: "assign"; agent: Agent }
  >({ type: "none" });
  const [showAgentPassId, setShowAgentPassId] = useState<number | null>(null);

  // Collapsible cards state
  const [collapsedBeneficiaryIds, setCollapsedBeneficiaryIds] = useState<Record<string, boolean>>({});
  const [collapsedAgentIds, setCollapsedAgentIds] = useState<Record<number, boolean>>({});

  // Filtering state
  const [filters, setFilters] = useState<FilterState>(defaultFilterState);

  // Deposit management state
  const [depositModalUserId, setDepositModalUserId] = useState<string | null>(null);
  const [depositData, setDepositData] = useState<DepositMethods | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositSaving, setDepositSaving] = useState(false);
  const [depositForm, setDepositForm] = useState({
    bankAccountName: "", bankIban: "", bankName: "",
    usdtWalletAddress: "", usdtNetwork: "",
  });

  // Admin notifications state
  const [adminNotifs, setAdminNotifs] = useState<AdminDepositNotif[]>([]);
  const [showAdminNotifPanel, setShowAdminNotifPanel] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      setAgentLoading(true);
      const data = await apiFetch<Agent[]>("/agents");
      setAgents(data);
    } catch { /* silent */ }
    finally { setAgentLoading(false); }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  const loadAdminNotifs = useCallback(async () => {
    try {
      const data = await apiFetch<AdminDepositNotif[]>("/admin/deposit-requests");
      setAdminNotifs(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    void loadAdminNotifs();
    const interval = setInterval(() => void loadAdminNotifs(), 30_000);
    return () => clearInterval(interval);
  }, [loadAdminNotifs]);

  const adminUnreadCount = adminNotifs.filter((n) => !n.isRead).length;

  async function markAdminNotifRead(id: number) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
      setAdminNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch { /* silent */ }
  }

  async function openDepositFromNotif(notif: AdminDepositNotif) {
    await markAdminNotifRead(notif.id);
    setShowAdminNotifPanel(false);
    const userMatch = users.find((u) => u.id === String(notif.beneficiaryId));
    if (userMatch) void openDepositModal(userMatch.id);
  }

  const loadPhases = useCallback(async () => {
    setPhaseLoading(true);
    try {
      const data = await apiFetch<CustomPhase[]>("/phases");
      setPhases(data);
    } catch { /* silent */ }
    finally { setPhaseLoading(false); }
  }, []);

  useEffect(() => {
    if (showPhases) void loadPhases();
  }, [showPhases, loadPhases]);

  async function handleCreatePhase() {
    if (!newPhaseName.trim() || !newPhaseFailureMessage.trim()) return;
    setPhaseLoading(true);
    try {
      await apiFetch("/phases", { method: "POST", body: JSON.stringify({
        name: newPhaseName.trim(),
        failureMessage: newPhaseFailureMessage.trim(),
        failureTitle: newPhaseFailureTitle.trim() || null,
        cardColor: newPhaseCardColor.trim() || null,
      }) });
      setNewPhaseName(""); setNewPhaseFailureMessage(""); setNewPhaseFailureTitle(""); setNewPhaseCardColor("");
      await loadPhases();
    } catch (e) { alert("فشل إنشاء المرحلة: " + (e instanceof Error ? e.message : "خطأ")); }
    finally { setPhaseLoading(false); }
  }

  async function handleUpdatePhase() {
    if (!editPhase) return;
    setPhaseLoading(true);
    try {
      await apiFetch(`/phases/${editPhase.id}`, { method: "PUT", body: JSON.stringify({
        name: editPhase.name,
        failureMessage: editPhase.failureMessage,
        failureTitle: editPhase.failureTitle ?? null,
        cardColor: editPhase.cardColor ?? null,
      }) });
      setEditPhase(null);
      await loadPhases();
    } catch (e) { alert("فشل تعديل المرحلة: " + (e instanceof Error ? e.message : "خطأ")); }
    finally { setPhaseLoading(false); }
  }

  async function handleDeletePhase(id: number) {
    setPhaseLoading(true);
    try {
      await apiFetch(`/phases/${id}`, { method: "DELETE" });
      setDeletePhaseId(null);
      await loadPhases();
    } catch (e) { alert("فشل حذف المرحلة: " + (e instanceof Error ? e.message : "خطأ")); }
    finally { setPhaseLoading(false); }
  }

  async function handleSaveAgent(data: Partial<Agent> & { password?: string }) {
    setSaving(true);
    try {
      if (agentModal.type === "create") {
        await apiFetch("/agents", { method: "POST", body: JSON.stringify(data) });
      } else if (agentModal.type === "edit") {
        await apiFetch(`/agents/${agentModal.agent.id}`, { method: "PUT", body: JSON.stringify(data) });
      }
      await loadAgents();
      await onRefresh();
      setAgentModal({ type: "none" });
    } catch (e) {
      alert("فشلت العملية: " + (e instanceof Error ? e.message : "خطأ"));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAgentStatus(agentId: number, status: "active" | "frozen" | "disabled") {
    try {
      await apiFetch(`/agents/${agentId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await loadAgents();
    } catch (e) {
      alert("فشل تغيير حالة الوكيل: " + (e instanceof Error ? e.message : "خطأ"));
    }
  }

  async function handleDeleteAgent(agentId: number) {
    if (!confirm("هل أنت تأكد من حذف هذا الوكيل؟ سيتم إلغاء ربط المستفيدين التابعين له.")) return;
    try {
      await apiFetch(`/agents/${agentId}`, { method: "DELETE" });
      await loadAgents();
      await onRefresh();
    } catch (e) {
      alert("فشل حذف الوكيل: " + (e instanceof Error ? e.message : "خطأ"));
    }
  }

  async function handleAssignBeneficiariesToAgent(beneficiaryIds: number[]) {
    if (agentModal.type !== "assign") return;
    setSaving(true);
    try {
      await apiFetch(`/agents/${agentModal.agent.id}/assign-beneficiaries`, {
        method: "POST",
        body: JSON.stringify({ beneficiaryIds }),
      });
      await loadAgents();
      await onRefresh();
      setAgentModal({ type: "none" });
    } catch (e) {
      alert("فشل تعيين المستفيدين: " + (e instanceof Error ? e.message : "خطأ"));
    } finally {
      setSaving(false);
    }
  }

  async function openDepositModal(userId: string) {
    setDepositModalUserId(userId);
    setDepositLoading(true);
    setDepositData(null);
    setDepositForm({ bankAccountName: "", bankIban: "", bankName: "", usdtWalletAddress: "", usdtNetwork: "" });
    try {
      const data = await apiFetch<DepositMethods | null>(`/beneficiaries/${userId}/deposit-methods`);
      setDepositData(data);
      if (data) {
        setDepositForm({
          bankAccountName: data.bankAccountName,
          bankIban: data.bankIban,
          bankName: data.bankName,
          usdtWalletAddress: data.usdtWalletAddress,
          usdtNetwork: data.usdtNetwork,
        });
      }
    } catch { /* silent */ }
    finally { setDepositLoading(false); }
  }

  async function saveDepositMethods() {
    if (!depositModalUserId) return;
    setDepositSaving(true);
    try {
      await apiFetch(`/beneficiaries/${depositModalUserId}/deposit-methods`, {
        method: "PUT",
        body: JSON.stringify(depositForm),
      });
      setDepositModalUserId(null);
    } catch (e) {
      alert("فشل حفظ بيانات الإيداع: " + (e instanceof Error ? e.message : "خطأ"));
    } finally {
      setDepositSaving(false);
    }
  }

  function copyUrl(userId: string, url: string) {
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedId(userId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  async function handleCreate(data: UserFormData) {
    setSaving(true);
    try {
      await apiFetch("/beneficiaries", {
        method: "POST",
        body: JSON.stringify(data),
      });
      await onRefresh();
      await loadAgents();
      setModal({ type: "none" });
    } catch (e) {
      alert("فشل حفظ المستفيد: " + (e instanceof Error ? e.message : "خطأ غير معروف"));
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(data: UserFormData) {
    if (modal.type !== "edit") return;
    setSaving(true);
    try {
      await apiFetch(`/beneficiaries/${modal.userId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      await onRefresh();
      await loadAgents();
      setModal({ type: "none" });
    } catch (e) {
      alert("فشل تعديل المستفيد: " + (e instanceof Error ? e.message : "خطأ غير معروف"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (modal.type !== "delete") return;
    setSaving(true);
    try {
      await apiFetch(`/beneficiaries/${modal.userId}`, { method: "DELETE" });
      await onRefresh();
      await loadAgents();
      setModal({ type: "none" });
    } catch (e) {
      alert("فشل حذف المستفيد: " + (e instanceof Error ? e.message : "خطأ غير معروف"));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleDisable() {
    if (modal.type !== "disable") return;
    const target = users.find((u) => u.id === modal.userId);
    if (!target) return;
    setSaving(true);
    try {
      await apiFetch(`/beneficiaries/${modal.userId}`, {
        method: "PUT",
        body: JSON.stringify({ status: target.status === "active" ? "disabled" : "active" }),
      });
      await onRefresh();
      setModal({ type: "none" });
    } catch (e) {
      alert("فشل تغيير حالة الحساب: " + (e instanceof Error ? e.message : "خطأ غير معروف"));
    } finally {
      setSaving(false);
    }
  }

  // Beneficiary Filter & Sort Computation
  const filteredUsers = users
    .filter((u) => {
      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        const matchName = u.name.toLowerCase().includes(q);
        const matchUser = u.username.toLowerCase().includes(q);
        const matchPhone = (u.phone || "").toLowerCase().includes(q);
        const matchIban = (u.iban || "").toLowerCase().includes(q);
        if (!matchName && !matchUser && !matchPhone && !matchIban) return false;
      }
      if (filters.status !== "all" && u.status !== filters.status) return false;
      if (filters.feeStatus !== "all") {
        const statuses = [u.withdrawalFeeStatus, u.liberationFeeStatus, u.transactionFeeStatus];
        if (filters.feeStatus === "unpaid" && !statuses.includes("unpaid")) return false;
        if (filters.feeStatus === "partial" && !statuses.includes("partial")) return false;
        if (filters.feeStatus === "paid" && !statuses.includes("paid")) return false;
      }
      if (filters.agentId !== "all") {
        if (filters.agentId === "unassigned") {
          if (u.agentId !== null && u.agentId !== undefined) return false;
        } else {
          if (u.agentId !== filters.agentId) return false;
        }
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

  const editingUser = modal.type === "edit" ? users.find((u) => u.id === modal.userId) : null;
  const disablingUser = modal.type === "disable" ? users.find((u) => u.id === modal.userId) : null;

  return (
    <div className="max-w-md mx-auto min-h-screen pb-10" dir="rtl">
      {/* Top Bar Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowAdminNotifPanel(true);
                adminNotifs.filter((n) => !n.isRead).forEach((n) => void markAdminNotifRead(n.id));
              }}
              className="relative w-9 h-9 rounded-xl bg-white border border-[#d0d7e8] flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1f3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {adminUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white font-extrabold"
                  style={{ fontSize: "9px", background: "#ef4444" }}>
                  {adminUnreadCount > 9 ? "9+" : adminUnreadCount}
                </span>
              )}
            </button>
            <button onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#d0d7e8] text-[#1a1f3c] text-[11px] font-semibold shadow-sm hover:bg-gray-50 transition-colors">
              <Icon.Logout />
              <span>خروج</span>
            </button>
          </div>
          <div className="text-right">
            <h1 className="text-[19px] font-extrabold text-[#1a1f3c]">لوحة الإدارة</h1>
            <p className="text-[11px] text-[#5a6282] font-medium">مرحباً، المدير العام</p>
          </div>
        </div>
      </div>

      {/* Navigation Tab Switcher */}
      <div className="px-4 mb-4">
        <div className="bg-white p-1 rounded-2xl border border-[#e2e8f0] flex gap-1 shadow-sm">
          <button
            onClick={() => setActiveTab("beneficiaries")}
            className={`flex-1 py-2.5 rounded-xl font-extrabold text-[13px] transition-all ${
              activeTab === "beneficiaries"
                ? "bg-[#1a1f3c] text-white shadow"
                : "text-[#64748b] hover:bg-gray-50"
            }`}
          >
            👥 المستفيدون ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("agents")}
            className={`flex-1 py-2.5 rounded-xl font-extrabold text-[13px] transition-all ${
              activeTab === "agents"
                ? "bg-[#1a1f3c] text-white shadow"
                : "text-[#64748b] hover:bg-gray-50"
            }`}
          >
            🛡️ الوكلاء ({agents.length})
          </button>
        </div>
      </div>

      {/* ── TAB 1: BENEFICIARIES ─────────────────────────────────────── */}
      {activeTab === "beneficiaries" && (
        <>
          {/* Stats Summary */}
          <div className="px-4 mb-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "إجمالي المستفيدين", value: users.length, color: "#2952e3" },
                { label: "حسابات نشطة", value: users.filter((u) => u.status === "active").length, color: "#16a34a" },
                { label: "حسابات معطّلة", value: users.filter((u) => u.status === "disabled").length, color: "#ef4444" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl p-3 text-center border border-[#e2e8f0] shadow-sm">
                  <p className="font-extrabold text-[22px] leading-none" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[9px] font-semibold text-[#8892a4] mt-1 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="px-4 mb-4 flex gap-2">
            <button
              onClick={() => setModal({ type: "create" })}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-white font-bold text-[13px] shadow-md transition-opacity active:opacity-90"
              style={{ background: "linear-gradient(135deg,#0f7a38,#22c55e)" }}
            >
              <Icon.Plus />
              <span>إضافة مستفيد جديد</span>
            </button>

            <button
              onClick={() => setShowPhases((v) => !v)}
              className="px-4 py-3 rounded-2xl bg-white border border-[#cbd5e1] text-[#1e293b] font-bold text-[12px] shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-1"
            >
              <span>المراحل المخصصة</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ transform: showPhases ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>

          {/* Phases Management Collapsible */}
          {showPhases && (
            <div className="px-4 mb-4">
              <div className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm p-4">
                <p className="text-[13px] font-bold text-[#1a1f3c] mb-3 text-right">إنشاء مرحلة جديدة</p>
                <input
                  type="text"
                  value={newPhaseName}
                  onChange={(e) => setNewPhaseName(e.target.value)}
                  placeholder="اسم المرحلة..."
                  className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[12px] font-semibold text-right outline-none mb-2"
                  dir="rtl"
                />
                <input
                  type="text"
                  value={newPhaseFailureMessage}
                  onChange={(e) => setNewPhaseFailureMessage(e.target.value)}
                  placeholder="نص رسالة الفشل (مطلوب)..."
                  className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[12px] font-semibold text-right outline-none mb-2"
                  dir="rtl"
                />
                <input
                  type="text"
                  value={newPhaseFailureTitle}
                  onChange={(e) => setNewPhaseFailureTitle(e.target.value)}
                  placeholder="عنوان رسالة الفشل (اختياري)..."
                  className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[12px] font-semibold text-right outline-none mb-2"
                  dir="rtl"
                />
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="color"
                    value={newPhaseCardColor || "#1a1f3c"}
                    onChange={(e) => setNewPhaseCardColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-[#e2e8f0] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newPhaseCardColor}
                    onChange={(e) => setNewPhaseCardColor(e.target.value)}
                    placeholder="لون البطاقة (اختياري) مثال: #8B1A1A"
                    className="flex-1 px-3 py-2 rounded-xl border border-[#e2e8f0] bg-[#f8f9fc] text-[#1a1f3c] text-[12px] font-semibold text-right outline-none"
                    dir="ltr"
                  />
                </div>
                <button
                  onClick={() => void handleCreatePhase()}
                  disabled={!newPhaseName.trim() || !newPhaseFailureMessage.trim() || phaseLoading}
                  className="w-full py-2.5 rounded-xl text-white font-bold text-[12px] disabled:opacity-40 transition-opacity active:opacity-90"
                  style={{ background: "linear-gradient(135deg,#0f7a38,#22c55e)" }}>
                  {phaseLoading ? "جارٍ الحفظ..." : "إضافة المرحلة"}
                </button>

                {phases.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="text-[11px] font-bold text-[#8892a4] text-right">المراحل المتاحة ({phases.length})</p>
                    {phases.map((phase) => (
                      <div key={phase.id} className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8f9fc]">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            <button onClick={() => void handleDeletePhase(phase.id)} className="text-red-500 font-bold text-[11px]">حذف</button>
                          </div>
                          <div className="text-right">
                            <p className="text-[12px] font-bold text-[#1a1f3c]">{phase.name}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="px-4">
            <BeneficiaryFilterBar
              filters={filters}
              onChange={setFilters}
              agents={agents}
              totalCount={users.length}
              filteredCount={filteredUsers.length}
            />
          </div>

          {/* Beneficiaries Cards List */}
          <div className="px-4 flex flex-col gap-4">
            {filteredUsers.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center text-[#8892a4] border border-[#e2e8f0]">
                <div className="text-[36px] mb-2">🔍</div>
                <p className="font-extrabold text-[14px] text-[#1a1f3c]">لا يوجد مستفيدون مطابقون</p>
                <p className="text-[11px] text-[#64748b] mt-1">حاول تعديل الفلاتر أو إزالة البحث.</p>
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isCollapsed = Boolean(collapsedBeneficiaryIds[user.id]);
                return (
                  <div key={user.id} className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm overflow-hidden transition-all">
                    <div className="h-1.5 w-full"
                      style={{ background: user.status === "active" ? "linear-gradient(90deg,#2952e3,#7c3aed)" : "#d1d5db" }} />

                    {/* Collapsible Header */}
                    <div
                      onClick={() => setCollapsedBeneficiaryIds((prev) => ({ ...prev, [user.id]: !prev[user.id] }))}
                      className="p-4 cursor-pointer hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 select-none"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[#64748b] bg-gray-100 transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""}`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </div>
                        <div className="flex flex-col items-start gap-1">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg ${user.status === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-red-50 text-red-500 border border-red-200"}`}>
                            {user.status === "active" ? "نشط" : "معطّل"}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                            الوكيل: {user.agentName || "غير مسند"}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-1 min-w-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); onViewUser(user.id); }}
                          className="text-[15px] font-extrabold text-[#2952e3] leading-snug hover:underline text-right block truncate w-full"
                        >
                          {user.name}
                        </button>
                        <p className="text-[11px] text-[#8892a4] font-medium mt-0.5" dir="ltr" style={{ textAlign: "right" }}>
                          @{user.username}
                        </p>
                      </div>
                    </div>

                    {/* Collapsible Body */}
                    {!isCollapsed && (
                      <div className="px-4 pb-4 pt-1 border-t border-[#f1f5f9]">
                        {/* Password */}
                        <div className="mb-3 text-right">
                          <label className="block text-[10px] font-bold text-[#8892a4] mb-1">كلمة المرور</label>
                          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#f8f9fc] border border-[#e8eaf0]">
                            <button onClick={() => setShowPassId(showPassId === user.id ? null : user.id)}
                              className="text-[#8892a4] hover:text-[#5a6282]">
                              {showPassId === user.id ? <Icon.EyeOff /> : <Icon.Eye />}
                            </button>
                            <span className="text-[12px] font-semibold text-[#1a1f3c]" dir="ltr">
                              {showPassId === user.id
                                ? (user.plainPassword || <span className="text-[#8892a4] italic text-[11px]">لم تُضبط بعد</span>)
                                : "••••••••"}
                            </span>
                          </div>
                        </div>

                        {/* Financial grid */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {[
                            { label: "أرباح الاشتراك", value: user.profits, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
                            { label: "مبلغ الاشتراك", value: user.subscription, color: "#2952e3", bg: "#eff6ff", border: "#bfdbfe" },
                            { label: "رسوم السحب", value: user.fees, color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
                          ].map((d) => (
                            <div key={d.label} className="rounded-xl p-2 text-center border" style={{ background: d.bg, borderColor: d.border }}>
                              <p className="font-extrabold text-[13px] leading-none" style={{ color: d.color }}>{d.value}</p>
                              <p className="text-[8px] font-semibold mt-1 text-[#8892a4] leading-snug">{d.label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Bank info */}
                        <div className="rounded-2xl p-3 text-right mb-3" style={{ background: "linear-gradient(135deg,#5b21b6,#7c3aed)" }}>
                          <p className="text-white/60 text-[9px] font-medium mb-0.5">اسم صاحب الحساب</p>
                          <p className="text-white font-bold text-[12px] leading-snug mb-1">{user.accountHolder}</p>
                          <p className="text-white/60 text-[9px] font-medium mb-0.5">رقم الإيبان</p>
                          <p className="text-white font-bold text-[11px]" dir="ltr" style={{ textAlign: "right", letterSpacing: "0.05em" }}>
                            {user.iban}
                          </p>
                        </div>

                        {/* Login Link Info */}
                        {(() => {
                          const clientUrl = user.loginSlug
                            ? `${window.location.origin}${import.meta.env.BASE_URL}client/${user.loginSlug}`
                            : "";
                          const isCopied = copiedId === user.id;
                          return (
                            <div className="rounded-xl p-2.5 text-right mb-3 bg-[#f8f9fc] border border-[#e2e8f0]">
                              <p className="text-[10px] font-bold text-[#8892a4] mb-1">رابط تسجيل الدخول للمستفيد</p>
                              {user.loginSlug ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => copyUrl(user.id, clientUrl)}
                                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                                  >
                                    {isCopied ? "تم النسخ ✓" : "نسخ الرابط"}
                                  </button>
                                  <p className="text-[11px] font-semibold text-[#2952e3] truncate flex-1 text-left" dir="ltr">
                                    {clientUrl}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-[10px] text-[#8892a4]">لم يحدد رابط بعد</p>
                              )}
                            </div>
                          );
                        })()}

                        {/* Deposit Methods Button */}
                        <button
                          onClick={() => void openDepositModal(user.id)}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-bold transition-colors mb-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                        >
                          <span>💳 بيانات الإيداع البنكي / USDT</span>
                        </button>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <button onClick={() => setModal({ type: "edit", userId: user.id })}
                            className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-blue-50 text-[#2952e3] border border-blue-200 hover:bg-blue-100">
                            تعديل
                          </button>
                          <button onClick={() => setModal({ type: "disable", userId: user.id })}
                            className={`flex-1 py-2 rounded-xl text-[11px] font-bold border ${user.status === "active" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                            {user.status === "active" ? "تعطيل" : "تفعيل"}
                          </button>
                          <button onClick={() => setModal({ type: "delete", userId: user.id })}
                            className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                            حذف
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ── TAB 2: AGENTS ────────────────────────────────────────────── */}
      {activeTab === "agents" && (
        <div className="px-4 flex flex-col gap-4">
          {/* Header Card */}
          <div className="flex items-center justify-between bg-white rounded-3xl p-4 border border-[#e2e8f0] shadow-sm">
            <button
              onClick={() => setAgentModal({ type: "create" })}
              className="px-4 py-2.5 rounded-2xl text-white font-bold text-[12px] shadow-sm transition-opacity active:opacity-90 flex items-center gap-1.5"
              style={{ background: "linear-gradient(135deg,#0f7a38,#22c55e)" }}
            >
              <Icon.Plus />
              <span>إضافة وكيل جديد</span>
            </button>
            <div className="text-right">
              <h2 className="text-[15px] font-extrabold text-[#1a1f3c]">إدارة الوكلاء والموظفين</h2>
              <p className="text-[11px] text-[#64748b]">منح الصلاحيات وتحديد حصص المستفيدين</p>
            </div>
          </div>

          {agentLoading ? (
            <div className="bg-white rounded-3xl p-10 text-center text-[#64748b] border border-[#e2e8f0]">
              جارٍ تحميل قائمة الوكلاء...
            </div>
          ) : agents.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center text-[#8892a4] border border-[#e2e8f0]">
              <div className="text-[36px] mb-2">🛡️</div>
              <p className="font-extrabold text-[14px] text-[#1a1f3c]">لا يوجد وكلاء حالياً</p>
              <p className="text-[11px] text-[#64748b] mt-1">اضغط على "إضافة وكيل جديد" لإنشاء أول وكيل وتعيين صلاحياته.</p>
            </div>
          ) : (
            agents.map((ag) => {
              const count = ag.currentBeneficiariesCount ?? 0;
              const quota = ag.maxBeneficiariesQuota;
              const pct = quota > 0 ? Math.min(100, Math.round((count / quota) * 100)) : 100;
              const isShowPass = showAgentPassId === ag.id;
              const isCollapsed = Boolean(collapsedAgentIds[ag.id]);

              return (
                <div key={ag.id} className="bg-white rounded-3xl border border-[#e2e8f0] shadow-sm overflow-hidden transition-all">
                  {/* Collapsible Header */}
                  <div
                    onClick={() => setCollapsedAgentIds((prev) => ({ ...prev, [ag.id]: !prev[ag.id] }))}
                    className="p-4 cursor-pointer hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 select-none"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[#64748b] bg-gray-100 transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg ${
                          ag.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : ag.status === "frozen"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {ag.status === "active" ? "🟢 نشط" : ag.status === "frozen" ? "❄️ مجمّد" : "🔴 معطّل"}
                      </span>
                    </div>

                    <div className="text-right flex-1 min-w-0">
                      <h3 className="text-[15px] font-extrabold text-[#1a1f3c] truncate">{ag.name}</h3>
                      <p className="text-[11px] text-[#64748b] font-medium" dir="ltr" style={{ textAlign: "right" }}>
                        @{ag.username}
                      </p>
                    </div>
                  </div>

                  {/* Collapsible Body */}
                  {!isCollapsed && (
                    <div className="px-4 pb-4 pt-1 border-t border-[#f1f5f9]">
                      {/* Password Reveal */}
                      <div className="mb-3 text-right">
                        <label className="block text-[10px] font-bold text-[#8892a4] mb-1">كلمة المرور</label>
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#f8f9fc] border border-[#e8eaf0]">
                          <button
                            onClick={() => setShowAgentPassId(isShowPass ? null : ag.id)}
                            className="text-[#8892a4] hover:text-[#5a6282]"
                          >
                            {isShowPass ? <Icon.EyeOff /> : <Icon.Eye />}
                          </button>
                          <span className="text-[12px] font-semibold text-[#1a1f3c]" dir="ltr">
                            {isShowPass ? ag.plainPassword || "—" : "••••••••"}
                          </span>
                        </div>
                      </div>

                      {/* Quota Progress */}
                      <div className="mb-3 p-3 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0]">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className="text-[#1e293b]">حصة المستفيدين:</span>
                          <span dir="ltr" className="text-[#2952e3]">
                            {count} / {quota} مستفيد
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${pct}%`,
                              background: count >= quota ? "#ef4444" : "#2952e3",
                            }}
                          />
                        </div>
                      </div>

                      {/* Permissions Pills */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${ag.canEditBeneficiaries ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                          {ag.canEditBeneficiaries ? "✓ تعديل المستفيدين" : "✗ تعديل المستفيدين"}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${ag.canManagePhases ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                          {ag.canManagePhases ? "✓ إدارة المراحل" : "✗ إدارة المراحل"}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${ag.canManageFinancials ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                          {ag.canManageFinancials ? "✓ العمليات المالية" : "✗ العمليات المالية"}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setAgentModal({ type: "assign", agent: ag })}
                          className="py-2 rounded-xl bg-blue-50 text-[#2952e3] border border-blue-200 text-[11px] font-bold hover:bg-blue-100 transition-colors"
                        >
                          🔗 ربط مستفيدين
                        </button>
                        <button
                          onClick={() => setAgentModal({ type: "edit", agent: ag })}
                          className="py-2 rounded-xl bg-gray-100 text-[#334155] border border-gray-200 text-[11px] font-bold hover:bg-gray-200 transition-colors"
                        >
                          ✏️ تعديل والصلاحيات
                        </button>
                        <button
                          onClick={() => void handleToggleAgentStatus(ag.id, ag.status === "frozen" ? "active" : "frozen")}
                          className="py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold hover:bg-amber-100 transition-colors"
                        >
                          {ag.status === "frozen" ? "☀️ إلغاء التجميد" : "❄️ تجميد الحساب"}
                        </button>
                        <button
                          onClick={() => void handleDeleteAgent(ag.id)}
                          className="py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold hover:bg-red-100 transition-colors"
                        >
                          🗑️ حذف الوكيل
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Agent Form Modal (Create / Edit) */}
      {(agentModal.type === "create" || agentModal.type === "edit") && (
        <AgentFormModal
          mode={agentModal.type === "create" ? "create" : "edit"}
          initialAgent={agentModal.type === "edit" ? agentModal.agent : null}
          onSave={handleSaveAgent}
          onClose={() => setAgentModal({ type: "none" })}
          loading={saving}
        />
      )}

      {/* Assign Beneficiaries Modal */}
      {agentModal.type === "assign" && (
        <AssignBeneficiariesModal
          agent={agentModal.agent}
          beneficiaries={users}
          onSave={handleAssignBeneficiariesToAgent}
          onClose={() => setAgentModal({ type: "none" })}
          loading={saving}
        />
      )}
      {modal.type === "delete" && (
        <ConfirmModal
          message="هل تريد حذف هذا المستفيد نهائياً؟"
          onConfirm={handleDelete}
          onCancel={() => setModal({ type: "none" })}
        />
      )}
      {modal.type === "disable" && disablingUser && (
        <ConfirmModal
          message={disablingUser.status === "active" ? "هل تريد تعطيل هذا الحساب؟" : "هل تريد تفعيل هذا الحساب؟"}
          onConfirm={handleToggleDisable}
          onCancel={() => setModal({ type: "none" })}
        />
      )}

      {/* Admin Notifications Panel */}
      {showAdminNotifPanel && (
        <div className="fixed inset-0 z-50 flex" dir="rtl"
          style={{ fontFamily: "'Cairo', sans-serif" }}>
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdminNotifPanel(false)} />
          <div className="w-full max-w-sm bg-white h-full overflow-y-auto flex flex-col shadow-2xl"
            style={{ animation: "slideInRight 0.25s ease-out" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef0f6] sticky top-0 bg-white z-10">
              <button onClick={() => setShowAdminNotifPanel(false)}
                className="w-8 h-8 rounded-full bg-[#f3f5fa] flex items-center justify-center text-[#5a6282]">
                <Icon.X />
              </button>
              <div className="text-right">
                <h2 className="font-extrabold text-[16px] text-[#1a1f3c]">طلبات الإيداع</h2>
                <p className="text-[11px] text-[#8892a4] font-medium">إشعارات المستفيدين</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#f3f5fa] flex items-center justify-center">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5a6282" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
            </div>

            {/* List */}
            <div className="flex flex-col gap-0 flex-1">
              {adminNotifs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-[#8892a4]">
                  <div className="text-[40px] mb-3">📭</div>
                  <p className="font-bold text-[13px]">لا توجد طلبات إيداع</p>
                </div>
              ) : (
                adminNotifs.map((n) => {
                  const d = new Date(n.createdAt);
                  const date = d.toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
                  const time = d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
                  const isBank = n.title.includes("بنكي");
                  return (
                    <div key={n.id}
                      className="px-5 py-4 border-b border-[#eef0f6] text-right"
                      style={{ background: n.isRead ? "white" : "#f0fdf4" }}>
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: isBank ? "linear-gradient(135deg,#2952e3,#4f46e5)" : "linear-gradient(135deg,#059669,#10b981)" }}>
                          {isBank ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="10" strokeWidth="0"/><path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Unread badge + time */}
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1 text-[#8892a4]">
                              <span className="text-[10px] font-medium">{time}</span>
                              <span className="text-[10px]">—</span>
                              <span className="text-[10px] font-medium">{date}</span>
                            </div>
                            {!n.isRead && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">● جديد</span>
                            )}
                          </div>

                          {/* Title */}
                          <p className="font-extrabold text-[13px] text-[#1a1f3c] mb-0.5">{n.title}</p>

                          {/* Beneficiary */}
                          <p className="text-[11px] font-semibold mb-1" style={{ color: isBank ? "#2952e3" : "#059669" }}>
                            {n.beneficiaryName} (@{n.beneficiaryUsername})
                          </p>

                          {/* Method tag */}
                          <div className="flex justify-end mt-2">
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl"
                              style={{
                                background: isBank ? "#eff6ff" : "#f0fdf4",
                                color: isBank ? "#2952e3" : "#059669",
                                border: `1px solid ${isBank ? "#bfdbfe" : "#bbf7d0"}`,
                              }}>
                              {isBank ? "🏦 إيداع بنكي" : "💰 إيداع USDT"}
                            </span>
                          </div>

                          {/* Action button */}
                          <button
                            onClick={() => void openDepositFromNotif(n)}
                            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-bold text-[12px] transition-opacity active:opacity-80"
                            style={{ background: isBank ? "linear-gradient(135deg,#2952e3,#4f46e5)" : "linear-gradient(135deg,#059669,#10b981)" }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            <span>فتح بيانات الإيداع</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deposit Methods Modal */}
      {depositModalUserId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(10,15,40,0.6)", backdropFilter: "blur(6px)", fontFamily: "'Cairo', sans-serif" }}
          dir="rtl"
          onClick={(e) => { if (e.target === e.currentTarget) setDepositModalUserId(null); }}
        >
          <div
            className="w-full max-w-md rounded-t-3xl shadow-2xl bg-white"
            style={{ animation: "slideUp 0.3s cubic-bezier(.175,.885,.32,1.275)", maxHeight: "92vh", overflowY: "auto" }}
          >
            <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(60px); } to { opacity:1; transform:translateY(0); } }`}</style>

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="px-5 pt-3 pb-4 flex items-center justify-between">
              <button
                onClick={() => setDepositModalUserId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-[#8892a4] hover:bg-gray-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              <div className="text-right">
                <h2 className="text-[17px] font-extrabold text-[#1a1f3c]">بيانات الإيداع</h2>
                <p className="text-[11px] text-[#8892a4] font-medium">
                  {users.find(u => u.id === depositModalUserId)?.name ?? ""}
                </p>
              </div>
            </div>

            {depositLoading ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <div className="w-10 h-10 rounded-full border-4 border-[#e2e8f0] border-t-[#059669] animate-spin" />
                <p className="text-[12px] text-[#8892a4] font-medium">جارٍ التحميل...</p>
              </div>
            ) : (
              <div className="px-5 pb-8 flex flex-col gap-5">

                {/* Current deposit status summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl text-center" style={{
                    background: depositData?.bankIban ? "#f0fdf4" : "#f8f9fc",
                    border: `1.5px solid ${depositData?.bankIban ? "#86efac" : "#e2e8f0"}`
                  }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-1.5" style={{
                      background: depositData?.bankIban ? "linear-gradient(135deg,#059669,#10b981)" : "#e2e8f0"
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      </svg>
                    </div>
                    <p className="text-[11px] font-bold" style={{ color: depositData?.bankIban ? "#059669" : "#8892a4" }}>
                      {depositData?.bankIban ? "مُعدّ" : "غير مُعدّ"}
                    </p>
                    <p className="text-[10px] text-[#8892a4] font-medium mt-0.5">الإيداع البنكي</p>
                  </div>
                  <div className="p-3 rounded-2xl text-center" style={{
                    background: depositData?.usdtWalletAddress ? "#f0fdf4" : "#f8f9fc",
                    border: `1.5px solid ${depositData?.usdtWalletAddress ? "#86efac" : "#e2e8f0"}`
                  }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-1.5" style={{
                      background: depositData?.usdtWalletAddress ? "linear-gradient(135deg,#059669,#10b981)" : "#e2e8f0"
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                        <circle cx="12" cy="12" r="10" strokeWidth="0"/><path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <p className="text-[11px] font-bold" style={{ color: depositData?.usdtWalletAddress ? "#059669" : "#8892a4" }}>
                      {depositData?.usdtWalletAddress ? "مُعدّ" : "غير مُعدّ"}
                    </p>
                    <p className="text-[10px] text-[#8892a4] font-medium mt-0.5">محفظة USDT</p>
                  </div>
                </div>

                {/* Bank section */}
                <div className="rounded-2xl overflow-hidden border border-[#e2e8f0]">
                  <div className="px-4 py-3 flex items-center gap-3"
                    style={{ background: "linear-gradient(135deg,#2952e3,#4f46e5)" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/20">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      </svg>
                    </div>
                    <p className="text-white font-bold text-[13px]">بيانات الحساب البنكي</p>
                  </div>
                  <div className="p-4 flex flex-col gap-3 bg-[#f8f9fc]">
                    <div>
                      <label className="block text-[11px] font-bold text-[#5a6282] mb-1.5 text-right">اسم صاحب الحساب</label>
                      <input
                        type="text"
                        value={depositForm.bankAccountName}
                        onChange={(e) => setDepositForm({ ...depositForm, bankAccountName: e.target.value })}
                        placeholder="اسم صاحب الحساب البنكي..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-[#1a1f3c] text-[13px] font-semibold text-right outline-none focus:border-[#2952e3] transition-colors"
                        dir="rtl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#5a6282] mb-1.5 text-right">اسم البنك</label>
                      <input
                        type="text"
                        value={depositForm.bankName}
                        onChange={(e) => setDepositForm({ ...depositForm, bankName: e.target.value })}
                        placeholder="مثال: بنك الراجحي..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-[#1a1f3c] text-[13px] font-semibold text-right outline-none focus:border-[#2952e3] transition-colors"
                        dir="rtl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#5a6282] mb-1.5 text-right">رقم الآيبان / رقم الحساب</label>
                      <input
                        type="text"
                        value={depositForm.bankIban}
                        onChange={(e) => setDepositForm({ ...depositForm, bankIban: e.target.value })}
                        placeholder="SA0000000000000000000000"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-[#1a1f3c] text-[13px] font-bold outline-none focus:border-[#2952e3] transition-colors tracking-wider"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* USDT section */}
                <div className="rounded-2xl overflow-hidden border border-[#e2e8f0]">
                  <div className="px-4 py-3 flex items-center gap-3"
                    style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/20">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                        <circle cx="12" cy="12" r="10" strokeWidth="0"/><path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <p className="text-white font-bold text-[13px]">بيانات محفظة USDT</p>
                  </div>
                  <div className="p-4 flex flex-col gap-3 bg-[#f8f9fc]">
                    <div>
                      <label className="block text-[11px] font-bold text-[#5a6282] mb-1.5 text-right">نوع الشبكة</label>
                      <select
                        value={depositForm.usdtNetwork}
                        onChange={(e) => setDepositForm({ ...depositForm, usdtNetwork: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-[#1a1f3c] text-[13px] font-semibold outline-none focus:border-[#059669] transition-colors appearance-none cursor-pointer"
                        dir="ltr"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238892a4' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "left 12px center", paddingLeft: "36px" }}
                      >
                        <option value="">— اختر الشبكة —</option>
                        <option value="TRC20">TRC20 (Tron)</option>
                        <option value="ERC20">ERC20 (Ethereum)</option>
                        <option value="BEP20">BEP20 (BSC)</option>
                        <option value="SOL">SOL (Solana)</option>
                        <option value="TON">TON (Telegram)</option>
                        <option value="MATIC">MATIC (Polygon)</option>
                        <option value="ARB">ARB (Arbitrum)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#5a6282] mb-1.5 text-right">رابط / عنوان المحفظة</label>
                      <textarea
                        value={depositForm.usdtWalletAddress}
                        onChange={(e) => setDepositForm({ ...depositForm, usdtWalletAddress: e.target.value })}
                        placeholder="عنوان المحفظة كاملاً..."
                        rows={3}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-[#1a1f3c] text-[12px] font-semibold outline-none focus:border-[#059669] transition-colors resize-none"
                        dir="ltr"
                        style={{ wordBreak: "break-all" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={() => void saveDepositMethods()}
                  disabled={depositSaving}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-[14px] disabled:opacity-50 transition-opacity active:opacity-80"
                  style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}
                >
                  {depositSaving ? "جارٍ الحفظ..." : "حفظ بيانات الإيداع"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════ */

// Safe localStorage wrappers — embedded browsers (Telegram, Instagram, etc.)
// may throw SecurityError or have localStorage disabled entirely.
function safeStorageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeStorageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function loadLocalUsers(): User[] {
  try {
    const stored = safeStorageGet(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as User[];
  } catch { /* ignore */ }
  return initialUsers;
}

export default function App() {
  const initialSlug = getClientSlugFromUrl();
  const [view, setView] = useState<View>(
    initialSlug ? { page: "client-login", slug: initialSlug } : { page: "login" }
  );
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const refreshUsers = useCallback(async () => {
    try {
      const data = await apiFetch<ApiUser[]>("/beneficiaries");
      const mapped = data.map(mapApiUser);
      setUsers(mapped);
      // also keep localStorage in sync as fallback
      safeStorageSet(STORAGE_KEY, JSON.stringify(mapped));
    } catch {
      // API unavailable → fall back to localStorage
      setUsers(loadLocalUsers());
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => { void refreshUsers(); }, [refreshUsers]);

  const activeUser = view.page === "user" ? users.find((u) => u.id === view.userId) : null;

  if (loadingUsers && view.page !== "client-login") {
    return (
      <div dir="rtl" style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg,#1a1f3c 0%,#2952e3 50%,#7c3aed 100%)",
        fontFamily: "'Cairo', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "16px",
      }}>
        <div style={{
          width: 48, height: 48, border: "4px solid rgba(255,255,255,0.2)",
          borderTopColor: "white", borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 600 }}>
          جارٍ تحميل البيانات...
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg,#dce4f0 0%,#e8edf7 40%,#eaeef7 100%)",
      fontFamily: "'Cairo', sans-serif",
    }}>
      {view.page === "client-login" && (
        <ClientLoginPage
          slug={view.slug}
          onLogin={(v) => { void refreshUsers(); setView(v); }}
        />
      )}
      {view.page === "login" && (
        <LoginPage
          onLogin={(v) => setView(v)}
        />
      )}
      {view.page === "admin" && (
        <AdminDashboard
          users={users}
          onRefresh={refreshUsers}
          onLogout={() => setView({ page: "login" })}
          onViewUser={(userId) => setView({ page: "user", userId, fromAdmin: true })}
        />
      )}
      {view.page === "agent" && (
        <AgentDashboard
          initialAgent={view.agent}
          onLogout={() => setView({ page: "login" })}
          onViewBeneficiary={(beneficiaryId, agent) =>
            setView({
              page: "user",
              userId: beneficiaryId,
              fromAgent: true,
              currentAgent: agent,
            })
          }
          UserFormModalComponent={UserFormModal}
        />
      )}
      {view.page === "user" && activeUser && (
        <UserDashboard
          user={activeUser}
          onLogout={() => setView({ page: "login" })}
          onBack={
            view.fromAdmin
              ? () => setView({ page: "admin" })
              : view.fromAgent && view.currentAgent
              ? () => setView({ page: "agent", agent: view.currentAgent! })
              : undefined
          }
          onRefreshUser={view.fromAdmin || view.fromAgent ? refreshUsers : undefined}
          isAgent={view.fromAgent}
          currentAgent={view.currentAgent}
        />
      )}
      {view.page === "user" && !activeUser && loadingUsers && (
        <div dir="rtl" style={{
          minHeight: "100vh",
          background: "linear-gradient(160deg,#1a1f3c 0%,#2952e3 50%,#7c3aed 100%)",
          fontFamily: "'Cairo', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "16px",
        }}>
          <div style={{
            width: 48, height: 48, border: "4px solid rgba(255,255,255,0.2)",
            borderTopColor: "white", borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
