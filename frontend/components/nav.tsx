"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./auth-context";
import { Logo } from "./logo";

export function Nav() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <nav className="bg-canvas/90 backdrop-blur border-b border-hairline sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 py-3.5 flex justify-between items-center">
        <Logo
          href={user ? "/dashboard" : "/"}
          imageClassName="h-9 w-auto max-w-[150px] sm:max-w-[174px]"
        />

        {user ? (
          <div className="flex items-center gap-2">
            <Link
              href="/plans/new"
              className="hidden sm:inline-flex items-center h-9 px-3 rounded-md text-[13px] font-medium text-charcoal hover:bg-surface transition-colors"
            >
              + New plan
            </Link>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="w-9 h-9 rounded-full bg-tint-lavender text-brand-purple-800 flex items-center justify-center font-medium text-[13px] hover:opacity-90 transition-opacity"
                aria-label="Account menu"
              >
                {initial}
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 bg-canvas border border-hairline rounded-lg shadow-lg overflow-hidden animate-fade-in z-20">
                    <div className="px-4 py-3 border-b border-hairline-soft">
                      <div className="text-[13px] font-medium text-charcoal truncate">
                        {user.name || "Hello"}
                      </div>
                      <div className="text-[12px] text-steel truncate">
                        {user.email}
                      </div>
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-[13px] hover:bg-surface text-charcoal"
                    >
                      My plan
                    </Link>
                    <Link
                      href="/plans/new"
                      onClick={() => setMenuOpen(false)}
                      className="block sm:hidden px-4 py-2 text-[13px] hover:bg-surface text-charcoal"
                    >
                      New plan
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-[13px] hover:bg-surface text-error"
                    >
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-1">
            <Link
              href="/login"
              className="inline-flex items-center h-9 px-3 rounded-md text-[13px] font-medium text-charcoal hover:bg-surface transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center h-9 px-[18px] rounded-md text-[13px] font-medium bg-primary text-on-primary hover:bg-primary-pressed transition-colors"
            >
              Get LearnMate free
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
