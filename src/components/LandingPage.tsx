import { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  Shield,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { signInWithGoogle } from '../utils/firebase.ts';

interface LandingPageProps {
  onSignInSuccess?: () => void;
}

export function LandingPage({ onSignInSuccess }: LandingPageProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const user = await signInWithGoogle();
      if (user && onSignInSuccess) {
        onSignInSuccess();
      }
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        // User cancelled or closed the popup window; clean state without error logging
        return;
      }
      console.warn('Sign-in notification:', err?.message || err);
      setAuthError(err?.message || 'Unable to complete sign-in. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div
      id="landing-page-container"
      className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#24211D] relative selection:bg-[#EAE2D5] selection:text-[#1A1815] overflow-x-hidden"
    >
      {/* Editorial Atmosphere: Soft Ambient Light & Architectural Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1080px] max-w-full h-[600px] bg-gradient-to-b from-[#F1E7D8]/80 via-[#F7F2E8]/40 to-transparent blur-3xl -z-10"
      />

      {/* Editorial Atmosphere: Faint Botanical Silhouette (Left Edge) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-24 -left-12 w-64 h-96 opacity-[0.06] text-[#5C503D] hidden lg:block select-none -z-10"
      >
        <svg viewBox="0 0 200 300" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
          <path d="M100 280 C100 200, 70 120, 20 40" strokeLinecap="round" />
          <path d="M78 190 C60 180, 50 160, 56 146 C62 132, 80 140, 78 190 Z" fill="currentColor" fillOpacity="0.5" />
          <path d="M88 150 C105 140, 115 120, 110 106 C105 92, 88 100, 88 150 Z" fill="currentColor" fillOpacity="0.5" />
          <path d="M58 110 C42 100, 35 82, 42 70 C49 58, 64 68, 58 110 Z" fill="currentColor" fillOpacity="0.5" />
          <path d="M68 70 C82 60, 90 42, 85 32 C80 22, 66 30, 68 70 Z" fill="currentColor" fillOpacity="0.5" />
          <path d="M30 46 C20 38, 16 26, 22 18 C28 10, 38 18, 30 46 Z" fill="currentColor" fillOpacity="0.5" />
        </svg>
      </div>

      {/* Editorial Atmosphere: Faint Journal Page Lines Motif (Right Edge) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-36 -right-10 w-72 h-80 opacity-[0.05] text-[#5C503D] hidden lg:block select-none -z-10"
      >
        <svg viewBox="0 0 200 240" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-full">
          <rect x="20" y="20" width="160" height="200" rx="6" />
          <line x1="40" y1="55" x2="160" y2="55" />
          <line x1="40" y1="80" x2="160" y2="80" />
          <line x1="40" y1="105" x2="160" y2="105" />
          <line x1="40" y1="130" x2="160" y2="130" />
          <line x1="40" y1="155" x2="140" y2="155" />
          <line x1="40" y1="180" x2="100" y2="180" />
        </svg>
      </div>

      {/* Top Navigation: Minimal Branding Only */}
      <header className="border-b border-[#E7DFD4] bg-[#FAF8F5]/90 backdrop-blur-md sticky top-0 z-30 transition-all">
        <div className="max-w-[1360px] mx-auto px-6 sm:px-10 lg:px-16 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#211E1A] text-[#FAF8F5] flex items-center justify-center shrink-0 shadow-xs border border-[#3A332B]">
              <BookOpen className="w-5 h-5 text-[#FAF8F5]" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="font-editorial text-lg sm:text-[20px] font-bold text-[#1B1814] tracking-tight leading-tight select-none">
                Personal Gemini Journal
              </span>
            </div>
          </div>
          {/* Right Header Status: Quiet Editorial Detail (No Duplicate Buttons) */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-[#7A7163]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600/80" aria-hidden="true" />
            <span>Private Sanctuary</span>
          </div>
        </div>
      </header>

      {/* Main Content: Full Viewport Architectural Composition */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 sm:px-10 lg:px-16 pt-12 sm:pt-16 md:pt-20 pb-16 sm:pb-24 flex flex-col items-center">
        {/* Full-Screen Premium Hero Section */}
        <section className="w-full max-w-4xl lg:max-w-5xl flex flex-col items-center text-center mb-16 sm:mb-20 md:mb-24">
          {/* Trust Badge */}
          <div
            id="hero-trust-badge"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F2EAE0] border border-[#DCD2C3] text-xs font-semibold text-[#3D352A] mb-7 sm:mb-8 select-none shadow-2xs"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-800 shrink-0" aria-hidden="true" />
            <span className="tracking-tight">Private by design &bull; Owner-bound data</span>
          </div>

          {/* Main Editorial Headline */}
          <h1 className="font-editorial text-4xl sm:text-5xl md:text-6xl lg:text-[68px] xl:text-[74px] font-medium tracking-[-0.035em] text-[#1B1814] max-w-4xl lg:max-w-5xl leading-[1.12] sm:leading-[1.06] mb-6">
            A tranquil sanctuary for your thoughts,
            <span className="block mt-1 sm:mt-2 text-[#4A4033] font-normal italic">
              illuminated by Gemini AI.
            </span>
          </h1>

          {/* Supporting Text */}
          <p className="font-editorial text-lg sm:text-xl md:text-[22px] text-[#544B3E] max-w-2xl leading-[1.65] mb-9 sm:mb-11 font-normal">
            Reflect, understand your patterns, and preserve your private thoughts in a space designed around ownership and trust.
          </p>

          {/* Authentication Error Feedback */}
          {authError && (
            <div className="mb-8 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs max-w-md text-left space-y-1.5 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
                <span className="font-semibold">{authError}</span>
              </div>
              <p className="text-[11.5px] text-amber-800 leading-normal">
                If browser security blocks popups inside the preview frame, open the app in a new tab:
              </p>
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-semibold text-amber-950 underline text-[11.5px]"
              >
                Open in New Window ↗
              </a>
            </div>
          )}

          {/* Primary CTA Block: Exactly ONE Google sign-in button */}
          <div className="flex flex-col items-center justify-center gap-3.5 w-full max-w-md">
            <button
              id="hero-google-sign-in-btn"
              type="button"
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="w-full sm:w-auto min-w-[300px] sm:min-w-[340px] flex items-center justify-center gap-3.5 px-8 py-4.5 bg-[#211E1A] hover:bg-[#342F28] active:bg-[#141210] text-[#FAF8F5] rounded-xl text-[16px] font-semibold tracking-tight transition-all duration-200 ease-out shadow-[0_4px_20px_rgba(33,30,26,0.14),0_1px_3px_rgba(33,30,26,0.08)] hover:shadow-[0_8px_28px_rgba(33,30,26,0.20)] border border-[#3A332B] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#211E1A] focus-visible:ring-offset-2 disabled:opacity-60 group cursor-pointer"
              aria-label="Continue with Google sign-in"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5.1 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.2C.6 9.2 0 11.5 0 14s.6 4.8 1.6 6.8l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16c1.9 3.8 5.8 7 10.4 7z"
                />
              </svg>
              <span>{isSigningIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
              <ArrowRight className="w-4.5 h-4.5 text-[#A89F91] group-hover:translate-x-1 transition-transform duration-200 shrink-0" aria-hidden="true" />
            </button>

            {/* Small Trust Reassurance */}
            <span className="text-xs font-medium text-[#736A5D] flex items-center gap-1.5 pt-0.5 select-none">
              <Lock className="w-3.5 h-3.5 text-[#857B6C]" aria-hidden="true" />
              Secure sign-in &bull; Your journal remains private
            </span>
          </div>
        </section>

        {/* Feature Grid: Exactly Three Redesigned Editorial Cards */}
        <section className="w-full grid grid-cols-1 md:grid-cols-3 gap-7 sm:gap-8 lg:gap-9 mb-12 sm:mb-16 text-left">
          {/* Card 1: Gemini Reflection Engine */}
          <div className="flex flex-col justify-between h-full p-8 sm:p-9 lg:p-10 bg-[#FFFEFD] border border-[#E3DACD] hover:border-[#C4B7A5] rounded-2xl shadow-[0_4px_20px_rgba(33,30,26,0.03),0_1px_3px_rgba(33,30,26,0.03)] hover:shadow-[0_12px_32px_rgba(33,30,26,0.06)] hover:-translate-y-0.5 transition-all duration-200 ease-out group">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#FAF1E4] text-[#8C5815] border border-[#ECD7BC] flex items-center justify-center shrink-0 shadow-2xs">
                  <Sparkles className="w-5 h-5 text-amber-700" aria-hidden="true" />
                </div>
                <span className="text-[11px] font-semibold tracking-wider text-[#8F8474] uppercase select-none">
                  Reflection
                </span>
              </div>
              <h3 className="font-editorial text-2xl font-bold text-[#1D1915] mb-3 tracking-tight">
                Gemini Reflection Engine
              </h3>
              <p className="text-[15px] sm:text-base text-[#595043] leading-[1.65]">
                Explore thoughtful AI-guided reflection to uncover patterns, perspectives, and deeper insights.
              </p>
            </div>
          </div>

          {/* Card 2: Owner-Bound Isolation */}
          <div className="flex flex-col justify-between h-full p-8 sm:p-9 lg:p-10 bg-[#FFFEFD] border border-[#E3DACD] hover:border-[#C4B7A5] rounded-2xl shadow-[0_4px_20px_rgba(33,30,26,0.03),0_1px_3px_rgba(33,30,26,0.03)] hover:shadow-[0_12px_32px_rgba(33,30,26,0.06)] hover:-translate-y-0.5 transition-all duration-200 ease-out group">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#ECF5ED] text-[#1E6B3E] border border-[#D0E5D3] flex items-center justify-center shrink-0 shadow-2xs">
                  <Shield className="w-5 h-5 text-emerald-800" aria-hidden="true" />
                </div>
                <span className="text-[11px] font-semibold tracking-wider text-[#8F8474] uppercase select-none">
                  Privacy
                </span>
              </div>
              <h3 className="font-editorial text-2xl font-bold text-[#1D1915] mb-3 tracking-tight">
                Owner-Bound Isolation
              </h3>
              <p className="text-[15px] sm:text-base text-[#595043] leading-[1.65]">
                Your journal data is structured around owner-level access, so your private reflections remain isolated.
              </p>
            </div>
          </div>

          {/* Card 3: Optional Location & Vault */}
          <div className="flex flex-col justify-between h-full p-8 sm:p-9 lg:p-10 bg-[#FFFEFD] border border-[#E3DACD] hover:border-[#C4B7A5] rounded-2xl shadow-[0_4px_20px_rgba(33,30,26,0.03),0_1px_3px_rgba(33,30,26,0.03)] hover:shadow-[0_12px_32px_rgba(33,30,26,0.06)] hover:-translate-y-0.5 transition-all duration-200 ease-out group">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#F1ECE3] text-[#3D372E] border border-[#E0D8CC] flex items-center justify-center shrink-0 shadow-2xs">
                  <Lock className="w-5 h-5 text-[#3D372E]" aria-hidden="true" />
                </div>
                <span className="text-[11px] font-semibold tracking-wider text-[#8F8474] uppercase select-none">
                  Security
                </span>
              </div>
              <h3 className="font-editorial text-2xl font-bold text-[#1D1915] mb-3 tracking-tight">
                Optional Location &amp; Vault
              </h3>
              <p className="text-[15px] sm:text-base text-[#595043] leading-[1.65]">
                Attach meaningful places when you choose, with privacy-conscious location handling and local protection options.
              </p>
            </div>
          </div>
        </section>

        {/* Refined Horizontal Trust Band */}
        <section className="w-full p-6 sm:p-8 rounded-2xl bg-[#F6F1E9] border border-[#DFD6C8] shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-[#EAE1D3] flex items-center justify-center text-emerald-800 shrink-0">
                <Shield className="w-4.5 h-4.5 text-emerald-800" aria-hidden="true" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                <span className="font-editorial text-lg sm:text-xl font-bold text-[#231E18] tracking-tight">
                  Built for private reflection
                </span>
                <span className="text-xs font-medium text-[#736B5E] hidden md:inline">
                  Designed around data ownership and control
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-3.5 sm:gap-4 lg:gap-6 text-xs sm:text-[13px] text-[#3D352A]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-800 shrink-0" aria-hidden="true" />
                <span className="font-medium">No exposed API keys</span>
              </div>
              <span className="hidden lg:block w-px h-3.5 bg-[#DDD3C4]" aria-hidden="true" />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-800 shrink-0" aria-hidden="true" />
                <span className="font-medium">Zero-knowledge encryption option</span>
              </div>
              <span className="hidden lg:block w-px h-3.5 bg-[#DDD3C4]" aria-hidden="true" />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-800 shrink-0" aria-hidden="true" />
                <span className="font-medium">Automatic PII protection</span>
              </div>
              <span className="hidden lg:block w-px h-3.5 bg-[#DDD3C4]" aria-hidden="true" />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-800 shrink-0" aria-hidden="true" />
                <span className="font-medium">Export your data anytime</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer: Minimal & Polished */}
      <footer className="mt-auto border-t border-[#E6DFD3] py-8 px-6 sm:px-10 lg:px-16 text-xs text-[#70675A] bg-[#FAF8F5]">
        <div className="max-w-[1360px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[#211E1A] text-[#FAF8F5] flex items-center justify-center text-[11px] shadow-2xs">
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            </div>
            <span className="font-semibold text-[#29231B] text-[13px]">Personal Gemini Journal</span>
            <span className="text-[#A3998A]">&bull;</span>
            <span className="text-xs text-[#70675A]">Encrypted Private Vault</span>
          </div>
          <p className="text-xs text-[#70675A]">
            Built with Google Gemini, Google Maps Platform &amp; Firebase Security
          </p>
          <span className="text-xs text-[#8C8273] italic">
            A more mindful you, every day
          </span>
        </div>
      </footer>
    </div>
  );
}
