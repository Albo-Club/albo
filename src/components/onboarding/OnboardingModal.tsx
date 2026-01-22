import React from 'react';

interface OnboardingModalProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function OnboardingModal({ children, title, subtitle }: OnboardingModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-semibold text-center text-gray-900">
          {title}
        </h1>
        <p className="text-gray-500 text-center mt-2 mb-8 text-sm">
          {subtitle}
        </p>
        {children}
      </div>
    </div>
  );
}
