import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 ml-64">
          <div className="container mx-auto px-8 py-8">
            <article className="prose max-w-none">
              {children}
            </article>
          </div>
        </main>
      </div>
    </div>
  );
}
