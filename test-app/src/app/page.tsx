"use client";

import Link from "next/link";
import { useState } from "react";

interface Task {
  id: number;
  label: string;
  done: boolean;
}

const initialTasks: Task[] = [
  { id: 1, label: "Buy groceries", done: false },
  { id: 2, label: "Review pull requests", done: false },
  { id: 3, label: "Ship prdemo v0", done: false },
];

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTask, setNewTask] = useState("");

  function toggle(id: number) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  function addTask() {
    const text = newTask.trim();
    if (!text) return;
    setTasks((prev) => [...prev, { id: Date.now(), label: text, done: false }]);
    setNewTask("");
  }

  function removeCompleted() {
    setTasks((prev) => prev.filter((t) => !t.done));
  }

  const completed = tasks.filter((t) => t.done).length;
  const progress = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;

  return (
    <main style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px' }}>
      <h1>Task Tracker</h1>
      <p style={{ color: '#666', fontSize: 14 }}>
        {completed}/{tasks.length} completed
      </p>

      {/* Progress bar */}
      <div style={{
        height: 6,
        background: '#e0e0e0',
        borderRadius: 3,
        marginBottom: 20,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: progress === 100 ? '#4caf50' : '#0070f3',
          borderRadius: 3,
          transition: 'width 0.3s ease, background 0.3s ease',
        }} />
      </div>

      {/* Add task input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add a new task..."
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid #ddd',
            borderRadius: 8,
            fontSize: 15,
            outline: 'none',
          }}
        />
        <button
          onClick={addTask}
          style={{
            padding: '10px 20px',
            background: '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Add
        </button>
      </div>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {tasks.map((task) => (
          <li
            key={task.id}
            onClick={() => toggle(task.id)}
            style={{
              padding: '14px 16px',
              background: task.done ? '#e8f5e9' : '#fff',
              marginBottom: 8,
              borderRadius: 8,
              cursor: 'pointer',
              textDecoration: task.done ? 'line-through' : 'none',
              color: task.done ? '#888' : '#000',
              transition: 'all 0.2s ease',
              border: '1px solid #eee',
            }}
          >
            {task.done ? '☑' : '☐'} {task.label}
          </li>
        ))}
      </ul>

      {completed > 0 && (
        <button
          onClick={removeCompleted}
          style={{
            marginTop: 8,
            padding: '8px 16px',
            background: 'transparent',
            color: '#999',
            border: '1px solid #ddd',
            borderRadius: 8,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Clear {completed} completed
        </button>
      )}

      <div style={{ marginTop: 24 }}>
        <Link href="/about" style={{ color: '#0070f3' }}>About this app</Link>
      </div>
    </main>
  );
}
