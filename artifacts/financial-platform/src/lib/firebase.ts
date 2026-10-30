import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  memoryLocalCache,
  setLogLevel,
  type Firestore,
} from "firebase/firestore";
import firebaseConfig from "../../../../firebase-applet-config.json";

// Suppress internal non-fatal SDK logs (such as BloomFilter fallback to full re-query)
try {
  setLogLevel("silent");
} catch {
  // ignore
}

if (typeof window !== "undefined") {
  const origError = console.error;
  console.error = function (...args: any[]) {
    try {
      const text = args
        .map((a) => (typeof a === "object" ? (a?.message || a?.name || JSON.stringify(a)) : String(a)))
        .join(" ");
      if (
        text.includes("BloomFilter error") ||
        text.includes("BloomFilterError") ||
        text.includes("Invalid hash count")
      ) {
        // Safe internal fallback: SDK automatically performs full re-query
        return;
      }
    } catch {
      // ignore
    }
    origError.apply(console, args);
  };
}

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with memoryLocalCache and experimentalForceLongPolling to eliminate BloomFilter and timeout issues
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreInstance;
export const auth = getAuth(app);
