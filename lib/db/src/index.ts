import * as schema from "./schema";
import fs from "fs";
import path from "path";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  type Firestore,
} from "firebase/firestore";

// Mock pg pool to satisfy any legacy external imports
export const pool = {
  query: async () => ({ rows: [] }),
  connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
  on: () => {},
} as any;

export const createPool = () => pool;

function getTableName(table: any): string {
  if (!table) return "unknown";
  const syms = Object.getOwnPropertySymbols(table);
  for (const s of syms) {
    if (s.description === "drizzle:Name" || s.description === "drizzle:BaseName") {
      return String(table[s]);
    }
  }
  return table.name || "unknown";
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, l) => l.toUpperCase());
}

function extractConditions(cond: any): Array<{ key: string; value: any }> {
  if (!cond) return [];
  const results: Array<{ key: string; value: any }> = [];

  function walk(sqlObj: any) {
    if (!sqlObj) return;
    if (Array.isArray(sqlObj.queryChunks)) {
      let colName: string | null = null;
      let paramVal: any = undefined;

      for (const chunk of sqlObj.queryChunks) {
        if (chunk && typeof chunk === "object") {
          if (chunk.name && typeof chunk.name === "string") {
            colName = chunk.name;
          } else if (chunk.value !== undefined && !Array.isArray(chunk.value)) {
            paramVal = chunk.value;
          } else if (Array.isArray(chunk)) {
            paramVal = chunk.map((c: any) => (c && c.value !== undefined ? c.value : c));
          } else if (chunk.queryChunks) {
            walk(chunk);
          }
        }
      }

      if (colName !== null) {
        results.push({ key: colName, value: paramVal });
      }
    }
  }

  walk(cond);
  return results;
}

// In-Memory Database Store (with persistent seed)
const memoryStore: Record<string, any[]> = {
  beneficiaries: [
    {
      id: 1,
      username: "test_user_1",
      passwordHash: "$2b$10$6FdbHnurqG7RapVnRIMBAubCgexFNKD/to/d35KcGIsqkDCGYftkG",
      plainPassword: "user@pass123",
      name: "أحمد السبيعي",
      profits: "15,500",
      subscription: "5000",
      fees: "0",
      accountHolder: "أحمد السبيعي",
      iban: "SA1580000234567890123456",
      phone: "+966501234567",
      status: "active",
      loginTitle: "منصة المستثمر المالية",
      loginSlug: "ahmed-invest",
      telegramLink: "https://t.me/investment_admin",
      withdrawalFeeStatus: "unpaid",
      withdrawalFeePaidAt: null,
      phase1Visible: false,
      phase2Visible: false,
      phase3Visible: false,
      liberationFee: "0",
      liberationFeeStatus: "unpaid",
      liberationFeePaidAt: null,
      transactionFee: "0",
      transactionFeeStatus: "unpaid",
      transactionFeePaidAt: null,
      agentId: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date(),
    },
    {
      id: 100,
      username: "Maray",
      passwordHash: "$2b$12$HSxe9VEZDBVyl8k1VxWmH.sE/MqMtE5r0UNKVtjhtZNP6t2763yC2",
      plainPassword: "Maray@9990",
      name: "مرعي ابراهيم الدوسري",
      profits: "0187,545",
      subscription: "1,000",
      fees: "0",
      accountHolder: "مرعي ابراهيم الدوسري",
      iban: "SA2345000000352202568002",
      phone: "",
      status: "active",
      loginTitle: "منصة تداول للاستثمار",
      loginSlug: "Maraya",
      telegramLink: "http://t.me/Absaedi",
      withdrawalFeeStatus: "unpaid",
      withdrawalFeePaidAt: null,
      phase1Visible: false,
      phase2Visible: false,
      phase3Visible: false,
      liberationFee: "0",
      liberationFeeStatus: "unpaid",
      liberationFeePaidAt: null,
      transactionFee: "0",
      transactionFeeStatus: "unpaid",
      transactionFeePaidAt: null,
      agentId: null,
      createdAt: new Date("2026-10-26T21:17:15.851Z"),
      updatedAt: new Date("2026-10-26T21:37:02.186Z"),
    },
    {
      id: 101,
      username: "fsdfff",
      passwordHash: "$2b$12$BLRGUKYu6/iuYRyE.vy/q.dfgj9KQkeyhNjawh75wJg/Sz1qTogDy",
      plainPassword: "fdsdsfsd",
      name: "user@pass123",
      profits: "0",
      subscription: "1,000",
      fees: "0",
      accountHolder: "",
      iban: "",
      phone: "",
      status: "active",
      loginTitle: "",
      loginSlug: "dsfdfdf",
      telegramLink: "",
      withdrawalFeeStatus: "unpaid",
      withdrawalFeePaidAt: null,
      phase1Visible: false,
      phase2Visible: false,
      phase3Visible: false,
      liberationFee: "0",
      liberationFeeStatus: "unpaid",
      liberationFeePaidAt: null,
      transactionFee: "0",
      transactionFeeStatus: "unpaid",
      transactionFeePaidAt: null,
      agentId: null,
      agentIds: [],
      agentNames: [],
      createdAt: new Date("2026-10-26T22:32:09.341Z"),
      updatedAt: new Date("2026-10-26T22:35:56.758Z"),
    },
  ],
  agents: [
    {
      id: 1,
      username: "agent1",
      passwordHash: "$2b$10$6FdbHnurqG7RapVnRIMBAubCgexFNKD/to/d35KcGIsqkDCGYftkG",
      plainPassword: "password123",
      name: "سعود القحطاني",
      status: "active",
      maxBeneficiariesQuota: 5,
      canViewBeneficiaries: true,
      canAddBeneficiaries: true,
      canEditBeneficiaries: true,
      canDeleteBeneficiaries: false,
      canManageProfits: true,
      canManageFees: true,
      canPayFees: true,
      canManageFinancials: true,
      canManagePhases: true,
      canPayPhases: true,
      canSendNotifications: true,
      canViewAccountInfo: true,
      canEditAccountInfo: false,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date(),
    },
  ],
  admins: [
    {
      id: 1,
      username: "Assubaihi",
      passwordHash: "$2b$10$6FdbHnurqG7RapVnRIMBAubCgexFNKD/to/d35KcGIsqkDCGYftkG",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
  ],
  deposit_methods: [
    {
      id: 1,
      methodType: "bank",
      details: {
        bankName: "مصرف الراجحي",
        accountName: "مؤسسة المستثمر للاستثمار",
        accountNumber: "12345678901234",
        iban: "SA0380000123456789012345",
      },
      isActive: true,
      updatedAt: new Date(),
    },
    {
      id: 2,
      methodType: "usdt",
      details: {
        network: "TRC20 (Tron)",
        address: "TYDny5jf2MsswT8FfW2gHjKmN5xZ19",
      },
      isActive: true,
      updatedAt: new Date(),
    },
  ],
  notifications: [],
  custom_phases: [],
  user_custom_phases: [],
  financial_transactions: [],
  audit_logs: [],
};

let autoIncrementId = 105;

// Firestore Singleton Instance with Long Polling (zero gRPC, works everywhere)
let firestoreDb: Firestore | null = null;

function getFirestoreInstance(): Firestore | null {
  if (firestoreDb) return firestoreDb;
  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(configPath)) return null;
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const app: FirebaseApp = getApps().length > 0 ? getApps()[0]! : initializeApp(config);
    firestoreDb = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, config.firestoreDatabaseId);
    console.log("[AI Studio] Connected to Firebase Firestore database:", config.firestoreDatabaseId);
    return firestoreDb;
  } catch (err) {
    console.warn("[AI Studio] Firestore init warning:", err);
    return null;
  }
}

async function loadCollectionFromFirestore(tName: string): Promise<any[]> {
  const fDb = getFirestoreInstance();
  if (!fDb) return memoryStore[tName] || [];
  try {
    const snap = await getDocs(collection(fDb, tName));
    if (!snap.empty) {
      const list: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({ id: Number(d.id) || d.id, ...data });
      });
      if (list.length > 0) {
        memoryStore[tName] = list;
        const maxId = Math.max(...list.map((i) => Number(i.id) || 0));
        if (maxId >= autoIncrementId) autoIncrementId = maxId + 1;

        if (tName === "beneficiaries") {
          const agents = memoryStore["agents"] || [];
          const aMap = new Map<number, string>();
          for (const a of agents) aMap.set(Number(a.id), a.name);

          for (const b of list) {
            if (!b.agentIds) {
              b.agentIds = b.agentId ? [Number(b.agentId)] : [];
            } else if (!Array.isArray(b.agentIds)) {
              b.agentIds = [Number(b.agentIds)].filter(Boolean);
            }
            if (!b.agentNames || b.agentNames.length === 0) {
              b.agentNames = b.agentIds.map((aid: number) => aMap.get(aid)).filter(Boolean);
            }
            b.agentName = b.agentNames && b.agentNames.length > 0 ? b.agentNames.join("، ") : (b.agentName || null);
            b.agentId = b.agentIds[0] ?? null;
          }
        }

        return list;
      }
    }
  } catch (err) {
    console.warn(`[Firestore] Failed to read ${tName}:`, err);
  }
  return memoryStore[tName] || [];
}

async function syncDocToFirestore(tName: string, id: any, data: any): Promise<void> {
  const fDb = getFirestoreInstance();
  if (!fDb) return;
  try {
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(doc(fDb, tName, String(id)), cleanData, { merge: true });
  } catch (err) {
    console.warn(`[Firestore] Failed to sync ${tName}/${id}:`, err);
  }
}

async function deleteDocFromFirestore(tName: string, id: any): Promise<void> {
  const fDb = getFirestoreInstance();
  if (!fDb) return;
  try {
    await deleteDoc(doc(fDb, tName, String(id)));
  } catch (err) {
    console.warn(`[Firestore] Failed to delete ${tName}/${id}:`, err);
  }
}

// Initial bootstrap from Firestore
void (async () => {
  for (const t of ["beneficiaries", "agents", "admins", "deposit_methods", "notifications", "custom_phases", "audit_logs"]) {
    await loadCollectionFromFirestore(t);
  }
})();

export const db: any = {
  select(selection?: any) {
    return {
      from(table: any) {
        const tName = getTableName(table);
        let currentConditions: any = null;
        let limitCount: number | null = null;
        let isGrouped = false;
        let leftJoinTable: any = null;
        let innerJoinTable: any = null;

        const queryObj: any = {
          where(cond: any) {
            currentConditions = cond;
            return queryObj;
          },
          orderBy() {
            return queryObj;
          },
          limit(n: number) {
            limitCount = n;
            return queryObj;
          },
          groupBy() {
            isGrouped = true;
            return queryObj;
          },
          leftJoin(otherTable: any, _cond: any) {
            leftJoinTable = otherTable;
            return queryObj;
          },
          innerJoin(otherTable: any, _cond: any) {
            innerJoinTable = otherTable;
            return queryObj;
          },
          then(resolve: any, reject?: any) {
            loadCollectionFromFirestore(tName)
              .then((freshList) => {
                let list = [...freshList];
                const conditions = extractConditions(currentConditions);
                if (conditions.length > 0) {
                  list = list.filter((item) => {
                    return conditions.every((c) => {
                      const camelKey = snakeToCamel(c.key);
                      const itemVal = item[c.key] !== undefined ? item[c.key] : item[camelKey];
                      if (Array.isArray(c.value)) {
                        return c.value.includes(itemVal);
                      }
                      if (c.value === null) {
                        return itemVal === null || itemVal === undefined;
                      }
                      return String(itemVal) === String(c.value);
                    });
                  });
                }

                if (isGrouped && selection && selection.count) {
                  const map = new Map<number, number>();
                  for (const b of list) {
                    const ids: number[] = Array.isArray(b.agentIds) && b.agentIds.length > 0
                      ? b.agentIds.map(Number)
                      : (b.agentId ? [Number(b.agentId)] : []);
                    for (const aid of ids) {
                      map.set(aid, (map.get(aid) || 0) + 1);
                    }
                  }
                  list = Array.from(map.entries()).map(([agentId, count]) => ({ agentId, count }));
                }

                if (leftJoinTable) {
                  const otherName = getTableName(leftJoinTable);
                  const otherList = memoryStore[otherName] || [];
                  const otherMap = new Map<any, any>();
                  for (const o of otherList) {
                    otherMap.set(Number(o.id), o);
                  }
                  list = list.map((item) => {
                    const ids: number[] = Array.isArray(item.agentIds) && item.agentIds.length > 0
                      ? item.agentIds.map(Number)
                      : (item.agentId ? [Number(item.agentId)] : []);
                    const names = ids.map((aid: number) => otherMap.get(aid)?.name).filter(Boolean);
                    return {
                      ...item,
                      agentIds: ids,
                      agentNames: names,
                      agentName: names.length > 0 ? names.join("، ") : (item.agentName || null),
                      agentId: ids[0] ?? null,
                    };
                  });
                }

                if (innerJoinTable) {
                  const otherName = getTableName(innerJoinTable);
                  const otherList = memoryStore[otherName] || [];
                  const otherMap = new Map<any, any>();
                  for (const o of otherList) {
                    otherMap.set(o.id, o);
                  }
                  const joined: any[] = [];
                  for (const item of list) {
                    const foreignId = item.beneficiaryId || item.userId;
                    const matched = foreignId ? otherMap.get(foreignId) : null;
                    if (matched) {
                      joined.push({
                        ...item,
                        beneficiaryName: matched.name,
                        beneficiaryUsername: matched.username,
                      });
                    }
                  }
                  list = joined;
                }

                if (limitCount !== null) {
                  list = list.slice(0, limitCount);
                }

                resolve(list);
              })
              .catch((err) => {
                if (reject) reject(err);
                else resolve(memoryStore[tName] || []);
              });
          },
        };

        return queryObj;
      },
    };
  },

  insert(table: any) {
    const tName = getTableName(table);
    return {
      values(data: any) {
        if (!memoryStore[tName]) memoryStore[tName] = [];
        const recordsToInsert = Array.isArray(data) ? data : [data];
        const insertedList: any[] = [];

        for (const raw of recordsToInsert) {
          const record: any = {
            id: raw.id ?? autoIncrementId++,
            ...raw,
            createdAt: raw.createdAt || new Date(),
            updatedAt: raw.updatedAt || new Date(),
          };
          memoryStore[tName].push(record);
          insertedList.push(record);
        }

        const res = Array.isArray(data) ? insertedList : [insertedList[0]];

        const resultObj = {
          returning() {
            return (async () => {
              for (const r of insertedList) {
                await syncDocToFirestore(tName, r.id, r);
              }
              return res;
            })();
          },
          then(resolve: any) {
            (async () => {
              for (const r of insertedList) {
                await syncDocToFirestore(tName, r.id, r);
              }
              resolve(res);
            })();
          },
        };

        return resultObj;
      },
    };
  },

  update(table: any) {
    const tName = getTableName(table);
    return {
      set(updates: any) {
        return {
          where(cond: any) {
            const conditions = extractConditions(cond);
            const list = memoryStore[tName] || [];
            const updatedRows: any[] = [];

            for (let i = 0; i < list.length; i++) {
              const item = list[i];
              const match =
                conditions.length === 0 ||
                conditions.every((c) => {
                  const camelKey = snakeToCamel(c.key);
                  const itemVal = item[c.key] !== undefined ? item[c.key] : item[camelKey];
                  return String(itemVal) === String(c.value);
                });

              if (match) {
                list[i] = {
                  ...item,
                  ...updates,
                  updatedAt: new Date(),
                };
                updatedRows.push(list[i]);
              }
            }

            const resultObj = {
              returning() {
                return (async () => {
                  for (const r of updatedRows) {
                    await syncDocToFirestore(tName, r.id, r);
                  }
                  return updatedRows;
                })();
              },
              then(resolve: any) {
                (async () => {
                  for (const r of updatedRows) {
                    await syncDocToFirestore(tName, r.id, r);
                  }
                  resolve(updatedRows);
                })();
              },
            };

            return resultObj;
          },
        };
      },
    };
  },

  delete(table: any) {
    const tName = getTableName(table);
    return {
      where(cond: any) {
        const conditions = extractConditions(cond);
        const list = memoryStore[tName] || [];
        const deletedRows: any[] = [];
        const remaining: any[] = [];

        for (const item of list) {
          const match =
            conditions.length > 0 &&
            conditions.every((c) => {
              const camelKey = snakeToCamel(c.key);
              const itemVal = item[c.key] !== undefined ? item[c.key] : item[camelKey];
              return String(itemVal) === String(c.value);
            });

          if (match) {
            deletedRows.push(item);
          } else {
            remaining.push(item);
          }
        }

        memoryStore[tName] = remaining;

        const resultObj = {
          returning() {
            return (async () => {
              for (const r of deletedRows) {
                await deleteDocFromFirestore(tName, r.id);
              }
              return deletedRows;
            })();
          },
          then(resolve: any) {
            (async () => {
              for (const r of deletedRows) {
                await deleteDocFromFirestore(tName, r.id);
              }
              resolve(deletedRows);
            })();
          },
        };

        return resultObj;
      },
    };
  },
};

export * from "./schema";
