// useRealtimeSync.ts - Firebase-backed cursor sync (works cross-network)
// Supports lazy board ID — works even when URL doesn't show the ID yet
import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { FireProvider } from "y-fire";
import { initializeApp, getApps, getApp } from "firebase/app";

/// <reference types="vite/client" />

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

interface SharedBoard {
  id: string;
  elements: any[];
  participants: Participant[];
  viewport: ViewportState;
}

interface ViewportState {
  scrollX: number;
  scrollY: number;
  zoomLevel: number;
}

interface Participant {
  id: string;
  name: string;
  role: "host" | "guest";
  color: string;
}

export interface UserAwareness {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number } | null;
  activeTool?: string;
  isDrawing?: boolean;
  viewport?: ViewportState;
  user?: {
    id: string;
    name: string;
    color: string;
    activeTool?: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Convert a string clientId to a stable numeric key for the Map
const clientIdToNumeric = (clientId: string): number => {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    const char = clientId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 32-bit int
  }
  return Math.abs(hash);
};

const CURSOR_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
];

const pickColor = () =>
  CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];

/**
 * When the user is on "/" (no boardId in URL), we still need a real ID
 * to connect to Firebase. Store it in sessionStorage so that:
 *   - Refreshing the same tab reconnects to the same board.
 *   - Opening a new tab starts a fresh board.
 */
const getOrCreateSessionBoardId = (): string => {
  const existing = sessionStorage.getItem("edxly-current-board");
  if (existing) return existing;
  const newId = crypto.randomUUID();
  sessionStorage.setItem("edxly-current-board", newId);
  return newId;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useRealtimeSync = (
  boardId: string,          // "" when on "/" (lazy), real UUID when opened via share link
  userRole: "host" | "guest",
  userName: string,
  currentTool: string
) => {
  // Resolve the real board ID to use for Firebase.
  // If boardId is provided (guest opened a share link), use it directly.
  // Otherwise, generate/reuse one from sessionStorage (host on "/" route).
 // boardId should always be correct now — but keep fallback for safety
const resolvedBoardId = boardId || getOrCreateSessionBoardId();
console.log("🔥 Connecting to board:", resolvedBoardId, "| raw boardId:", boardId);

  const [board, setBoard] = useState<SharedBoard>({
    id: resolvedBoardId,
    elements: [],
    participants: [],
    viewport: { scrollX: 0, scrollY: 0, zoomLevel: 1.0 },
  });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [awarenessStates, setAwarenessStates] = useState<
    Map<number, UserAwareness>
  >(new Map());

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<FireProvider | null>(null);
  const elementsRef = useRef<Y.Array<any> | null>(null);
  const participantsRef = useRef<Y.Map<Participant> | null>(null);
  const viewportRef = useRef<Y.Map<any> | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const cursorsRef = useRef<Y.Map<any> | null>(null);

  const myClientIdRef = useRef<string>("");
  const myColorRef = useRef<string>("");
  const initializedRef = useRef(false);
  const lastUpdateRef = useRef<number>(0);
  const THROTTLE_MS = 40;

  // ─── INIT ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Wait until we have a userName and a board ID before connecting
    if (initializedRef.current || !userName || !resolvedBoardId) return;
    initializedRef.current = true;

    // Stable client identity (survives page refreshes)
    const clientId =
      localStorage.getItem("clientId") || crypto.randomUUID();
    localStorage.setItem("clientId", clientId);
    myClientIdRef.current = clientId;

    // Stable cursor color (survives page refreshes)
    const storedColor =
      localStorage.getItem("edxly-cursor-color") || pickColor();
    localStorage.setItem("edxly-cursor-color", storedColor);
    myColorRef.current = storedColor;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new FireProvider({
      firebaseApp: app,
      ydoc: ydoc,
      path: `edxly-boards/board-${resolvedBoardId}`,
    });
    providerRef.current = provider;

    // ── Shared Y.js data structures ──────────────────────────────────────────
    const elements = ydoc.getArray("elements");
    const participantsMap = ydoc.getMap<Participant>("participants");
    const viewport = ydoc.getMap("viewport");
    const cursors = ydoc.getMap("cursors"); // cross-network cursor store

    elementsRef.current = elements;
    participantsRef.current = participantsMap;
    viewportRef.current = viewport;
    cursorsRef.current = cursors;

    // ── Observers ────────────────────────────────────────────────────────────

    elements.observe(() => {
      setBoard((prev) => ({ ...prev, elements: elements.toArray() }));
      setIsConnected(true);
    });

    viewport.observe(() => {
      setBoard((prev) => ({
        ...prev,
        viewport: {
          scrollX: (viewport.get("scrollX") as number) || 0,
          scrollY: (viewport.get("scrollY") as number) || 0,
          zoomLevel: (viewport.get("zoomLevel") as number) || 1.0,
        },
      }));
    });

    participantsMap.observe(() => {
      const current = Array.from(participantsMap.values());
      setParticipants(current);
      setBoard((prev) => ({ ...prev, participants: current }));
    });

    // Cursors observer — rebuilds remote cursor states whenever any cursor changes
const rebuildAwarenessStates = () => {
  const freshMyId = localStorage.getItem("clientId"); // ← always fresh, no stale closure
  const newStates = new Map<number, UserAwareness>();
  cursors.forEach((value: any, key: string) => {
    if (value.lastSeen && Date.now() - value.lastSeen > 30_000) return;
    if (key === freshMyId) return;
    if (!value.user && !value.id) return;

    const numericId = clientIdToNumeric(key);
    newStates.set(numericId, {
      id: value.user?.id || value.id || key,
      name: value.user?.name || value.name || "Guest",
      color: value.user?.color || value.color || "#3B82F6",
      cursor: value.cursor || null,
      activeTool: value.user?.activeTool || "selection",
      user: value.user,
    });
  });
  setAwarenessStates(newStates);
};

cursors.observe(rebuildAwarenessStates);
rebuildAwarenessStates(); // ← run once immediately on mount

    // ── Announce this user's identity to Firebase ─────────────────────────────
    // const announceIdentity = () => {
    //   cursors.set(clientId, {
    //     user: {
    //       id: clientId,
    //       name: userName,
    //       color: storedColor,
    //       activeTool: currentTool || "selection",
    //     },
    //     cursor: null,
    //     lastSeen: Date.now(),
    //   });
    // };
    const announceIdentity = () => {
  const clientId = localStorage.getItem("clientId"); // Always use the UUID
  if (!clientId || !cursorsRef.current) return;

  cursorsRef.current.set(clientId, {
    id:clientId,
    user: {
      id: clientId,
      name: userName,
      color: storedColor,
      activeTool: currentTool || "selection",
    },
    cursor: null,
    lastSeen: Date.now(),
  });
};

    announceIdentity();

    // Register in participants map
    if (!participantsMap.has(clientId)) {
      participantsMap.set(clientId, {
        id: clientId,
        name: userName,
        role: userRole,
        color: storedColor,
      });
    }

provider.on("synced", (isSynced: boolean) => {
  setIsConnected(isSynced);
  if (isSynced) {
    announceIdentity();
    rebuildAwarenessStates();
  }
});

// Mobile fix: poll every 2s since Firebase observer fires unreliably on mobile
const pollInterval = setInterval(rebuildAwarenessStates, 2000);

// Mobile fix: rebuild when user switches back to tab
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    rebuildAwarenessStates();
  }
};
document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    // return () => {
    //   initializedRef.current = false;
    //   // Mark cursor as instantly stale so peers immediately stop showing it
    //   if (cursorsRef.current) {
    //     cursorsRef.current.set(clientId, {
    //       user: {
    //         id: clientId,
    //         name: userName,
    //         color: storedColor,
    //         activeTool: "selection",
    //       },
    //       cursor: null,
    //       lastSeen: 0,
    //     });
    //   }
    //   provider.destroy();
    //   ydoc.destroy();
    // };


return () => {
  initializedRef.current = false;
  clearInterval(pollInterval);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  const clientId = localStorage.getItem("clientId");
  if (cursorsRef.current && clientId) {
    cursorsRef.current.set(clientId, {
      cursor: null,
      lastSeen: 0,
    });
  }
  provider.destroy();
  ydoc.destroy();
};

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedBoardId, userName, userRole]);

  // ─── IDENTITY BROADCAST ──────────────────────────────────────────────────────
  // Re-runs whenever the user's name or active tool changes so remote peers
  // always see the latest info.
  useEffect(() => {
    const clientId = myClientIdRef.current;
    if (!clientId || !cursorsRef.current || !userName) return;

    const existing = cursorsRef.current.get(clientId) || {};
    cursorsRef.current.set(clientId, {
      ...existing,
      user: {
        id: clientId,
        name: userName,
        color: myColorRef.current,
        activeTool: currentTool || "selection",
      },
      lastSeen: Date.now(),
    });
  }, [userName, currentTool]);

  // ─── CURSOR UPDATE (throttled) ────────────────────────────────────────────────
  const updateCursorThrottled = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < THROTTLE_MS) return;
    lastUpdateRef.current = now;

    const clientId = myClientIdRef.current;
    if (!clientId || !cursorsRef.current) return;

    const existing = cursorsRef.current.get(clientId) || {};
    cursorsRef.current.set(clientId, {
      ...existing,
      cursor: { x, y },
      lastSeen: now,
    });
  }, []);

  // ─── ACTIVE TOOL BROADCAST ────────────────────────────────────────────────────
  const updateActiveTool = useCallback((tool: string) => {
    const clientId = myClientIdRef.current;
    if (!clientId || !cursorsRef.current) return;

    const existing = cursorsRef.current.get(clientId) || {};
    cursorsRef.current.set(clientId, {
      ...existing,
      user: {
        ...(existing.user || {}),
        activeTool: tool,
      },
      lastSeen: Date.now(),
    });
  }, []);

  // ─── ELEMENT OPERATIONS ───────────────────────────────────────────────────────
  const addElement = useCallback((element: any) => {
    if (!elementsRef.current) return;
    if (!element.id) {
      element.id = `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    elementsRef.current.push([element]);
  }, []);

  const updateElement = useCallback(
    (elementId: string, updates: Partial<any>) => {
      const elements = elementsRef.current;
      if (!elements || !ydocRef.current) return;
      const arr = elements.toArray();
      const index = arr.findIndex((el: any) => el.id === elementId);
      if (index !== -1) {
        ydocRef.current.transact(() => {
          const updated = { ...arr[index], ...updates };
          elements.delete(index, 1);
          elements.insert(index, [updated]);
        });
      }
    },
    []
  );

  const deleteElement = useCallback((elementId: string) => {
    if (!elementsRef.current) return;
    const arr = elementsRef.current.toArray();
    const index = arr.findIndex((el: any) => el.id === elementId);
    if (index !== -1) elementsRef.current.delete(index, 1);
  }, []);

  const updateViewport = useCallback((v: Partial<ViewportState>) => {
    if (!viewportRef.current) return;
    if (v.scrollX !== undefined) viewportRef.current.set("scrollX", v.scrollX);
    if (v.scrollY !== undefined) viewportRef.current.set("scrollY", v.scrollY);
    if (v.zoomLevel !== undefined)
      viewportRef.current.set("zoomLevel", v.zoomLevel);
  }, []);

  // ─── RETURN ───────────────────────────────────────────────────────────────────
  return {
    board,
    participants,
    isConnected,
    awarenessStates,
    resolvedBoardId,       // ← BoardPage uses this when building the share URL
    updateCursorThrottled,
    updateActiveTool,
    addElement,
    updateElement,
    deleteElement,
    updateViewport,
    undo: () => undoManagerRef.current?.undo(),
    redo: () => undoManagerRef.current?.redo(),
    ydoc: ydocRef.current,
    awareness: null,       // Cursors now go through Firebase, not Y.js awareness
  };
};