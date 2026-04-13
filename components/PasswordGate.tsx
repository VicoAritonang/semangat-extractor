"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Orbit } from "lucide-react";

interface AuthContextType {
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType>({ isAuthenticated: false });

export function useAuth() {
  return useContext(AuthContext);
}

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("semangat_auth");
    if (stored === "true") {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!password.trim()) return;
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        sessionStorage.setItem("semangat_auth", "true");
        setIsAuthenticated(true);
      } else {
        setError("Wrong password. Try again.");
        setPassword("");
      }
    } catch {
      setError("Connection error. Try again.");
    } finally {
      setIsLoading(false);
    }
  }, [password]);

  if (isChecking) {
    return (
      <div className="loading-page">
        <div className="orbit-ring" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="password-gate">
        <motion.div
          className="glass-card password-card"
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, type: "spring", stiffness: 100 }}
        >
          <motion.div
            className="password-icon"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          >
            <Lock size={28} color="white" />
          </motion.div>

          <motion.h1
            className="password-title"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            Semangat ✦
          </motion.h1>

          <motion.p
            className="password-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            Enter password to access the cosmos
          </motion.p>

          <AnimatePresence>
            {error && (
              <motion.p
                className="password-error"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <input
              type="password"
              className="password-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
              id="password-input"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
          >
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={isLoading || !password.trim()}
              style={{ width: "100%" }}
              id="login-button"
            >
              {isLoading ? (
                <span className="loading-orbit" />
              ) : (
                <>
                  <Orbit size={16} />
                  Enter the Cosmos
                </>
              )}
            </button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: true }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    </AuthContext.Provider>
  );
}
