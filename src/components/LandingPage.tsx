import { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  Shield,
  Lock,
  Compass,
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
      className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#24211D]"
    >
      {/* Top Navbar */}
      <header className="border-b border-[#E8E3DA] bg-[#FAF8F5]/90 backdrop-blur-xs sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#24211D] text-[#FAF8F5] flex items-center justify-center shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="font-editorial text-lg font-bold text-[#1F1C18] tracking-tight">
                Personal Gemini Journal
              </span>
            </div>
          </div>

          <button
            id="nav-google-sign-in-btn"
            type="button"
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="flex items-center gap-2 px-4 py-2 bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-xl text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
          >
            {isSigningIn ? (
              <span>Signing in...</span>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                <span>Sign in with Google</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-8 py-12 sm:py-20 flex flex-col items-center text-center">
        {/* Subtle pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2ECE1] border border-[#E0D9CB] text-xs font-medium text-[#5A5245] mb-6">
          <Shield className="w-3.5 h-3.5 text-emerald-700" />
          <span>Firebase Authenticated • Owner-Bound Firestore Isolation</span>
        </div>

        {/* Hero Title */}
        <h1 className="font-editorial text-4xl sm:text-6xl font-medium tracking-tight text-[#1F1C18] max-w-3xl leading-[1.15] mb-6">
          A tranquil sanctuary for your thoughts, illuminated by Gemini AI.
        </h1>

        {/* Hero Subtitle */}
        <p className="text-base sm:text-lg font-editorial text-[#5E5649] max-w-2xl leading-relaxed mb-10">
          Reflect deeply with compassionate AI companions, protect your memories with owner-bound cloud persistence, and preserve complete sovereignty over your inner narrative.
        </p>

        {/* Error notice if auth failed */}
        {authError && (
          <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs max-w-md text-left space-y-1.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
              <span className="font-medium">{authError}</span>
            </div>
            <p className="text-[11px] text-amber-800">
              If browser security blocks popups inside the preview frame, open the app in a new tab:
            </p>
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-semibold text-amber-950 underline text-[11px]"
            >
              Open in New Window ↗
            </a>
          </div>
        )}

        {/* Primary CTA */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-16">
          <button
            id="hero-google-sign-in-btn"
            type="button"
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="flex items-center justify-center gap-3 px-6 py-3.5 bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-xl text-sm font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 group cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            <ArrowRight className="w-4 h-4 text-[#A8A195] group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left w-full max-w-4xl">
          {/* Feature 1 */}
          <div className="p-6 bg-white border border-[#E5E0D5] rounded-2xl shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-editorial text-lg font-semibold text-[#1F1C18]">
              Gemini Reflection Engine
            </h3>
            <p className="text-xs sm:text-sm text-[#665F52] leading-relaxed">
              Explore four reflective modes: Empathetic presence, Socratic inquiry, CBT cognitive reframing, and hidden inner strengths.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-6 bg-white border border-[#E5E0D5] rounded-2xl shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-editorial text-lg font-semibold text-[#1F1C18]">
              Owner-Bound Isolation
            </h3>
            <p className="text-xs sm:text-sm text-[#665F52] leading-relaxed">
              Strict Firestore security rules guarantee your reflections exist only at <code className="bg-[#F0EBE0] px-1 py-0.5 rounded text-[11px]">/users/{'{userId}'}/interactions</code>. No other user can ever read your words.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-6 bg-white border border-[#E5E0D5] rounded-2xl shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0EBE0] text-[#3D372F] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-editorial text-lg font-semibold text-[#1F1C18]">
              Optional Local AES Vault
            </h3>
            <p className="text-xs sm:text-sm text-[#665F52] leading-relaxed">
              Enhance cloud security with on-device AES-256-GCM encryption, PII redaction shields, and automated inactivity locks.
            </p>
          </div>
        </div>

        {/* Security Checklist */}
        <div className="mt-14 p-5 rounded-2xl bg-[#F2ECE1] border border-[#E0D8CB] max-w-2xl w-full text-xs text-[#524B40] space-y-2.5">
          <div className="font-semibold uppercase tracking-wider text-[#3D372F] text-[11px] mb-1">
            Zero-Trust Architectural Standards
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>No exposed API keys in browser</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Zero-knowledge client encryption option</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Automatic PII redaction shield</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Full export in JSON & Markdown</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E8E3DA] py-6 px-4 text-center text-xs text-[#8A8376]">
        <p>Personal Gemini Journal • Built with Google Gemini & Firebase Security</p>
      </footer>
    </div>
  );
}
