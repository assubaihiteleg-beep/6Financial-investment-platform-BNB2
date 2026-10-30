import { collection, onSnapshot, doc, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";

export interface FirestoreBeneficiaryDoc {
  id: number | string;
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
  agentIds?: number[];
  agentNames?: string[];
  createdAt?: string;
}

/**
 * Real-time listener for all beneficiaries.
 * Updates immediately across Preview, Published apps, and mobile clients.
 */
export function subscribeToBeneficiaries(
  onData: (beneficiaries: FirestoreBeneficiaryDoc[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    const colRef = collection(db, "beneficiaries");

    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: FirestoreBeneficiaryDoc[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: Number(docSnap.id) || Number(d.id) || docSnap.id,
            username: d.username || "",
            name: d.name || "",
            profits: String(d.profits ?? "0"),
            subscription: String(d.subscription ?? "0"),
            fees: String(d.fees ?? "0"),
            accountHolder: d.accountHolder ?? "",
            iban: d.iban ?? "",
            phone: d.phone ?? "",
            status: d.status ?? "active",
            loginTitle: d.loginTitle ?? "",
            loginSlug: d.loginSlug ?? "",
            telegramLink: d.telegramLink ?? "",
            withdrawalFeeStatus: d.withdrawalFeeStatus ?? "unpaid",
            withdrawalFeePaidAt: d.withdrawalFeePaidAt ?? null,
            plainPassword: d.plainPassword ?? "",
            phase1Visible: Boolean(d.phase1Visible),
            phase2Visible: Boolean(d.phase2Visible),
            liberationFee: String(d.liberationFee ?? "0"),
            liberationFeeStatus: d.liberationFeeStatus ?? "unpaid",
            liberationFeePaidAt: d.liberationFeePaidAt ?? null,
            transactionFee: String(d.transactionFee ?? "0"),
            transactionFeeStatus: d.transactionFeeStatus ?? "unpaid",
            transactionFeePaidAt: d.transactionFeePaidAt ?? null,
            phase3Visible: Boolean(d.phase3Visible),
            agentId: d.agentId !== null && d.agentId !== undefined ? Number(d.agentId) : null,
            agentName: d.agentName ?? (Array.isArray(d.agentNames) && d.agentNames.length > 0 ? d.agentNames.join("، ") : null),
            agentIds: Array.isArray(d.agentIds) ? d.agentIds.map(Number) : (d.agentId !== null && d.agentId !== undefined ? [Number(d.agentId)] : []),
            agentNames: Array.isArray(d.agentNames) ? d.agentNames : (d.agentName ? [String(d.agentName)] : []),
            createdAt: d.createdAt ? String(d.createdAt) : undefined,
          });
        });

        // Sort consistently by numeric ID
        list.sort((a, b) => Number(a.id) - Number(b.id));
        onData(list);
      },
      (err) => {
        console.warn("[Firestore Realtime] Beneficiaries snapshot listener warning:", err.message);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn("[Firestore Realtime] Could not initialize beneficiaries listener:", err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Real-time listener for beneficiaries assigned to a specific agent.
 */
export function subscribeToAgentBeneficiaries(
  agentId: number,
  onData: (beneficiaries: FirestoreBeneficiaryDoc[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    const colRef = collection(db, "beneficiaries");

    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: FirestoreBeneficiaryDoc[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const docAgentIds: number[] = Array.isArray(d.agentIds) && d.agentIds.length > 0
            ? d.agentIds.map(Number)
            : (d.agentId !== null && d.agentId !== undefined ? [Number(d.agentId)] : []);

          if (docAgentIds.includes(agentId)) {
            list.push({
              id: Number(docSnap.id) || Number(d.id) || docSnap.id,
              username: d.username || "",
              name: d.name || "",
              profits: String(d.profits ?? "0"),
              subscription: String(d.subscription ?? "0"),
              fees: String(d.fees ?? "0"),
              accountHolder: d.accountHolder ?? "",
              iban: d.iban ?? "",
              phone: d.phone ?? "",
              status: d.status ?? "active",
              loginTitle: d.loginTitle ?? "",
              loginSlug: d.loginSlug ?? "",
              telegramLink: d.telegramLink ?? "",
              withdrawalFeeStatus: d.withdrawalFeeStatus ?? "unpaid",
              withdrawalFeePaidAt: d.withdrawalFeePaidAt ?? null,
              plainPassword: d.plainPassword ?? "",
              phase1Visible: Boolean(d.phase1Visible),
              phase2Visible: Boolean(d.phase2Visible),
              liberationFee: String(d.liberationFee ?? "0"),
              liberationFeeStatus: d.liberationFeeStatus ?? "unpaid",
              liberationFeePaidAt: d.liberationFeePaidAt ?? null,
              transactionFee: String(d.transactionFee ?? "0"),
              transactionFeeStatus: d.transactionFeeStatus ?? "unpaid",
              transactionFeePaidAt: d.transactionFeePaidAt ?? null,
              phase3Visible: Boolean(d.phase3Visible),
              agentId: d.agentId !== null && d.agentId !== undefined ? Number(d.agentId) : null,
              agentName: d.agentName ?? (Array.isArray(d.agentNames) && d.agentNames.length > 0 ? d.agentNames.join("، ") : null),
              agentIds: docAgentIds,
              agentNames: Array.isArray(d.agentNames) ? d.agentNames : (d.agentName ? [String(d.agentName)] : []),
              createdAt: d.createdAt ? String(d.createdAt) : undefined,
            });
          }
        });

        list.sort((a, b) => Number(a.id) - Number(b.id));
        onData(list);
      },
      (err) => {
        console.warn("[Firestore Realtime] Agent beneficiaries snapshot warning:", err.message);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn("[Firestore Realtime] Could not initialize agent listener:", err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Real-time listener for an individual agent's profile and permissions.
 */
export function subscribeToSingleAgent(
  agentId: number,
  onData: (agentData: any) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    const docRef = doc(db, "agents", String(agentId));
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onData({ id: Number(docSnap.id) || docSnap.id, ...docSnap.data() });
        }
      },
      (err) => {
        console.warn("[Firestore Realtime] Single agent snapshot warning:", err.message);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn("[Firestore Realtime] Could not initialize single agent listener:", err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Real-time listener for notifications of a specific beneficiary.
 */
export function subscribeToUserNotifications(
  userId: number,
  onData: (notifications: any[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    const colRef = collection(db, "notifications");
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const docUserId = Number(d.userId || d.beneficiaryId || 0);
          if (docUserId === userId) {
            list.push({ id: Number(docSnap.id) || docSnap.id, ...d });
          }
        });
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        onData(list);
      },
      (err) => {
        console.warn("[Firestore Realtime] Notifications snapshot warning:", err.message);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn("[Firestore Realtime] Could not initialize notifications listener:", err);
    if (onError) onError(err);
    return () => {};
  }
}
