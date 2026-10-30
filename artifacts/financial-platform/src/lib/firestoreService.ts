import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/* ─── Interfaces ──────────────────────────────────────────────────────── */
export interface FirestoreBeneficiary {
  id: string | number;
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
  plainPassword?: string;
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
  agentIds?: number[];
  agentNames?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FirestoreAgent {
  id: number;
  username: string;
  plainPassword?: string;
  name: string;
  status: "active" | "frozen" | "disabled";
  maxBeneficiariesQuota: number;
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

export interface FirestoreCustomPhase {
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

export interface FirestoreUserCustomPhase {
  id?: number | string;
  userId: number | string;
  phaseId: number;
  amount: string;
  status: "unpaid" | "paid" | "partial";
  paidAt: string | null;
  visible: boolean;
}

export interface FirestoreDepositMethods {
  id?: number | string;
  beneficiaryId: number | string;
  bankAccountName: string;
  bankIban: string;
  bankName: string;
  usdtWalletAddress: string;
  usdtNetwork: string;
}

export interface FirestoreFinancialTransaction {
  id?: number | string;
  beneficiaryId: number | string;
  type: string;
  amount: string;
  description: string;
  createdAt: string;
}

export interface FirestoreNotification {
  id?: number | string;
  beneficiaryId: number | string;
  userId?: number | string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface FirestoreAuditLog {
  id?: string;
  actor: string;
  actorType: "admin" | "agent" | "beneficiary";
  action: string;
  targetType: string;
  targetId?: string | number | null;
  details?: string;
  createdAt: string;
}

/* ─── Helper Functions ────────────────────────────────────────────────── */
const col = (name: string) => collection(db, name);

function generateNumericId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

/* ─── Beneficiaries CRUD ──────────────────────────────────────────────── */
export async function getFirestoreBeneficiaries(): Promise<FirestoreBeneficiary[]> {
  try {
    const snap = await getDocs(col("beneficiaries"));
    const list: FirestoreBeneficiary[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as any) });
    });
    return list.sort((a, b) => Number(a.id) - Number(b.id));
  } catch (err) {
    console.warn("[FirestoreService] getFirestoreBeneficiaries error:", err);
    return [];
  }
}

export async function getFirestoreBeneficiaryBySlug(slug: string): Promise<FirestoreBeneficiary | null> {
  try {
    const q = query(col("beneficiaries"), where("loginSlug", "==", slug), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...(docSnap.data() as any) };
    }
    return null;
  } catch (err) {
    console.warn("[FirestoreService] getFirestoreBeneficiaryBySlug error:", err);
    return null;
  }
}

export async function saveFirestoreBeneficiary(
  b: Partial<FirestoreBeneficiary> & { id?: string | number }
): Promise<FirestoreBeneficiary> {
  const idStr = String(b.id || generateNumericId());
  const now = new Date().toISOString();

  const data: FirestoreBeneficiary = {
    id: idStr,
    username: b.username || "",
    name: b.name || "",
    profits: String(b.profits ?? "0"),
    subscription: String(b.subscription ?? "0"),
    fees: String(b.fees ?? "0"),
    accountHolder: b.accountHolder ?? "",
    iban: b.iban ?? "",
    phone: b.phone ?? "",
    status: b.status === "disabled" ? "disabled" : "active",
    loginTitle: b.loginTitle ?? "",
    loginSlug: b.loginSlug ?? "",
    telegramLink: b.telegramLink ?? "",
    withdrawalFeeStatus: b.withdrawalFeeStatus ?? "unpaid",
    withdrawalFeePaidAt: b.withdrawalFeePaidAt ?? null,
    plainPassword: b.plainPassword ?? "",
    phase1Visible: Boolean(b.phase1Visible),
    phase2Visible: Boolean(b.phase2Visible),
    liberationFee: String(b.liberationFee ?? "0"),
    liberationFeeStatus: b.liberationFeeStatus ?? "unpaid",
    liberationFeePaidAt: b.liberationFeePaidAt ?? null,
    transactionFee: String(b.transactionFee ?? "0"),
    transactionFeeStatus: b.transactionFeeStatus ?? "unpaid",
    transactionFeePaidAt: b.transactionFeePaidAt ?? null,
    phase3Visible: Boolean(b.phase3Visible),
    agentId: b.agentId !== undefined && b.agentId !== null ? Number(b.agentId) : null,
    agentName: b.agentName ?? (b.agentNames && b.agentNames.length > 0 ? b.agentNames.join("، ") : null),
    agentIds: b.agentIds ?? (b.agentId ? [Number(b.agentId)] : []),
    agentNames: b.agentNames ?? (b.agentName ? [b.agentName] : []),
    createdAt: b.createdAt || now,
    updatedAt: now,
  };

  const docRef = doc(db, "beneficiaries", idStr);
  await setDoc(docRef, data, { merge: true });
  return data;
}

export async function deleteFirestoreBeneficiary(id: string | number): Promise<void> {
  const docRef = doc(db, "beneficiaries", String(id));
  await deleteDoc(docRef);
}

/* ─── Agents CRUD ─────────────────────────────────────────────────────── */
export async function getFirestoreAgents(): Promise<FirestoreAgent[]> {
  try {
    const snap = await getDocs(col("agents"));
    const list: FirestoreAgent[] = [];
    snap.forEach((d) => {
      list.push({ id: Number(d.id) || Number((d.data() as any).id), ...(d.data() as any) });
    });
    return list.sort((a, b) => Number(a.id) - Number(b.id));
  } catch (err) {
    console.warn("[FirestoreService] getFirestoreAgents error:", err);
    return [];
  }
}

export async function saveFirestoreAgent(
  agent: Partial<FirestoreAgent> & { id?: number; password?: string }
): Promise<FirestoreAgent> {
  const idNum = agent.id || generateNumericId();
  const idStr = String(idNum);
  const now = new Date().toISOString();

  const data: FirestoreAgent = {
    id: idNum,
    username: agent.username || "",
    plainPassword: agent.password || agent.plainPassword || "",
    name: agent.name || "",
    status: agent.status || "active",
    maxBeneficiariesQuota: Number(agent.maxBeneficiariesQuota ?? 5),
    canViewBeneficiaries: agent.canViewBeneficiaries ?? true,
    canAddBeneficiaries: agent.canAddBeneficiaries ?? true,
    canEditBeneficiaries: agent.canEditBeneficiaries ?? true,
    canDeleteBeneficiaries: agent.canDeleteBeneficiaries ?? false,
    canManageProfits: agent.canManageProfits ?? false,
    canManageFees: agent.canManageFees ?? true,
    canPayFees: agent.canPayFees ?? true,
    canManageFinancials: agent.canManageFinancials ?? false,
    canManagePhases: agent.canManagePhases ?? true,
    canPayPhases: agent.canPayPhases ?? true,
    canSendNotifications: agent.canSendNotifications ?? true,
    canViewAccountInfo: agent.canViewAccountInfo ?? true,
    canEditAccountInfo: agent.canEditAccountInfo ?? false,
    currentBeneficiariesCount: agent.currentBeneficiariesCount ?? 0,
    createdAt: agent.createdAt || now,
    updatedAt: now,
  };

  const docRef = doc(db, "agents", idStr);
  await setDoc(docRef, data, { merge: true });
  return data;
}

export async function deleteFirestoreAgent(id: number): Promise<void> {
  const docRef = doc(db, "agents", String(id));
  await deleteDoc(docRef);
}

/* ─── Custom Phases CRUD ──────────────────────────────────────────────── */
export async function getFirestoreCustomPhases(): Promise<FirestoreCustomPhase[]> {
  try {
    const snap = await getDocs(col("custom_phases"));
    const list: FirestoreCustomPhase[] = [];
    snap.forEach((d) => {
      list.push({ id: Number(d.id), ...(d.data() as any) });
    });
    return list.sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (err) {
    console.warn("[FirestoreService] getFirestoreCustomPhases error:", err);
    return [];
  }
}

export async function saveFirestoreCustomPhase(phase: Partial<FirestoreCustomPhase>): Promise<FirestoreCustomPhase> {
  const idNum = phase.id || generateNumericId();
  const idStr = String(idNum);

  const data: FirestoreCustomPhase = {
    id: idNum,
    name: phase.name || "",
    description: phase.description ?? null,
    defaultAmount: phase.defaultAmount ?? "0",
    failureMessage: phase.failureMessage || "حدث خطأ في معالجة هذه المرحلة، يرجى سداد المبلغ المطلوب.",
    failureTitle: phase.failureTitle ?? null,
    cardColor: phase.cardColor ?? null,
    sortOrder: Number(phase.sortOrder ?? 0),
    status: phase.status ?? "active",
    isFrozen: phase.status === "frozen" || Boolean(phase.isFrozen),
  };

  const docRef = doc(db, "custom_phases", idStr);
  await setDoc(docRef, data, { merge: true });
  return data;
}

export async function deleteFirestoreCustomPhase(id: number): Promise<void> {
  const docRef = doc(db, "custom_phases", String(id));
  await deleteDoc(docRef);
}

/* ─── User Custom Phases ──────────────────────────────────────────────── */
export async function getFirestoreUserCustomPhases(userId: string | number): Promise<FirestoreUserCustomPhase[]> {
  try {
    const q = query(col("user_custom_phases"), where("userId", "in", [String(userId), Number(userId)]));
    const snap = await getDocs(q);
    const list: FirestoreUserCustomPhase[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as any) });
    });
    return list;
  } catch (err) {
    console.warn("[FirestoreService] getFirestoreUserCustomPhases error:", err);
    return [];
  }
}

export async function saveFirestoreUserCustomPhase(p: FirestoreUserCustomPhase): Promise<void> {
  const docKey = `${p.userId}_${p.phaseId}`;
  const docRef = doc(db, "user_custom_phases", docKey);
  await setDoc(
    docRef,
    {
      userId: String(p.userId),
      phaseId: Number(p.phaseId),
      amount: String(p.amount ?? "0"),
      status: p.status ?? "unpaid",
      paidAt: p.paidAt ?? null,
      visible: Boolean(p.visible),
    },
    { merge: true }
  );
}

/* ─── Deposit Methods ─────────────────────────────────────────────────── */
export async function getFirestoreDepositMethods(beneficiaryId: string | number): Promise<FirestoreDepositMethods> {
  try {
    const docRef = doc(db, "deposit_methods", String(beneficiaryId));
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as FirestoreDepositMethods;
    }
  } catch (err) {
    console.warn("[FirestoreService] getFirestoreDepositMethods error:", err);
  }
  return {
    beneficiaryId: String(beneficiaryId),
    bankAccountName: "",
    bankIban: "",
    bankName: "",
    usdtWalletAddress: "",
    usdtNetwork: "TRC20",
  };
}

export async function saveFirestoreDepositMethods(data: FirestoreDepositMethods): Promise<void> {
  const docRef = doc(db, "deposit_methods", String(data.beneficiaryId));
  await setDoc(docRef, data, { merge: true });
}

/* ─── Financial Transactions ─────────────────────────────────────────── */
export async function getFirestoreTransactions(beneficiaryId: string | number): Promise<FirestoreFinancialTransaction[]> {
  try {
    const q = query(
      col("financial_transactions"),
      where("beneficiaryId", "in", [String(beneficiaryId), Number(beneficiaryId)])
    );
    const snap = await getDocs(q);
    const list: FirestoreFinancialTransaction[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn("[FirestoreService] getFirestoreTransactions error:", err);
    return [];
  }
}

export async function createFirestoreTransaction(tx: Omit<FirestoreFinancialTransaction, "id">): Promise<void> {
  const idStr = String(generateNumericId());
  const docRef = doc(db, "financial_transactions", idStr);
  await setDoc(docRef, { ...tx, id: idStr });
}

/* ─── Notifications ───────────────────────────────────────────────────── */
export async function getFirestoreNotifications(beneficiaryId: string | number): Promise<FirestoreNotification[]> {
  try {
    const q = query(
      col("notifications"),
      where("beneficiaryId", "in", [String(beneficiaryId), Number(beneficiaryId)])
    );
    const snap = await getDocs(q);
    const list: FirestoreNotification[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn("[FirestoreService] getFirestoreNotifications error:", err);
    return [];
  }
}

export async function createFirestoreNotification(notif: Omit<FirestoreNotification, "id">): Promise<void> {
  const idStr = String(generateNumericId());
  const docRef = doc(db, "notifications", idStr);
  await setDoc(docRef, { ...notif, id: idStr });
}

export async function markFirestoreNotificationRead(id: string | number): Promise<void> {
  const docRef = doc(db, "notifications", String(id));
  await updateDoc(docRef, { isRead: true });
}

/* ─── Audit Logs ──────────────────────────────────────────────────────── */
export async function createFirestoreAuditLog(
  actor: string,
  actorType: "admin" | "agent" | "beneficiary",
  action: string,
  targetType: string,
  targetId?: string | number | null,
  details?: string
): Promise<void> {
  try {
    const idStr = String(generateNumericId());
    const docRef = doc(db, "audit_logs", idStr);
    await setDoc(docRef, {
      id: idStr,
      actor,
      actorType,
      action,
      targetType,
      targetId: targetId ?? null,
      details: details || "",
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[FirestoreService] createFirestoreAuditLog error:", err);
  }
}
