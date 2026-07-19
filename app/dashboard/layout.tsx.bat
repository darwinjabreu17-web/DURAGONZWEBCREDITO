export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* Menú Lateral unificado */}
      <aside className="w-64 border-r border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-xl mb-6 text-gray-900">DURAGONZ</h2>
        <nav className="space-y-4">
          <a href="/dashboard" className="block text-gray-600 hover:text-blue-600 font-medium">Inicio</a>
          <a href="/dashboard/creditos" className="block text-blue-600 font-bold">Créditos</a>
        </nav>
      </aside>
      
      {/* Contenido Principal con fondo claro */}
      <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
        {children}
      </main>
    </div>
  );
}