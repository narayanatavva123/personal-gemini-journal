# Custom Instructions & Production Directives

## 1. Google Maps Platform & Location-Aware Security Architecture
When designing or implementing Location-Aware features and Google Maps Platform integrations:

### A. Zero Client-Side Secret Exposure
* **Never expose API keys to the browser bundle**: All Google Maps and Geocoding API keys (`GOOGLE_MAPS_API_KEY`) must strictly reside on the server-side, loaded via **Google Cloud Secret Manager** (`projects/${PROJECT_ID}/secrets/GOOGLE_MAPS_API_KEY/versions/latest`) or securely injected environment variables.
* **Server-Side Reverse Proxy**: All reverse geocoding requests from the client must be directed to `/api/location/reverse-geocode`. The server validates input coordinates and proxies to the Google Maps Geocoding REST API with `User-Agent` and tracking attribution headers (`gmp_mcp_codeassist_v1_aistudio`).
* **Client Fallback**: If the server has no API key or external network is restricted, the server and client must provide safe coordinate-based representations without leaking internal error traces or credentials.

### B. User Consent & Anti-Surveillance Directives
* **Strict On-Demand Geolocation**: Geolocation (`navigator.geolocation.getCurrentPosition`) MUST ONLY be invoked upon an explicit user interaction (e.g., the user deliberately clicks the "Add Location" or "Update Location" button).
* **Zero Ambient / Background Tracking**: The application is strictly forbidden from invoking `watchPosition`, background interval polling, or silent auto-geolocating on page load or editor initialization.
* **Revocable & Detachable**: Users must be able to remove/clear the attached location from any journal entry with a single click before or after saving.
* **Transparent Feedback**: Specific, actionable error messages must be rendered when permission is denied (`PERMISSION_DENIED`), position is unavailable (`POSITION_UNAVAILABLE`), or a timeout occurs (`TIMEOUT`).

### C. Data Minimization & Privacy
* **Store Only Necessary Fields**: Location metadata is strictly limited to:
  * `latitude` (number)
  * `longitude` (number)
  * `name` (string, optional concise city/area name)
  * `formattedAddress` (string, optional reverse-geocoded address)
  * `accuracy` (number, meters)
  * `capturedAt` (ISO string timestamp)
* **Zero Redundant PII**: Do not store IP addresses, device identifiers, or continuous historical trajectory breadcrumbs.

### D. Firestore Owner-Bound Tenant Isolation
* **Subcollection Isolation**: All location-bearing entries must strictly reside under `/users/{userId}/interactions/{interactionId}`.
* **Zero-Trust Security Rules**: Security rules in `firestore.rules` must enforce `request.auth != null && request.auth.uid == userId`. No user may read, list, update, or delete location records belonging to any other user.
* **Sanitization Guarantee**: Payloads passed to Firestore must undergo undefined-stripping (`sanitizeForFirestore`) to guarantee zero-crash execution.

### E. Google Maps Platform Terms of Service & Attribution
* **Tracking Identifier**: All Google Maps Platform calls must use `gmp_mcp_codeassist_v1_aistudio` attribution.
* **Prohibited Uses**: Google Maps geospatial data must never be used to train AI models or for prohibited surveillance/emergency vehicle navigation.

## 2. Admin Roles and Authorization Directive
When designing, implementing, or enforcing administrative access control:

### A. Non-Bypassable Server-Side Authorization
* **Zero Client-Side Trust**: Never grant administrative access based solely on client-side state, URL routes/hash parameters, local storage flags, unverified client claims, or user-mutable Firestore fields.
* **Cryptographic Token Verification**: All admin operations must independently verify the caller's Firebase Authentication ID token on the server using the Firebase Admin SDK or certified public key signature checks.
* **Trusted Authority Source**: Elevated role status must strictly derive from:
  1. Firebase Custom Claims (`request.auth.token.admin == true`), or
  2. Server-side configured admin list (`ADMIN_EMAILS`) loaded from **Google Cloud Secret Manager** (`projects/${PROJECT_ID}/secrets/ADMIN_EMAILS/versions/latest`) or environment variables, or
  3. Server-authoritative Firestore roles collection (`/admin_roles/{uid}`) where write access is prohibited to non-server clients (`allow write: if false;`).

### B. Privacy-Safe Aggregate Dashboard Architecture
* **Strict Differential Privacy & Zero Content Leakage**: The Admin Dashboard is strictly limited to macro-level aggregate statistics:
  * Total registered users count
  * Total journal entries count
  * Total Gemini reflections count
  * Total saved places count
  * High-level anonymized system activity telemetry (event categories and timestamps)
* **Prohibited Data in Admin Payloads**: The server must NEVER query, serialize, or transmit:
  * User private journal titles, text, or reflection answers
  * Exact geographic coordinates or street addresses of individual users
  * Raw user email directories or personal contact info
  * Application API keys, Firebase service account keys, or raw tokens
* **Access Barrier & Redirect Enforcement**: If a non-admin or unauthenticated client accesses the Admin route directly, the server must return `403 Forbidden`, and the client must render an unambiguous "Access Denied" barrier with immediate safe redirection.

## 3. Notification API Directive
When designing, implementing, or dispatching external email notifications:

### A. User-Centric Consent & Preference Control
* **Explicit Opt-In Principle**: All email notifications are strictly opt-in and disabled by default until the authenticated user explicitly enables them in their settings.
* **Granular Event Selection**: Users must have independent control over specific notification types:
  1. Gemini reflection ready notifications
  2. Weekly journal activity summaries
  3. Writing streak milestones
  4. Inactivity reflection nudges
* **Owner-Bound Preference Isolation**: Notification preferences must reside under `/users/{userId}/settings/notifications`. Read and write permissions are restricted strictly to `request.auth.uid == userId`.

### B. Content Minimization & Privacy Protection
* **Zero Private Journal Data in Transits**: Email payloads MUST NEVER include raw journal content, private user thoughts, sensitive cognitive analysis, or exact locations.
* **Privacy-Safe Template Design**: Emails must contain only abstract event notifications (e.g., "Your reflection is ready to review in your private vault", "You reached a 7-day writing streak!").
* **Zero Secret Leakage**: Emails must never reference API keys, system tokens, or internal error logs.

### C. Server-Authoritative Dispatch & Secret Management
* **Zero Client-Side Credentials**: Notification provider credentials (e.g. `RESEND_API_KEY`, `SENDGRID_API_KEY`, or `SMTP_PASSWORD`) must NEVER be exposed to the client bundle. All credentials must be loaded via Google Cloud Secret Manager or server environment variables.
* **No Mocking / Honest Feedback**: The dispatch service must NEVER simulate or fake successful email delivery. If external credentials are not configured, the system must return a clear `503 Service Unavailable / 412 Precondition Failed` error identifying that provider credentials must be configured.
* **Server-Side Scheduled Execution**: Scheduled weekly summaries and reminders must run through an authorized server cron endpoint (`/api/notifications/scheduled-cron`) verified via `CRON_SECRET` or Cloud Scheduler headers, never through browser-side intervals.
* **Idempotency & Duplicate Suppression**: Dispatches must incorporate event deduplication to prevent spamming users across rapid saves or re-renders.

