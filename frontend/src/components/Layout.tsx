import { Button } from "@/components/ui/button";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useActor } from "@caffeineai/core-infrastructure";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, MapIcon, Radio, Shield, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { createActor } from "../backend";
import { useEmergencyStore } from "../store/emergency";
import { ThreatBadge } from "./ThreatBadge";

const NAV_ITEMS = [
  { to: "/", label: "DETECTION", icon: Radio },
  { to: "/floorplan", label: "FLOOR PLAN", icon: MapIcon },
  { to: "/manifest", label: "MANIFEST", icon: Users },
];

function abbreviatePrincipal(principal: string): string {
  if (principal.length <= 16) return principal;
  return `${principal.slice(0, 8)}...${principal.slice(-4)}`;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const currentThreat = useEmergencyStore((s) => s.currentThreat);
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const navigate = useNavigate();

  const { isAuthenticated, clear: logout } = useInternetIdentity();

  const { actor } = useActor(createActor);
  const [principalId, setPrincipalId] = useState<string | null>(null);

  // Fetch principal on mount once actor and identity are ready
  useEffect(() => {
    if (!actor || !isAuthenticated) return;
    actor
      .whoami()
      .then((id) => setPrincipalId(abbreviatePrincipal(id)))
      .catch(() => setPrincipalId(null));
  }, [actor, isAuthenticated]);

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top bar */}
      <header
        className="bg-card border-b border-border sticky top-0 z-50"
        data-ocid="layout.header"
      >
        <div className="flex items-center h-12 px-4 gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Shield className="w-5 h-5 text-primary" aria-hidden="true" />
            <span className="font-display font-bold text-sm tracking-widest text-foreground uppercase">
              Guardian<span className="text-primary">Pulse</span>
            </span>
          </div>

          {/* Nav */}
          <nav
            className="flex items-center gap-1 flex-1"
            aria-label="Main navigation"
          >
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  data-ocid={`nav.${label.toLowerCase().replace(" ", "_")}_link`}
                  className={[
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold tracking-widest uppercase border transition-colors duration-150",
                    active
                      ? "bg-primary/15 text-primary border-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground hover:border-border",
                  ].join(" ")}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Live threat status */}
          <div className="flex-shrink-0">
            <ThreatBadge threat={currentThreat} size="sm" showConfidence />
          </div>

          {/* Logout button */}
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-ocid="layout.logout_button"
              className="flex-shrink-0 h-7 text-xs font-mono text-muted-foreground hover:text-foreground gap-1.5 uppercase tracking-widest"
              aria-label="Logout"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">LOGOUT</span>
            </Button>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 flex flex-col" data-ocid="layout.main">
        {children}
      </main>

      {/* Footer */}
      <footer
        className="bg-muted/40 border-t border-border py-2 px-4"
        data-ocid="layout.footer"
      >
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <p className="text-xs text-muted-foreground font-mono">
            © {new Date().getFullYear()}{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Built with love using caffeine.ai
            </a>
          </p>
          {principalId && (
            <span
              className="text-xs text-muted-foreground font-mono opacity-60"
              data-ocid="layout.principal_id"
            >
              ID: {principalId}
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
