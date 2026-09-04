# Personal Gemini Journal

A production-grade, privacy-first personal journal application integrating Google Cloud Run, Firebase Authentication (Google Sign-In), Cloud Firestore with owner-bound security rules, and server-side Google Gemini reflections (`gemini-3.8-flash` / `gemini-3.1-flash-lite`).

---

## 1. Architecture & Security Overview

- **Server-Side Gemini AI**: All interactions with `@google/genai` are proxied server-side via `/api/gemini/*` with telemetry headers (`User-Agent: aistudio-build`). The `GEMINI_API_KEY` is strictly isolated on the server and is never exposed to browser bundles or client storage.
- **Owner-Bound Cloud Firestore**: Every journal reflection is saved to `/users/{userId}/interactions/{interactionId}`. Firestore security rules enforce strict authentication and isolation (`request.auth.uid == userId`), preventing any cross-user data exposure.
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

Never store API keys in source code or `.env` files committed to version control. Store your `GEMINI_API_KEY` in Google Cloud Secret Manager:

```bash
# 1. Create and populate the secret in Secret Manager
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Identify your Cloud project number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# 3. Grant the Cloud Run compute service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Firestore Security Rules

Deploy the owner-bound security rules ensuring user data isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
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

Deploy the application to Google Cloud Run, mounting the `GEMINI_API_KEY` secret as an environment variable:

```bash
gcloud run deploy personal-gemini-journal \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
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

## 7. Verification & Functional Walkthrough

To verify the end-to-end functionality of the application:

1. **Unauthenticated Landing**: Open the root URL. Confirm that the welcoming landing page is displayed with feature guarantees and the "Sign in with Google" button.
2. **Google Sign-In**: Click "Continue with Google". Complete the authentication popup.
3. **Private Dashboard Entry**: Verify automatic redirection to the private dashboard displaying writing streak counters, mood filters, and the entry list.
4. **Create Journal Entry**: Click "Write Entry". Enter a title, select a mood (e.g. *Serene*), add tags, and write a paragraph.
5. **AI Reflection Request**: In the Gemini Companion dock, select a reflection style (e.g. *Empathetic Reflection* or *Socratic Deep Inquiry*), ensure PII redaction is toggled, and click "Reflect with Gemini".
6. **Persistence Confirmation**: Confirm that both the entry text and the Gemini reflection are saved to Cloud Firestore at `/users/{userId}/interactions/{interactionId}`.
7. **Sign Out**: Click "Sign Out" in the top-right header. Confirm redirection back to the landing page and that previous user data is cleared from memory.
8. **Sign In Continuity**: Sign in again with the same Google account and verify that all previous entries and Gemini reflections are restored from Cloud Firestore.
9. **Cross-User Data Isolation**: Sign in with an alternate Google account and verify that the first user's entries are strictly inaccessible.
10. **Persistence Failure Handling**: If network connectivity drops during a save, verify that the error banner appears with a functional "Retry Save" button while keeping all user prose in the input area intact.
