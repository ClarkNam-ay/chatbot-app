"use client";

import { supabase } from "@/app/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
  createdAt: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface ChatResponse {
  reply?: string;
  error?: string;
  details?: string;
}

interface Profile {
  id: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface ChatSessionRow {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatMessageRow {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const NEURA_CLARK_LOGO_SRC = "/neura-clark-logo.png";
const NEURA_CLARK_WORDMARK_SRC = "/neura-clark-white.png";

function getUserDisplayName(user: User | null) {
  const metadataName =
    user?.user_metadata?.full_name ?? user?.user_metadata?.name;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return user?.email?.split("@")[0] ?? "Account";
}

function getUserInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "U";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    avatarUrl: row.avatar_url,
  };
}

function mapMessage(row: ChatMessageRow): Message {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

function mapSession(
  row: ChatSessionRow,
  messages: Message[] = [],
): ChatSession {
  return {
    id: row.id,
    title: row.title || "New conversation",
    messages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureUserProfile(currentUser: User) {
  const fullName = getUserDisplayName(currentUser);

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: currentUser.id,
        full_name: fullName,
        email: currentUser.email ?? null,
      },
      { onConflict: "id" },
    )
    .select("id, full_name, email, avatar_url")
    .single();

  if (error) throw error;

  return mapProfile(data as ProfileRow);
}

async function createStoredSession(userId: string, title = "New conversation") {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: userId, title })
    .select("id, title, created_at, updated_at")
    .single();

  if (error) throw error;

  return mapSession(data as ChatSessionRow);
}

async function loadStoredSessions(userId: string) {
  const { data: sessionRows, error: sessionsError } = await supabase
    .from("chat_sessions")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (sessionsError) throw sessionsError;

  const rows = (sessionRows ?? []) as ChatSessionRow[];

  if (rows.length === 0) {
    return [await createStoredSession(userId)];
  }

  const sessionIds = rows.map((session) => session.id);
  const { data: messageRows, error: messagesError } = await supabase
    .from("chat_messages")
    .select("id, session_id, role, content, created_at")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });

  if (messagesError) throw messagesError;

  const messagesBySession = new Map<string, Message[]>();
  ((messageRows ?? []) as ChatMessageRow[]).forEach((message) => {
    const messages = messagesBySession.get(message.session_id) ?? [];
    messages.push(mapMessage(message));
    messagesBySession.set(message.session_id, messages);
  });

  return rows.map((session) =>
    mapSession(session, messagesBySession.get(session.id)),
  );
}

async function updateStoredSessionTitle(sessionId: string, title: string) {
  const { error } = await supabase
    .from("chat_sessions")
    .update({ title })
    .eq("id", sessionId);

  if (error) throw error;
}

async function deleteStoredSession(sessionId: string) {
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) throw error;
}

async function saveStoredMessage(
  userId: string,
  sessionId: string,
  role: Message["role"],
  content: string,
) {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      user_id: userId,
      session_id: sessionId,
      role,
      content,
    })
    .select("id, session_id, role, content, created_at")
    .single();

  if (error) throw error;

  return mapMessage(data as ChatMessageRow);
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [openSessionMenuId, setOpenSessionMenuId] = useState("");
  const [renamingSessionId, setRenamingSessionId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deleteTargetSessionId, setDeleteTargetSessionId] = useState("");
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error || !data.user) {
        router.replace("/auth/login");
        return;
      }

      setUser(data.user);
      setAuthLoading(false);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setSessions([]);
        setActiveSessionId("");
        setOpenSessionMenuId("");
        setRenamingSessionId("");
        setDeleteTargetSessionId("");
        setIsDeletingSession(false);
        router.replace("/auth/login");
        return;
      }

      setUser(session.user);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    const closeMenus = () => setOpenSessionMenuId("");

    window.addEventListener("click", closeMenus);

    return () => {
      window.removeEventListener("click", closeMenus);
    };
  }, []);

  useEffect(() => {
    if (!deleteTargetSessionId || isDeletingSession) return;

    const closeDeleteModal = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDeleteTargetSessionId("");
      }
    };

    window.addEventListener("keydown", closeDeleteModal);

    return () => {
      window.removeEventListener("keydown", closeDeleteModal);
    };
  }, [deleteTargetSessionId, isDeletingSession]);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    const loadData = async () => {
      setDataLoading(true);
      setSyncError("");

      try {
        const [profileData, storedSessions] = await Promise.all([
          ensureUserProfile(user),
          loadStoredSessions(user.id),
        ]);

        if (!mounted) return;

        setProfile(profileData);
        setSessions(storedSessions);
        setActiveSessionId(storedSessions[0]?.id ?? "");
      } catch (error) {
        if (!mounted) return;
        setSyncError(
          `Supabase data setup is not ready yet: ${getErrorMessage(error)}`,
        );
      } finally {
        if (mounted) setDataLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [user]);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? sessions[0] ?? null;
  const deleteTargetSession =
    sessions.find((session) => session.id === deleteTargetSessionId) ?? null;
  const profileName = profile?.fullName?.trim() || getUserDisplayName(user);
  const profileEmail = profile?.email || user?.email || "";
  const profileInitial = getUserInitial(profileName);
  const profileAvatarUrl = profile?.avatarUrl?.trim() || "";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const createNewSession = async () => {
    if (!user) return;

    setSyncError("");
    setOpenSessionMenuId("");
    setRenamingSessionId("");
    setDeleteTargetSessionId("");

    try {
      const newSession = await createStoredSession(user.id);
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setInput("");
    } catch (error) {
      setSyncError(`Could not create chat: ${getErrorMessage(error)}`);
    }
  };

  const startRenamingSession = (session: ChatSession) => {
    setOpenSessionMenuId("");
    setRenamingSessionId(session.id);
    setRenameValue(session.title);
  };

  const cancelRenamingSession = () => {
    setRenamingSessionId("");
    setRenameValue("");
  };

  const saveRenamedSession = async (sessionId: string) => {
    const nextTitle = renameValue.trim() || "New conversation";

    setRenamingSessionId("");
    setRenameValue("");
    setSyncError("");

    try {
      await updateStoredSessionTitle(sessionId, nextTitle);
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId ? { ...session, title: nextTitle } : session,
        ),
      );
    } catch (error) {
      setSyncError(`Could not rename chat: ${getErrorMessage(error)}`);
    }
  };

  const handleRenameSubmit = (
    e: React.FormEvent<HTMLFormElement>,
    sessionId: string,
  ) => {
    e.preventDefault();
    void saveRenamedSession(sessionId);
  };

  const openDeleteSessionModal = (sessionId: string) => {
    setOpenSessionMenuId("");
    setRenamingSessionId("");
    setDeleteTargetSessionId(sessionId);
  };

  const closeDeleteSessionModal = () => {
    if (isDeletingSession) return;

    setDeleteTargetSessionId("");
  };

  const deleteSession = async () => {
    if (!user || !deleteTargetSessionId || isDeletingSession) return;

    const sessionId = deleteTargetSessionId;

    setIsDeletingSession(true);
    setOpenSessionMenuId("");
    setRenamingSessionId("");
    setSyncError("");

    try {
      await deleteStoredSession(sessionId);
      setDeleteTargetSessionId("");

      const remainingSessions = sessions.filter(
        (session) => session.id !== sessionId,
      );

      if (remainingSessions.length === 0) {
        const newSession = await createStoredSession(user.id);
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
        return;
      }

      setSessions(remainingSessions);

      if (activeSessionId === sessionId) {
        setActiveSessionId(remainingSessions[0].id);
      }
    } catch (error) {
      setDeleteTargetSessionId("");
      setSyncError(`Could not delete chat: ${getErrorMessage(error)}`);
    } finally {
      setIsDeletingSession(false);
    }
  };

  const handleLogout = async () => {
    setLogoutError("");
    setIsLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setLogoutError(error.message);
      setIsLoggingOut(false);
      return;
    }

    router.replace("/auth/login");
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !user || !activeSession) return;

    const messageText = input.trim();
    const newTitle =
      activeSession.messages.length === 0
        ? messageText.slice(0, 36) + (messageText.length > 36 ? "..." : "")
        : activeSession.title;

    setInput("");
    setSyncError("");
    setIsLoading(true);

    try {
      const userMessage = await saveStoredMessage(
        user.id,
        activeSession.id,
        "user",
        messageText,
      );

      await updateStoredSessionTitle(activeSession.id, newTitle);

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? { ...s, title: newTitle, messages: [...s.messages, userMessage] }
            : s,
        ),
      );

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Please sign in again before sending a message.");
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: messageText }),
      });

      const data = (await res.json()) as ChatResponse;

      if (!res.ok || !data.reply) {
        throw new Error(data.details || data.error || "No reply from AI");
      }

      const assistantMessage = await saveStoredMessage(
        user.id,
        activeSession.id,
        "assistant",
        data.reply,
      );

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? { ...s, messages: [...s.messages, assistantMessage] }
            : s,
        ),
      );
    } catch (error) {
      const errorText =
        error instanceof Error
          ? `AI request failed: ${error.message}`
          : "Something went wrong. Please try again.";

      try {
        const errorMessage = await saveStoredMessage(
          user.id,
          activeSession.id,
          "assistant",
          errorText,
        );

        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSession.id
              ? { ...s, messages: [...s.messages, errorMessage] }
              : s,
          ),
        );
      } catch (saveError) {
        setSyncError(`Could not save message: ${getErrorMessage(saveError)}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (authLoading || !user || dataLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0f0f0f",
          color: "#e8e6e1",
          fontFamily: "DM Sans, Arial, sans-serif",
        }}
      >
        Loading dashboard...
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');

        :root {
          --bg: #0f0f0f;
          --surface: #171717;
          --surface-2: #1f1f1f;
          --border: #2a2a2a;
          --border-hover: #3a3a3a;
          --text: #e8e6e1;
          --text-muted: #6b6b6b;
          --text-subtle: #4a4a4a;
          --accent: #c9a96e;
          --accent-dim: rgba(201, 169, 110, 0.12);
          --accent-glow: rgba(201, 169, 110, 0.06);
          --user-bg: #1e1c19;
          --assistant-bg: transparent;
          --radius: 14px;
          --sidebar-w: 260px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .chat-root {
          display: flex;
          height: 100vh;
          background: var(--bg);
          font-family: 'DM Sans', sans-serif;
          color: var(--text);
          overflow: hidden;
        }

        /* ── Sidebar ── */
        .sidebar {
          width: var(--sidebar-w);
          background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          transition: width 0.25s ease, opacity 0.25s ease;
          overflow: hidden;
        }
        .sidebar.closed {
          width: 0;
          opacity: 0;
          border-right: none;
        }

        .sidebar-header {
          padding: 14px 16px 12px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
        }

        .brand-logo {
          width: 184px;
          height: 58px;
          object-fit: cover;
          object-position: center;
        }

        .new-chat-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 12px 12px 8px;
          padding: 10px 14px;
          background: var(--accent-dim);
          border: 1px solid rgba(201,169,110,0.2);
          border-radius: 10px;
          color: var(--accent);
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .new-chat-btn:hover {
          background: rgba(201,169,110,0.18);
          border-color: rgba(201,169,110,0.35);
        }
        .new-chat-btn svg { flex-shrink: 0; }

        .history-label {
          padding: 12px 16px 6px;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-subtle);
          white-space: nowrap;
        }

        .sessions-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 8px 12px;
        }
        .sessions-list::-webkit-scrollbar { width: 4px; }
        .sessions-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

        .sidebar-footer {
          border-top: 1px solid var(--border);
          padding: 12px;
          flex-shrink: 0;
        }
        .profile-row {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .profile-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--accent-dim);
          border: 1px solid rgba(201,169,110,0.25);
          color: var(--accent);
          font-size: 13px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .avatar-image {
          width: 100%;
          height: 100%;
          border-radius: inherit;
          background-position: center;
          background-size: cover;
        }
        .profile-meta {
          min-width: 0;
          flex: 1;
        }
        .profile-name,
        .profile-email {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .profile-name {
          font-size: 13px;
          color: var(--text);
          font-weight: 500;
        }
        .profile-email {
          font-size: 11px;
          color: var(--text-subtle);
          margin-top: 2px;
        }
        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 10px;
          padding: 9px 12px;
          border-radius: 9px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }
        .logout-btn:hover:not(:disabled) {
          background: var(--surface-2);
          color: var(--text);
          border-color: var(--border-hover);
        }
        .logout-btn:disabled {
          opacity: 0.55;
          cursor: wait;
        }
        .logout-error {
          margin-top: 8px;
          color: #e05c5c;
          font-size: 11px;
          line-height: 1.4;
        }

        .session-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 10px;
          border-radius: 9px;
          cursor: pointer;
          transition: background 0.12s;
          white-space: nowrap;
          overflow: visible;
        }
        .session-item:hover { background: var(--surface-2); }
        .session-item.active { background: var(--surface-2); }
        .session-item.active .session-dot { background: var(--accent); }
        .session-main {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex: 1;
        }

        .session-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--text-subtle);
          flex-shrink: 0;
          transition: background 0.12s;
        }
        .session-title {
          min-width: 0;
          flex: 1;
          font-size: 13px;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .session-item.active .session-title { color: var(--text); }
        .session-actions {
          position: relative;
          flex-shrink: 0;
          opacity: 0;
          transition: opacity 0.12s;
        }
        .session-item:hover .session-actions,
        .session-item.active .session-actions,
        .session-item.menu-open .session-actions {
          opacity: 1;
        }
        .session-menu-btn {
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          border: none;
          background: transparent;
          color: var(--text-subtle);
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
        }
        .session-menu-btn:hover {
          background: var(--border);
          color: var(--text);
        }
        .session-menu {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          z-index: 20;
          width: 132px;
          padding: 5px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: #202020;
          box-shadow: 0 16px 40px rgba(0,0,0,0.35);
        }
        .session-menu-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          border: none;
          border-radius: 7px;
          background: transparent;
          color: var(--text-muted);
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          cursor: pointer;
          text-align: left;
        }
        .session-menu-item:hover {
          background: var(--surface-2);
          color: var(--text);
        }
        .session-menu-item.danger {
          color: #e05c5c;
        }
        .session-menu-item.danger:hover {
          background: rgba(224,92,92,0.1);
        }
        .session-rename-form {
          flex: 1;
          min-width: 0;
        }
        .session-rename-input {
          width: 100%;
          height: 28px;
          border: 1px solid rgba(201,169,110,0.35);
          border-radius: 7px;
          background: var(--surface);
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          outline: none;
          padding: 0 8px;
        }

        /* ── Main ── */
        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          position: relative;
        }

        /* ── Topbar ── */
        .topbar {
          height: 55px;
          padding: 0 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .icon-btn {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
          flex-shrink: 0;
        }
        .icon-btn:hover {
          background: var(--surface-2);
          color: var(--text);
          border-color: var(--border-hover);
        }
        .topbar-title {
          font-size: 14px;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          font-weight: 400;
        }

        /* ── Messages ── */
        .messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 32px 0 8px;
          scroll-behavior: smooth;
        }
        .messages-area::-webkit-scrollbar { width: 4px; }
        .messages-area::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

        .messages-inner {
          max-width: 680px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        /* ── Empty state ── */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          padding: 40px;
        }
        .empty-icon {
          width: 64px;
          height: 64px;
          display: grid;
          place-items: center;
          margin-bottom: 20px;
        }

        .empty-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .empty-state h2 {
          font-family: 'Instrument Serif', serif;
          font-size: 24px;
          font-weight: 400;
          color: var(--text);
          margin-bottom: 8px;
        }
        .empty-state p {
          font-size: 14px;
          color: var(--text-muted);
          line-height: 1.6;
          max-width: 320px;
        }

        /* ── Message bubbles ── */
        .message-row {
          display: flex;
          gap: 12px;
          padding: 10px 0;
          animation: fadeSlideIn 0.2s ease;
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .message-row.user {
          flex-direction: row-reverse;
        }

        .avatar {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 600;
          margin-top: 2px;
          overflow: hidden;
        }
        .avatar.user-avatar {
          background: var(--accent-dim);
          border: 1px solid rgba(201,169,110,0.25);
          color: var(--accent);
        }
        .avatar.assistant-avatar {
          background: #050505;
          border: 1px solid rgba(201,169,110,0.28);
          padding: 2px;
        }

        .assistant-logo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }

        .bubble {
          max-width: calc(100% - 52px);
          padding: 11px 15px;
          border-radius: var(--radius);
          font-size: 14px;
          line-height: 1.65;
          font-weight: 300;
        }
        .message-row.user .bubble {
          background: var(--user-bg);
          border: 1px solid var(--border);
          border-bottom-right-radius: 4px;
          color: var(--text);
        }
        .message-row.assistant .bubble {
          background: var(--assistant-bg);
          border: 1px solid transparent;
          border-bottom-left-radius: 4px;
          color: var(--text);
          padding-left: 0;
        }

        /* ── Typing indicator ── */
        .typing-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
        }
        .typing-dots {
          display: flex;
          gap: 4px;
          padding: 12px 4px;
        }
        .typing-dots span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--text-subtle);
          animation: bounce 1.2s infinite ease-in-out;
        }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }

        /* ── Input area ── */
        .input-area {
          padding: 16px 24px 20px;
          border-top: 1px solid var(--border);
          flex-shrink: 0;
        }
        .input-inner {
          max-width: 680px;
          margin: 0 auto;
        }
        .input-box {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 10px 12px 10px 16px;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input-box:focus-within {
          border-color: rgba(201,169,110,0.35);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }
        .input-box textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 300;
          line-height: 1.6;
          resize: none;
          min-height: 24px;
          max-height: 160px;
          overflow-y: auto;
        }
        .input-box textarea::placeholder { color: var(--text-subtle); }
        .input-box textarea::-webkit-scrollbar { width: 3px; }
        .input-box textarea::-webkit-scrollbar-thumb { background: var(--border); }

        .send-btn {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          border: none;
          background: var(--accent);
          color: #0f0f0f;
          display: grid;
          place-items: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: opacity 0.15s, transform 0.1s;
        }
        .send-btn:hover:not(:disabled) { opacity: 0.88; transform: scale(1.04); }
        .send-btn:disabled { opacity: 0.3; cursor: default; }

        .input-hint {
          text-align: center;
          font-size: 11px;
          color: var(--text-subtle);
          margin-top: 10px;
        }
        .sync-error {
          max-width: 680px;
          margin: 0 auto 10px;
          padding: 9px 12px;
          border-radius: 9px;
          border: 1px solid rgba(224,92,92,0.24);
          background: rgba(224,92,92,0.08);
          color: #e05c5c;
          font-size: 12px;
          line-height: 1.45;
        }

        .delete-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(5,5,5,0.74);
          backdrop-filter: blur(10px);
        }
        .delete-modal {
          width: min(100%, 390px);
          border-radius: 12px;
          border: 1px solid var(--border);
          background: #191919;
          box-shadow: 0 24px 80px rgba(0,0,0,0.52);
          padding: 20px;
        }
        .delete-modal-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(224,92,92,0.1);
          border: 1px solid rgba(224,92,92,0.24);
          color: #e05c5c;
          margin-bottom: 14px;
        }
        .delete-modal h2 {
          font-family: 'Instrument Serif', serif;
          font-size: 24px;
          font-weight: 400;
          color: var(--text);
          margin-bottom: 8px;
        }
        .delete-modal p {
          color: var(--text-muted);
          font-size: 13px;
          line-height: 1.6;
        }
        .delete-modal-session {
          color: var(--text);
          overflow-wrap: anywhere;
        }
        .delete-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
        }
        .delete-modal-btn {
          min-width: 92px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s, color 0.12s, opacity 0.12s;
        }
        .delete-modal-btn.secondary {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
        }
        .delete-modal-btn.secondary:hover:not(:disabled) {
          background: var(--surface-2);
          border-color: var(--border-hover);
          color: var(--text);
        }
        .delete-modal-btn.danger {
          border: 1px solid rgba(224,92,92,0.38);
          background: #e05c5c;
          color: #0f0f0f;
        }
        .delete-modal-btn.danger:hover:not(:disabled) {
          background: #f06c6c;
          border-color: rgba(240,108,108,0.55);
        }
        .delete-modal-btn:disabled {
          opacity: 0.58;
          cursor: wait;
        }

        @media (max-width: 520px) {
          .delete-modal-backdrop {
            align-items: end;
            padding: 16px;
          }
          .delete-modal {
            width: 100%;
          }
          .delete-modal-actions {
            flex-direction: column-reverse;
          }
          .delete-modal-btn {
            width: 100%;
          }
        }
      `}</style>

      <div className="chat-root">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? "" : "closed"}`}>
          <div className="sidebar-header">
            <Image
              className="brand-logo"
              src={NEURA_CLARK_WORDMARK_SRC}
              alt="NeuraClark"
              width={184}
              height={58}
              priority
            />
          </div>

          <button className="new-chat-btn" onClick={createNewSession}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1v12M1 7h12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            New conversation
          </button>

          <div className="history-label">Recent</div>

          <div className="sessions-list">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`session-item ${session.id === activeSessionId ? "active" : ""} ${session.id === openSessionMenuId ? "menu-open" : ""}`}
                onClick={() => {
                  setActiveSessionId(session.id);
                  setOpenSessionMenuId("");
                }}
              >
                {renamingSessionId === session.id ? (
                  <form
                    className="session-rename-form"
                    onClick={(e) => e.stopPropagation()}
                    onSubmit={(e) => handleRenameSubmit(e, session.id)}
                  >
                    <input
                      className="session-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => void saveRenamedSession(session.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelRenamingSession();
                        }
                      }}
                      autoFocus
                    />
                  </form>
                ) : (
                  <>
                    <div className="session-main">
                      <span className="session-dot" />
                      <span className="session-title">{session.title}</span>
                    </div>

                    <div
                      className="session-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="session-menu-btn"
                        type="button"
                        title="Conversation options"
                        onClick={() =>
                          setOpenSessionMenuId((current) =>
                            current === session.id ? "" : session.id,
                          )
                        }
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                        >
                          <circle
                            cx="3.25"
                            cy="7.5"
                            r="1.15"
                            fill="currentColor"
                          />
                          <circle
                            cx="7.5"
                            cy="7.5"
                            r="1.15"
                            fill="currentColor"
                          />
                          <circle
                            cx="11.75"
                            cy="7.5"
                            r="1.15"
                            fill="currentColor"
                          />
                        </svg>
                      </button>

                      {openSessionMenuId === session.id && (
                        <div className="session-menu">
                          <button
                            className="session-menu-item"
                            type="button"
                            onClick={() => startRenamingSession(session)}
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 13 13"
                              fill="none"
                            >
                              <path
                                d="M2 9.6V11h1.4l6.75-6.75-1.4-1.4L2 9.6z"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M8 2l1-1 2 2-1 1"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                              />
                            </svg>
                            Rename
                          </button>
                          <button
                            className="session-menu-item danger"
                            type="button"
                            onClick={() => openDeleteSessionModal(session.id)}
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 13 13"
                              fill="none"
                            >
                              <path
                                d="M2.25 3.25h8.5M5 1.75h3M4 3.25l.35 7.1h4.3L9 3.25"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="sidebar-footer">
            <div className="profile-row">
              <div className="profile-icon" aria-hidden="true">
                {profileAvatarUrl ? (
                  <span
                    className="avatar-image"
                    style={{ backgroundImage: `url(${profileAvatarUrl})` }}
                  />
                ) : (
                  profileInitial
                )}
              </div>
              <div className="profile-meta">
                <span className="profile-name">{profileName}</span>
                <span className="profile-email">{profileEmail}</span>
              </div>
            </div>

            <button
              className="logout-btn"
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M5.5 2.25H3.25A1.25 1.25 0 002 3.5v7A1.25 1.25 0 003.25 11.75H5.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M8.5 4l3 3-3 3M11.5 7H5.25"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {isLoggingOut ? "Signing out..." : "Logout"}
            </button>

            {logoutError && <p className="logout-error">{logoutError}</p>}
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          {/* Topbar */}
          <div className="topbar">
            <button
              className="icon-btn"
              onClick={() => setSidebarOpen((v) => !v)}
              title="Toggle sidebar"
            >
              <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
                <rect
                  x="0"
                  y="0"
                  width="15"
                  height="1.5"
                  rx="0.75"
                  fill="currentColor"
                />
                <rect
                  x="0"
                  y="4.75"
                  width="10"
                  height="1.5"
                  rx="0.75"
                  fill="currentColor"
                />
                <rect
                  x="0"
                  y="9.5"
                  width="15"
                  height="1.5"
                  rx="0.75"
                  fill="currentColor"
                />
              </svg>
            </button>
            <span className="topbar-title">{activeSession?.title}</span>
          </div>

          {/* Messages */}
          <div className="messages-area">
            {(!activeSession || activeSession.messages.length === 0) &&
            !isLoading ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Image
                    className="empty-logo"
                    src={NEURA_CLARK_LOGO_SRC}
                    alt="NeuraClark assistant"
                    width={64}
                    height={64}
                    priority
                  />
                </div>
                <h2>Start a conversation</h2>
                <p>
                  Ask anything — type below and press Enter to send your first
                  message.
                </p>
              </div>
            ) : (
              <div className="messages-inner">
                {activeSession?.messages.map((msg) => (
                  <div key={msg.id} className={`message-row ${msg.role}`}>
                    <div
                      className={`avatar ${msg.role === "user" ? "user-avatar" : "assistant-avatar"}`}
                    >
                      {msg.role === "user" ? (
                        profileAvatarUrl ? (
                          <span
                            className="avatar-image"
                            style={{
                              backgroundImage: `url(${profileAvatarUrl})`,
                            }}
                          />
                        ) : (
                          profileInitial
                        )
                      ) : (
                        <Image
                          className="assistant-logo"
                          src={NEURA_CLARK_LOGO_SRC}
                          alt="NeuraClark assistant"
                          width={28}
                          height={28}
                        />
                      )}
                    </div>
                    <div className="bubble">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="typing-row">
                    <div className="avatar assistant-avatar">
                      <Image
                        className="assistant-logo"
                        src={NEURA_CLARK_LOGO_SRC}
                        alt="NeuraClark assistant"
                        width={28}
                        height={28}
                      />
                    </div>
                    <div className="typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="input-area">
            {syncError && <p className="sync-error">{syncError}</p>}
            <div className="input-inner">
              <div className="input-box">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message..."
                  rows={1}
                />
                <button
                  className="send-btn"
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading || !activeSession}
                  title="Send (Enter)"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M7 12V2M2 7l5-5 5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <p className="input-hint">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        </main>

        {deleteTargetSession && (
          <div
            className="delete-modal-backdrop"
            onMouseDown={closeDeleteSessionModal}
          >
            <section
              className="delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-modal-title"
              aria-describedby="delete-modal-description"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="delete-modal-icon" aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                  <path
                    d="M3 4.25h11M6.25 2.5h4.5M5 4.25l.45 10h6.1l.45-10"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="delete-modal-copy">
                <h2 id="delete-modal-title">Delete chat?</h2>
                <p id="delete-modal-description">
                  <span className="delete-modal-session">
                    {deleteTargetSession.title}
                  </span>{" "}
                  and all of its messages will be permanently removed.
                </p>
              </div>

              <div className="delete-modal-actions">
                <button
                  className="delete-modal-btn secondary"
                  type="button"
                  onClick={closeDeleteSessionModal}
                  disabled={isDeletingSession}
                >
                  Cancel
                </button>
                <button
                  className="delete-modal-btn danger"
                  type="button"
                  onClick={() => void deleteSession()}
                  disabled={isDeletingSession}
                >
                  {isDeletingSession ? "Deleting..." : "Delete"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
