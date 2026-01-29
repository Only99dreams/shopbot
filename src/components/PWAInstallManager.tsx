import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
  }
}

const PWAInstallManager: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      console.log("beforeinstallprompt event fired");
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  useEffect(() => {
    // Show install UI on /marketplace
    setVisible(location.pathname === "/marketplace");
  }, [location.pathname]);

  if (!visible) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        console.log("PWA install choice:", choice.outcome);
      } catch (err) {
        console.error("PWA install failed", err);
      }
    } else {
      alert("To install, look for the 'Add to Home Screen' option in your browser menu.");
    }
  };

  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 60 }}>
      <button
        onClick={handleInstall}
        className={`text-white px-4 py-2 rounded-lg shadow-lg ${
          deferredPrompt ? "bg-green-500 hover:bg-green-600" : "bg-blue-500 hover:bg-blue-600"
        }`}
      >
        {deferredPrompt ? "Install Marketplace" : "Install Guide"}
      </button>
    </div>
  );
};

export default PWAInstallManager;
