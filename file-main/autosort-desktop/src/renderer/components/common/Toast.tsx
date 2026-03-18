import React, { useEffect } from 'react';

type ToastVariant = 'success' | 'error' | 'info';

interface Props {
  message: string;
  variant?: ToastVariant;
  onClose?: () => void;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
};

export default function Toast({ message, variant = 'info', onClose }: Props) {
  useEffect(() => {
    if (!onClose) return;
    const timer = setTimeout(() => {
      onClose();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <div
        className={`text-white px-4 py-2 rounded-lg shadow-lg ${VARIANT_STYLES[variant]} text-sm`}
      >
        {message}
      </div>
    </div>
  );
}
