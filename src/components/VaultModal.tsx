import { useState, type FormEvent } from 'react';
import { ShieldCheck, Lock, Key, AlertCircle, Check, X, ShieldAlert } from 'lucide-react';
import type { VaultConfig, JournalEntry } from '../types.ts';
import { createVaultVerification, verifyPasscode } from '../utils/crypto.ts';
import { saveVaultConfig, saveEntries } from '../utils/storage.ts';

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultConfig: VaultConfig;
  isUnlocked: boolean;
  activePasscode: string | null;
  entries: JournalEntry[];
  onUnlockSuccess: (passcode: string) => void;
  onVaultConfigUpdated: (config: VaultConfig, newPasscode: string | null) => void;
}

export function VaultModal({
  isOpen,
  onClose,
  vaultConfig,
  isUnlocked,
  activePasscode,
  entries,
  onUnlockSuccess,
  onVaultConfigUpdated,
}: VaultModalProps) {
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState(vaultConfig.autoLockMinutes || 5);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<'unlock' | 'setup' | 'change' | 'disable'>(
    !vaultConfig.isConfigured ? 'setup' : !isUnlocked ? 'unlock' : 'change'
  );

  if (!isOpen) return null;

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!passcode) {
      setError('Please enter your passcode.');
      return;
    }
    if (!vaultConfig.verification) {
      setError('Vault is not properly configured.');
      return;
    }

    setIsProcessing(true);
    try {
      const isValid = await verifyPasscode(vaultConfig.verification, passcode);
      if (isValid) {
        onUnlockSuccess(passcode);
        setPasscode('');
        onClose();
      } else {
        setError('Incorrect passcode. Decryption failed.');
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (passcode.length < 4) {
      setError('Passcode must be at least 4 characters long.');
      return;
    }

    if (passcode !== confirmPasscode) {
      setError('Passcodes do not match.');
      return;
    }

    setIsProcessing(true);
    try {
      const verification = await createVaultVerification(passcode);
      const updatedConfig: VaultConfig = {
        isConfigured: true,
        useEncryption: true,
        autoLockMinutes,
        verification,
      };

      // Save entries encrypted with this new passcode
      await saveEntries(entries, passcode);
      saveVaultConfig(updatedConfig);

      onVaultConfigUpdated(updatedConfig, passcode);
      setSuccessMsg('Vault successfully configured with AES-256-GCM encryption!');
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize vault.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisableEncryption = async () => {
    if (!activePasscode) {
      setError('Please unlock the vault first before disabling encryption.');
      return;
    }

    setIsProcessing(true);
    try {
      const updatedConfig: VaultConfig = {
        isConfigured: false,
        useEncryption: false,
        autoLockMinutes: 5,
      };

      // Save entries in plaintext
      await saveEntries(entries, undefined);
      saveVaultConfig(updatedConfig);

      onVaultConfigUpdated(updatedConfig, null);
      setSuccessMsg('Vault encryption disabled. Entries are stored locally in standard storage.');
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err.message || 'Failed to disable encryption.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="vault-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F1C18]/60 backdrop-blur-xs"
    >
      <div
        id="vault-modal-card"
        className="w-full max-w-md bg-[#FAF8F5] border border-[#E2DCCE] rounded-2xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Close Button if unlocked or not forced */}
        {isUnlocked && (
          <button
            id="close-vault-modal-btn"
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-[#888175] hover:text-[#24211D] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#EBE5DA] text-[#4A4339] flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1F1C18]">
              {mode === 'unlock'
                ? 'Unlock Journal Vault'
                : mode === 'setup'
                ? 'Setup End-to-End Encryption'
                : 'Vault Security Settings'}
            </h2>
            <p className="text-xs text-[#7A7367]">
              Client-side AES-256-GCM encryption with PBKDF2
            </p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div
            id="vault-error-alert"
            className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            id="vault-success-alert"
            className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* MODE 1: UNLOCK */}
        {mode === 'unlock' && (
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label
                htmlFor="unlock-passcode-input"
                className="block text-xs font-medium text-[#4D463B] mb-1"
              >
                Enter Master Passcode / PIN
              </label>
              <input
                id="unlock-passcode-input"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••"
                autoFocus
                className="w-full px-3.5 py-2.5 bg-white border border-[#D8D1C4] rounded-lg text-sm text-[#1F1C18] focus:outline-hidden focus:border-[#24211D] focus:ring-1 focus:ring-[#24211D]"
              />
            </div>

            <div className="pt-2">
              <button
                id="submit-unlock-btn"
                type="submit"
                disabled={isProcessing}
                className="w-full py-2.5 px-4 bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-lg text-sm font-medium transition-colors shadow-xs disabled:opacity-50"
              >
                {isProcessing ? 'Decrypting...' : 'Unlock Journal'}
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: SETUP / CHANGE */}
        {(mode === 'setup' || mode === 'change') && (
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="bg-[#F2ECE1] p-3 rounded-lg text-xs text-[#5D564A] space-y-1">
              <p className="font-medium text-[#24211D] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                Zero-Knowledge Local Encryption
              </p>
              <p>
                Your journal entries are encrypted directly inside your browser before saving to
                storage. Only your passcode can derive the key.
              </p>
            </div>

            <div>
              <label
                htmlFor="new-passcode-input"
                className="block text-xs font-medium text-[#4D463B] mb-1"
              >
                {mode === 'change' ? 'New Master Passcode' : 'Create Master Passcode'}
              </label>
              <input
                id="new-passcode-input"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="At least 4 characters"
                className="w-full px-3.5 py-2.5 bg-white border border-[#D8D1C4] rounded-lg text-sm text-[#1F1C18] focus:outline-hidden focus:border-[#24211D] focus:ring-1 focus:ring-[#24211D]"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-passcode-input"
                className="block text-xs font-medium text-[#4D463B] mb-1"
              >
                Confirm Passcode
              </label>
              <input
                id="confirm-passcode-input"
                type="password"
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                placeholder="Repeat passcode"
                className="w-full px-3.5 py-2.5 bg-white border border-[#D8D1C4] rounded-lg text-sm text-[#1F1C18] focus:outline-hidden focus:border-[#24211D] focus:ring-1 focus:ring-[#24211D]"
              />
            </div>

            <div>
              <label
                htmlFor="autolock-select"
                className="block text-xs font-medium text-[#4D463B] mb-1"
              >
                Auto-Lock on Inactivity
              </label>
              <select
                id="autolock-select"
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-[#D8D1C4] rounded-lg text-xs text-[#1F1C18] focus:outline-hidden"
              >
                <option value={1}>1 Minute</option>
                <option value={5}>5 Minutes (Recommended)</option>
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={0}>Disabled (Manual lock only)</option>
              </select>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2">
              {vaultConfig.isConfigured && (
                <button
                  id="disable-encryption-tab-btn"
                  type="button"
                  onClick={() => setMode('disable')}
                  className="text-xs text-red-700 hover:underline"
                >
                  Disable Passcode
                </button>
              )}
              <button
                id="save-vault-setup-btn"
                type="submit"
                disabled={isProcessing}
                className="ml-auto py-2.5 px-5 bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-lg text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
              >
                {isProcessing ? 'Configuring Vault...' : 'Enable Encryption'}
              </button>
            </div>
          </form>
        )}

        {/* MODE 3: DISABLE ENCRYPTION */}
        {mode === 'disable' && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <div>
                <p className="font-medium">Remove Master Passcode?</p>
                <p className="mt-1">
                  Your entries will be stored in standard unencrypted browser storage. Anyone with
                  access to this browser profile could read your entries.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                id="cancel-disable-btn"
                type="button"
                onClick={() => setMode('change')}
                className="px-3.5 py-2 text-xs font-medium text-[#4D463B] hover:bg-[#EBE5DA] rounded-lg"
              >
                Cancel
              </button>
              <button
                id="confirm-disable-btn"
                type="button"
                onClick={handleDisableEncryption}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-medium bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors"
              >
                {isProcessing ? 'Removing...' : 'Confirm Remove Passcode'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
