import { useEffect, useState } from 'react';
import { Download, Sparkles } from 'lucide-react';

export default function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Vérifier si l'app est déjà installée en mode autonome
    const isStandalone =
      (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof window !== 'undefined' && (window.navigator as any)?.standalone === true);

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  if (isInstalled || !deferredPrompt) {
    return null;
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  }

  return (
    <div className="p-3 mx-2 my-2 bg-gradient-to-r from-indigo-900/40 to-slate-900/40 border border-indigo-500/20 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Application mobile & PC</span>
        </span>
      </div>
      <p className="text-[11px] text-slate-400 leading-snug mb-2.5">
        Installez l'application sur votre écran d'accueil pour un accès rapide.
      </p>
      <button
        onClick={handleInstallClick}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-sm transition-all duration-200"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Installer l'application</span>
      </button>
    </div>
  );
}
