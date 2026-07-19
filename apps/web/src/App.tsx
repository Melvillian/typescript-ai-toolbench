import { Link, Outlet } from 'react-router-dom';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="flex gap-6 border-b border-gray-200 bg-white px-6 py-4">
        <Link to="/" className="font-semibold hover:text-blue-600">
          Home
        </Link>
        <Link to="/about" className="font-semibold hover:text-blue-600">
          About
        </Link>
      </nav>
      <main className="mx-auto max-w-2xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
