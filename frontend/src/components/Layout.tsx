import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  CalendarRange,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import type { User } from '../types';
import logoUrl from '../assets/logo.svg';

const navItems = [
  { to: '/banque', label: 'Compte courant de la SCI', icon: CreditCard },
  { to: '/associes', label: 'Comptes courant associés', icon: Users },
  { to: '/exercices', label: 'Bilan annuel', icon: CalendarRange },
  { to: '/sci', label: 'Configuration', icon: Settings },
];

interface Props {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function Layout({ user, onLogout, children }: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      {/* Overlay mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-bg-secondary border-r border-border flex flex-col transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Gestion SCI Logo" className="w-10 h-10 object-contain rounded-lg" />
            <div>
              <h1 className="text-lg font-bold text-text-primary tracking-tight leading-none">
                Gestion SCI
              </h1>
              <p className="text-xs text-text-muted mt-1">Espace Gérant</p>
            </div>
          </div>
          <button onClick={closeSidebar} className="md:hidden text-slate-500 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-accent text-white shadow-lg shadow-accent/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full p-2 text-sm font-medium text-text-secondary hover:text-danger rounded-lg hover:bg-bg-hover transition-colors"
            title="Se déconnecter"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header mobile */}
        <header className="md:hidden flex items-center justify-between p-4 bg-bg-secondary border-b border-border">
          <div className="flex items-center gap-3">
            <button onClick={toggleSidebar} className="text-slate-600 hover:text-slate-900">
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt="Gestion SCI Logo" className="w-6 h-6 object-contain" />
              <h1 className="text-lg font-bold text-text-primary tracking-tight">Gestion SCI</h1>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
