import React, { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { isAuthenticated, onAuthChange, checkFirstTimeSetup } from "@/lib/pocketbase";
import IndexPocketBase from "./pages/IndexPocketBase";
import AuthPocketBase from "./pages/AuthPocketBase";
import FirstTimeSetupPocketBase from "./pages/FirstTimeSetupPocketBase";
import NotFound from "./pages/NotFound";
import { InstallPWA } from "./components/haccp/InstallPWA";

const queryClient = new QueryClient();

// Protected Route component for PocketBase
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check initial auth state
    setAuthenticated(isAuthenticated());

    // Subscribe to auth changes
    const unsubscribe = onAuthChange((isValid) => {
      setAuthenticated(isValid);
    });

    return () => unsubscribe();
  }, []);

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

// Auth Router with First-Time Setup detection
const AuthRouter = () => {
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);

  useEffect(() => {
    checkFirstTimeSetup().then(setIsFirstTime);
  }, []);

  if (isFirstTime === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If first time, show setup wizard
  if (isFirstTime) {
    return <FirstTimeSetupPocketBase />;
  }

  // Otherwise show normal login
  return <AuthPocketBase />;
};

const AppPocketBase = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <InstallPWA />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthRouter />} />
          <Route path="/setup" element={<FirstTimeSetupPocketBase />} />
          <Route path="/" element={
            <ProtectedRoute>
              <IndexPocketBase />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default AppPocketBase;
