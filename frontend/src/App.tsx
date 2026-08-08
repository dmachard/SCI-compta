import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { authApi } from './api';
import type { User } from './types';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import SCIConfig from './pages/SCIConfig';
import Associates from './pages/Associates';
import AssociateDetail from './pages/AssociateDetail';
import Capital from './pages/Capital';
import CurrentAccounts from './pages/CurrentAccounts';
import FiscalYears from './pages/FiscalYears';
import BankAccounts from './pages/BankAccounts';
import DocumentsPage from './pages/Documents';
import Tax2072 from './pages/Tax2072';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const status = await authApi.status();
      setConfigured(status.configured);

      const token = localStorage.getItem('token');
      if (token) {
        const me = await authApi.me();
        setUser(me);
      }
    } catch {
      // Si la vérification du statut échoue (ex: API injoignable ou première installation),
      // on permet de basculer en mode configuration si besoin.
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(token: string) {
    localStorage.setItem('token', token);
    checkAuth();
  }

  function handleLogout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  const isUnconfigured = configured === false;

  // Pas encore configuré ou bouton d'initialisation cliqué → setup
  if (isUnconfigured || showSetup) {
    return (
      <SetupPage
        onSetup={(token) => {
          setShowSetup(false);
          setConfigured(true);
          handleLogin(token);
        }}
      />
    );
  }

  // Pas connecté → login
  if (!user) {
    return (
      <LoginPage
        onLogin={handleLogin}
        onNavigateSetup={isUnconfigured ? () => setShowSetup(true) : undefined}
      />
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Navigate to="/exercices" replace />} />
        <Route path="/sci" element={<SCIConfig />} />
        <Route path="/associes" element={<Associates />} />
        <Route path="/associes/:id" element={<AssociateDetail />} />
        <Route path="/capital" element={<Capital />} />
        <Route path="/banque" element={<BankAccounts />} />
        <Route path="/comptes-courants" element={<CurrentAccounts />} />
        <Route path="/exercices" element={<FiscalYears />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
