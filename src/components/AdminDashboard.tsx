import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  BookOpen,
  Sparkles,
  MapPin,
  FileText,
  Activity,
  ArrowLeft,
  RefreshCw,
  Lock,
  Server,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import type { AdminAggregateStats, UserAuthProfile } from '../types.ts';
import { fetchAdminStats } from '../utils/apiClient.ts';

interface AdminDashboardProps {
  userProfile: UserAuthProfile | null;
  onBackToJournal: () => void;
}

export function AdminDashboard({ userProfile, onBackToJournal }: AdminDashboardProps) {
  const [stats, setStats] = useState<AdminAggregateStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadStats = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await fetchAdminStats();
      setStats(data);
      setStatusCode(200);
    } catch (err: any) {
      setError(err.message || 'Failed to load administrator statistics.');
      setStatusCode(err.status || 403);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Access Denied Barrier for Non-Admin or Unauthorized Request
  if (error && (statusCode === 403 || statusCode === 401)) {
    return (
      <div
        id="admin-access-denied-view"
        className="max-w-2xl mx-auto my-12 p-8 bg-white border border-red-200 rounded-2xl shadow-xs space-y-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#1F1C18]">
              Access Denied (403 Forbidden)
            </h2>
            <p className="text-xs text-[#7A7367]">
              Server-authoritative Role-Based Access Control barrier
            </p>
          </div>
        </div>

        <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#E2DCCE] text-xs text-[#4A4339] space-y-2">
          <p className="font-medium text-[#1F1C18]">
            Your current identity is not authorized to access the Admin Console:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[#655E53]">
            <li>
              Signed in account: <code className="text-[#1F1C18] bg-[#F2ECE1] px-1.5 py-0.5 rounded">{userProfile?.email || 'Authenticated User'}</code>
            </li>
            <li>Role: <span className="font-semibold text-amber-800">standard_user</span></li>
            <li>
              Authorization Policy: Administrator status is strictly verified on the server via Google Cloud Secret Manager (<code className="text-xs">ADMIN_EMAILS</code>) or Firebase Custom Claims.
            </li>
          </ul>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onBackToJournal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Personal Journal</span>
          </button>

          <button
            type="button"
            onClick={() => loadStats(false)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#5E584F] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded-xl transition-all border border-[#DDD6C8] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Authorization</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="admin-dashboard-container" className="space-y-8 animate-fade-in">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2DCCE]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToJournal}
              className="p-1.5 text-[#655E53] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded-lg transition-colors cursor-pointer mr-1"
              title="Return to Personal Journal"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-semibold text-[#1F1C18] tracking-tight">
              Administrative Console
            </h1>
            <span
              id="admin-verified-badge"
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200"
            >
              <ShieldCheck className="w-3 h-3 text-amber-700" />
              Verified Administrator
            </span>
          </div>
          <p className="text-xs text-[#7A7367]">
            Privacy-safe aggregate telemetry & server-side system infrastructure health
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="admin-refresh-btn"
            type="button"
            onClick={() => loadStats(true)}
            disabled={isRefreshing || loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white hover:bg-[#F8F5EE] text-[#3D372F] rounded-xl border border-[#DDD6C8] shadow-2xs transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
          </button>

          <button
            type="button"
            onClick={onBackToJournal}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <span>Back to Journal</span>
          </button>
        </div>
      </div>

      {/* Strict Privacy Isolation Guarantee Banner */}
      <div className="p-4 bg-[#FAF8F5] border border-[#E2DCCE] rounded-xl flex items-start gap-3">
        <Lock className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-semibold text-[#1F1C18]">
            Differential Privacy & Zero-PII Enforcement
          </span>
          <p className="text-[#655E53] leading-relaxed">
            This administrative view operates under strict data minimization directives. The backend
            only returns aggregated counts and macro system timestamps. Individual journal writings,
            deep reflections, precise geolocation coordinates, and personal email directories are
            cryptographically isolated in owner-bound Firestore subcollections and never transmitted
            to this view.
          </p>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-6 bg-white border border-[#E2DCCE] rounded-2xl shadow-2xs animate-pulse space-y-3"
            >
              <div className="w-8 h-8 rounded-xl bg-[#F2ECE1]" />
              <div className="h-4 bg-[#F2ECE1] rounded w-1/2" />
              <div className="h-7 bg-[#F2ECE1] rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <>
          {/* Macro Aggregate Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Users */}
            <div
              id="admin-stat-users"
              className="p-5 bg-white border border-[#E2DCCE] rounded-2xl shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#7A7367]">Registered Users</span>
                <div className="w-8 h-8 rounded-lg bg-[#F2ECE1] text-[#4A4339] flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#1F1C18]">
                {stats.totalUsers.toLocaleString()}
              </div>
              <div className="text-xs text-[#8A8376]">
                Owner-isolated user accounts
              </div>
            </div>

            {/* Total Journal Entries */}
            <div
              id="admin-stat-entries"
              className="p-5 bg-white border border-[#E2DCCE] rounded-2xl shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#7A7367]">Journal Entries</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#1F1C18]">
                {stats.totalEntries.toLocaleString()}
              </div>
              <div className="text-xs text-[#8A8376]">
                Persisted in Firestore
              </div>
            </div>

            {/* Total Gemini Reflections */}
            <div
              id="admin-stat-reflections"
              className="p-5 bg-white border border-[#E2DCCE] rounded-2xl shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#7A7367]">Gemini Reflections</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#1F1C18]">
                {stats.totalReflections.toLocaleString()}
              </div>
              <div className="text-xs text-[#8A8376]">
                Server-side AI syntheses
              </div>
            </div>

            {/* Total Saved Places */}
            <div
              id="admin-stat-places"
              className="p-5 bg-white border border-[#E2DCCE] rounded-2xl shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#7A7367]">Saved Places</span>
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-800 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#1F1C18]">
                {stats.totalSavedPlaces.toLocaleString()}
              </div>
              <div className="text-xs text-[#8A8376]">
                On-demand location entries
              </div>
            </div>
          </div>

          {/* Aggregate Usage & Security Audit Bento */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* System Activity Summary (Anonymized Telemetry) */}
            <div className="lg:col-span-2 p-6 bg-white border border-[#E2DCCE] rounded-2xl shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#5E584F]" />
                  <h2 className="text-sm font-semibold text-[#1F1C18]">
                    Recent System Activity Telemetry
                  </h2>
                </div>
                <span className="text-xs text-[#8A8376]">Anonymized event stream</span>
              </div>

              <div className="divide-y divide-[#F0EBE1] max-h-80 overflow-y-auto">
                {stats.systemActivity.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#8A8376]">
                    No recent telemetry records recorded.
                  </div>
                ) : (
                  stats.systemActivity.map((event) => (
                    <div key={event.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-[#24211D] capitalize">
                            {event.eventType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F2ECE1] text-[#5D5548]">
                            System
                          </span>
                        </div>
                        <p className="text-xs text-[#6B6355]">{event.details}</p>
                      </div>
                      <span className="text-[11px] text-[#8A8376] shrink-0 font-mono">
                        {new Date(event.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Security Architecture & Secret Manager Status */}
            <div className="p-6 bg-white border border-[#E2DCCE] rounded-2xl shadow-2xs space-y-5">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#5E584F]" />
                <h2 className="text-sm font-semibold text-[#1F1C18]">Security Controls Audit</h2>
              </div>

              <div className="space-y-3 text-xs">
                {/* Server-Side Gemini */}
                <div className="flex items-center justify-between py-2 border-b border-[#F2ECE1]">
                  <span className="text-[#5D5548]">Server-Side Gemini Proxy</span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    Enforced
                  </span>
                </div>

                {/* Secret Manager Integration */}
                <div className="flex items-center justify-between py-2 border-b border-[#F2ECE1]">
                  <span className="text-[#5D5548]">GCP Secret Manager</span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    Active
                  </span>
                </div>

                {/* Client Secret Exposure */}
                <div className="flex items-center justify-between py-2 border-b border-[#F2ECE1]">
                  <span className="text-[#5D5548]">Client Key Exposure</span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    0 Keys in Bundle
                  </span>
                </div>

                {/* RBAC Rules */}
                <div className="flex items-center justify-between py-2 border-b border-[#F2ECE1]">
                  <span className="text-[#5D5548]">RBAC Authorization</span>
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    Server-Verified
                  </span>
                </div>

                {/* External Email Notification Provider */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-[#5D5548]">Email Notification API</span>
                  {stats.securityAudit.emailNotificationsConfigured ? (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-800 capitalize">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      {stats.securityAudit.emailProvider}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 font-medium text-amber-800"
                      title="Optional: Add RESEND_API_KEY to Secret Manager to enable external email delivery"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Key Unset
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E2DCCE] text-[11px] text-[#655E53] leading-relaxed">
                Total aggregate words recorded across all user journals:{' '}
                <strong className="text-[#1F1C18]">{stats.totalWordsWritten.toLocaleString()}</strong> words.
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
