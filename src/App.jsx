import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import UserChat from './components/UserChat';
import AdminPanel from './components/AdminPanel';

function App() {
  return (
    <BrowserRouter>
      <div className="glass h-full flex flex-col">
        <header className="app-header">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl" style={{ fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.03em' }}>
              Support Chat System.
            </h1>
          </div>
          <nav className="flex gap-4">
            <Link to="/" className="btn btn-glass" style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>User Chat</Link>
            <Link to="/admin" className="btn btn-glass" style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>Admin Panel</Link>
          </nav>
        </header>

        <main className="flex-1 overflow-hidden relative">
          <Routes>
            <Route path="/" element={<UserChat />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
