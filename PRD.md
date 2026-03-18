# MediLog — Product Requirements Document (PRD)

**Product Name:** MediLog - Family Health Record Manager
**Version:** 1.0
**Author:** Sandeep
**Date:** March 18, 2026
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Personas](#4-user-personas)
5. [User Stories](#5-user-stories)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Information Architecture](#8-information-architecture)
9. [Wireframes & User Flows](#9-wireframes--user-flows)
10. [API Specifications](#10-api-specifications)
11. [AI/ML Requirements](#11-aiml-requirements)
12. [Security & Privacy](#12-security--privacy)
13. [Accessibility](#13-accessibility)
14. [Release Plan](#14-release-plan)
15. [Risk Assessment](#15-risk-assessment)
16. [Open Questions](#16-open-questions)

---

## 1. Executive Summary

**MediLog** is a mobile-first application that enables Indian families to digitize, organize, and share medical records for every family member. Using AI-powered prescription scanning, smart medicine reminders, and secure QR-based doctor sharing, MediLog replaces the chaos of paper prescriptions, WhatsApp photos, and forgotten medical histories with a single, offline-first app.

**Key Differentiator:** Family-centric health management with AI prescription extraction that works with handwritten Hindi & English prescriptions — designed specifically for India's healthcare reality.

**Target Market:** 300M+ smartphone-using Indian families who currently have zero organized health record management.

---

## 2. Problem Statement

### 2.1 Current State

Indian families manage health records through:
- **Paper prescriptions** → Lost within days/weeks
- **WhatsApp group photos** → Buried under messages, unsearchable, no structure
- **Memory** → "I think the doctor said to take the blue pill twice a day?"
- **Plastic folders** → Disorganized, damaged, incomplete, not portable

### 2.2 Impact

| Problem | Impact |
|---------|--------|
| Lost prescriptions | Doctors prescribe from scratch, unnecessary tests repeated, ₹500-5000 wasted per incident |
| No medication history | Drug interactions go undetected, dangerous for elderly on 5+ medicines |
| Missed medicines | Chronic conditions worsen, 50% of patients don't complete antibiotic courses |
| Emergency situations | No immediate access to blood group, allergies, or current medications |
| Doctor switching | No portable history, every new doctor starts blind |
| Family coordination | Kids can't monitor elderly parents' health remotely |

### 2.3 Existing Solutions & Gaps

| Solution | Problem |
|----------|---------|
| Practo | Doctor discovery, not record management. No family feature. Paid. |
| Google Health | Discontinued in India. Was individual-only. |
| Generic scanner apps | No medical intelligence. Can't extract medicine names. No reminders. |
| Hospital portals | Siloed to one hospital. Different login for each. |
| ABHA (Ayushman Bharat) | Government initiative, very slow adoption, complex UX, not family-centric |

### 2.4 Opportunity

- **440M+ smartphones** in India (2026)
- **No dominant player** in family health record management
- **Government push** for digital health (ABHA) creating awareness
- **Post-COVID** health consciousness at all-time high
- **AI capabilities** now make prescription scanning viable at low cost

---

## 3. Goals & Success Metrics

### 3.1 Product Goals

| Priority | Goal |
|----------|------|
| P0 | Enable families to store and retrieve health records instantly |
| P0 | AI-scan prescriptions with >85% accuracy for printed text, >70% for handwritten |
| P0 | Work fully offline on low-end Android devices |
| P1 | Automate medicine reminders from scanned prescriptions |
| P1 | Enable secure record sharing with doctors without requiring doctor to have an account |
| P2 | Provide health insights and spending tracking |
| P2 | Support Hindi + English bilingual interface |

### 3.2 Success Metrics (MVP — First 3 Months)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Downloads | 5,000+ | Play Store analytics |
| DAU/MAU ratio | >25% | Analytics |
| Records created per user | >10 in first month | In-app analytics |
| AI scan accuracy (printed) | >85% | User correction rate |
| AI scan accuracy (handwritten) | >70% | User correction rate |
| Reminder adherence rate | >60% marked as "taken" | In-app tracking |
| App crash rate | <1% | Firebase Crashlytics |
| App rating | >4.2 stars | Play Store |
| Retention (D7) | >40% | Analytics |
| Retention (D30) | >20% | Analytics |

### 3.3 North Star Metric

**Records stored per family per month** — measures both acquisition and engagement. A family that stores 5+ records/month is a retained, high-value user.

---

## 4. User Personas

### Persona 1: Rahul (Primary)

| Attribute | Detail |
|-----------|--------|
| **Age** | 28 |
| **Location** | Bangalore |
| **Role** | Software engineer, lives away from parents |
| **Family** | Parents (60+) in Jaipur, wife in Bangalore |
| **Tech comfort** | High — uses apps for everything |
| **Health situation** | Father has diabetes + hypertension (5 daily medicines), Mother has thyroid |
| **Current behavior** | Mom sends prescription photos on WhatsApp, he screenshots and forgets |
| **Pain point** | "When Dad was hospitalized, I couldn't tell the doctor what medicines he's on" |
| **Goal** | Track parents' medicines remotely, get alerts if they miss doses |
| **Device** | iPhone 15 (self), Redmi Note 12 (parents) |

### Persona 2: Priya (Secondary)

| Attribute | Detail |
|-----------|--------|
| **Age** | 33 |
| **Location** | Pune |
| **Role** | Stay-at-home mom, manages family health |
| **Family** | Husband, two kids (4 and 7), mother-in-law |
| **Tech comfort** | Medium — WhatsApp, Instagram, basic apps |
| **Health situation** | Kids have frequent pediatrician visits, vaccinations due. MIL has arthritis. |
| **Current behavior** | Keeps a plastic folder of prescriptions, often can't find the right one |
| **Pain point** | "I can never remember which vaccinations are done for which child" |
| **Goal** | One place for all family health records, vaccination tracking, reminders |
| **Device** | Samsung Galaxy A54 |

### Persona 3: Dr. Meena (Tertiary — Doctor side)

| Attribute | Detail |
|-----------|--------|
| **Age** | 45 |
| **Location** | Delhi |
| **Role** | General physician, private clinic |
| **Tech comfort** | Medium |
| **Pain point** | "Patients come with no history. I ask about past medicines, they don't know." |
| **Goal** | Quickly see patient's medication history and past reports without installing anything |
| **Interaction** | Scans QR code on patient's phone → sees organized health summary in browser |

---

## 5. User Stories

### 5.1 Authentication & Onboarding

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|-------------------|
| US-001 | As a new user, I want to sign up with my phone number so I don't need to remember a password | P0 | OTP sent within 10s, verified, account created. Support +91 numbers. |
| US-002 | As a new user, I want to add myself as the first family member during onboarding | P0 | Name (required), DOB, blood group, allergies collected. Can skip optional fields. |
| US-003 | As a returning user, I want to login automatically so I don't have to enter OTP every time | P0 | Session persists for 30 days. Biometric/PIN unlock option. |
| US-004 | As a user, I want to set a PIN lock on the app so my health data stays private | P1 | 4-digit PIN, biometric fallback, lock after 5 min inactivity. |

### 5.2 Family Management

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|-------------------|
| US-010 | As a user, I want to add family members so I can manage everyone's health in one app | P0 | Add name, relation, DOB, blood group, allergies, photo. Min: name + relation. |
| US-011 | As a user, I want to see all family members on the home screen for quick access | P0 | Horizontal scroll of member avatars. Tap to see their timeline. |
| US-012 | As a user, I want to edit a family member's profile when their info changes | P0 | All fields editable. Changes sync to cloud. |
| US-013 | As a user, I want to delete a family member and their records if needed | P1 | Soft delete with 30-day recovery. Confirmation dialog. "Are you sure?" |
| US-014 | As a user, I want to see each member's emergency info (blood group, allergies, medicines) at a glance | P1 | Emergency card view accessible in 2 taps from home. |

### 5.3 Health Records

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|-------------------|
| US-020 | As a user, I want to add a health record manually (type, title, date, doctor, notes, photo) | P0 | Record types: prescription, lab report, vaccination, bill, discharge summary, other. Photo attachment optional. |
| US-021 | As a user, I want to scan a prescription with my camera and have AI extract the details | P0 | Camera opens, captures image, sends to AI, returns structured data within 15s, user reviews and confirms. |
| US-022 | As a user, I want to view all records for a family member in chronological order | P0 | Timeline view with date headers. Most recent first. Filter by type. |
| US-023 | As a user, I want to search across all records by medicine name, doctor name, or diagnosis | P0 | Full-text search. Results show matching record with highlighted match. |
| US-024 | As a user, I want to tag records with custom labels for easy filtering | P1 | Add/remove tags. Filter by tag. Suggested tags: "important", "follow-up", "insurance". |
| US-025 | As a user, I want to view the original prescription photo alongside extracted data | P0 | Side-by-side or toggle view. Pinch to zoom on photo. |
| US-026 | As a user, I want to correct AI-extracted data when it makes mistakes | P0 | Editable fields. Corrections saved. "Was this extraction accurate?" feedback. |
| US-027 | As a user, I want to attach multiple photos to a single record (e.g., 3-page lab report) | P1 | Up to 10 images per record. Swipe through gallery. |

### 5.4 Medicine Reminders

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|-------------------|
| US-030 | As a user, I want medicine reminders auto-created when I scan a prescription | P1 | AI extraction creates reminder entries. User confirms time preferences. |
| US-031 | As a user, I want to receive push notifications for medicine reminders | P1 | Notification at set time. "Tap to mark as Taken / Skipped". Repeats if not acted on within 30min. |
| US-032 | As a user, I want to manually add medicine reminders without scanning | P1 | Medicine name, dosage, frequency (once/twice/thrice daily, weekly, custom), time, before/after food, duration. |
| US-033 | As a user, I want to see today's remaining reminders on the home screen | P0 | Today's reminders grouped by family member. Status: upcoming, taken, missed, skipped. |
| US-034 | As a user, I want to track medicine adherence over time | P1 | Weekly/monthly view. % adherence per medicine and per member. Visual calendar (green/red/gray). |
| US-035 | As a user, I want to be notified when a medicine course is ending | P1 | "Dad's Amlodipine course ends in 3 days. Refill or consult doctor?" |
| US-036 | As a user, I want to get notified if a family member misses their medicine | P2 | Optional per-member. "Dad missed his 8 AM medicine" notification to caretaker. |

### 5.5 QR Sharing with Doctors

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|-------------------|
| US-040 | As a user, I want to generate a QR code that lets a doctor view my family member's records | P1 | QR code generated in-app. Contains temporary secure URL. |
| US-041 | As a user, I want to choose which records to share (all or selected) | P1 | Checkbox selection. "Share all" toggle. Default: share all. |
| US-042 | As a user, I want the shared link to expire automatically | P1 | Default: 24 hours. Options: 1hr, 6hr, 24hr, 3 days, 7 days. |
| US-043 | As a doctor, I want to scan a QR code and see the patient's health summary in my browser without installing anything | P1 | Mobile-responsive web page. No login required. Shows: profile, active medicines, recent records, timeline. |
| US-044 | As a user, I want to see who accessed my shared records and when | P2 | Access log: timestamp, IP-based city (approximate), device type. |
| US-045 | As a user, I want to revoke a shared link before it expires | P1 | "Deactivate" button. Link returns "expired" page after deactivation. |

### 5.6 Emergency Card

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|-------------------|
| US-050 | As a user, I want a one-tap emergency card showing critical info for any family member | P1 | Blood group, allergies, current medicines, chronic conditions, emergency contacts. |
| US-051 | As a user, I want to call emergency contacts directly from the emergency card | P1 | Tap phone number → native dialer opens. |
| US-052 | As a user, I want to export the emergency card as an image or PDF | P2 | Download as PNG or PDF. Printable. Can set as phone wallpaper. |
| US-053 | As a user, I want to access the emergency card from the lock screen | P2 | Android widget or notification-style quick access. |

### 5.7 Health Insights

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|-------------------|
| US-060 | As a user, I want to manually log health metrics (BP, sugar, weight, temperature) | P2 | Input: value(s), date/time, notes. Validates ranges (e.g., BP systolic 60-250). |
| US-061 | As a user, I want to see health metrics as charts over time | P2 | Line chart for each metric. Filter by date range. Normal range overlay. |
| US-062 | As a user, I want to see total medical spending per family member | P2 | Sum of bills/costs from records. Monthly/yearly breakdown. Bar chart. |
| US-063 | As a user, I want monthly/yearly health summary for each family member | P2 | Total visits, medicines prescribed, money spent, upcoming due checkups. |

### 5.8 Offline & Sync

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|-------------------|
| US-070 | As a user, I want all my data available offline | P0 | All records, photos (thumbnails), reminders work without internet. |
| US-071 | As a user, I want my data to sync to the cloud when I'm online | P0 | Background sync. Conflict resolution: last-write-wins. Sync status indicator. |
| US-072 | As a user, I want to use the app on a new phone without losing data | P0 | Login on new device → full data restored from cloud. |
| US-073 | As a user, I want to export all my data as a ZIP file | P2 | JSON data + all images in organized folders. One-tap export. |

---

## 6. Functional Requirements

### 6.1 Authentication

| ID | Requirement | Details |
|----|------------|---------|
| FR-001 | Phone OTP authentication | Supabase Auth with SMS OTP. Indian +91 numbers. 6-digit OTP. 60s resend cooldown. 3 attempts max. |
| FR-002 | Session management | JWT tokens. 30-day refresh token. Auto-refresh access token. |
| FR-003 | PIN/Biometric lock | Optional 4-digit PIN. Fingerprint/Face ID support. Lock after 5min inactivity (configurable). |
| FR-004 | Account deletion | User can delete account + all data. 30-day grace period. GDPR-style compliance. |

### 6.2 AI Prescription Scanning

| ID | Requirement | Details |
|----|------------|---------|
| FR-010 | Image capture | expo-camera with flash toggle, auto-focus, grid overlay for alignment. |
| FR-011 | Image enhancement | Auto-crop to prescription boundaries. Contrast enhancement. Deskew rotation. |
| FR-012 | OCR processing | Tesseract.js for initial text extraction (runs locally). Handles Hindi + English. |
| FR-013 | AI structuring | Claude API (Haiku) receives OCR text + image. Returns structured JSON with doctor, medicines, diagnosis. |
| FR-014 | Medicine normalization | Map variations to standard names: "Crocin" → "Paracetamol 500mg (Crocin)". Database of 500+ common Indian medicines. |
| FR-015 | Review & correction UI | User sees extracted data in editable form. Can add/remove/modify medicines. Confirm to save. |
| FR-016 | Fallback handling | If AI extraction fails: save as photo-only record with manual entry option. Never lose the user's photo. |
| FR-017 | Accuracy feedback | "Was this extraction accurate?" → Yes/No. Misidentified fields tracked for improvement. |

### 6.3 Data Storage

| ID | Requirement | Details |
|----|------------|---------|
| FR-020 | Local database | WatermelonDB (SQLite wrapper). All data local-first. Lazy loading for performance. |
| FR-021 | Cloud database | Supabase PostgreSQL. Mumbai region (ap-south-1). Row Level Security enabled. |
| FR-022 | Image storage | Original images stored locally (full resolution) + Supabase Storage (compressed). Thumbnail generation. |
| FR-023 | Sync engine | WatermelonDB sync protocol. Pull/push on app foreground. Background sync every 15min when online. |
| FR-024 | Conflict resolution | Last-write-wins with timestamp. Server timestamp authoritative. |
| FR-025 | Data migration | Schema versioning via WatermelonDB migrations. Non-destructive upgrades. |

### 6.4 Notifications

| ID | Requirement | Details |
|----|------------|---------|
| FR-030 | Local notifications | expo-notifications for medicine reminders. Works offline. |
| FR-031 | Push notifications | Firebase FCM for remote triggers (family member missed medicine). |
| FR-032 | Notification actions | "Taken" / "Skipped" / "Snooze 30min" directly from notification. |
| FR-033 | Quiet hours | Default: 10 PM - 7 AM no notifications (configurable). |
| FR-034 | Family notifications | Optional: get notified when linked family member misses medicine. Requires both parties' consent. |

### 6.5 QR Sharing

| ID | Requirement | Details |
|----|------------|---------|
| FR-040 | QR generation | Generate QR code containing `https://medilog.app/share/{token}`. |
| FR-041 | Share web page | Server-rendered page showing patient health summary. Mobile responsive. No login needed. |
| FR-042 | Access control | Token-based. Expires based on user setting. Revocable. |
| FR-043 | Data scope | User selects: all records, or specific records/date range. |
| FR-044 | Access logging | Log each access: timestamp, approximate location (IP), device info. Show in app. |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Requirement | Target |
|------------|--------|
| App cold start | < 3 seconds on mid-range Android (Snapdragon 680) |
| Screen transitions | < 300ms |
| Record list scroll | 60 FPS, no jank with 500+ records |
| AI extraction time | < 15 seconds end-to-end (capture → structured data) |
| Search response | < 500ms for 1000+ records |
| Image load | Thumbnails < 200ms, full image < 1s |
| Sync cycle | < 30s for 100 new records |
| APK size | < 25 MB (initial download) |

### 7.2 Reliability

| Requirement | Target |
|------------|--------|
| App crash rate | < 1% of sessions |
| Data loss incidents | Zero — local + cloud redundancy |
| Sync failure recovery | Auto-retry with exponential backoff. Queue unsent data. |
| Offline capability | 100% of core features work offline (scan, record, remind) |
| Uptime (cloud services) | 99.5% (Supabase SLA) |

### 7.3 Scalability

| Requirement | Target |
|------------|--------|
| Users per Supabase instance | Up to 50,000 (free/pro tier) |
| Records per user | Tested up to 10,000 records |
| Family members per account | Up to 20 |
| Concurrent share link access | Up to 100 per link |
| Image storage per user | Up to 5 GB (compressed) |

### 7.4 Device Compatibility

| Requirement | Target |
|------------|--------|
| Android minimum | Android 8.0 (API 26) — covers 95% of Indian Android devices |
| iOS minimum | iOS 15.0 |
| RAM minimum | 2 GB |
| Storage requirement | 100 MB app + data (excluding user images) |
| Screen sizes | 5" to 7" phones. Tablet layout: stretch (not optimized for v1) |

### 7.5 Network

| Requirement | Target |
|------------|--------|
| Offline mode | Full functionality for all local operations |
| Low bandwidth | Sync works on 2G (compressed payloads, image queue) |
| Data usage | < 5 MB/day for typical sync usage |
| Background data | Configurable: WiFi-only sync option |

---

## 8. Information Architecture

### 8.1 Navigation Structure

```
Bottom Tab Navigation
├── Home (Dashboard)
│   ├── Quick Actions Bar
│   ├── Today's Reminders Widget
│   ├── Family Members Row
│   └── Recent Records
│
├── Family
│   ├── Member List
│   └── Member Detail
│       ├── Timeline
│       ├── Active Medicines
│       ├── Emergency Card
│       └── Share (QR)
│
├── Scan (Center FAB - Primary Action)
│   ├── Camera View
│   ├── Image Review
│   ├── AI Extraction Loading
│   └── Extraction Review & Save
│
├── Records
│   ├── All Records (filterable)
│   ├── Record Detail
│   └── Search
│
└── More
    ├── Reminders Management
    ├── Health Insights
    ├── Settings
    │   ├── Notifications
    │   ├── PIN/Biometric
    │   ├── Language
    │   ├── Sync & Backup
    │   └── Data Export
    ├── Shared Links
    └── Help & Feedback
```

### 8.2 Data Model Relationships

```
User (auth)
 └── has many → Members
      ├── has many → Records
      │    ├── has many → Medicines
      │    │    └── has many → Reminders
      │    │         └── has many → ReminderLogs
      │    └── has many → Images
      ├── has many → HealthMetrics
      └── has many → ShareLinks
           └── has many → AccessLogs
```

---

## 9. Wireframes & User Flows

### 9.1 Critical User Flow: Scan Prescription

```
[Home Screen]
     |
     | tap "Scan" FAB
     v
[Camera Screen]
  - Viewfinder with document boundary guide
  - Flash toggle, gallery picker
  - Capture button
     |
     | capture photo
     v
[Image Review]
  - Crop/rotate controls
  - "Retake" / "Use this photo"
     |
     | confirm photo
     v
[Select Family Member]
  - Quick member selector (avatars)
  - "Who is this prescription for?"
     |
     | select member
     v
[Processing Screen]
  - Animated loading: "Reading prescription..."
  - Progress: OCR → AI Analysis → Structuring
  - Takes 5-15 seconds
     |
     | extraction complete
     v
[Extraction Review]
  - Doctor name (editable)
  - Date (editable)
  - Diagnosis (editable)
  - Medicines list (add/edit/remove each)
    - Name, dosage, frequency, duration
  - Original photo (viewable)
  - "Create reminders for these medicines?" toggle
  - [Save Record] button
     |
     | save
     v
[Success Screen]
  - "Record saved for Dad"
  - "3 medicine reminders created"
  - [View Record] / [Scan Another] / [Go Home]
```

### 9.2 Critical User Flow: Share with Doctor

```
[Member Timeline]
     |
     | tap "Share with Doctor"
     v
[Share Configuration]
  - "What to share?"
    ○ All records
    ○ Selected records (checkboxes)
    ○ Date range
  - "Link expires in:"
    - 1 hour / 6 hours / 24 hours / 3 days / 7 days
  - [Generate QR Code]
     |
     | generate
     v
[QR Code Screen]
  - Large QR code (scannable)
  - Link text (copyable)
  - "Show this to your doctor"
  - [Share Link] button (native share sheet)
  - Link expiry countdown
     |
     | doctor scans QR
     v
[Doctor's Browser - Web View]
  - Patient name, age, blood group
  - Current medications (highlighted)
  - Allergies (red warning)
  - Health timeline (scrollable)
  - Record details (expandable)
  - Image viewer for prescriptions/reports
  - "Shared via MediLog" footer
```

### 9.3 Critical User Flow: Medicine Reminder

```
[Reminder Time Reached]
     |
     v
[Push Notification]
  "💊 Dad's Medicine - 8:00 AM"
  "Amlodipine 5mg - Before food"
  [Taken] [Skipped] [Snooze]
     |
     ├── tap "Taken" → logged, notification dismissed
     ├── tap "Skipped" → logged with "skipped" status, dismissed
     ├── tap "Snooze" → notification in 30 min
     └── no action after 30 min → second notification
          |
          └── no action after 60 min → marked as "missed"
               |
               └── (if enabled) family caretaker gets notification
                   "Dad missed his 8 AM medicine (Amlodipine)"
```

---

## 10. API Specifications

### 10.1 Supabase Edge Functions

#### POST `/functions/v1/extract-prescription`

Sends prescription image to Claude API for extraction.

**Request:**
```json
{
  "image_base64": "data:image/jpeg;base64,...",
  "ocr_text": "Dr. Sharma... Amlodipine 5mg...",
  "language_hint": "en"  // "en", "hi", "mixed"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "doctor": {
      "name": "Dr. R.K. Sharma",
      "specialization": "Cardiologist",
      "hospital": "Apollo Clinic",
      "registration_no": "MCI-12345"
    },
    "visit_date": "2026-03-15",
    "diagnosis": "Hypertension Stage 1",
    "medicines": [
      {
        "name": "Amlodipine",
        "brand": "Amlokind",
        "dosage": "5mg",
        "frequency": "Once daily",
        "timing": "Morning",
        "before_food": false,
        "duration": "30 days",
        "quantity": 30
      }
    ],
    "notes": "Review after 1 month. Reduce salt intake. Monitor BP weekly.",
    "follow_up_date": "2026-04-15",
    "confidence": 0.87
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "EXTRACTION_FAILED",
  "message": "Could not extract structured data from this image. Please add details manually.",
  "partial_data": {
    "ocr_text": "raw text that was extracted..."
  }
}
```

#### POST `/functions/v1/create-share`

Generates a temporary sharing link.

**Request:**
```json
{
  "member_id": "uuid",
  "record_ids": ["uuid1", "uuid2"],  // null = all records
  "expires_in_hours": 24
}
```

**Response:**
```json
{
  "token": "abc123xyz",
  "url": "https://medilog.app/share/abc123xyz",
  "expires_at": "2026-03-19T10:30:00Z"
}
```

#### GET `/functions/v1/share/{token}`

Returns shared health records for doctor view.

**Response:**
```json
{
  "member": {
    "name": "Rajesh Kumar",
    "age": 62,
    "gender": "Male",
    "blood_group": "B+",
    "allergies": ["Penicillin"],
    "chronic_conditions": ["Hypertension", "Type 2 Diabetes"]
  },
  "active_medicines": [...],
  "records": [...],
  "shared_by": "Rahul Kumar",
  "expires_at": "2026-03-19T10:30:00Z"
}
```

### 10.2 Claude API Prompt Template

```
You are a medical prescription extraction AI. Extract structured data from the following Indian medical prescription.

Input: OCR text and/or image of a prescription.

Rules:
1. Extract doctor name, specialization, hospital/clinic name
2. Extract each medicine with: name, dosage, frequency, duration, timing (before/after food)
3. Map brand names to generic names when possible (e.g., "Crocin" → "Paracetamol 500mg")
4. Extract diagnosis and doctor's notes
5. Identify follow-up date if mentioned
6. Handle Hindi text — transliterate to English where needed
7. If unsure about any field, set confidence < 0.5 for that field
8. Return valid JSON matching the specified schema

OCR Text: {ocr_text}

Respond with JSON only.
```

---

## 11. AI/ML Requirements

### 11.1 Prescription Extraction Pipeline

```
Stage 1: Image Pre-processing (On-device)
├── Auto-crop to document boundaries
├── Perspective correction (deskew)
├── Contrast enhancement
├── Resolution normalization (max 2000px width)
└── Output: Enhanced JPEG (< 500KB)

Stage 2: OCR (On-device)
├── Tesseract.js with Hindi + English language packs
├── Extract raw text with coordinates
└── Output: Raw text string

Stage 3: AI Structuring (Cloud - Claude API)
├── Input: Raw OCR text + compressed image (for visual context)
├── Model: Claude Haiku (fast, cheap — ~$0.001 per extraction)
├── Structured JSON extraction
├── Medicine name normalization
└── Output: Structured prescription data

Stage 4: Post-processing (On-device)
├── Validate against medicine database (500+ common Indian medicines)
├── Flag low-confidence fields for user review
├── Generate reminder suggestions from medicine data
└── Output: Final structured record ready for review
```

### 11.2 Accuracy Targets

| Category | Target | Measurement |
|----------|--------|-------------|
| Printed English prescriptions | >90% field accuracy | % fields correct without user edit |
| Printed Hindi prescriptions | >80% field accuracy | % fields correct without user edit |
| Handwritten English | >75% field accuracy | % fields correct without user edit |
| Handwritten Hindi | >65% field accuracy | % fields correct without user edit |
| Medicine name recognition | >85% | Correct generic/brand identification |
| Dosage extraction | >90% | Correct mg/ml/units parsing |

### 11.3 Cost Estimation

| Item | Cost per Unit | Monthly (1000 users, 5 scans/user) |
|------|--------------|-------------------------------------|
| Claude Haiku API | ~$0.001/extraction | $5 |
| Supabase (free tier) | $0 | $0 |
| Supabase (pro tier, if needed) | $25/month | $25 |
| Total | | $5 - $30/month |

---

## 12. Security & Privacy

### 12.1 Data Protection

| Requirement | Implementation |
|-------------|---------------|
| Encryption at rest | SQLite encryption (sqlcipher) on device. Supabase encrypts at rest. |
| Encryption in transit | HTTPS/TLS 1.3 for all API calls |
| Row Level Security | Supabase RLS: users can only access their own family's data |
| Image security | Prescription images stored in private Supabase buckets. Signed URLs with expiry. |
| API key protection | Claude API key stored in Supabase Edge Function env vars. Never exposed to client. |
| PIN/Biometric | App-level lock. Keychain/Keystore for credential storage. |

### 12.2 Privacy Compliance

| Requirement | Implementation |
|-------------|---------------|
| Data minimization | Only collect what's needed. No analytics on health data content. |
| User consent | Clear consent during onboarding. Explain what data is stored and where. |
| Right to deletion | Account deletion removes all data within 30 days (immediate soft delete). |
| Data export | User can export all data as ZIP (JSON + images). |
| Third-party sharing | Only Claude API sees prescription images (for extraction). No data sold or shared. |
| India IT Act compliance | Data stored in India (Supabase Mumbai). |
| DPDPA readiness | Consent mechanisms, data portability, deletion rights aligned with India's Digital Personal Data Protection Act. |

### 12.3 Share Link Security

| Requirement | Implementation |
|-------------|---------------|
| Token generation | Cryptographically random 32-byte token (URL-safe base64) |
| Expiry enforcement | Server-side check. Expired tokens return 410 Gone. |
| Rate limiting | Max 10 access attempts per token per hour (prevent enumeration) |
| No authentication bypass | Shared pages are read-only. No edit/delete actions possible. |
| Access logging | IP, timestamp, user-agent logged for each access |
| Revocation | Instant revocation by user. Token blacklisted server-side. |

---

## 13. Accessibility

| Requirement | Target |
|------------|--------|
| Font scaling | Support system font size (up to 200%) |
| Color contrast | WCAG AA (4.5:1 ratio minimum) |
| Screen reader | TalkBack (Android) / VoiceOver (iOS) support for all screens |
| Touch targets | Minimum 48x48dp for all interactive elements |
| Motion | Reduce motion option. No critical info conveyed only via animation. |
| Language | Hindi + English. Content auto-adapts to device language. |
| Elderly-friendly | Large text option in settings. High contrast mode. Simple navigation. |

---

## 14. Release Plan

### 14.1 MVP (v1.0) — Week 1-5

**Scope:**
- Phone OTP authentication
- Family member CRUD (add, edit, view, delete)
- Manual health record entry (all types)
- AI prescription scanning (printed English)
- Basic timeline view per member
- Local storage with cloud sync
- Basic medicine reminders (manual)

**Out of scope for MVP:**
- QR sharing
- Emergency card
- Health insights/charts
- Hindi OCR
- Handwritten prescription support
- Family notifications

### 14.2 v1.1 — Week 6-8

**Additions:**
- QR code doctor sharing
- Emergency card
- Auto-reminders from prescription scan
- Reminder adherence tracking
- Hindi printed prescription support
- Search across records

### 14.3 v1.2 — Week 9-12

**Additions:**
- Health metrics tracking (BP, sugar, weight)
- Health insights dashboard
- Spending tracker
- Handwritten prescription support (English + Hindi)
- Family member notifications (missed medicine)
- Data export (ZIP)
- Multi-language UI (Hindi)

### 14.4 v2.0 — Future

**Potential additions:**
- ABHA integration (India's national health ID)
- WhatsApp reminders
- Doctor directory integration
- Insurance claim helper
- Pharmacy price comparison
- Voice-based record entry for elderly
- Web dashboard for family overview
- Apple Watch / WearOS reminders

---

## 15. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| AI extraction accuracy too low for handwritten | High | Medium | Start with printed-only. Improve iteratively. Always allow manual correction. |
| Users don't scan — prefer manual entry | Medium | Medium | Make manual entry excellent. Scanning is a bonus, not a requirement. |
| Low retention after initial excitement | Medium | High | Reminders create daily engagement. Gamify adherence. Family features create network effect. |
| Supabase free tier limits hit | Low | Medium | Architecture supports self-hosted PostgreSQL migration. Monitor usage early. |
| Privacy concerns — health data sensitivity | Medium | High | Offline-first by default. Clear privacy policy. Data stored in India. Open source for trust. |
| Claude API cost scaling | Low | Low | Haiku is very cheap (~$0.001/scan). Rate limit per user (10 scans/day free). |
| Competition from Google/Apple Health | Low | High | They don't target Indian families. Our India-specific features (Hindi, Indian medicines, QR sharing) are moats. |
| Regulatory changes (India health data laws) | Medium | Medium | DPDPA-ready from day 1. Data portability built-in. |

---

## 16. Open Questions

| # | Question | Decision Needed By | Impact |
|---|----------|-------------------|--------|
| 1 | Should we support ABHA (Ayushman Bharat) integration in v1? | Before MVP | Scope — adds 2-3 weeks but increases credibility |
| 2 | Free tier limit: 3 or 5 family members? | Before MVP | Monetization vs adoption |
| 3 | Should prescription images be sent to Claude API directly, or only OCR text? | Before MVP | Accuracy vs cost vs privacy |
| 4 | Do we need a web app, or mobile-only for v1? | Before MVP | Development scope |
| 5 | Should doctor sharing page be hosted on our domain or Supabase? | Before v1.1 | Infrastructure cost |
| 6 | Do we build our own medicine database or use an existing one (e.g., 1mg API)? | Before MVP | Accuracy of medicine normalization |
| 7 | Should we support multi-device family sharing (e.g., both parents have the app)? | Before v1.2 | Requires complex sync and permission model |
| 8 | Monetization: freemium from day 1 or fully free initially? | Before launch | Revenue vs growth |

---

## Appendix A: Common Indian Medicine Database (Sample)

| Generic Name | Common Brands | Category |
|-------------|---------------|----------|
| Paracetamol 500mg | Crocin, Dolo 650, Calpol | Analgesic/Antipyretic |
| Azithromycin 500mg | Azithral, Zithromax, Azee | Antibiotic |
| Amlodipine 5mg | Amlokind, Amlong, Stamlo | Antihypertensive |
| Metformin 500mg | Glycomet, Glucophage, Obimet | Antidiabetic |
| Pantoprazole 40mg | Pan-D, Pantocid, Nexpro | Antacid |
| Cetirizine 10mg | Cetzine, Alerid, Okacet | Antihistamine |
| Atorvastatin 10mg | Atorva, Lipitor, Tonact | Statin |
| Montelukast 10mg | Montair, Singulair, Montek | Anti-asthma |
| Levothyroxine 50mcg | Thyronorm, Eltroxin, Thyrox | Thyroid |
| Rabeprazole 20mg | Razo, Rabeloc, Happi | Antacid |
| Telmisartan 40mg | Telma, Telmikind, Sartel | Antihypertensive |
| Glimepiride 1mg | Amaryl, Glimisave, Glimy | Antidiabetic |
| Losartan 50mg | Losar, Losacar, Repace | Antihypertensive |
| Aspirin 75mg | Ecosprin, Disprin, Loprin | Antiplatelet |
| Omeprazole 20mg | Omez, Ocid, Omesec | Antacid |

---

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| ABHA | Ayushman Bharat Health Account — India's national health ID system |
| DPDPA | Digital Personal Data Protection Act — India's data privacy law (2023) |
| OCR | Optical Character Recognition — converting images of text to machine-readable text |
| OTP | One-Time Password — used for phone-based authentication |
| PWA | Progressive Web App — web app with native app-like features |
| RLS | Row Level Security — Supabase feature to restrict database access per user |
| WatermelonDB | React Native database built on SQLite, designed for offline-first apps with sync |

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | March 18, 2026 | Sandeep | Initial PRD |
