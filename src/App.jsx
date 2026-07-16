import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Check, ChevronDown, ChevronRight, Trash2, Copy, X, LogOut, Loader2 } from "lucide-react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBJ7v2WgWy5b-kf26g9be-AV1lxwgUZ79k",
  authDomain: "chalkline-a2023.firebaseapp.com",
  projectId: "chalkline-a2023",
  storageBucket: "chalkline-a2023.firebasestorage.app",
  messagingSenderId: "277834389268",
  appId: "1:277834389268:web:e277162c9300af29929401",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const FONT_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.chalk-root {
  --bg: #1E3229;
  --bg-alt: #263D32;
  --panel: #2A4238;
  --ink: #F1EEE4;
  --ink-dim: rgba(241,238,228,0.58);
  --ink-faint: rgba(241,238,228,0.32);
  --yellow: #E4C468;
  --coral: #E2795F;
  --blue: #8FB4C9;
  --rule: rgba(241,238,228,0.16);
  background:
    radial-gradient(ellipse 80% 50% at 20% -10%, rgba(241,238,228,0.05), transparent 60%),
    radial-gradient(ellipse 60% 40% at 90% 110%, rgba(241,238,228,0.04), transparent 60%),
    var(--bg);
  color: var(--ink);
  font-family: 'IBM Plex Sans', sans-serif;
  min-height: 100vh;
}
.chalk-display { font-family: 'Fraunces', serif; }
.chalk-mono { font-family: 'IBM Plex Mono', monospace; }

.chalk-dashed { border: 1.5px dashed var(--rule); }
.chalk-checkbox {
  width: 22px; height: 22px; border-radius: 4px 6px 5px 7px / 6px 4px 7px 5px;
  border: 2px solid var(--ink-dim);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; cursor: pointer; transition: all 0.15s ease;
  background: transparent;
}
.chalk-checkbox:hover { border-color: var(--ink); }
.chalk-checkbox.done { background: var(--yellow); border-color: var(--yellow); }
.chalk-tag {
  display: inline-block;
  border: 1.5px solid var(--ink-faint);
  border-radius: 3px 8px 4px 7px / 7px 4px 8px 3px;
  padding: 1px 9px;
  transform: rotate(-0.6deg);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.02em;
}
.chalk-input {
  background: rgba(241,238,228,0.06);
  border: 1.5px solid var(--rule);
  border-radius: 6px;
  color: var(--ink);
  padding: 8px 11px;
  font-family: 'IBM Plex Sans', sans-serif;
  outline: none;
  transition: border-color 0.15s ease;
}
.chalk-input:focus { border-color: var(--ink-dim); }
.chalk-input::placeholder { color: var(--ink-faint); }
.chalk-btn {
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 500;
  border-radius: 7px;
  padding: 9px 16px;
  cursor: pointer;
  transition: transform 0.1s ease, opacity 0.15s ease;
  border: none;
}
.chalk-btn:active { transform: scale(0.97); }
.chalk-btn-primary { background: var(--yellow); color: #1E3229; }
.chalk-btn-primary:hover { opacity: 0.9; }
.chalk-btn-ghost { background: transparent; color: var(--ink-dim); border: 1.5px solid var(--rule); }
.chalk-btn-ghost:hover { color: var(--ink); border-color: var(--ink-dim); }
.chalk-card { background: var(--panel); border-radius: 10px; border: 1.5px solid var(--rule); }
.chalk-focus:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
`;

const PRIORITIES = {
  high: { label: "High", color: "var(--coral)" },
  medium: { label: "Medium", color: "var(--yellow)" },
  low: { label: "Low", color: "var(--blue)" },
};

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmtDate(d) {
  if (!d) return null;
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function dateBucket(dueDate) {
  if (!dueDate) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diff = Math.round((due - today) / 86400000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  return "upcoming";
}

export default function CollegePlanner() {
  const [phase, setPhase] = useState("gate");
  const [roomCode, setRoomCode] = useState(null);
  const [joinInput, setJoinInput] = useState("");
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");

  const [form, setForm] = useState({
    title: "", course: "", dueDate: "", priority: "medium", notes: "", subtasks: [],
  });
  const [subtaskDraft, setSubtaskDraft] = useState("");

  useEffect(() => {
    if (!roomCode) return;
    setError("");
    const ref = doc(db, "planners", roomCode);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setTasks(snap.data().tasks || []);
        } else {
          setTasks([]);
        }
      },
      (err) => {
        setError("Couldn't connect to the shared planner. Check your connection and try again.");
      }
    );
    return () => unsubscribe();
  }, [roomCode]);

  const saveTasks = useCallback(async (code, nextTasks) => {
    setSaving(true);
    try {
      await setDoc(doc(db, "planners", code), { tasks: nextTasks, updatedAt: Date.now() });
    } catch (e) {
      setError("Couldn't save just now. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }, []);

  const updateTasks = (updater) => {
    setTasks((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (roomCode) saveTasks(roomCode, next);
      return next;
    });
  };

  const handleCreateNew = () => {
    const code = genCode();
    setTasks([]);
    setRoomCode(code);
    setPhase("app");
  };

  const handleJoin = async () => {
    const code = joinInput.trim().toUpperCase();
    if (!code) return;
    setError("");
    try {
      const snap = await getDoc(doc(db, "planners", code));
      setTasks(snap.exists() ? snap.data().tasks || [] : []);
      setRoomCode(code);
      setPhase("app");
    } catch (e) {
      setError("Couldn't find that planner. Double check the code and try again.");
    }
  };

  const handleLeave = () => {
    setRoomCode(null);
    setTasks([]);
    setJoinInput("");
    setPhase("gate");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopyLabel("Copied");
      setTimeout(() => setCopyLabel("Copy"), 1500);
    } catch (e) {
      setCopyLabel(roomCode);
      setTimeout(() => setCopyLabel("Copy"), 2000);
    }
  };

  const addSubtaskDraft = () => {
    if (!subtaskDraft.trim()) return;
    setForm((f) => ({ ...f, subtasks: [...f.subtasks, { id: uid(), text: subtaskDraft.trim(), done: false }] }));
    setSubtaskDraft("");
  };

  const submitForm = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const newTask = {
      id: uid(),
      title: form.title.trim(),
      course: form.course.trim(),
      dueDate: form.dueDate || null,
      priority: form.priority,
      notes: form.notes.trim(),
      subtasks: form.subtasks,
      done: false,
      createdAt: Date.now(),
    };
    updateTasks((prev) => [newTask, ...prev]);
    setForm({ title: "", course: "", dueDate: "", priority: "medium", notes: "", subtasks: [] });
    setShowForm(false);
  };

  const toggleDone = (id) => {
    updateTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const toggleSubtask = (taskId, subId) => {
    updateTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) }
          : t
      )
    );
  };

  const deleteTask = (id) => {
    updateTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleExpand = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const grouped = useMemo(() => {
    const active = tasks.filter((t) => !t.done);
    const done = tasks.filter((t) => t.done);
    const buckets = { overdue: [], today: [], upcoming: [], none: [] };
    active.forEach((t) => buckets[dateBucket(t.dueDate)].push(t));
    Object.keys(buckets).forEach((k) =>
      buckets[k].sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    );
    done.sort((a, b) => b.createdAt - a.createdAt);
    return { ...buckets, done };
  }, [tasks]);

  const sections = [
    { key: "overdue", label: "Overdue", color: "var(--coral)" },
    { key: "today", label: "Due today", color: "var(--yellow)" },
    { key: "upcoming", label: "Upcoming", color: "var(--ink)" },
    { key: "none", label: "No date set", color: "var(--ink-dim)" },
  ];

  if (phase === "gate") {
    return (
      <div className="chalk-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <style>{FONT_STYLE}</style>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          <h1 className="chalk-display" style={{ fontSize: "34px", fontStyle: "italic", fontWeight: 600, marginBottom: "6px" }}>
            Chalkline
          </h1>
          <p style={{ color: "var(--ink-dim)", fontSize: "14.5px", marginBottom: "28px", lineHeight: 1.5 }}>
            A shared planner for assignments and deadlines. Start a fresh board, or join one with a code someone already shared with you.
          </p>

          <button onClick={handleCreateNew} className="chalk-btn chalk-btn-primary chalk-focus" style={{ width: "100%", marginBottom: "18px", fontSize: "15px" }}>
            Start a new planner
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "18px 0", color: "var(--ink-faint)", fontSize: "12px" }}>
            <div style={{ flex: 1, borderTop: "1.5px dashed var(--rule)" }} />
            OR
            <div style={{ flex: 1, borderTop: "1.5px dashed var(--rule)" }} />
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <input
              className="chalk-input chalk-focus chalk-mono"
              style={{ flex: 1, textTransform: "uppercase", letterSpacing: "0.08em" }}
              placeholder="ENTER CODE"
              maxLength={6}
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
            <button onClick={handleJoin} className="chalk-btn chalk-btn-ghost chalk-focus">Join</button>
          </div>
          {error && (
            <p style={{ color: "var(--coral)", fontSize: "12.5px", marginTop: "10px" }}>{error}</p>
          )}
          <p style={{ color: "var(--ink-faint)", fontSize: "12.5px", marginTop: "14px", lineHeight: 1.5 }}>
            Anyone with the code — a roommate, a parent — can view and check off tasks here too.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="chalk-root">
      <style>{FONT_STYLE}</style>
      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "32px 20px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 className="chalk-display" style={{ fontSize: "30px", fontStyle: "italic", fontWeight: 600, marginBottom: "2px" }}>
              Chalkline
            </h1>
            <span style={{ color: "var(--ink-dim)", fontSize: "12.5px" }}>
              {saving ? "Saving…" : "Synced"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="chalk-tag chalk-mono" style={{ fontSize: "13px", padding: "4px 10px" }}>{roomCode}</div>
            <button onClick={handleCopy} className="chalk-btn chalk-btn-ghost chalk-focus" style={{ padding: "6px 10px", fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
              <Copy size={13} /> {copyLabel}
            </button>
            <button onClick={handleLeave} className="chalk-btn chalk-btn-ghost chalk-focus" style={{ padding: "6px 10px" }} aria-label="Leave planner">
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {error && (
          <div className="chalk-dashed" style={{ padding: "10px 14px", borderRadius: "8px", color: "var(--coral)", fontSize: "13px", marginBottom: "18px" }}>
            {error}
          </div>
        )}

        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="chalk-btn chalk-btn-primary chalk-focus" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "28px" }}>
            <Plus size={17} /> Add assignment
          </button>
        ) : (
          <form onSubmit={submitForm} className="chalk-card" style={{ padding: "18px", marginBottom: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span className="chalk-display" style={{ fontStyle: "italic", fontSize: "18px" }}>New assignment</span>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close" style={{ background: "none", border: "none", color: "var(--ink-dim)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <input
              className="chalk-input chalk-focus"
              style={{ width: "100%", marginBottom: "10px" }}
              placeholder="Title — e.g. Problem set 4"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
            />

            <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
              <input
                className="chalk-input chalk-focus"
                style={{ flex: "1 1 140px" }}
                placeholder="Course — e.g. CHEM 201"
                value={form.course}
                onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}
              />
              <input
                type="date"
                className="chalk-input chalk-focus chalk-mono"
                style={{ flex: "1 1 140px" }}
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              {Object.entries(PRIORITIES).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority: key }))}
                  className="chalk-focus"
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: "6px", fontSize: "12.5px", cursor: "pointer",
                    border: form.priority === key ? `1.5px solid ${p.color}` : "1.5px solid var(--rule)",
                    background: form.priority === key ? "rgba(241,238,228,0.06)" : "transparent",
                    color: form.priority === key ? "var(--ink)" : "var(--ink-dim)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <textarea
              className="chalk-input chalk-focus"
              style={{ width: "100%", minHeight: "60px", marginBottom: "12px", resize: "vertical" }}
              placeholder="Notes — details, links, what's expected"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />

            <div style={{ marginBottom: "12px" }}>
              <span style={{ fontSize: "12.5px", color: "var(--ink-dim)", display: "block", marginBottom: "6px" }}>Subtasks</span>
              {form.subtasks.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "13.5px" }}>{s.text}</span>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, subtasks: f.subtasks.filter((x) => x.id !== s.id) }))}
                    style={{ background: "none", border: "none", color: "var(--ink-faint)", cursor: "pointer", marginLeft: "auto" }}
                    aria-label="Remove subtask"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  className="chalk-input chalk-focus"
                  style={{ flex: 1, fontSize: "13px", padding: "6px 10px" }}
                  placeholder="Add a subtask and press Enter"
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addSubtaskDraft(); }
                  }}
                />
                <button type="button" onClick={addSubtaskDraft} className="chalk-btn chalk-btn-ghost chalk-focus" style={{ padding: "6px 12px", fontSize: "13px" }}>
                  Add
                </button>
              </div>
            </div>

            <button type="submit" className="chalk-btn chalk-btn-primary chalk-focus" style={{ width: "100%" }}>
              Save assignment
            </button>
          </form>
        )}

        {tasks.length === 0 && (
          <p style={{ color: "var(--ink-faint)", fontSize: "14px", textAlign: "center", padding: "40px 0" }}>
            Nothing on the board yet. Add your first assignment above.
          </p>
        )}

        {sections.map(({ key, label, color }) => {
          const list = grouped[key];
          if (!list || list.length === 0) return null;
          return (
            <div key={key} style={{ marginBottom: "26px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: color }} />
                <span style={{ fontSize: "12.5px", letterSpacing: "0.04em", color: "var(--ink-dim)", textTransform: "uppercase" }}>{label}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {list.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    expanded={!!expanded[task.id]}
                    onToggleExpand={() => toggleExpand(task.id)}
                    onToggleDone={() => toggleDone(task.id)}
                    onToggleSubtask={(subId) => toggleSubtask(task.id, subId)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {grouped.done.length > 0 && (
          <div style={{ marginTop: "34px" }}>
            <div style={{ fontSize: "12.5px", letterSpacing: "0.04em", color: "var(--ink-faint)", textTransform: "uppercase", marginBottom: "10px" }}>
              Done ({grouped.done.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {grouped.done.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  expanded={!!expanded[task.id]}
                  onToggleExpand={() => toggleExpand(task.id)}
                  onToggleDone={() => toggleDone(task.id)}
                  onToggleSubtask={(subId) => toggleSubtask(task.id, subId)}
                  onDelete={() => deleteTask(task.id)}
                  faded
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, expanded, onToggleExpand, onToggleDone, onToggleSubtask, onDelete, faded }) {
  const p = PRIORITIES[task.priority] || PRIORITIES.medium;
  const subDone = task.subtasks.filter((s) => s.done).length;
  const bucket = dateBucket(task.dueDate);

  return (
    <div className="chalk-card" style={{ padding: "12px 14px", opacity: faded ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "11px" }}>
        <button
          className={`chalk-checkbox chalk-focus ${task.done ? "done" : ""}`}
          onClick={onToggleDone}
          aria-label={task.done ? "Mark as not done" : "Mark as done"}
          style={{ marginTop: "1px" }}
        >
          {task.done && <Check size={14} color="#1E3229" strokeWidth={3} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "15px", textDecoration: task.done ? "line-through" : "none", color: task.done ? "var(--ink-dim)" : "var(--ink)" }}>
              {task.title}
            </span>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "5px", flexWrap: "wrap" }}>
            {task.course && <span className="chalk-tag">{task.course}</span>}
            {task.dueDate && (
              <span className="chalk-mono" style={{ fontSize: "12px", color: bucket === "overdue" && !task.done ? "var(--coral)" : "var(--ink-dim)" }}>
                {fmtDate(task.dueDate)}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span style={{ fontSize: "12px", color: "var(--ink-faint)" }}>{subDone}/{task.subtasks.length} subtasks</span>
            )}
          </div>

          {(task.notes || task.subtasks.length > 0) && (
            <button onClick={onToggleExpand} className="chalk-focus" style={{ background: "none", border: "none", color: "var(--ink-faint)", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px", fontSize: "12px", padding: "6px 0 0", marginLeft: "-2px" }}>
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />} details
            </button>
          )}

          {expanded && (
            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1.5px dashed var(--rule)" }}>
              {task.notes && <p style={{ fontSize: "13px", color: "var(--ink-dim)", lineHeight: 1.5, marginBottom: task.subtasks.length ? "10px" : 0 }}>{task.notes}</p>}
              {task.subtasks.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "6px" }}>
                  <button
                    className={`chalk-checkbox chalk-focus ${s.done ? "done" : ""}`}
                    style={{ width: "17px", height: "17px" }}
                    onClick={() => onToggleSubtask(s.id)}
                    aria-label={s.done ? "Mark subtask not done" : "Mark subtask done"}
                  >
                    {s.done && <Check size={11} color="#1E3229" strokeWidth={3} />}
                  </button>
                  <span style={{ fontSize: "13px", textDecoration: s.done ? "line-through" : "none", color: s.done ? "var(--ink-faint)" : "var(--ink-dim)" }}>
                    {s.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={onDelete} aria-label="Delete assignment" className="chalk-focus" style={{ background: "none", border: "none", color: "var(--ink-faint)", cursor: "pointer", padding: "2px" }}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
