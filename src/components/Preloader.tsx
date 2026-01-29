import React from "react";

const Preloader: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-green-900 to-green-700 text-white">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-20 w-20 border-4 border-white/20 border-t-white" />
        <div className="mt-4 text-lg font-semibold">ShopAfrica</div>
        <div className="mt-2 text-sm opacity-90">Loading marketplace…</div>
      </div>
    </div>
  );
};

export default Preloader;
