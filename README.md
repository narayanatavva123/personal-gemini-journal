# Personal Gemini Journal

A production-grade, privacy-first personal journal application integrating Google Cloud Run, Firebase Authentication (Google Sign-In), Cloud Firestore with owner-bound security rules, server-side Google Gemini reflections (`gemini-3.6-flash` with resilient fallback ladder), Location-Aware entries via Google Maps Platform reverse-geocoding, a Secure Admin Dashboard with Role-Based Access Control (RBAC), and Secure External Email Notifications.

---

## 1. Architecture & Security Overview

- **Server-Side Gemini AI**: All interactions with `@google/genai` are proxied server-side via `/api/gemini/*` with telemetry tracking (`User-Agent: aistudio-build`). The `GEMINI_API_KEY` is strictly isolated on the server and is never exposed to browser bundles or client storage.
- **Owner-Bound Cloud Firestore**: Every journal reflection is saved to `/users/{userId}/interactions/{interactionId}`. Firestore security rules enforce strict authentication and isolation (`request.auth.uid == userId`), preventing any cross-user data exposure.
- **Location-Aware Entries (Zero Client Secret Exposure)**: On-demand geolocation invoked strictly upon explicit user click (`Add Location`). Reverse-geocoding is securely proxied via server-side `/api/location/reverse-geocode` using `GOOGLE_MAPS_API_KEY` from Secret Manager.
- **Secure Admin Dashboard with RBAC**: Server-authoritative role verification using Firebase Auth ID token verification (`server/firebaseAdmin.ts`). Protects the administrative console from client tampering. The dashboard strictly displays differential aggregate metrics (total users, total entries, total reflections, total saved places, aggregate word count, and security controls audit) with **Zero PII**: private journal text, individual reflections, precise geographic coordinates, and user email directories are never queried or transmitted.
- **Secure External Email Notifications**: User-controlled opt-in notification preferences stored in isolated Firestore subcollections (`/users/{userId}/settings/notifications`). Delivers privacy-safe trigger emails via Resend or SendGrid using credentials stored in Google Cloud Secret Manager (`RESEND_API_KEY` or `SENDGRID_API_KEY`). Email templates contain only event notices and streak milestones—raw journal text and reflections are never transmitted via email.
- **Client-Side Cryptographic Vault**: Optional client-side AES-256-GCM encryption with PBKDF2 (100,000 rounds) for zero-knowledge privacy.
- **Pre-Flight PII Redaction Shield**: Automatically scrubs personal data (emails, phone numbers, credit card patterns) before reflection requests.

---

## 2. Prerequisites & Cloud Setup

### Required Google Cloud APIs
Enable the required Google Cloud APIs for Cloud Run, Secret Manager, and Firestore:

```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com
```

---

## 3. Secret Management Setup (Zero-Hardcoding)

Never store API keys or service account credentials in client code or `.env` files committed to version control. Store your credentials in Google Cloud Secret Manager:

```bash
# 1. Gemini API Key for server-side AI reflections
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Administrator Emails for RBAC access (comma-separated list of authorized emails)
gcloud secrets create ADMIN_EMAILS --replication-policy="automatic"
echo -n "admin@example.com,lead-security@example.com" | gcloud secrets versions add ADMIN_EMAILS --data-file=-

# 3. Email Notification Provider Key (SendGrid or Resend)
gcloud secrets create SENDGRID_API_KEY --replication-policy="automatic"
echo -n "SG.YOUR_SENDGRID_API_KEY" | gcloud secrets versions add SENDGRID_API_KEY --data-file=-

# Optional: Verified sender email for SendGrid delivery
gcloud secrets create SENDGRID_FROM_EMAIL --replication-policy="automatic"
echo -n "Personal Gemini Journal <verified-sender@yourdomain.com>" | gcloud secrets versions add SENDGRID_FROM_EMAIL --data-file=-

# Alternative provider: Resend
gcloud secrets create RESEND_API_KEY --replication-policy="automatic"
echo -n "re_YOUR_RESEND_API_KEY" | gcloud secrets versions add RESEND_API_KEY --data-file=-

# 4. Optional: Google Maps Platform API key for server-side reverse geocoding
gcloud secrets create GOOGLE_MAPS_API_KEY --replication-policy="automatic"
echo -n "YOUR_GOOGLE_MAPS_API_KEY" | gcloud secrets versions add GOOGLE_MAPS_API_KEY --data-file=-

# 5. Optional: Secret token for Cloud Scheduler cron tasks
gcloud secrets create CRON_SECRET --replication-policy="automatic"
echo -n "RANDOM_STRONG_CRON_SECRET_TOKEN" | gcloud secrets versions add CRON_SECRET --data-file=-

# Identify your Cloud project number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# Grant the Cloud Run compute service account access to read secrets (Secret Manager Secret Accessor)
for SECRET in GEMINI_API_KEY ADMIN_EMAILS SENDGRID_API_KEY SENDGRID_FROM_EMAIL RESEND_API_KEY GOOGLE_MAPS_API_KEY CRON_SECRET; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" || true
done
```

---

## 4. Firestore Security Rules

Deploy the owner-bound security rules ensuring user data isolation, role-based protection for administrative collections, and private notification preferences:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isAuthenticated() && (
        request.auth.token.admin == true ||
        (exists(/databases/$(database)/documents/admin_roles/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/admin_roles/$(request.auth.uid)).data.role == 'admin')
      );
    }

    // Owner-bound user sanctuary and subcollections
    match /users/{userId} {
      allow read, write: if isOwner(userId);

      match /interactions/{interactionId} {
        allow read, write: if isOwner(userId);
      }

      match /entries/{entryId} {
        allow read, write: if isOwner(userId);
      }

      match /settings/{settingId} {
        allow read, write: if isOwner(userId);
      }
    }

    // Administrative roles - Read-only for authorized admins, writes only by Admin SDK
    match /admin_roles/{userId} {
      allow read: if isAdmin();
      allow write: if false;
    }

    // Audit logs - Read-only for authorized admins, writes only by Admin SDK
    match /admin_audit_logs/{logId} {
      allow read: if isAdmin();
      allow write: if false;
    }
  }
}
```

Deploy the rules using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 5. Cloud Run Deployment Flow

Deploy the application to Google Cloud Run, mounting Secret Manager secrets as environment variables:

```bash
gcloud run deploy personal-gemini-journal \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest,ADMIN_EMAILS=ADMIN_EMAILS:latest,SENDGRID_API_KEY=SENDGRID_API_KEY:latest,SENDGRID_FROM_EMAIL=SENDGRID_FROM_EMAIL:latest" \
  --port 3000
```

---

## 6. Campaign Verification Binding

Apply the mandatory challenge verification label to your deployed Cloud Run service:

```bash
gcloud run services update personal-gemini-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 7. Verification & Comprehensive Functional Walkthrough

Every user journey and security boundary has a verifiable end-to-end test procedure:

### Journey 1: Authentication & User Sanctuary Isolation
1. **Landing View**: Open the root URL. Confirm that the welcoming landing page is displayed with feature guarantees and the "Sign in with Google" button.
2. **Google Sign-In**: Click "Continue with Google". Complete the authentication popup.
3. **Private Dashboard Entry**: Verify automatic redirection to the private dashboard displaying writing streak counters, mood filters, and the entry list.
4. **Sign Out**: Click "Sign Out" in the top-right header. Confirm redirection back to the landing page and that previous user data is cleared from memory.
5. **Cross-User Data Isolation**: Sign in with User B and verify that User A's entries, settings, and locations are strictly inaccessible.

### Journey 2: Journaling, Location, and Gemini AI Reflections
1. **Create Journal Entry**: Click "Write Entry". Enter a title, select a mood (e.g. *Serene*), add tags, and write a paragraph.
2. **On-Demand Location Attachment**: Click the "Add Location" button. Confirm that the browser requests geolocation permission only after this explicit click. Confirm that coordinates are reverse-geocoded without exposing API keys to the browser.
3. **AI Reflection Request**: In the Gemini Companion dock, select a reflection style (e.g. *Empathetic Reflection* or *Socratic Deep Inquiry*), ensure PII redaction is toggled, and click "Reflect with Gemini".
4. **Persistence Confirmation**: Confirm that both the entry text, location data, and the Gemini reflection are saved to Cloud Firestore at `/users/{userId}/interactions/{interactionId}`.

### Journey 3: Secure Admin Dashboard & RBAC Access Control
1. **Role Check on Header**: Note the header. If the signed-in user's email is in `ADMIN_EMAILS` or has custom claim `admin: true`, the "Admin" button displays an active badge.
2. **Admin Navigation**: Click the "Admin" button in the top header.
3. **Server-Side Token Verification**: Observe network traffic: the client issues a `GET /api/admin/stats` request with `Authorization: Bearer <ID_TOKEN>`. The backend validates the cryptographic signature with Firebase Admin.
4. **Differential Privacy & Aggregate Metrics**:
   - Confirm that the dashboard displays only aggregate cards: *Registered Users*, *Journal Entries*, *Gemini Reflections*, *Saved Places*, and *Total Words Written*.
   - Confirm that the Privacy Notice card is displayed: no private entry content, reflection text, precise coordinates, or email rosters are exposed.
   - View the System Activity Telemetry feed for recent anonymized server events.
   - Inspect the Security Controls Audit card verifying zero client secret exposure and active Secret Manager status.
5. **Non-Admin Access Denied Barrier (403 Forbidden)**:
   - When a standard user without admin rights attempts to access `/api/admin/stats` or view the admin dashboard, the server responds with an HTTP `403 Forbidden`.
   - The UI cleanly renders the **Access Denied (403 Forbidden)** security barrier with a clear explanation of server-authoritative RBAC enforcement and a button to return to the personal journal sanctuary.

### Journey 4: Secure External Email Notifications
1. **Open Notification Settings**: In the header, click the "Alerts" bell icon.
2. **Notification Modal**:
   - Confirm that the recipient email defaults to the authenticated user's verified Google address.
   - Observe the Privacy Notice: emails contain only event summaries and streak milestones; raw private entries and coordinates are never emailed.
   - Toggle the Master Switch to enable notifications.
   - Customize granular subscriptions: *Gemini Reflection Ready*, *Writing Streak Milestones*, *Weekly Activity Synthesis*, and *Gentle Inactivity Nudge* (with days slider).
3. **Deliverability Test**:
   - Click "Send Test Notification".
   - If `RESEND_API_KEY` or `SENDGRID_API_KEY` is configured in Secret Manager, confirm that the test email is dispatched and a green confirmation banner appears showing the provider and recipient.
   - If the key is not yet set in the deployment environment, confirm that a clear, informative amber banner is displayed explaining that provider credentials need to be configured in Google Cloud Secret Manager.
4. **Save Preferences**: Click "Save Preferences". Confirm that the settings are persisted to `/users/{userId}/settings/notifications` and a confirmation banner appears.
5. **Scheduled Cron Trigger**:
   - Test the server endpoint `POST /api/notifications/scheduled-cron` with `Authorization: Bearer <CRON_SECRET>`. Confirm that the server authorizes the cron execution safely and reports the processed subscriber count.
