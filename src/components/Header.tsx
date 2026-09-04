import {
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  Sparkles,
  Plus,
  BookOpen,
  Key,
  Info,
  LogOut,
  User as UserIcon,
  Cloud,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { VaultConfig } from '../types.ts';

interface HeaderProps {
  user: User | null;
  vaultConfig: VaultConfig;
  isUnlocked: boolean;
  onLock: () => void;
  onOpenVaultSettings: () => void;
  onOpenPrivacyAudit: () => void;
  onOpenSynthesis: () => void;
  onOpenPrompts: () => void;
  onNewEntry: () => void;
  onSignOut: () => void;
  streak: number;
}

export function Header({
  user,
  vaultConfig,
  isUnlocked,
  onLock,
  onOpenVaultSettings,
  onOpenPrivacyAudit,
  onOpenSynthesis,
  onOpenPrompts,
  onNewEntry,
  onSignOut,
  streak,
}: HeaderProps) {
  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E8E3DA] px-4 sm:px-8 py-3 transition-colors"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#24211D] text-[#FAF8F5] flex items-center justify-center shadow-xs">
            <BookOpen className="w-5 h-5 text-[#EFEBE4]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-[#1F1C18]">
                Personal Gemini Journal
              </h1>
              {vaultConfig.useEncryption ? (
                <span
                  id="vault-encryption-badge"
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200"
                  title="Protected by client-side AES-256-GCM encryption"
                >
                  <ShieldCheck className="w-3 h-3" />
                  AES-256
                </span>
              ) : (
                <span
                  id="vault-unencrypted-badge"
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#F2ECE1] text-[#635544] border border-[#E0D9CB]"
                  title="Cloud Firestore Isolated Storage"
                >
                  <Cloud className="w-3 h-3 text-emerald-700" />
                  <span>Firestore</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#756F67] hidden sm:block">
              Owner-isolated reflections powered by Gemini AI
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Streak indicator */}
          {streak > 0 && (
            <div
              id="streak-badge"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#F4EFE6] text-[#635544] rounded-lg border border-[#E3DCCE] border-opacity-70"
              title={`${streak} consecutive day streak`}
            >
              <span className="text-amber-600">🔥</span>
              <span>{streak}d streak</span>
            </div>
          )}

          {/* Privacy Audit Button */}
          <button
            id="privacy-audit-btn"
            type="button"
            onClick={onOpenPrivacyAudit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#5E584F] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded-lg border border-transparent hover:border-[#E2DCCE] transition-all"
            title="View Security & Privacy Architecture"
          >
            <Info className="w-4 h-4 text-[#7B746A]" />
            <span className="hidden xl:inline">Security Specs</span>
          </button>

          {/* Prompts Sparkle */}
          <button
            id="open-prompts-btn"
            type="button"
            onClick={onOpenPrompts}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#5E584F] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded-lg border border-transparent hover:border-[#E2DCCE] transition-all"
            title="Generate Journaling Prompts"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">Prompts</span>
          </button>

          {/* Synthesis Button */}
          <button
            id="open-synthesis-btn"
            type="button"
            onClick={onOpenSynthesis}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#5E584F] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded-lg border border-transparent hover:border-[#E2DCCE] transition-all"
            title="Multi-Entry Life Journey Synthesis"
          >
            <span className="text-xs">✨</span>
            <span className="hidden sm:inline">Review</span>
          </button>

          {/* Vault Security / Lock Button */}
          {vaultConfig.useEncryption ? (
            <button
              id="lock-vault-btn"
              type="button"
              onClick={isUnlocked ? onLock : onOpenVaultSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#ECE7DC] hover:bg-[#E3DCCE] text-[#3D372F] rounded-lg border border-[#DCD5C7] transition-all shadow-2xs"
              title={isUnlocked ? 'Lock Vault (clears in-memory keys)' : 'Unlock Vault'}
            >
              {isUnlocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Lock</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Unlock</span>
                </>
              )}
            </button>
          ) : (
            <button
              id="setup-vault-btn"
              type="button"
              onClick={onOpenVaultSettings}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#655E53] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded-lg border border-[#DDD6C8] transition-all"
              title="Set master passcode to encrypt entries"
            >
              <Key className="w-3.5 h-3.5 text-[#887F72]" />
              <span className="hidden md:inline">Passcode</span>
            </button>
          )}

          {/* New Entry CTA */}
          <button
            id="new-entry-btn"
            type="button"
            onClick={onNewEntry}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-lg transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Write Entry</span>
          </button>

          {/* Authenticated User & Sign Out */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-[#E2DCCE]">
              <div
                className="flex items-center gap-1.5 py-1 px-2 rounded-lg bg-[#F2ECE1] text-xs font-medium text-[#3D372F]"
                title={`Signed in as ${user.email || user.displayName}`}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-5 h-5 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserIcon className="w-3.5 h-3.5 text-[#655E53]" />
                )}
                <span className="max-w-[90px] sm:max-w-[120px] truncate hidden md:inline">
                  {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
                </span>
              </div>

              <button
                id="sign-out-btn"
                type="button"
                onClick={onSignOut}
                className="p-1.5 text-[#655E53] hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign out of your journal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
