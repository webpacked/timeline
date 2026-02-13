import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        <div className="container mx-auto flex h-14 items-center px-4">
          <div className="mr-8 flex items-center space-x-2">
            <span className="font-bold text-lg">Timeline</span>
          </div>
          
          <nav className="flex flex-1 items-center justify-between">
            <div className="flex items-center space-x-6 text-sm">
              <Link 
                href="/docs/getting-started" 
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                Documentation
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <a
                href="https://github.com/yourusername/timeline"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors text-sm"
              >
                GitHub
              </a>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-24">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-5xl font-bold tracking-tight mb-6">
              Timeline
            </h1>
            
            <p className="text-xl text-[hsl(var(--muted-foreground))] mb-8">
              Framework-agnostic timeline infrastructure for video editing applications
            </p>

            <div className="bg-[hsl(var(--muted))] rounded-lg p-4 mb-8 border border-[hsl(var(--border))]">
              <code className="text-sm">
                npm install @timeline/core @timeline/react
              </code>
            </div>

            <div className="flex gap-4">
              <Link
                href="/docs/getting-started"
                className="inline-flex items-center justify-center rounded-md bg-[hsl(var(--accent))] px-6 py-3 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90 transition-opacity"
              >
                Get Started
              </Link>
              
              <a
                href="https://github.com/yourusername/timeline"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-[hsl(var(--border))] px-6 py-3 text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors"
              >
                View on GitHub
              </a>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              <div>
                <h3 className="font-semibold mb-2">Framework Agnostic</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Core engine works with any framework. Official React adapter included.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Deterministic</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Frame-based time system ensures predictable, reproducible behavior.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Extensible</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Built-in systems for snapping, grouping, linking, and validation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
