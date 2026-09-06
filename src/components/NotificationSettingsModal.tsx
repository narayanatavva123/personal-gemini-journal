import { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  CheckCircle,
  AlertTriangle,
  Send,
  X,
  RefreshCw,
  Lock,
  Sparkles,
  Flame,
  Calendar,
  Clock,
} from 'lucide-react';
import type { UserNotificationSettings } from '../types.ts';
import {
  fetchNotificationSettings,
  saveNotificationSettings,
  sendTestNotification,
} from '../utils/apiClient.ts';
import {
  auth,
  fetchNotificationSettingsFromFirestore,
  saveNotificationSettingsToFirestore,
} from '../utils/firebase.ts';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

export function NotificationSettingsModal({
  isOpen,
  onClose,
  userEmail,
}: NotificationSettingsModalProps) {
  const [settings, setSettings] = useState<UserNotificationSettings>({
    notificationEmail: '',
    emailNotificationsEnabled: false,
    reflectionReady: true,
    writingStreak: true,
    weeklySynthesis: true,
    inactivityNudge: false,
    inactivityDays: 3,
    updatedAt: new Date().toISOString(),
    // Legacy compatibility aliases
    email: '',
    enabled: false,
    streakMilestone: true,
    weeklySummary: true,
    inactivityReminder: false,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Test email outcome state
  const [testResult, setTestResult] = useState<{
    attempted: boolean;
    success: boolean;
    configured: boolean;
    provider?: string;
    message?: string;
    errorType?: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);
    setSaveSuccess(false);
    setTestResult(null);

    const loadSettings = async () => {
      try {
        const currentUser = auth.currentUser;
        let savedSettings: Partial<UserNotificationSettings> | null = null;

        // 1. First load the saved notification preferences from Firestore path
        if (currentUser?.uid) {
          savedSettings = await fetchNotificationSettingsFromFirestore(currentUser.uid);
        }

        // 2. Secondary fallback check via server API if direct client fetch was null
        if (!savedSettings) {
          try {
            const apiData = await fetchNotificationSettings();
            if (
              apiData &&
              (apiData.notificationEmail ||
                apiData.email ||
                typeof apiData.emailNotificationsEnabled === 'boolean' ||
                typeof apiData.enabled === 'boolean')
            ) {
              savedSettings = apiData;
            }
          } catch {
            // Non-blocking fallback
          }
        }

        if (!isMounted) return;

        // 3. Fallback logic:
        // Use Firebase Auth currentUser.email only as a fallback when notificationEmail does not yet exist in Firestore.
        // const notificationEmail = savedSettings.notificationEmail || currentUser.email || "";
        const notificationEmail =
          savedSettings?.notificationEmail ||
          savedSettings?.email ||
          currentUser?.email ||
          userEmail ||
          '';

        const emailNotificationsEnabled =
          typeof savedSettings?.emailNotificationsEnabled === 'boolean'
            ? savedSettings.emailNotificationsEnabled
            : typeof savedSettings?.enabled === 'boolean'
            ? savedSettings.enabled
            : false;

        const reflectionReady = savedSettings?.reflectionReady !== false;
        const writingStreak =
          typeof savedSettings?.writingStreak === 'boolean'
            ? savedSettings.writingStreak
            : savedSettings?.streakMilestone !== false;
        const weeklySynthesis =
          typeof savedSettings?.weeklySynthesis === 'boolean'
            ? savedSettings.weeklySynthesis
            : savedSettings?.weeklySummary !== false;
        const inactivityNudge =
          typeof savedSettings?.inactivityNudge === 'boolean'
            ? savedSettings.inactivityNudge
            : Boolean(savedSettings?.inactivityReminder);
        const inactivityDays =
          typeof savedSettings?.inactivityDays === 'number' && savedSettings.inactivityDays > 0
            ? savedSettings.inactivityDays
            : 3;

        setSettings({
          notificationEmail,
          emailNotificationsEnabled,
          reflectionReady,
          writingStreak,
          weeklySynthesis,
          inactivityNudge,
          inactivityDays,
          updatedAt: savedSettings?.updatedAt || new Date().toISOString(),
          // Backwards compatibility aliases
          email: notificationEmail,
          enabled: emailNotificationsEnabled,
          streakMilestone: writingStreak,
          weeklySummary: weeklySynthesis,
          inactivityReminder: inactivityNudge,
        });
      } catch (err: any) {
        if (isMounted) {
          console.warn('Could not fetch existing notification settings:', err);
          // Do not overwrite user's saved email during initialization
          setSettings((prev) => {
            const fallbackEmail =
              prev.notificationEmail || auth.currentUser?.email || userEmail || '';
            return {
              ...prev,
              notificationEmail: fallbackEmail,
              email: fallbackEmail,
            };
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const currentUser = auth.currentUser;
      const targetUserId = currentUser?.uid;
      if (!targetUserId) {
        throw new Error('Please sign in to save your notification preferences.');
      }

      // 1. Await the Firestore write successfully
      const saved = await saveNotificationSettingsToFirestore(targetUserId, {
        notificationEmail: settings.notificationEmail.trim(),
        emailNotificationsEnabled: settings.emailNotificationsEnabled,
        reflectionReady: settings.reflectionReady,
        writingStreak: settings.writingStreak,
        weeklySynthesis: settings.weeklySynthesis,
        inactivityNudge: settings.inactivityNudge,
        inactivityDays: settings.inactivityDays,
      });

      // 2. Also keep server sync for cron notifications
      try {
        await saveNotificationSettings(saved);
      } catch (apiErr) {
        console.info('Server sync notification note:', apiErr);
      }

      // 3. Update local state only after or consistently with the saved data
      setSettings(saved);

      // 4. Show success confirmation
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save notification preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setErrorMessage(null);

    const emailToSend = (settings.notificationEmail || settings.email || '').trim();

    try {
      const res = await sendTestNotification(emailToSend);
      setTestResult({
        attempted: true,
        success: res.success,
        configured: res.configured,
        provider: res.provider,
        message: res.success
          ? res.message || `Test email dispatched to ${res.recipient || emailToSend} via ${res.provider}.`
          : res.error || 'Failed to send test email.',
        errorType: res.errorType,
      });
    } catch (err: any) {
      setTestResult({
        attempted: true,
        success: false,
        configured: false,
        message: err.message || 'Failed to process test email dispatch.',
        errorType: 'server_error',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#24211D]/40 backdrop-blur-xs animate-fade-in">
      <div
        id="notification-settings-dialog"
        className="bg-white border border-[#E2DCCE] rounded-2xl max-w-lg w-full p-6 shadow-lg space-y-6 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E8E3DA]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F2ECE1] text-[#4A4339] flex items-center justify-center shadow-2xs">
              <Bell className="w-5 h-5 text-[#24211D]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1F1C18]">
                Email Notification Preferences
              </h2>
              <p className="text-xs text-[#7A7367]">
                Privacy-first, opt-in updates delivered to your inbox
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#7A7367] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-5 overflow-y-auto pr-1 flex-1 text-xs">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#7A7367]">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading your preferences...</span>
            </div>
          ) : (
            <>
              {/* Privacy Notice Card */}
              <div className="p-3.5 bg-[#FAF8F5] border border-[#E2DCCE] rounded-xl flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-[#5D5548] leading-relaxed">
                  <strong className="text-[#1F1C18] font-medium">Strict Privacy Policy:</strong>{' '}
                  Notifications contain only event triggers and streak milestones. Your private
                  journal text, deep reflections, and GPS coordinates are never sent in emails.
                </div>
              </div>

              {/* Master Enable Toggle */}
              <div className="p-4 bg-[#F7F4EE] border border-[#E0D8CB] rounded-xl flex items-center justify-between gap-4">
                <div>
                  <span className="text-sm font-semibold text-[#1F1C18] block">
                    Enable Email Notifications
                  </span>
                  <span className="text-[#655E53] text-xs">
                    Receive opt-in updates and milestone summaries
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    id="master-notification-toggle"
                    type="checkbox"
                    checked={settings.emailNotificationsEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        emailNotificationsEnabled: e.target.checked,
                        enabled: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#D4CDBC] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#C0B7A4] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#24211D]"></div>
                </label>
              </div>

              {/* Destination Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="notification-email-input"
                  className="block font-medium text-[#24211D]"
                >
                  Notification Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8A8376] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="notification-email-input"
                    type="email"
                    value={settings.notificationEmail}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notificationEmail: e.target.value,
                        email: e.target.value,
                      })
                    }
                    placeholder="your-email@example.com"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#DDD6C8] rounded-xl text-xs text-[#1F1C18] focus:outline-hidden focus:border-[#24211D]"
                  />
                </div>
                <p className="text-[11px] text-[#7A7367]">
                  Verified identity email from your Google Authentication profile or preferred inbox.
                </p>
              </div>

              {/* Granular Event Subscriptions */}
              <div className="space-y-2.5 pt-1">
                <span className="font-semibold text-[#1F1C18] block">
                  Notification Triggers
                </span>

                <div className="space-y-2">
                  {/* Reflection Ready */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#E2DCCE] bg-white hover:bg-[#FAF8F5] transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.reflectionReady}
                      disabled={!settings.emailNotificationsEnabled}
                      onChange={(e) =>
                        setSettings({ ...settings, reflectionReady: e.target.checked })
                      }
                      className="mt-0.5 rounded text-[#24211D] focus:ring-0 disabled:opacity-50"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-medium text-[#1F1C18]">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Gemini Reflection Ready</span>
                      </div>
                      <p className="text-[#7A7367] text-[11px]">
                        Notify when a new reflection has been processed and saved to your sanctuary.
                      </p>
                    </div>
                  </label>

                  {/* Streak Milestones */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#E2DCCE] bg-white hover:bg-[#FAF8F5] transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.writingStreak}
                      disabled={!settings.emailNotificationsEnabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          writingStreak: e.target.checked,
                          streakMilestone: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded text-[#24211D] focus:ring-0 disabled:opacity-50"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-medium text-[#1F1C18]">
                        <Flame className="w-3.5 h-3.5 text-amber-600" />
                        <span>Writing Streak Milestones</span>
                      </div>
                      <p className="text-[#7A7367] text-[11px]">
                        Celebrate when you achieve 3, 7, 14, or 30-day journaling consistency streaks.
                      </p>
                    </div>
                  </label>

                  {/* Weekly Synthesis Summary */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#E2DCCE] bg-white hover:bg-[#FAF8F5] transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.weeklySynthesis}
                      disabled={!settings.emailNotificationsEnabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          weeklySynthesis: e.target.checked,
                          weeklySummary: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded text-[#24211D] focus:ring-0 disabled:opacity-50"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-medium text-[#1F1C18]">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Weekly Journal Activity Synthesis</span>
                      </div>
                      <p className="text-[#7A7367] text-[11px]">
                        A macro overview of your weekly writing volume and predominant moods.
                      </p>
                    </div>
                  </label>

                  {/* Inactivity Reminder */}
                  <div className="p-3 rounded-xl border border-[#E2DCCE] bg-white space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.inactivityNudge}
                        disabled={!settings.emailNotificationsEnabled}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            inactivityNudge: e.target.checked,
                            inactivityReminder: e.target.checked,
                          })
                        }
                        className="mt-0.5 rounded text-[#24211D] focus:ring-0 disabled:opacity-50"
                      />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-medium text-[#1F1C18]">
                          <Clock className="w-3.5 h-3.5 text-sky-600" />
                          <span>Gentle Inactivity Nudge</span>
                        </div>
                        <p className="text-[#7A7367] text-[11px]">
                          Send a mindful reminder when you have not written for several days.
                        </p>
                      </div>
                    </label>

                    {settings.inactivityNudge && (
                      <div className="pl-6 pt-1 flex items-center gap-2 text-xs text-[#5D5548]">
                        <span>Remind me after</span>
                        <select
                          value={settings.inactivityDays}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              inactivityDays: parseInt(e.target.value, 10),
                            })
                          }
                          className="bg-[#FAF8F5] border border-[#DDD6C8] rounded-md px-2 py-1 text-xs text-[#1F1C18]"
                        >
                          <option value={2}>2 days</option>
                          <option value={3}>3 days</option>
                          <option value={5}>5 days</option>
                          <option value={7}>7 days</option>
                        </select>
                        <span>of inactivity</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Test Email Dispatch & Status */}
              <div className="pt-2 border-t border-[#E8E3DA] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#1F1C18]">Deliverability Test</span>
                  <button
                    id="send-test-notification-btn"
                    type="button"
                    onClick={handleSendTest}
                    disabled={isTesting || !settings.notificationEmail.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#FAF8F5] hover:bg-[#F2ECE1] text-[#24211D] border border-[#DDD6C8] rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className={`w-3 h-3 ${isTesting ? 'animate-pulse' : ''}`} />
                    <span>{isTesting ? 'Dispatching...' : 'Send Test Notification'}</span>
                  </button>
                </div>

                {testResult && (() => {
                  const isPermissionDenied =
                    testResult.errorType === 'permission_denied' ||
                    testResult.message?.includes('PERMISSION_DENIED') ||
                    testResult.message?.includes('insufficient permissions');

                  return (
                    <div
                      className={`p-3 rounded-xl border text-xs ${
                        testResult.success
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : isPermissionDenied
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : testResult.configured
                          ? 'bg-red-50 border-red-200 text-red-900'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {testResult.success ? (
                          <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <strong className="block font-medium">
                            {testResult.success
                              ? 'Test Dispatched Successfully'
                              : isPermissionDenied
                              ? 'Secret Manager / IAM Permission Denied'
                              : testResult.configured
                              ? 'Provider API Error / Notice'
                              : 'Email Provider Key Not Configured'}
                          </strong>
                          <p className="text-[11px] leading-relaxed">
                            {testResult.message}
                          </p>
                          {isPermissionDenied && (
                            <div className="mt-1.5 p-2 bg-amber-100/70 border border-amber-300/60 rounded-md font-mono text-[10px] text-amber-950 overflow-x-auto select-all">
                              gcloud secrets add-iam-policy-binding SENDGRID_API_KEY \<br />
                              &nbsp;&nbsp;--member=&quot;serviceAccount:YOUR_SERVICE_ACCOUNT&quot; \<br />
                              &nbsp;&nbsp;--role=&quot;roles/secretmanager.secretAccessor&quot;
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Status Feedback */}
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-700" />
                  <span>Preferences saved successfully to your Firestore profile.</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-700" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-[#E8E3DA] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#5E584F] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            id="save-notification-settings-btn"
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="flex items-center gap-2 px-5 py-2 text-xs font-medium bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
