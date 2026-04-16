import Link from "next/link";

export default function About() {
  return (
    <main style={{ maxWidth: 600, margin: '40px auto', padding: '0 20px' }}>
      <h1>About</h1>
      <p>Task Tracker is a demo app used to test prdemo — a CLI that generates narrated PR demo videos.</p>
      <h2 style={{ fontSize: 18, marginTop: 24 }}>What&apos;s new in v0.2</h2>
      <ul style={{ lineHeight: 1.8, color: '#444' }}>
        <li>Add new tasks with the input field</li>
        <li>Progress bar shows completion at a glance</li>
        <li>Clear completed tasks in one click</li>
        <li>New navigation bar</li>
      </ul>
      <Link href="/" style={{ color: '#0070f3' }}>← Back home</Link>
    </main>
  );
}
