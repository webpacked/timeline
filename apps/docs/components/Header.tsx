import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]">
      <div className="container mx-auto flex h-14 items-center px-4">
        <div className="mr-8 flex items-center space-x-2">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-lg">Timeline</span>
          </Link>
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
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              GitHub
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
