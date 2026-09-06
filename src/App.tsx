import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { Header } from './components/Header.tsx';
import { EntryList } from './components/EntryList.tsx';
import { EntryEditor } from './components/EntryEditor.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { VaultModal } from './components/VaultModal.tsx';
import { PrivacyAuditModal } from './components/PrivacyAuditModal.tsx';
import { PromptModal } from './components/PromptModal.tsx';
import { SynthesisModal } from './components/SynthesisModal.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { NotificationSettingsModal } from './components/NotificationSettingsModal.tsx';
import type { JournalEntry, VaultConfig, MoodType, ViewMode, UserAuthProfile } from './types.ts';
import {
  getVaultConfig,
  saveVaultConfig,
  loadEntries,
  saveEntries,
  calculateStreak,
} from './utils/storage.ts';
import {
  subscribeToAuth,
  signOutUser,
  saveInteractionToFirestore,
  fetchUserInteractions,
  deleteInteractionFromFirestore,
  fetchNotificationSettingsFromFirestore,
} from './utils/firebase.ts';
import { checkUserRole, triggerNotificationEvent, saveNotificationSettings } from './utils/apiClient.ts';
import { Lock, RefreshCw, BookOpen } from 'lucide-react';

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserAuthProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Journal and vault states
  const [vaultConfig, setVaultConfig] = useState<VaultConfig>(getVaultConfig());
  const [activePasscode, setActivePasscode] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(!getVaultConfig().useEncryption);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Modals
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [isPrivacyAuditOpen, setIsPrivacyAuditOpen] = useState(false);
  const [isPromptsOpen, setIsPromptsOpen] = useState(false);
  const [isSynthesisOpen, setIsSynthesisOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Inactivity tracking
  const lastActiveRef = useRef<number>(Date.now());

  // Subscribe to Firebase Auth changes
  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (user) {
        // Verify user role with server-side RBAC
        checkUserRole()
          .then((profile) => {
            setUserProfile(profile);
          })
          .catch((err) => {
            console.warn('Role verification pass:', err);
          });

        // Authenticated user: Load owner-bound Firestore data
        setIsSyncing(true);
        try {
          const firestoreEntries = await fetchUserInteractions(user.uid);
          if (firestoreEntries.length > 0) {
            setEntries(firestoreEntries);
            // Also cache locally for offline continuity
            await saveEntries(firestoreEntries, activePasscode || undefined);
          } else {
            // Check local fallback if new account
            const local = await loadEntries(activePasscode || undefined);
            if (local.length > 0) {
              setEntries(local);
              // Seed to Firestore under the new user ID
              for (const entry of local) {
                await saveInteractionToFirestore(user.uid, entry);
              }
            } else {
              setEntries([]);
            }
          }

          // Sync notification preferences to ensure server cache has latest settings
          try {
            const notifSettings = await fetchNotificationSettingsFromFirestore(user.uid);
            if (notifSettings) {
              await saveNotificationSettings(notifSettings);
            }
          } catch (notifErr) {
            console.debug('Notification settings sync note:', notifErr);
          }
        } catch (err) {
          console.error('Failed to load user interactions from Firestore:', err);
          // Fallback to local storage
          const local = await loadEntries(activePasscode || undefined);
          setEntries(local);
        } finally {
          setIsSyncing(false);
        }
      } else {
        // Logged out: Clear memory state for data isolation
        setUserProfile(null);
        setEntries([]);
        setSelectedEntry(null);
        setViewMode('list');
      }
    });

    return () => unsubscribe();
  }, [activePasscode]);

  // Handle Vault config on mount
  useEffect(() => {
    const config = getVaultConfig();
    setVaultConfig(config);
    if (!config.useEncryption) {
      setIsUnlocked(true);
    } else {
      setIsUnlocked(false);
    }
  }, []);

  // Lock vault action
  const handleLockVault = useCallback(() => {
    setActivePasscode(null);
    setIsUnlocked(false);
    setSelectedEntry(null);
    setViewMode('list');
    setIsVaultModalOpen(true);
  }, []);

  // Auto-lock timer on inactivity
  useEffect(() => {
    if (!vaultConfig.useEncryption || !isUnlocked || vaultConfig.autoLockMinutes <= 0) {
      return;
    }

    const intervalMs = 15000;
    const timeoutMs = vaultConfig.autoLockMinutes * 60 * 1000;

    const timer = setInterval(() => {
      const inactiveFor = Date.now() - lastActiveRef.current;
      if (inactiveFor >= timeoutMs) {
        handleLockVault();
      }
    }, intervalMs);

    const onUserActivity = () => {
      lastActiveRef.current = Date.now();
    };

    window.addEventListener('mousemove', onUserActivity);
    window.addEventListener('keydown', onUserActivity);
    window.addEventListener('click', onUserActivity);

    return () => {
      clearInterval(timer);
      window.removeEventListener('mousemove', onUserActivity);
      window.removeEventListener('keydown', onUserActivity);
      window.removeEventListener('click', onUserActivity);
    };
  }, [vaultConfig.useEncryption, isUnlocked, vaultConfig.autoLockMinutes, handleLockVault]);

  // Keyboard shortcut: Cmd+L / Ctrl+L for instant lock
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (vaultConfig.useEncryption && isUnlocked) {
          handleLockVault();
        } else if (!vaultConfig.useEncryption) {
          setIsVaultModalOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [vaultConfig.useEncryption, isUnlocked, handleLockVault]);

  // Unlock callback
  const handleUnlockSuccess = async (passcode: string) => {
    setActivePasscode(passcode);
    setIsUnlocked(true);
    lastActiveRef.current = Date.now();
    try {
      if (currentUser) {
        const cloudEntries = await fetchUserInteractions(currentUser.uid);
        setEntries(cloudEntries);
      } else {
        const loaded = await loadEntries(passcode);
        setEntries(loaded);
      }
    } catch (err) {
      console.error('Failed to decrypt entries on unlock:', err);
    }
  };

  // Vault config updated
  const handleVaultConfigUpdated = (newConfig: VaultConfig, newPasscode: string | null) => {
    setVaultConfig(newConfig);
    setActivePasscode(newPasscode);
    setIsUnlocked(!newConfig.useEncryption || Boolean(newPasscode));
  };

  // Save entry (Firestore primary + Local backup)
  const handleSaveEntry = async (
    entryToSave: JournalEntry,
    options?: { keepOpen?: boolean; isNewReflection?: boolean }
  ): Promise<void> => {
    // 1. If user is authenticated, save to Firestore with owner-bound isolation
    if (currentUser) {
      await saveInteractionToFirestore(currentUser.uid, entryToSave);
    }

    // 2. Update React state
    const previousStreak = calculateStreak(entries);
    const exists = entries.some((e) => e.id === entryToSave.id);
    const updated = exists
      ? entries.map((e) => (e.id === entryToSave.id ? entryToSave : e))
      : [entryToSave, ...entries];
    setEntries(updated);

    // 3. Keep local encrypted/plain backup
    await saveEntries(updated, activePasscode || undefined);

    // 4. Opt-in event notifications (Strictly zero-PII event trigger)
    // Dispatch reflection_ready notification when a new Gemini reflection is generated and saved
    if (options?.isNewReflection) {
      console.log('[App] New Gemini Reflection generated and saved. Triggering reflection_ready notification...');
      triggerNotificationEvent('reflection_ready')
        .then((res) => {
          console.log('[App] reflection_ready notification result:', res);
        })
        .catch((err) => {
          console.warn('[App] reflection_ready notification error:', err);
        });
    }

    // Writing streak milestones: only dispatch when streak reaches configured milestone (3, 7, 14, 30)
    const currentStreak = calculateStreak(updated);
    const MILESTONES = [3, 7, 14, 30];
    if (MILESTONES.includes(currentStreak) && currentStreak !== previousStreak) {
      console.log(`[App] Writing streak milestone reached: ${currentStreak} days. Triggering notification...`);
      triggerNotificationEvent('streak_milestone', { streak: currentStreak })
        .then((res) => {
          console.log('[App] streak_milestone notification result:', res);
        })
        .catch((err) => {
          console.warn('[App] streak_milestone notification error:', err);
        });
    }

    if (options?.keepOpen) {
      setSelectedEntry(entryToSave);
    } else {
      setSelectedEntry(null);
      setViewMode('list');
    }
  };

  // Delete entry
  const handleDeleteEntry = async (id: string) => {
    if (currentUser) {
      try {
        await deleteInteractionFromFirestore(currentUser.uid, id);
      } catch (err) {
        console.error('Failed to delete interaction from Firestore:', err);
      }
    }

    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    await saveEntries(updated, activePasscode || undefined);
    if (selectedEntry?.id === id) {
      setSelectedEntry(null);
      setViewMode('list');
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (id: string) => {
    const target = entries.find((e) => e.id === id);
    if (!target) return;

    const updatedEntry = { ...target, isFavorite: !target.isFavorite };
    const updated = entries.map((e) => (e.id === id ? updatedEntry : e));
    setEntries(updated);

    if (currentUser) {
      await saveInteractionToFirestore(currentUser.uid, updatedEntry);
    }
    await saveEntries(updated, activePasscode || undefined);
  };

  // Sign out user
  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  // Prompt selection to start entry
  const handleSelectPrompt = (promptTitle: string, promptText: string, suggestedMood: MoodType) => {
    const newEntry: JournalEntry = {
      id: `entry-${Date.now()}`,
      title: promptTitle,
      content: `> *Prompt: ${promptText}*\n\n`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mood: suggestedMood,
      tags: ['PromptResponse'],
      isFavorite: false,
      wordCount: 0,
    };
    setSelectedEntry(newEntry);
    setViewMode('editor');
  };

  // Export encrypted backup
  const handleExportEncrypted = () => {
    const encData = localStorage.getItem('gemini_journal_entries_enc');
    const blob = new Blob(
      [
        JSON.stringify(
          {
            type: 'gemini-journal-backup-encrypted',
            timestamp: new Date().toISOString(),
            vaultConfig,
            payload: encData ? JSON.parse(encData) : null,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `personal-gemini-journal-encrypted-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export decrypted markdown
  const handleExportDecrypted = () => {
    let md = `# Personal Gemini Journal Export\nAuthor: ${currentUser?.email || 'Authenticated User'}\nExported: ${new Date().toLocaleString()}\nTotal entries: ${entries.length}\n\n---\n\n`;

    entries.forEach((e) => {
      md += `## ${e.title}\n`;
      md += `**Date:** ${new Date(e.createdAt).toLocaleDateString()} | **Mood:** ${e.mood} | **Tags:** ${e.tags.map((t) => `#${t}`).join(' ')}\n\n`;
      md += `${e.content}\n\n`;
      if (e.reflection) {
        md += `### Gemini Reflection (${e.reflection.mode})\n`;
        md += `${e.reflection.reflectionText}\n\n`;
        if (e.reflection.cognitiveInsight) {
          md += `*Cognitive Note:* ${e.reflection.cognitiveInsight}\n\n`;
        }
      }
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `personal-gemini-journal-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import backup
  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed)) {
          setEntries(parsed);
          if (currentUser) {
            for (const item of parsed) {
              await saveInteractionToFirestore(currentUser.uid, item);
            }
          }
          await saveEntries(parsed, activePasscode || undefined);
          alert(`Successfully imported ${parsed.length} entries.`);
          return;
        }

        if (parsed.type === 'gemini-journal-backup-encrypted' && parsed.payload) {
          localStorage.setItem('gemini_journal_entries_enc', JSON.stringify(parsed.payload));
          if (parsed.vaultConfig) {
            saveVaultConfig(parsed.vaultConfig);
            setVaultConfig(parsed.vaultConfig);
          }
          alert('Encrypted backup imported. Please enter your passcode to unlock.');
          setIsVaultModalOpen(true);
          return;
        }

        alert('Unrecognized backup format.');
      } catch (err: any) {
        alert('Failed to parse backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Wipe all data
  const handleWipeAllData = async () => {
    if (confirm('Are you absolutely certain? This will delete local cached data and reset encryption.')) {
      localStorage.clear();
      setEntries([]);
      setSelectedEntry(null);
      setViewMode('list');
      const resetConfig: VaultConfig = {
        isConfigured: false,
        useEncryption: false,
        autoLockMinutes: 5,
      };
      saveVaultConfig(resetConfig);
      setVaultConfig(resetConfig);
      setActivePasscode(null);
      setIsUnlocked(true);
      setIsPrivacyAuditOpen(false);
      alert('Local journal data has been cleared.');
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF8F5] text-[#24211D]">
        <div className="flex items-center gap-3 p-6 bg-white border border-[#E2DCCE] rounded-2xl shadow-xs">
          <RefreshCw className="w-5 h-5 animate-spin text-[#6B6355]" />
          <span className="font-editorial text-sm text-[#4A4339]">
            Opening your journal sanctuary...
          </span>
        </div>
      </div>
    );
  }

  // If unauthenticated: Show Landing Page
  if (!currentUser) {
    return <LandingPage onSignInSuccess={() => {}} />;
  }

  const streak = calculateStreak(entries);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#24211D]">
      {/* App Header */}
      <Header
        user={currentUser}
        vaultConfig={vaultConfig}
        isUnlocked={isUnlocked}
        isAdmin={Boolean(userProfile?.isAdmin)}
        onLock={handleLockVault}
        onOpenVaultSettings={() => setIsVaultModalOpen(true)}
        onOpenPrivacyAudit={() => setIsPrivacyAuditOpen(true)}
        onOpenSynthesis={() => setIsSynthesisOpen(true)}
        onOpenPrompts={() => setIsPromptsOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenAdminDashboard={() => setViewMode('admin')}
        onNewEntry={() => {
          setSelectedEntry(null);
          setViewMode('editor');
        }}
        onSignOut={handleSignOut}
        streak={streak}
      />

      {/* Sync indicator if loading cloud data */}
      {isSyncing && (
        <div className="bg-[#F2ECE1] border-b border-[#E0D8CB] px-4 py-1.5 text-center text-xs text-[#5D5548] flex items-center justify-center gap-1.5">
          <RefreshCw className="w-3 h-3 animate-spin text-amber-700" />
          <span>Synchronizing your private Firestore entries...</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {/* Admin Dashboard view */}
        {viewMode === 'admin' ? (
          <AdminDashboard
            userProfile={userProfile}
            onBackToJournal={() => setViewMode('list')}
          />
        ) : vaultConfig.useEncryption && !isUnlocked ? (
          <div
            id="locked-vault-banner"
            className="my-12 max-w-md mx-auto p-8 rounded-2xl bg-white border border-[#E2DCCE] text-center shadow-sm space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#F2ECE1] text-[#4A4339] flex items-center justify-center mx-auto shadow-2xs">
              <Lock className="w-7 h-7 text-[#24211D]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#1F1C18]">
                Your Journal Vault is Locked
              </h2>
              <p className="text-xs text-[#7A7367] mt-1 leading-relaxed">
                All writings are protected with client-side AES-256-GCM encryption. Provide your
                master passcode to decrypt and access your entries.
              </p>
            </div>
            <button
              id="unlock-vault-cta-btn"
              type="button"
              onClick={() => setIsVaultModalOpen(true)}
              className="w-full py-2.5 px-4 bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-xl text-xs font-medium transition-colors shadow-xs cursor-pointer"
            >
              Unlock Vault
            </button>
          </div>
        ) : viewMode === 'editor' ? (
          <EntryEditor
            entry={selectedEntry}
            onSave={handleSaveEntry}
            onBack={() => {
              setSelectedEntry(null);
              setViewMode('list');
            }}
          />
        ) : (
          <EntryList
            entries={entries}
            streak={streak}
            onSelectEntry={(entry) => {
              setSelectedEntry(entry);
              setViewMode('editor');
            }}
            onNewEntry={() => {
              setSelectedEntry(null);
              setViewMode('editor');
            }}
            onDeleteEntry={handleDeleteEntry}
            onToggleFavorite={handleToggleFavorite}
            onOpenPrompts={() => setIsPromptsOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E8E3DA] py-6 px-4 text-center text-xs text-[#8A8376]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>
            Personal Gemini Journal • Owner-Bound Cloud Firestore & Gemini AI Reflections
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPrivacyAuditOpen(true)}
              className="hover:text-[#24211D] underline cursor-pointer"
            >
              Security Specs
            </button>
            <button
              onClick={() => setIsVaultModalOpen(true)}
              className="hover:text-[#24211D] underline cursor-pointer"
            >
              Vault Settings
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <VaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        vaultConfig={vaultConfig}
        isUnlocked={isUnlocked}
        activePasscode={activePasscode}
        entries={entries}
        onUnlockSuccess={handleUnlockSuccess}
        onVaultConfigUpdated={handleVaultConfigUpdated}
      />

      <PrivacyAuditModal
        isOpen={isPrivacyAuditOpen}
        onClose={() => setIsPrivacyAuditOpen(false)}
        vaultConfig={vaultConfig}
        entries={entries}
        onExportEncrypted={handleExportEncrypted}
        onExportDecrypted={handleExportDecrypted}
        onImportBackup={handleImportBackup}
        onWipeAllData={handleWipeAllData}
      />

      <PromptModal
        isOpen={isPromptsOpen}
        onClose={() => setIsPromptsOpen(false)}
        onSelectPrompt={handleSelectPrompt}
      />

      <SynthesisModal
        isOpen={isSynthesisOpen}
        onClose={() => setIsSynthesisOpen(false)}
        entries={entries}
      />

      <NotificationSettingsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        userEmail={currentUser?.email}
      />
    </div>
  );
}
