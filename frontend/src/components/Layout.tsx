import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  CalendarRange,
  FileText,
  Settings,
  FolderArchive,
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
  { to: '/documents', label: 'Documents', icon: FolderArchive },
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

  const isManager = user.role === 'gerant';
  const filteredNavItems = navItems.filter((item) => {
    if (item.to === '/sci' && !isManager) return false;
    return true;
  });

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
        <div className="p-5 border-b border-border flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Gestion SCI Logo" className="w-9 h-9 object-contain rounded-lg" />
            <div>
              <h1 className="text-base font-extrabold text-text-primary tracking-tight leading-none">
                Gestion SCI
              </h1>
              <p className="text-[11px] text-text-muted mt-1 font-medium">Comptabilité immobilière</p>
            </div>
          </div>
          <button onClick={closeSidebar} className="md:hidden text-slate-500 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-accent text-white shadow-md shadow-accent/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User Info & Footer */}
        <div className="p-3 border-t border-border bg-slate-50/50">
          <div className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
            {/* Avatar & User Details */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${
                  isManager
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-white'
                }`}
              >
                {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-slate-900 truncate leading-tight" title={user.full_name || user.email}>
                  {user.full_name || user.email}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold border uppercase tracking-wider ${
                      isManager
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {isManager ? 'Gérant' : 'Lecture seule'}
                  </span>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
              title="Se déconnecter"
            >
              <LogOut size={16} />
            </button>
          </div>
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
