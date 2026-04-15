/**
 * 20-PR Narrator Benchmark Fixtures
 *
 * Each fixture simulates a real PR scenario with a diff, event log, and PR info.
 * Used to regression-test narrator quality on every prompt change.
 */

import type { EventLogEntry, PRInfo } from "../src/types.js";

export interface BenchFixture {
  id: string;
  description: string;
  diff: string;
  eventLog: EventLogEntry[];
  prInfo: PRInfo;
  /** Strings the narration SHOULD mention (case-insensitive) */
  mustMention: string[];
  /** Strings the narration must NOT contain */
  mustNotContain: string[];
  /** Minimum number of narration segments expected */
  minSegments: number;
}

// --- Helper to build event timelines quickly ---
function ev(
  ts: number,
  action: string,
  selector?: string,
  text?: string
): EventLogEntry {
  return { timestamp: ts, action, selector, text };
}

export const fixtures: BenchFixture[] = [
  // ─── 1. Sidebar layout ─────────────────────────────────────────
  {
    id: "sidebar-layout",
    description: "Adds a sidebar with contacts list and share feature",
    diff: `diff --git a/src/components/Sidebar.tsx b/src/components/Sidebar.tsx
new file mode 100644
+import { useState } from 'react'
+export function Sidebar({ tasks }: { tasks: Task[] }) {
+  const [selected, setSelected] = useState<string[]>([])
+  const contacts = ['Alice', 'Bob', 'Carol']
+  return (
+    <aside className="sidebar">
+      <h3>Share Tasks</h3>
+      <ul>{contacts.map(c => <li key={c} onClick={() => toggle(c)}>{c}</li>)}</ul>
+      <button onClick={() => shareTasks(selected, tasks)}>Share</button>
+    </aside>
+  )
+}`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000"),
      ev(500, "page_loaded", undefined, "Task Tracker"),
      ev(3500, "click", "li:nth-child(1)", "Buy groceries"),
      ev(3500, "narrate", undefined, "Tasks toggle complete with a click"),
      ev(7500, "click", "aside li:nth-child(1)", "Alice"),
      ev(7500, "narrate", undefined, "The sidebar shows contacts to share with"),
      ev(11500, "click", "aside button", "Share"),
      ev(11500, "narrate", undefined, "Hit share to send pending tasks"),
      ev(15000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/sidebar-share-todos",
      commitMessage: "Add sidebar with contacts list and share button",
    },
    mustMention: ["sidebar", "share", "contacts"],
    mustNotContain: ["page loads", "we can see"],
    minSegments: 3,
  },

  // ─── 2. Dark mode toggle ──────────────────────────────────────
  {
    id: "dark-mode",
    description: "Adds dark mode toggle with localStorage persistence",
    diff: `diff --git a/src/hooks/useTheme.ts b/src/hooks/useTheme.ts
new file mode 100644
+import { useState, useEffect } from 'react'
+export function useTheme() {
+  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
+  useEffect(() => {
+    document.documentElement.classList.toggle('dark', dark)
+    localStorage.setItem('theme', dark ? 'dark' : 'light')
+  }, [dark])
+  return { dark, toggle: () => setDark(d => !d) }
+}
diff --git a/src/components/Header.tsx b/src/components/Header.tsx
-  return <header><h1>{title}</h1></header>
+  const { dark, toggle } = useTheme()
+  return <header><h1>{title}</h1><button onClick={toggle}>{dark ? '☀️' : '🌙'}</button></header>`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000"),
      ev(500, "page_loaded", undefined, "My App"),
      ev(4000, "narrate", undefined, "The header now has a theme toggle button"),
      ev(5000, "click", "button.theme-toggle", "🌙"),
      ev(5000, "narrate", undefined, "Clicking toggles to dark mode with localStorage persistence"),
      ev(9000, "click", "button.theme-toggle", "☀️"),
      ev(9000, "narrate", undefined, "And back to light mode — preference is remembered"),
      ev(12000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/dark-mode",
      commitMessage: "Add dark mode toggle with localStorage persistence",
    },
    mustMention: ["dark mode", "localStorage"],
    mustNotContain: ["page loads"],
    minSegments: 3,
  },

  // ─── 3. Search/filter ─────────────────────────────────────────
  {
    id: "search-filter",
    description: "Adds real-time search filtering to a list",
    diff: `diff --git a/src/components/SearchBar.tsx b/src/components/SearchBar.tsx
new file mode 100644
+export function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
+  return <input placeholder="Search..." onChange={e => onSearch(e.target.value)} />
+}
diff --git a/src/components/ProductList.tsx b/src/components/ProductList.tsx
-  return <ul>{products.map(p => <li key={p.id}>{p.name}</li>)}</ul>
+  const [query, setQuery] = useState('')
+  const filtered = products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
+  return <>
+    <SearchBar onSearch={setQuery} />
+    <p>{filtered.length} of {products.length} items</p>
+    <ul>{filtered.map(p => <li key={p.id}>{p.name}</li>)}</ul>
+  </>`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000/products"),
      ev(500, "page_loaded", undefined, "Products"),
      ev(3000, "narrate", undefined, "The product list now has a search bar"),
      ev(4000, "type", "input[placeholder='Search...']", "laptop"),
      ev(4000, "narrate", undefined, "Typing filters the list in real-time — case-insensitive matching"),
      ev(8000, "type", "input[placeholder='Search...']", ""),
      ev(8000, "narrate", undefined, "Clearing the search restores all products"),
      ev(11000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/search-filter",
      commitMessage: "Add real-time search filtering to product list",
    },
    mustMention: ["search", "filter"],
    mustNotContain: ["we can see a text box"],
    minSegments: 3,
  },

  // ─── 4. Form validation ───────────────────────────────────────
  {
    id: "form-validation",
    description: "Adds client-side form validation with error messages",
    diff: `diff --git a/src/components/SignupForm.tsx b/src/components/SignupForm.tsx
+  const [errors, setErrors] = useState<Record<string, string>>({})
+  function validate(data: FormData) {
+    const errs: Record<string, string> = {}
+    if (!data.email.includes('@')) errs.email = 'Invalid email'
+    if (data.password.length < 8) errs.password = 'Min 8 characters'
+    return errs
+  }
+  function handleSubmit(e: FormEvent) {
+    e.preventDefault()
+    const errs = validate(formData)
+    if (Object.keys(errs).length) { setErrors(errs); return }
+    submitForm(formData)
+  }
-  <form onSubmit={submitForm}>
+  <form onSubmit={handleSubmit}>
     <input name="email" />
+    {errors.email && <span className="error">{errors.email}</span>}
     <input name="password" type="password" />
+    {errors.password && <span className="error">{errors.password}</span>}`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000/signup"),
      ev(500, "page_loaded", undefined, "Sign Up"),
      ev(3000, "type", "input[name='email']", "bad-email"),
      ev(6000, "click", "button[type='submit']", "Sign Up"),
      ev(6000, "narrate", undefined, "Submitting with invalid email now shows inline errors"),
      ev(9000, "type", "input[name='email']", "user@example.com"),
      ev(9000, "type", "input[name='password']", "secure123"),
      ev(12000, "click", "button[type='submit']", "Sign Up"),
      ev(12000, "narrate", undefined, "Valid inputs pass client-side validation and submit"),
      ev(15000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/form-validation",
      commitMessage: "Add client-side form validation with inline error messages",
    },
    mustMention: ["validation", "error"],
    mustNotContain: ["a form appears"],
    minSegments: 2,
  },

  // ─── 5. Pagination ────────────────────────────────────────────
  {
    id: "pagination",
    description: "Adds cursor-based pagination to API list",
    diff: `diff --git a/src/hooks/usePagination.ts b/src/hooks/usePagination.ts
new file mode 100644
+export function usePagination<T>(fetchFn: (cursor?: string) => Promise<Page<T>>) {
+  const [items, setItems] = useState<T[]>([])
+  const [cursor, setCursor] = useState<string | undefined>()
+  const [hasMore, setHasMore] = useState(true)
+  async function loadMore() {
+    const page = await fetchFn(cursor)
+    setItems(prev => [...prev, ...page.items])
+    setCursor(page.nextCursor)
+    setHasMore(!!page.nextCursor)
+  }
+  return { items, loadMore, hasMore }
+}
diff --git a/src/pages/Users.tsx b/src/pages/Users.tsx
-  const users = await fetchAllUsers()
+  const { items: users, loadMore, hasMore } = usePagination(fetchUsers)
+  <button disabled={!hasMore} onClick={loadMore}>Load More</button>`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000/users"),
      ev(500, "page_loaded", undefined, "Users"),
      ev(3000, "narrate", undefined, "The users list now loads page by page instead of all at once"),
      ev(5000, "click", "text=Load More", "Load More"),
      ev(5000, "narrate", undefined, "Each click fetches the next page using cursor-based pagination"),
      ev(9000, "click", "text=Load More", "Load More"),
      ev(13000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/pagination",
      commitMessage: "Replace fetch-all with cursor-based pagination",
    },
    mustMention: ["pagination", "cursor"],
    mustNotContain: ["button appears"],
    minSegments: 2,
  },

  // ─── 6. Toast notifications ───────────────────────────────────
  {
    id: "toast-notifications",
    description: "Adds toast notification system with auto-dismiss",
    diff: `diff --git a/src/components/ToastProvider.tsx b/src/components/ToastProvider.tsx
new file mode 100644
+const ToastContext = createContext<ToastApi>(null!)
+export function ToastProvider({ children }: Props) {
+  const [toasts, setToasts] = useState<Toast[]>([])
+  function show(message: string, type: 'success' | 'error' = 'success') {
+    const id = crypto.randomUUID()
+    setToasts(prev => [...prev, { id, message, type }])
+    setTimeout(() => dismiss(id), 3000)
+  }
+  function dismiss(id: string) {
+    setToasts(prev => prev.filter(t => t.id !== id))
+  }
+  return <ToastContext.Provider value={{ show }}>
+    {children}
+    <div className="toast-container">{toasts.map(renderToast)}</div>
+  </ToastContext.Provider>
+}`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000"),
      ev(500, "page_loaded", undefined, "Dashboard"),
      ev(3000, "click", "text=Save", "Save"),
      ev(3000, "narrate", undefined, "Saving now triggers a success toast that auto-dismisses"),
      ev(7000, "click", "text=Delete", "Delete"),
      ev(7000, "narrate", undefined, "Error actions show a red error toast"),
      ev(11000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/toast-notifications",
      commitMessage: "Add toast notification system with auto-dismiss",
    },
    mustMention: ["toast", "auto-dismiss"],
    mustNotContain: ["message pops up"],
    minSegments: 2,
  },

  // ─── 7. Drag-and-drop reorder ─────────────────────────────────
  {
    id: "drag-reorder",
    description: "Adds drag-and-drop reordering to a kanban board",
    diff: `diff --git a/src/components/KanbanColumn.tsx b/src/components/KanbanColumn.tsx
+import { DndContext, closestCenter } from '@dnd-kit/core'
+import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
-  return <div className="column">
-    {items.map(item => <Card key={item.id} item={item} />)}
-  </div>
+  function handleDragEnd(event: DragEndEvent) {
+    const { active, over } = event
+    if (active.id !== over?.id) {
+      const oldIndex = items.findIndex(i => i.id === active.id)
+      const newIndex = items.findIndex(i => i.id === over!.id)
+      onReorder(arrayMove(items, oldIndex, newIndex))
+    }
+  }
+  return <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
+    <SortableContext items={items} strategy={verticalListSortingStrategy}>
+      {items.map(item => <SortableCard key={item.id} item={item} />)}
+    </SortableContext>
+  </DndContext>`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000/board"),
      ev(500, "page_loaded", undefined, "Kanban Board"),
      ev(3000, "narrate", undefined, "Cards in each column are now drag-and-drop sortable"),
      ev(5000, "click", ".card:nth-child(3)", "Fix login bug"),
      ev(5000, "narrate", undefined, "Using dnd-kit with closestCenter collision detection"),
      ev(9000, "click", ".card:nth-child(1)", "Deploy v2"),
      ev(9000, "narrate", undefined, "The reorder persists via the onReorder callback"),
      ev(13000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/drag-reorder",
      commitMessage: "Add drag-and-drop card reordering with dnd-kit",
    },
    mustMention: ["drag", "reorder"],
    mustNotContain: ["we see cards"],
    minSegments: 2,
  },

  // ─── 8. Optimistic updates ────────────────────────────────────
  {
    id: "optimistic-updates",
    description: "Adds optimistic updates for like/unlike actions",
    diff: `diff --git a/src/hooks/useLike.ts b/src/hooks/useLike.ts
+export function useLike(postId: string) {
+  const queryClient = useQueryClient()
+  return useMutation({
+    mutationFn: () => api.toggleLike(postId),
+    onMutate: async () => {
+      await queryClient.cancelQueries(['post', postId])
+      const prev = queryClient.getQueryData<Post>(['post', postId])
+      queryClient.setQueryData(['post', postId], (old: Post) => ({
+        ...old, liked: !old.liked, likes: old.liked ? old.likes - 1 : old.likes + 1
+      }))
+      return { prev }
+    },
+    onError: (err, vars, ctx) => {
+      queryClient.setQueryData(['post', postId], ctx?.prev)
+    },
+    onSettled: () => queryClient.invalidateQueries(['post', postId])
+  })
+}`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000/feed"),
      ev(500, "page_loaded", undefined, "Feed"),
      ev(3000, "click", "text=♡", "♡ 42"),
      ev(3000, "narrate", undefined, "Likes now update instantly — optimistic mutation via React Query"),
      ev(7000, "click", "text=♥", "♥ 43"),
      ev(7000, "narrate", undefined, "Unlike rolls back if the API fails, using onError context"),
      ev(11000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/optimistic-likes",
      commitMessage: "Add optimistic updates for like/unlike with React Query",
    },
    mustMention: ["optimistic", "React Query"],
    mustNotContain: ["heart icon"],
    minSegments: 2,
  },

  // ─── 9. Responsive navbar ─────────────────────────────────────
  {
    id: "responsive-nav",
    description: "Makes navbar responsive with hamburger menu on mobile",
    diff: `diff --git a/src/components/Navbar.tsx b/src/components/Navbar.tsx
+  const [menuOpen, setMenuOpen] = useState(false)
-  return <nav><ul className="nav-links">{links.map(renderLink)}</ul></nav>
+  return <nav>
+    <button className="hamburger md:hidden" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
+    <ul className={clsx('nav-links', { 'hidden md:flex': !menuOpen, 'flex flex-col': menuOpen })}>
+      {links.map(renderLink)}
+    </ul>
+  </nav>
diff --git a/tailwind.config.ts b/tailwind.config.ts
+  screens: { sm: '640px', md: '768px', lg: '1024px' }`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000"),
      ev(500, "page_loaded", undefined, "Home"),
      ev(3000, "narrate", undefined, "On mobile widths, the nav collapses behind a hamburger menu"),
      ev(5000, "click", "button.hamburger", "☰"),
      ev(5000, "narrate", undefined, "Tapping opens a vertical menu using Tailwind responsive classes"),
      ev(9000, "click", "button.hamburger", "☰"),
      ev(9000, "narrate", undefined, "Toggle again to close — state managed with useState"),
      ev(13000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/responsive-nav",
      commitMessage: "Add responsive hamburger menu for mobile viewports",
    },
    mustMention: ["responsive", "hamburger"],
    mustNotContain: ["a menu appears"],
    minSegments: 2,
  },

  // ─── 10. API error boundary ───────────────────────────────────
  {
    id: "error-boundary",
    description: "Adds React error boundary with retry for API failures",
    diff: `diff --git a/src/components/ErrorBoundary.tsx b/src/components/ErrorBoundary.tsx
new file mode 100644
+export class ApiErrorBoundary extends Component<Props, State> {
+  state = { error: null as Error | null }
+  static getDerivedStateFromError(error: Error) { return { error } }
+  retry = () => { this.setState({ error: null }) }
+  render() {
+    if (this.state.error) {
+      return <div className="error-panel">
+        <h2>Something went wrong</h2>
+        <p>{this.state.error.message}</p>
+        <button onClick={this.retry}>Retry</button>
+      </div>
+    }
+    return this.props.children
+  }
+}
diff --git a/src/App.tsx b/src/App.tsx
-  <Dashboard />
+  <ApiErrorBoundary><Dashboard /></ApiErrorBoundary>`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000"),
      ev(500, "page_loaded", undefined, "Dashboard"),
      ev(3000, "narrate", undefined, "The dashboard is now wrapped in an error boundary"),
      ev(5000, "click", "text=Trigger Error", "Trigger Error"),
      ev(5000, "narrate", undefined, "API failures show a friendly error panel with retry button"),
      ev(9000, "click", "text=Retry", "Retry"),
      ev(9000, "narrate", undefined, "Retry resets the boundary and re-renders the children"),
      ev(13000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/error-boundary",
      commitMessage: "Add error boundary with retry for API failures",
    },
    mustMention: ["error boundary", "retry"],
    mustNotContain: ["error message appears"],
    minSegments: 2,
  },

  // ─── 11. Infinite scroll ──────────────────────────────────────
  {
    id: "infinite-scroll",
    description: "Replaces pagination with IntersectionObserver infinite scroll",
    diff: `diff --git a/src/hooks/useInfiniteScroll.ts b/src/hooks/useInfiniteScroll.ts
new file mode 100644
+export function useInfiniteScroll(loadMore: () => void, hasMore: boolean) {
+  const sentinelRef = useRef<HTMLDivElement>(null)
+  useEffect(() => {
+    if (!hasMore) return
+    const obs = new IntersectionObserver(([entry]) => {
+      if (entry.isIntersecting) loadMore()
+    }, { threshold: 0.1 })
+    if (sentinelRef.current) obs.observe(sentinelRef.current)
+    return () => obs.disconnect()
+  }, [hasMore, loadMore])
+  return sentinelRef
+}
diff --git a/src/pages/Feed.tsx b/src/pages/Feed.tsx
-  <button onClick={loadMore}>Load More</button>
+  const sentinelRef = useInfiniteScroll(loadMore, hasMore)
+  <div ref={sentinelRef} className="h-4" />`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000/feed"),
      ev(500, "page_loaded", undefined, "Feed"),
      ev(3000, "narrate", undefined, "The feed now loads more posts as you scroll down"),
      ev(5000, "scroll", undefined, "down 800"),
      ev(5000, "narrate", undefined, "IntersectionObserver triggers loadMore when the sentinel enters the viewport"),
      ev(9000, "scroll", undefined, "down 800"),
      ev(13000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/infinite-scroll",
      commitMessage: "Replace Load More button with IntersectionObserver infinite scroll",
    },
    mustMention: ["infinite scroll", "IntersectionObserver"],
    mustNotContain: ["scrolling down"],
    minSegments: 2,
  },

  // ─── 12. Keyboard shortcuts ───────────────────────────────────
  {
    id: "keyboard-shortcuts",
    description: "Adds global keyboard shortcuts with a help modal",
    diff: `diff --git a/src/hooks/useKeyboardShortcuts.ts b/src/hooks/useKeyboardShortcuts.ts
new file mode 100644
+const shortcuts: Shortcut[] = [
+  { key: 'n', ctrl: true, action: 'new-item', label: 'New item' },
+  { key: '/', action: 'search', label: 'Focus search' },
+  { key: '?', action: 'help', label: 'Show shortcuts' },
+]
+export function useKeyboardShortcuts(handlers: Record<string, () => void>) {
+  useEffect(() => {
+    function onKey(e: KeyboardEvent) {
+      const match = shortcuts.find(s => s.key === e.key && (!s.ctrl || e.ctrlKey))
+      if (match && handlers[match.action]) { e.preventDefault(); handlers[match.action]() }
+    }
+    window.addEventListener('keydown', onKey)
+    return () => window.removeEventListener('keydown', onKey)
+  }, [handlers])
+}`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000"),
      ev(500, "page_loaded", undefined, "App"),
      ev(3000, "narrate", undefined, "Global keyboard shortcuts are now active"),
      ev(5000, "click", "text=?", "?"),
      ev(5000, "narrate", undefined, "Pressing ? opens a shortcuts reference modal"),
      ev(9000, "click", "text=Close", "Close"),
      ev(13000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/keyboard-shortcuts",
      commitMessage: "Add global keyboard shortcuts with help modal",
    },
    mustMention: ["keyboard", "shortcuts"],
    mustNotContain: ["a modal opens"],
    minSegments: 2,
  },

  // ─── 13. Auth guard / protected routes ────────────────────────
  {
    id: "auth-guard",
    description: "Adds authentication guard for protected routes",
    diff: `diff --git a/src/components/AuthGuard.tsx b/src/components/AuthGuard.tsx
new file mode 100644
+export function AuthGuard({ children }: { children: ReactNode }) {
+  const { user, loading } = useAuth()
+  const router = useRouter()
+  useEffect(() => {
+    if (!loading && !user) router.push('/login')
+  }, [user, loading, router])
+  if (loading) return <Spinner />
+  if (!user) return null
+  return <>{children}</>
+}
diff --git a/src/app/dashboard/layout.tsx b/src/app/dashboard/layout.tsx
-  return <>{children}</>
+  return <AuthGuard>{children}</AuthGuard>`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000/dashboard"),
      ev(500, "page_loaded", undefined, "Login"),
      ev(3000, "narrate", undefined, "Unauthenticated users are redirected to login"),
      ev(5000, "type", "input[name='email']", "admin@example.com"),
      ev(6000, "type", "input[name='password']", "password123"),
      ev(7000, "click", "text=Sign In", "Sign In"),
      ev(7000, "narrate", undefined, "After login, the AuthGuard re-renders and shows the dashboard"),
      ev(11000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/auth-guard",
      commitMessage: "Add AuthGuard component for protected routes",
    },
    mustMention: ["AuthGuard", "redirect"],
    mustNotContain: ["login page"],
    minSegments: 2,
  },

  // ─── 14. File upload with preview ─────────────────────────────
  {
    id: "file-upload",
    description: "Adds drag-and-drop file upload with image preview",
    diff: `diff --git a/src/components/FileUpload.tsx b/src/components/FileUpload.tsx
new file mode 100644
+export function FileUpload({ onUpload }: Props) {
+  const [preview, setPreview] = useState<string | null>(null)
+  const [dragOver, setDragOver] = useState(false)
+  function handleDrop(e: DragEvent) {
+    e.preventDefault(); setDragOver(false)
+    const file = e.dataTransfer?.files[0]
+    if (file?.type.startsWith('image/')) {
+      setPreview(URL.createObjectURL(file))
+      onUpload(file)
+    }
+  }
+  return <div className={clsx('dropzone', { 'drag-over': dragOver })}
+    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
+    onDragLeave={() => setDragOver(false)}
+    onDrop={handleDrop}>
+    {preview ? <img src={preview} alt="Preview" /> : <p>Drop an image here</p>}
+  </div>
+}`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000/upload"),
      ev(500, "page_loaded", undefined, "Upload"),
      ev(3000, "narrate", undefined, "The upload area accepts drag-and-drop with visual feedback"),
      ev(5000, "click", ".dropzone", "Drop an image here"),
      ev(5000, "narrate", undefined, "Images get an instant preview via URL.createObjectURL"),
      ev(9000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/file-upload",
      commitMessage: "Add drag-and-drop file upload with image preview",
    },
    mustMention: ["drag-and-drop", "preview"],
    mustNotContain: ["a box appears"],
    minSegments: 2,
  },

  // ─── 15. Markdown editor ──────────────────────────────────────
  {
    id: "markdown-editor",
    description: "Adds split-pane markdown editor with live preview",
    diff: `diff --git a/src/components/MarkdownEditor.tsx b/src/components/MarkdownEditor.tsx
new file mode 100644
+import { marked } from 'marked'
+import DOMPurify from 'dompurify'
+export function MarkdownEditor() {
+  const [source, setSource] = useState('# Hello\\n\\nStart writing...')
+  const html = DOMPurify.sanitize(marked.parse(source))
+  return <div className="grid grid-cols-2 gap-4">
+    <textarea value={source} onChange={e => setSource(e.target.value)}
+      className="font-mono p-4 border rounded" />
+    <div className="prose p-4 border rounded" dangerouslySetInnerHTML={{ __html: html }} />
+  </div>
+}`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000/editor"),
      ev(500, "page_loaded", undefined, "Editor"),
      ev(3000, "narrate", undefined, "Split-pane markdown editor with live HTML preview"),
      ev(5000, "type", "textarea", "## Features\n- Fast\n- Secure"),
      ev(5000, "narrate", undefined, "Typing in the left pane renders sanitized HTML on the right via marked + DOMPurify"),
      ev(9000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/markdown-editor",
      commitMessage: "Add split-pane markdown editor with DOMPurify sanitization",
    },
    mustMention: ["markdown", "DOMPurify"],
    mustNotContain: ["text editor"],
    minSegments: 2,
  },

  // ─── 16. Skeleton loading ─────────────────────────────────────
  {
    id: "skeleton-loading",
    description: "Replaces spinner with skeleton loading placeholders",
    diff: `diff --git a/src/components/Skeleton.tsx b/src/components/Skeleton.tsx
new file mode 100644
+export function Skeleton({ lines = 3, avatar = false }: Props) {
+  return <div className="animate-pulse space-y-3">
+    {avatar && <div className="rounded-full bg-gray-200 h-10 w-10" />}
+    {Array.from({ length: lines }).map((_, i) => (
+      <div key={i} className="h-4 bg-gray-200 rounded" style={{ width: \`\${80 - i * 10}%\` }} />
+    ))}
+  </div>
+}
diff --git a/src/pages/Profile.tsx b/src/pages/Profile.tsx
-  if (loading) return <Spinner />
+  if (loading) return <Skeleton lines={4} avatar />`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000/profile"),
      ev(500, "page_loaded", undefined, "Profile"),
      ev(2000, "narrate", undefined, "Loading state now shows skeleton placeholders instead of a spinner"),
      ev(5000, "narrate", undefined, "The Skeleton component uses Tailwind animate-pulse with variable-width lines"),
      ev(9000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/skeleton-loading",
      commitMessage: "Replace spinner with skeleton loading placeholders",
    },
    mustMention: ["skeleton", "animate-pulse"],
    mustNotContain: ["loading spinner"],
    minSegments: 2,
  },

  // ─── 17. WebSocket real-time updates ──────────────────────────
  {
    id: "websocket-updates",
    description: "Adds WebSocket connection for real-time data updates",
    diff: `diff --git a/src/hooks/useRealtimeUpdates.ts b/src/hooks/useRealtimeUpdates.ts
new file mode 100644
+export function useRealtimeUpdates(channel: string) {
+  const queryClient = useQueryClient()
+  useEffect(() => {
+    const ws = new WebSocket(\`wss://api.example.com/ws/\${channel}\`)
+    ws.onmessage = (event) => {
+      const update = JSON.parse(event.data)
+      queryClient.setQueryData([channel, update.id], update)
+    }
+    ws.onerror = () => ws.close()
+    return () => ws.close()
+  }, [channel, queryClient])
+}
diff --git a/src/pages/Chat.tsx b/src/pages/Chat.tsx
+  useRealtimeUpdates('messages')`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000/chat"),
      ev(500, "page_loaded", undefined, "Chat"),
      ev(3000, "narrate", undefined, "Chat messages now update in real-time via WebSocket"),
      ev(5000, "click", "text=Send", "Send"),
      ev(5000, "narrate", undefined, "New messages arrive instantly — the hook updates React Query cache on ws.onmessage"),
      ev(9000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/websocket-chat",
      commitMessage: "Add WebSocket hook for real-time message updates",
    },
    mustMention: ["WebSocket", "real-time"],
    mustNotContain: ["messages appear"],
    minSegments: 2,
  },

  // ─── 18. i18n / localization ──────────────────────────────────
  {
    id: "i18n",
    description: "Adds i18n support with language switcher",
    diff: `diff --git a/src/i18n/index.ts b/src/i18n/index.ts
new file mode 100644
+import i18next from 'i18next'
+import { initReactI18next } from 'react-i18next'
+import en from './locales/en.json'
+import es from './locales/es.json'
+i18next.use(initReactI18next).init({
+  resources: { en: { translation: en }, es: { translation: es } },
+  lng: navigator.language.startsWith('es') ? 'es' : 'en',
+  fallbackLng: 'en'
+})
diff --git a/src/components/LanguageSwitcher.tsx b/src/components/LanguageSwitcher.tsx
+export function LanguageSwitcher() {
+  const { i18n } = useTranslation()
+  return <select value={i18n.language} onChange={e => i18n.changeLanguage(e.target.value)}>
+    <option value="en">English</option>
+    <option value="es">Español</option>
+  </select>
+}`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000"),
      ev(500, "page_loaded", undefined, "Home"),
      ev(3000, "narrate", undefined, "The app now supports English and Spanish via i18next"),
      ev(5000, "click", "select", "English"),
      ev(5000, "narrate", undefined, "Switching language re-renders all translated strings instantly"),
      ev(9000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/i18n",
      commitMessage: "Add i18n with react-i18next and language switcher",
    },
    mustMention: ["i18n", "language"],
    mustNotContain: ["dropdown"],
    minSegments: 2,
  },

  // ─── 19. CSV export ───────────────────────────────────────────
  {
    id: "csv-export",
    description: "Adds CSV export for data tables",
    diff: `diff --git a/src/utils/exportCsv.ts b/src/utils/exportCsv.ts
new file mode 100644
+export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
+  if (!rows.length) return
+  const headers = Object.keys(rows[0])
+  const csv = [
+    headers.join(','),
+    ...rows.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
+  ].join('\\n')
+  const blob = new Blob([csv], { type: 'text/csv' })
+  const url = URL.createObjectURL(blob)
+  const a = document.createElement('a')
+  a.href = url; a.download = filename; a.click()
+  URL.revokeObjectURL(url)
+}
diff --git a/src/components/DataTable.tsx b/src/components/DataTable.tsx
+  <button onClick={() => exportToCsv('data.csv', filteredRows)}>Export CSV</button>`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000/data"),
      ev(500, "page_loaded", undefined, "Data Table"),
      ev(3000, "narrate", undefined, "The data table now has a CSV export button"),
      ev(5000, "click", "text=Export CSV", "Export CSV"),
      ev(5000, "narrate", undefined, "It generates a CSV blob from filtered rows and triggers a download"),
      ev(9000, "demo_complete"),
    ],
    prInfo: {
      branch: "feature/csv-export",
      commitMessage: "Add CSV export for data tables",
    },
    mustMention: ["CSV", "export"],
    mustNotContain: ["button clicks"],
    minSegments: 2,
  },

  // ─── 20. Accessibility audit fixes ────────────────────────────
  {
    id: "a11y-fixes",
    description: "Fixes accessibility issues: aria labels, focus traps, color contrast",
    diff: `diff --git a/src/components/Modal.tsx b/src/components/Modal.tsx
-  return <div className="modal-overlay" onClick={onClose}>
-    <div className="modal">{children}</div>
-  </div>
+  const modalRef = useRef<HTMLDivElement>(null)
+  useFocusTrap(modalRef)
+  return <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
+    <div className="modal" ref={modalRef} tabIndex={-1}>
+      <button aria-label="Close" onClick={onClose} className="modal-close">&times;</button>
+      {children}
+    </div>
+  </div>
diff --git a/src/components/Button.tsx b/src/components/Button.tsx
-  <button className={variant}>{children}</button>
+  <button className={variant} aria-label={ariaLabel}>{children}</button>
diff --git a/src/hooks/useFocusTrap.ts b/src/hooks/useFocusTrap.ts
new file mode 100644
+export function useFocusTrap(ref: RefObject<HTMLElement>) {
+  useEffect(() => {
+    const el = ref.current; if (!el) return
+    const focusable = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]')
+    const first = focusable[0], last = focusable[focusable.length - 1]
+    function trap(e: KeyboardEvent) {
+      if (e.key !== 'Tab') return
+      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
+      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
+    }
+    el.addEventListener('keydown', trap)
+    first?.focus()
+    return () => el.removeEventListener('keydown', trap)
+  }, [ref])
+}`,
    eventLog: [
      ev(0, "navigate", undefined, "http://localhost:3000"),
      ev(500, "page_loaded", undefined, "Home"),
      ev(3000, "click", "text=Open Modal", "Open Modal"),
      ev(3000, "narrate", undefined, "The modal now has proper ARIA attributes and focus trapping"),
      ev(7000, "narrate", undefined, "Tab cycles through focusable elements without leaving the modal"),
      ev(9000, "click", "button[aria-label='Close']", "×"),
      ev(9000, "narrate", undefined, "Close button has an aria-label for screen readers"),
      ev(13000, "demo_complete"),
    ],
    prInfo: {
      branch: "fix/accessibility-audit",
      commitMessage: "Fix modal a11y: add ARIA roles, focus trap, and aria-labels",
    },
    mustMention: ["ARIA", "focus trap"],
    mustNotContain: ["modal opens"],
    minSegments: 2,
  },
];
