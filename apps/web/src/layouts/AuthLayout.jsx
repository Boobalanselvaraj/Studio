import React from 'react';
import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            StudioFlow
          </h1>
          <p className="text-sm text-muted mt-1">
            Photography Studio Management & Customer Delivery
          </p>
        </div>

        <Outlet />
      </div>
    </div>
  );
}
