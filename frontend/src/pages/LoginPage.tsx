import { Button } from "@/components/ui/button";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useNavigate } from "@tanstack/react-router";
import { Lock, Shield } from "lucide-react";
import { useEffect } from "react";

const INTRO_SEEN_KEY = "guardianpulse_intro_seen";

export function LoginPage() {
  const { login, loginStatus, isAuthenticated } = useInternetIdentity();
  const navigate = useNavigate();

  const isLoggingIn = loginStatus === "logging-in";

  useEffect(() => {
    if (isAuthenticated) {
      const introSeen = localStorage.getItem(INTRO_SEEN_KEY);
      if (introSeen) {
        navigate({ to: "/" });
      } else {
        navigate({ to: "/intro" });
      }
    }
  }, [isAuthenticated, navigate]);

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-4"
      data-ocid="login.page"
    >
      {/* Background grid effect */}
      <div
        className="fixed inset-0 pointer-events-none bg-grid-pattern opacity-30"
        aria-hidden="true"
      />

      {/* Card */}
      <div
        className="relative w-full max-w-sm bg-card border border-border rounded-sm shadow-2xl p-8 space-y-8"
        data-ocid="login.card"
      >
        {/* Alert stripe at top */}
        <div className="absolute inset-x-0 top-0 h-1 bg-primary rounded-t-sm" />

        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-sm bg-primary/10 border border-primary/40 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl tracking-widest text-foreground uppercase">
              Guardian<span className="text-primary">Pulse</span>
            </h1>
            <p className="text-xs text-muted-foreground font-mono tracking-wider mt-1 uppercase">
              Emergency Response System
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Login section */}
        <div className="space-y-4">
          <p className="text-xs font-mono text-muted-foreground text-center leading-relaxed">
            Secure access required. Authenticate with Internet Identity to
            access the threat detection console.
          </p>

          <Button
            onClick={() => login()}
            disabled={isLoggingIn || isAuthenticated}
            data-ocid="login.login_button"
            className="w-full h-11 font-display font-bold tracking-widest uppercase text-sm gap-2 bg-primary text-primary-foreground border-primary hover:bg-primary/90"
          >
            {isLoggingIn ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                AUTHENTICATING…
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" aria-hidden="true" />
                Login with Internet Identity
              </>
            )}
          </Button>
        </div>

        {/* Status feedback */}
        {loginStatus === "loginError" && (
          <p
            data-ocid="login.error_state"
            className="text-xs font-mono text-destructive text-center bg-destructive/10 border border-destructive/30 rounded-sm px-3 py-2"
          >
            Authentication failed. Please try again.
          </p>
        )}

        {/* Footer note */}
        <p className="text-xs text-muted-foreground font-mono text-center opacity-60">
          Powered by Internet Computer · No password required
        </p>
      </div>

      {/* Bottom branding */}
      <p className="mt-6 text-xs text-muted-foreground font-mono opacity-40">
        © {new Date().getFullYear()} GuardianPulse
      </p>
    </div>
  );
}
