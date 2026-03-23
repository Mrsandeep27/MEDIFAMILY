# MediLog - Family Health Record Manager

> India's first offline-first, AI-powered family health record manager. Scan prescriptions, track medicines, and share records with doctors — all from your browser.

**Live Demo:** [medi--log.vercel.app](https://medi--log.vercel.app)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)
![PWA](https://img.shields.io/badge/PWA-Installable-purple)

---

## The Problem

Every Indian family faces this:

- **Lost prescriptions** — paper prescriptions get lost within days
- **WhatsApp chaos** — medical reports scattered across family group chats
- **No history at new doctors** — "What medicines are you currently taking?" and you blank out
- **Elderly parents** — kids manage parents' health remotely but have zero organized records
- **Emergency panic** — in a hospital emergency, no one can find blood group, allergies, or past surgery details

**There is no simple, free, offline-first app** that lets an Indian family manage health records for every member in one place.

---

## The Solution

**MediLog** is a Progressive Web App (PWA) that turns your phone into a **digital health locker for your entire family.**

### How It Works

```
1. Add Family Members  →  Mom, Dad, Kids, Grandparents
2. Scan Prescriptions   →  Camera snaps → AI extracts medicines, dosages, doctor name
3. Store Everything      →  Prescriptions, lab reports, vaccination records, bills
4. Get Reminders         →  "Dad's BP medicine at 8 AM", "Mom's blood test on March 25"
5. Share with Doctors    →  Generate QR code → Doctor scans → sees full history (no login needed)
```

---

## Core Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Family Profiles** | Add unlimited family members with health details | Done |
| **AI Prescription Scanner** | Camera → OCR → Claude AI extraction (Hindi + English) | Phase 3 |
| **Document Vault** | Store prescriptions, lab reports, vaccinations, bills | Phase 2 |
| **Medicine Reminders** | Auto-created from scans, push notifications, adherence tracking | Phase 4 |
| **Health Timeline** | Chronological view of all medical events per member | Phase 2 |
| **Doctor Sharing (QR)** | Generate QR code, doctor sees history in browser — no login needed | Phase 5 |
| **Emergency Card** | One-tap access to blood group, allergies, medicines, emergency contacts | Done |
| **Health Insights** | BP, sugar, weight charts + spending tracker | Phase 5 |
| **Offline-First** | Everything works without internet (IndexedDB + cloud sync) | Done |
| **PIN Lock** | 4-digit PIN lock with auto-lock after inactivity | Done |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, TypeScript) |
| **Styling** | Tailwind CSS v4 + shadcn/ui |
| **State Management** | Zustand |
| **Local Database** | Dexie.js (IndexedDB) — offline-first |
| **Cloud Database** | Supabase PostgreSQL (Mumbai) + Prisma ORM |
| **Auth** | Custom JWT (bcrypt + httpOnly cookies) |
| **AI/OCR** | Google Gemini 2.0 Flash (free) + Tesseract.js |
| **Notifications** | Web Push API |
| **Forms** | React Hook Form + Zod |
| **PWA** | Web App Manifest + Service Workers |
| **Deployment** | Vercel |

---

---

## Development Phases

| Phase | Description | Duration |
|-------|------------|----------|
| **Phase 1** | Foundation + Auth + Family Profiles | Weeks 1-2 |
| **Phase 2** | Health Records + Timeline + Sync Engine | Weeks 3-4 |
| **Phase 3** | AI Prescription Scanner (Camera + OCR + Claude) | Weeks 5-6 |
| **Phase 4** | Medicine Reminders + Push Notifications | Weeks 7-8 |
| **Phase 5** | QR Sharing + Emergency Card + Health Insights | Weeks 9-10 |
| **Phase 6** | Multi-Language (Hindi) + PWA Polish + Launch | Weeks 11-12 |

---

## Target Users

| Segment | Pain Point |
|---------|------------|
| **Young professionals (25-35)** | Can't track what medicines parents are taking remotely |
| **Parents with young kids** | Forget which vaccines are done, lose vaccination cards |
| **Elderly care** | Multiple doctors, 5+ daily medicines, frequent tests |
| **Chronic patients** | Need to track long-term medication and reports |

---

## Competitive Advantage

| Feature | MediLog | Practo | Google Health | Others |
|---------|---------|--------|--------------|--------|
| Family-centric | Yes | No | No | No |
| AI prescription scan (Hindi+English) | Yes | No | No | Basic OCR |
| Offline-first | Yes | No | No | Some |
| QR sharing (no login) | Yes | No | No | No |
| India-focused | Yes | Partial | No | No |
| Free & Open Source | Yes | Paid | Discontinued | Ads-heavy |

---

## License

MIT License — Open Source

---

**Built with care for every Indian family.**
