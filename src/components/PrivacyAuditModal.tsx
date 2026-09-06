import { Shield, Key, EyeOff, Server, Download, Trash2, X, CheckCircle2, MapPin } from 'lucide-react';
import type { JournalEntry, VaultConfig } from '../types.ts';

interface PrivacyAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultConfig: VaultConfig;
  entries: JournalEntry[];
  onExportEncrypted: () => void;
  onExportDecrypted: () => void;
  onImportBackup: (file: File) => void;
  onWipeAllData: () => void;
}

export function PrivacyAuditModal({
  isOpen,
  onClose,
  vaultConfig,
  entries,
  onExportEncrypted,
  onExportDecrypted,
  onImportBackup,
  onWipeAllData,
}: PrivacyAuditModalProps) {
  if (!isOpen) return null;

  return (
    <div
      id="privacy-audit-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F1C18]/60 backdrop-blur-xs"
    >
      <div
        id="privacy-audit-modal-card"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#FAF8F5] border border-[#E2DCCE] rounded-2xl p-6 sm:p-7 shadow-xl relative animate-in fade-in zoom-in-95 duration-150"
      >
        <button
          id="close-privacy-audit-btn"
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-[#888175] hover:text-[#24211D] rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#1F1C18]">
              Security & Privacy Specifications
            </h2>
            <p className="text-xs text-[#7A7367]">
              Production security guarantees for your Personal Gemini Journal
            </p>
          </div>
        </div>

        {/* Security Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
          {/* Card 1: Google Cloud Secret Manager & Server-Side AI Proxy */}
          <div className="p-4 rounded-xl bg-white border border-[#E5E0D5] shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-[#24211D]">
              <Server className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-semibold uppercase tracking-wide">
                GCP Secret Manager & Server Proxy
              </h3>
            </div>
            <p className="text-xs text-[#6B6459] leading-relaxed">
              Your <code className="bg-[#F0EBE0] px-1 py-0.5 rounded text-[11px]">GEMINI_API_KEY</code> is managed via Google Cloud Secret Manager and accessed exclusively by server-side routes. Zero client-side API keys are ever bundled or exposed.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Secret Manager Protected & Telemetry Verified</span>
            </div>
          </div>

          {/* Card 2: AES-256-GCM Encryption */}
          <div className="p-4 rounded-xl bg-white border border-[#E5E0D5] shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-[#24211D]">
              <Key className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-semibold uppercase tracking-wide">
                AES-256-GCM Local Vault
              </h3>
            </div>
            <p className="text-xs text-[#6B6459] leading-relaxed">
              When passcode protection is turned on, entries are encrypted using native Web Crypto PBKDF2 (100,000 iterations) and 256-bit AES-GCM. Unencrypted plaintext never leaves memory.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Status: {vaultConfig.useEncryption ? 'Vault Active' : 'Available on demand'}</span>
            </div>
          </div>

          {/* Card 3: PII Redaction Engine */}
          <div className="p-4 rounded-xl bg-white border border-[#E5E0D5] shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-[#24211D]">
              <EyeOff className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-semibold uppercase tracking-wide">
                Pre-Flight PII Redaction
              </h3>
            </div>
            <p className="text-xs text-[#6B6459] leading-relaxed">
              Before sending any text to Gemini for reflection, you can toggle automatic PII masking. Phone numbers, emails, credit cards, and SSNs are masked into <code className="bg-[#F0EBE0] px-1 py-0.5 rounded text-[11px]">[REDACTED]</code> tags.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Configurable per entry reflection</span>
            </div>
          </div>

          {/* Card 4: Owner-Bound Cloud Firestore Isolation */}
          <div className="p-4 rounded-xl bg-white border border-[#E5E0D5] shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-[#24211D]">
              <Shield className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-semibold uppercase tracking-wide">
                Owner-Bound Cloud Firestore
              </h3>
            </div>
            <p className="text-xs text-[#6B6459] leading-relaxed">
              Your journal writings and Gemini interactions are persisted to Cloud Firestore strictly under <code className="bg-[#F0EBE0] px-1 py-0.5 rounded text-[11px]">/users/{'{userId}'}/interactions</code> with strict owner-bound rules (<code className="bg-[#F0EBE0] px-1 py-0.5 rounded text-[11px]">request.auth.uid == userId</code>).
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Owner isolation enforced</span>
            </div>
          </div>

          {/* Card 5: On-Demand Location Privacy & Server-Side Maps Proxy */}
          <div className="p-4 rounded-xl bg-white border border-[#E5E0D5] shadow-2xs space-y-2 sm:col-span-2">
            <div className="flex items-center gap-2 text-[#24211D]">
              <MapPin className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-semibold uppercase tracking-wide">
                On-Demand Location & Zero-Exposure Maps Integration
              </h3>
            </div>
            <p className="text-xs text-[#6B6459] leading-relaxed">
              Geolocation is never tracked silently or in the background. Location permissions are prompted strictly on explicit user action (&ldquo;Add Location&rdquo;). Reverse geocoding executes via server-side proxy where Google Maps API keys are fetched from Google Cloud Secret Manager. No Maps credentials or raw telemetry are ever sent to client browsers.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-emerald-800 pt-1">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Explicit Opt-In Only</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Client-Side Maps Keys</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Isolated User Document Storage</span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Sovereignty Section */}
        <div className="p-4 bg-[#F2ECE1] rounded-xl border border-[#E0D9CB] space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#3D372F]">
            Data Sovereignty & Backups ({entries.length} {entries.length === 1 ? 'entry' : 'entries'})
          </h3>
          <div className="flex flex-wrap gap-2.5">
            <button
              id="export-encrypted-btn"
              type="button"
              onClick={onExportEncrypted}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white hover:bg-[#EBE5DA] text-[#24211D] border border-[#D5CEC0] rounded-lg transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Encrypted JSON</span>
            </button>

            <button
              id="export-decrypted-btn"
              type="button"
              onClick={onExportDecrypted}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white hover:bg-[#EBE5DA] text-[#24211D] border border-[#D5CEC0] rounded-lg transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Markdown / Plaintext</span>
            </button>

            <label
              id="import-backup-label"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white hover:bg-[#EBE5DA] text-[#24211D] border border-[#D5CEC0] rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <span>Import Backup</span>
              <input
                id="import-backup-file-input"
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportBackup(file);
                }}
              />
            </label>

            <button
              id="wipe-data-btn"
              type="button"
              onClick={onWipeAllData}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-lg transition-colors ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Wipe Local Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
