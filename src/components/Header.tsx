import { useState, useRef, useEffect } from 'react';
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
  Bell,
  MoreHorizontal,
  ChevronDown,
  Menu,
  X,
  Compass,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { VaultConfig } from '../types.ts';

interface HeaderProps {
  user: User | null;
  vaultConfig: VaultConfig;
  isUnlocked: boolean;
  isAdmin: boolean;
  onLock: () => void;
  onOpenVaultSettings: () => void;
  onOpenPrivacyAudit: () => void;
  onOpenSynthesis: () => void;
  onOpenPrompts: () => void;
  onOpenNotifications: () => void;
  onOpenAdminDashboard: () => void;
  onNewEntry: () => void;
  onSignOut: () => void;
  streak: number;
}

export function Header({
  user,
  vaultConfig,
  isUnlocked,
  isAdmin,
  onLock,
  onOpenVaultSettings,
  onOpenPrivacyAudit,
  onOpenSynthesis,
  onOpenPrompts,
  onOpenNotifications,
  onOpenAdminDashboard,
  onNewEntry,
  onSignOut,
  streak,
}: HeaderProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E8E2D6] px-4 sm:px-8 py-2.5 transition-colors"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#24211D] text-[#FAF8F5] flex items-center justify-center shrink-0 shadow-2xs">
            <BookOpen className="w-4 h-4 text-[#EFEBE4]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-[#1F1C18] truncate">
                Personal Gemini Journal
              </h1>
              {vaultConfig.useEncryption ? (
                <span
                  id="vault-encryption-badge"
                  className="hidden xs:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200"
                  title="Protected by client-side AES-256-GCM encryption"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-700" />
                  <span>AES-256</span>
                </span>
              ) : (
                <span
                  id="vault-unencrypted-badge"
                  className="hidden xs:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F2ECE1] text-[#635544] border border-[#E0D9CB]"
                  title="Cloud Firestore Isolated Storage"
                >
                  <Cloud className="w-3 h-3 text-emerald-700" />
                  <span>Firestore</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#7A7367] hidden md:block truncate">
              Private reflective sanctuary powered by Gemini AI
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Streak indicator */}
          {streak > 0 && (
            <div
              id="streak-badge"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#F4EFE6] text-[#554D41] rounded-lg border border-[#E3DCCE]"
              title={`${streak} consecutive day writing streak`}
            >
              <span className="text-amber-600">🔥</span>
              <span>{streak}d</span>
            </div>
          )}

          {/* Core Tools on Desktop */}
          <div className="hidden lg:flex items-center gap-1 border-r border-[#E6E0D4] pr-2 mr-1">
            {/* Prompts Sparkle */}
            <button
              id="open-prompts-btn"
              type="button"
              onClick={onOpenPrompts}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#5E584F] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded-lg transition-colors cursor-pointer"
              title="Generate Journaling Prompts"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Daily Spark</span>
            </button>

            {/* Synthesis Review */}
            <button
              id="open-synthesis-btn"
              type="button"
              onClick={onOpenSynthesis}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#5E584F] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded-lg transition-colors cursor-pointer"
              title="Multi-Entry Life Journey Synthesis"
            >
              <Compass className="w-3.5 h-3.5 text-[#736B5E]" />
              <span>Journey Review</span>
            </button>
          </div>

          {/* Secondary Utilities Dropdown (Settings, Alerts, Security, Vault) */}
          <div className="relative" ref={moreMenuRef}>
            <button
              id="more-options-menu-btn"
              type="button"
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#5E584F] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded-lg border border-[#E5E0D5] transition-colors cursor-pointer"
              title="More settings & privacy specifications"
            >
              <MoreHorizontal className="w-4 h-4 text-[#7A7367]" />
              <span className="hidden xl:inline">Tools</span>
              <ChevronDown className={`w-3 h-3 text-[#999184] transition-transform ${isMoreOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Desktop Dropdown Popover */}
            <div
              id="desktop-more-dropdown"
              className={`absolute right-0 mt-2 w-56 bg-white border border-[#E5E0D5] rounded-xl shadow-lg p-1.5 z-40 transition-all ${
                isMoreOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none hidden'
              }`}
            >
              <div className="px-2.5 py-1 text-[11px] font-semibold text-[#8C8477] uppercase tracking-wider">
                Vault & Utilities
              </div>

              {/* Security Specs */}
              <button
                id="privacy-audit-btn"
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  onOpenPrivacyAudit();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-[#4A4339] hover:bg-[#FAF7F2] rounded-lg transition-colors text-left cursor-pointer"
              >
                <Info className="w-4 h-4 text-[#7B746A]" />
                <div className="min-w-0">
                  <div className="font-medium text-[#1F1C18]">Security Specs</div>
                  <div className="text-[10px] text-[#8C8477]">Threat model & specs</div>
                </div>
              </button>

              {/* Email Alerts */}
              <button
                id="open-notifications-btn"
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  onOpenNotifications();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-[#4A4339] hover:bg-[#FAF7F2] rounded-lg transition-colors text-left cursor-pointer"
              >
                <Bell className="w-4 h-4 text-[#7B746A]" />
                <div className="min-w-0">
                  <div className="font-medium text-[#1F1C18]">Email Alerts</div>
                  <div className="text-[10px] text-[#8C8477]">Manage reflection reminders</div>
                </div>
              </button>

              {/* Vault Passcode / Lock */}
              {vaultConfig.useEncryption ? (
                <button
                  id="lock-vault-btn"
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    isUnlocked ? onLock() : onOpenVaultSettings();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-[#4A4339] hover:bg-[#FAF7F2] rounded-lg transition-colors text-left cursor-pointer"
                >
                  {isUnlocked ? (
                    <>
                      <Lock className="w-4 h-4 text-emerald-700" />
                      <div>
                        <div className="font-medium text-[#1F1C18]">Lock Vault</div>
                        <div className="text-[10px] text-emerald-700">AES-256 keys active</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 text-amber-700" />
                      <div>
                        <div className="font-medium text-[#1F1C18]">Unlock Vault</div>
                        <div className="text-[10px] text-amber-700">Enter master passcode</div>
                      </div>
                    </>
                  )}
                </button>
              ) : (
                <button
                  id="setup-vault-btn"
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    onOpenVaultSettings();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-[#4A4339] hover:bg-[#FAF7F2] rounded-lg transition-colors text-left cursor-pointer"
                >
                  <Key className="w-4 h-4 text-[#887F72]" />
                  <div>
                    <div className="font-medium text-[#1F1C18]">Passcode Lock</div>
                    <div className="text-[10px] text-[#8C8477]">Set client encryption</div>
                  </div>
                </button>
              )}

              {/* Admin Console */}
              <button
                id="open-admin-dashboard-btn"
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  onOpenAdminDashboard();
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg transition-colors text-left cursor-pointer ${
                  isAdmin ? 'text-amber-900 hover:bg-amber-50' : 'text-[#4A4339] hover:bg-[#FAF7F2]'
                }`}
              >
                <Shield className={`w-4 h-4 ${isAdmin ? 'text-amber-700' : 'text-[#7B746A]'}`} />
                <div>
                  <div className="font-medium text-[#1F1C18]">Admin Console</div>
                  <div className="text-[10px] text-[#8C8477]">System aggregate metrics</div>
                </div>
              </button>
            </div>
          </div>

          {/* PRIMARY CTA: + Write Entry */}
          <button
            id="new-entry-btn"
            type="button"
            onClick={onNewEntry}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-[#24211D] hover:bg-[#38322B] text-[#FAF8F5] rounded-xl text-xs sm:text-sm font-medium transition-all shadow-xs hover:shadow-md cursor-pointer shrink-0 min-h-[38px]"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Write Entry</span>
          </button>

          {/* User Profile & Sign Out */}
          {user && (
            <div className="hidden sm:flex items-center gap-1.5 pl-1.5 border-l border-[#E5E0D5]">
              <div
                className="flex items-center gap-1.5 py-1 px-2 rounded-lg bg-[#F4EFE6] text-xs font-medium text-[#3D372F]"
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
                <span className="max-w-[80px] md:max-w-[110px] truncate hidden md:inline">
                  {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
                </span>
              </div>

              <button
                id="sign-out-btn"
                type="button"
                onClick={onSignOut}
                className="p-1.5 text-[#655E53] hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Sign out of your journal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            id="mobile-menu-toggle-btn"
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="sm:hidden p-2 text-[#5E584F] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Toggle Menu"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Expandable Menu */}
      {isMobileMenuOpen && (
        <div
          id="mobile-nav-panel"
          className="sm:hidden mt-3 pt-3 pb-2 border-t border-[#E8E2D6] space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {streak > 0 && (
            <div className="px-3 py-1.5 text-xs font-medium text-[#554D41] bg-[#F4EFE6] rounded-lg flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5">
                <span className="text-amber-600">🔥</span>
                <span>Current Writing Streak</span>
              </span>
              <span className="font-semibold">{streak} days</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 pb-2">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenPrompts();
              }}
              className="flex items-center gap-2 p-2.5 text-xs font-medium text-[#3D372F] bg-white border border-[#E5E0D5] rounded-xl text-left"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Daily Spark</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenSynthesis();
              }}
              className="flex items-center gap-2 p-2.5 text-xs font-medium text-[#3D372F] bg-white border border-[#E5E0D5] rounded-xl text-left"
            >
              <Compass className="w-4 h-4 text-[#736B5E]" />
              <span>Journey Review</span>
            </button>
          </div>

          <div className="space-y-1 pt-1 border-t border-[#E8E2D6]">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenNotifications();
              }}
              className="w-full flex items-center justify-between p-2.5 text-xs font-medium text-[#3D372F] hover:bg-[#F2ECE1] rounded-xl"
            >
              <span className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#7A7367]" />
                <span>Email Notifications</span>
              </span>
              <span className="text-[11px] text-[#8C8477]">Settings</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenPrivacyAudit();
              }}
              className="w-full flex items-center justify-between p-2.5 text-xs font-medium text-[#3D372F] hover:bg-[#F2ECE1] rounded-xl"
            >
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#7A7367]" />
                <span>Security & Specs</span>
              </span>
              <span className="text-[11px] text-[#8C8477]">Architecture</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                isUnlocked ? onLock() : onOpenVaultSettings();
              }}
              className="w-full flex items-center justify-between p-2.5 text-xs font-medium text-[#3D372F] hover:bg-[#F2ECE1] rounded-xl"
            >
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#7A7367]" />
                <span>Vault Passcode</span>
              </span>
              <span className="text-[11px] text-[#8C8477]">{isUnlocked ? 'Unlocked' : 'Locked'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenAdminDashboard();
              }}
              className="w-full flex items-center justify-between p-2.5 text-xs font-medium text-[#3D372F] hover:bg-[#F2ECE1] rounded-xl"
            >
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#7A7367]" />
                <span>Admin Console</span>
              </span>
              <span className="text-[11px] text-amber-700 font-semibold">{isAdmin ? 'Admin' : 'Restricted'}</span>
            </button>

            {user && (
              <div className="pt-2 mt-2 border-t border-[#E8E2D6] flex items-center justify-between px-2.5 py-2">
                <div className="flex items-center gap-2 text-xs text-[#3D372F]">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-6 h-6 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserIcon className="w-4 h-4 text-[#7A7367]" />
                  )}
                  <span className="font-medium truncate max-w-[160px]">{user.email || user.displayName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onSignOut();
                  }}
                  className="text-xs text-red-700 font-medium px-2 py-1 hover:bg-red-50 rounded-lg flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

