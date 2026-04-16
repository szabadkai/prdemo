"use client";

import { useState } from "react";

function Copy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-dim hover:text-foreground transition-colors cursor-pointer shrink-0"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      )}
    </button>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col flex-1 font-mono">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-10 py-6 animate-in">
        <span className="text-sm font-semibold tracking-tight font-sans text-accent">
          diffcast
        </span>
        <a
          href="https://github.com/szabadkai/diffcast"
          target="_blank"
          rel="noopener noreferrer"
          className="text-dim hover:text-foreground transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
        </a>
      </nav>

      {/* Hero — the install command IS the headline */}
      <section className="px-6 sm:px-10 pt-24 sm:pt-36 pb-20">
        <div className="max-w-2xl">
          <div className="animate-in stagger-1 flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-3 text-sm w-fit">
            <span className="text-dim select-none">$</span>
            <span className="text-green">npm i -g diffcast</span>
            <Copy text="npm i -g diffcast" />
          </div>

          <p className="animate-in stagger-2 mt-8 text-2xl sm:text-3xl font-sans font-medium leading-snug tracking-tight text-accent max-w-lg">
            Auto-generated narrated demo videos from pull requests.
          </p>

          <p className="animate-in stagger-3 mt-4 text-sm text-muted leading-relaxed max-w-md">
            Reads your diff. Drives a browser through the changed flows.
            Narrates what happened. Delivers an MP4 on your PR.
          </p>
        </div>
      </section>

      {/* Terminal output demo */}
      <section className="px-6 sm:px-10 pb-24">
        <div className="animate-in stagger-4 max-w-2xl bg-surface border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <pre className="p-5 text-xs leading-6 overflow-x-auto">
<span className="text-dim">$</span> <span className="text-foreground">diffcast run</span>{"\n"}
<span className="text-dim">│</span>{"\n"}
<span className="text-dim">├─</span> <span className="text-foreground">Starting dev server</span>         <span className="text-green">ready</span>{"\n"}
<span className="text-dim">├─</span> <span className="text-foreground">Extracting diff</span>              <span className="text-green">+47 −12 across 3 files</span>{"\n"}
<span className="text-dim">├─</span> <span className="text-foreground">Recording browser session</span>    <span className="text-green">8.2s captured</span>{"\n"}
<span className="text-dim">├─</span> <span className="text-foreground">Generating narration</span>         <span className="text-green">4 segments</span>{"\n"}
<span className="text-dim">├─</span> <span className="text-foreground">Rendering speech</span>             <span className="text-green">12.1s audio</span>{"\n"}
<span className="text-dim">├─</span> <span className="text-foreground">Muxing video</span>                 <span className="text-green">demo.mp4</span>{"\n"}
<span className="text-dim">│</span>{"\n"}
<span className="text-dim">└─</span> <span className="text-green">Posted to PR #142</span> <span className="text-dim">github.com/you/app/pull/142#comment</span>
          </pre>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-6 sm:mx-10 border-t border-border" />

      {/* Features — compact, no cards, no emoji */}
      <section className="px-6 sm:px-10 py-24">
        <div className="max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-10">
          <div>
            <h3 className="text-sm font-sans font-medium text-accent mb-2">
              Diff-aware narration
            </h3>
            <p className="text-sm text-muted leading-relaxed">
              The narrator reads your actual git diff, not just screen pixels.
              It says &ldquo;the save button now disables during
              submission&rdquo; instead of &ldquo;a button was clicked.&rdquo;
            </p>
          </div>
          <div>
            <h3 className="text-sm font-sans font-medium text-accent mb-2">
              Zero-config demo scripts
            </h3>
            <p className="text-sm text-muted leading-relaxed">
              Set <code className="text-foreground">demo.infer: true</code> and
              the LLM generates a Playwright script from the diff alone.
              No manual scripting.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-sans font-medium text-accent mb-2">
              Local-first
            </h3>
            <p className="text-sm text-muted leading-relaxed">
              Video, code, and secrets stay on your machine. Only the
              prompt hits the LLM under your own API key.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-sans font-medium text-accent mb-2">
              Ships to GitHub
            </h3>
            <p className="text-sm text-muted leading-relaxed">
              Uploads the MP4 as a release asset, generates a GIF preview,
              and posts a formatted comment on your PR.
            </p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-6 sm:mx-10 border-t border-border" />

      {/* Config */}
      <section className="px-6 sm:px-10 py-24">
        <div className="max-w-2xl">
          <p className="text-sm text-muted mb-6">
            Minimal config. Drop this in your repo root.
          </p>

          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
              <span className="text-xs text-dim">.diffcast.yml</span>
              <Copy text={`start: npm run dev\nready: http://localhost:3000\ndemo:\n  infer: true`} />
            </div>
            <pre className="p-5 text-sm leading-7 overflow-x-auto">
<span className="text-accent">start</span><span className="text-dim">:</span> npm run dev{"\n"}
<span className="text-accent">ready</span><span className="text-dim">:</span> http://localhost:3000{"\n"}
<span className="text-accent">demo</span><span className="text-dim">:</span>{"\n"}
  <span className="text-accent">infer</span><span className="text-dim">:</span> <span className="text-green">true</span>
            </pre>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-6 sm:mx-10 border-t border-border" />

      {/* Pipeline */}
      <section className="px-6 sm:px-10 py-24">
        <div className="max-w-3xl">
          <p className="text-sm text-muted mb-10">How it works</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
            {[
              ["diff", "Reads git diff from your PR branch."],
              ["record", "Playwright drives the browser, captures video."],
              ["narrate", "LLM writes narration from diff + browser log."],
              ["deliver", "ffmpeg muxes the MP4, posts it on your PR."],
            ].map(([title, desc], i) => (
              <div key={title}>
                <span className="text-xs text-dim">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-sm font-sans font-medium text-accent mt-1 mb-2">
                  {title}
                </h3>
                <p className="text-xs text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border px-6 sm:px-10 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-dim">
          <span>diffcast · MIT</span>
          <span>
            Built by{" "}
            <a
              href="https://catalystai.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-foreground transition-colors"
            >
              Catalyst AI
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
