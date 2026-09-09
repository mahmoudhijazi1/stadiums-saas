# Business Requirements Document
## Stadium Management System

**Version:** 0.1 (Draft for review)
**Status:** Open for correction
**Document type:** Business Requirements — describes *what* the business needs and *why*, not how it will be built.

---

## 1. Purpose

This document defines the business needs for a subscription-based management system for football stadium owners in Lebanese villages and cities.

Each customer is a **stadium business owner** who currently runs his operation on pen and paper. The system gives him a simple back-office to manage bookings, collect money, run a small shop, track expenses, and later operate a football academy — plus a simple public page his players can use to see and request available slots.

The system is sold as a subscription to stadium owners. Each owner's business is completely separate from every other owner's business.

---

## 2. Background — the problem today

The stadium owner today operates as follows:

- **Reservations** arrive by WhatsApp or phone call and are written on a paper schedule. Conflicts, double-bookings, and forgotten reservations are common.
- **Payment collection** happens in cash after each game. A $30 game may be split across 10 players ($3 each), and is often paid in a mix of US Dollars and Lebanese Pounds — for example $20 cash plus 900,000 LBP.
- **The shop** (water, snacks, kits, shoes) has no record of what was bought, what is in stock, or what it earned.
- **Expenses** are remembered informally or not at all.
- **The result:** the owner has no reliable answer to the question *"how much did my business actually make this month?"*

He is not looking for software. He is looking to stop losing money and time. Any system that is slower or more confusing than his paper schedule will be abandoned within two weeks.

---

## 3. Goals and success criteria

### 3.1 Primary goal

Replace the paper schedule and the mental accounting with a system the owner uses **every single day, without hesitation**.

### 3.2 Success criteria

| # | Criterion |
|---|---|
| G-1 | Every owner-facing action is **faster than writing it on paper**. This outranks every other goal in this document. |
| G-2 | The owner can see, at any moment, what is booked today and what is still free. |
| G-3 | The owner can collect and record a mixed-currency payment in a few taps, without a calculator. |
| G-4 | The owner can answer "what did I earn this month?" from one screen. |
| G-5 | The owner stops using paper entirely within the first month. |
| G-6 | A player can see available slots and request one without phoning the owner. |

### 3.3 Explicit non-goal

The system is **not** intended to be impressive, feature-rich, or comprehensive. It is intended to be *used*. Where completeness and speed of use conflict, speed of use wins.

---

## 4. Users and roles

| Role | Who they are | What they need |
|---|---|---|
| **Owner** | The stadium business owner. The paying customer. | Full control of his business: schedule, approvals, money, shop, expenses, reports, staff. |
| **Staff** | A worker at the stadium (e.g. someone at the counter in the evening). | A reduced version of the owner's access. Can do daily work, cannot do everything. |
| **Player** | Someone who plays at the stadium. | See available slots, request a booking, know what he owes and that he paid. Usually has no account. |
| **Guardian** | Parent of an academy child. *(Later phase)* | See his child's schedule, attendance, and fees. |
| **Coach** | Academy coach. *(Later phase)* | See his groups, sessions, and attendance. |
| **Platform administrator** | The system provider (us). | Create owner accounts, manage subscriptions and plans. |

### 4.1 Key business rule about people

**Most people in the system will never have an account.**

The owner must be able to record ten players' names after a game in seconds. Requiring those ten people to register would kill the system on day one.

Therefore the system must clearly separate:
- **A person** — a human known to the stadium (a name and a phone number). Created by the owner in seconds, or automatically when someone requests a booking. No account, no password.
- **An account** — login credentials, used only by the few people who actually need to log in (owner, staff, and later some guardians).

A person may later gain an account. The same human must not become two separate records when that happens.

---

## 5. Scope

### 5.1 Phase 1 — MVP (build first)

- Stadium and pitch setup
- Booking: availability, requests, approvals, cancellations
- Payment collection, including mixed-currency and per-player splitting
- Expense recording
- Owner dashboard (basic financial picture)
- Public page per stadium
- Staff role
- Arabic and English, with full right-to-left support

### 5.2 Phase 2

- Shop: products, purchases, stock, sales, profit
- Player and guardian portal (own history, self-service)

### 5.3 Phase 3 — the strategic target

- **Football Academy:** age groups, coaches, academy players, monthly subscriptions, attendance, training sessions, fixtures, equipment, player assessments.

Bookings are how we win the customer. **The academy is the real business.** This phase must be ready before the next summer season.

### 5.4 Phase 4 — possible future

- Cross-stadium discovery / marketplace
- Automated WhatsApp messaging
- Online card payments

### 5.5 Explicitly out of scope (for now)

- Online payment of bookings by players
- Shopping cart and online ordering
- Sharing customer data between stadiums
- Translating content the owner writes himself

---

## 6. Business requirements

### 6.1 Stadium and pitch setup

| ID | Requirement | Phase |
|---|---|---|
| BR-1 | An owner's business may contain **more than one pitch** (e.g. a 5-a-side and a 7-a-side), and possibly more than one location. | 1 |
| BR-2 | Every booking belongs to a specific pitch. | 1 |
| BR-3 | Each pitch has its own weekly opening hours. | 1 |
| BR-4 | Each pitch has its own standard game length (e.g. 60 or 90 minutes). | 1 |
| BR-5 | Each pitch has its own price per game. Prices may differ by day or time (e.g. weekends cost more). | 1 |
| BR-6 | The owner can block a pitch for reasons other than a game — maintenance, a private event, or an academy session. Blocked time is not available for booking. | 1 |
| BR-7 | Games may run past midnight and the system must handle this correctly. | 1 |

### 6.2 Availability and the schedule

| ID | Requirement | Phase |
|---|---|---|
| BR-8 | The owner sees a clear daily schedule showing what is booked and what is free. | 1 |
| BR-9 | Today's schedule is the first thing the owner sees when he opens the system. | 1 |
| BR-10 | Available time slots are calculated from the pitch's opening hours and game length — the owner never creates empty slots by hand. | 1 |
| BR-11 | The owner can move or edit a booking (change time, pitch, or price). | 1 |
| BR-12 | All times are shown in local Lebanese time. | 1 |

### 6.3 Booking — creation and approval

| ID | Requirement | Phase |
|---|---|---|
| BR-13 | The owner can create a booking himself in a few taps (the phone-call case — the most common case). | 1 |
| BR-14 | A booking created by the owner is **confirmed immediately**. The owner does not approve his own bookings. | 1 |
| BR-15 | A player can request a slot from the public page. This creates a **pending request**, not a confirmed booking. | 1 |
| BR-16 | A booking request requires only a name and a phone number. No account, no password, no email. | 1 |
| BR-17 | The owner sees all pending requests, ordered by when they were received, so he knows who asked first. | 1 |
| BR-18 | The owner approves or rejects each request. Only approval confirms a booking. | 1 |
| BR-19 | **Several people may request the same slot at the same time.** A pending request does not reserve or hold the slot. | 1 |
| BR-20 | When the owner approves one request for a slot, all other pending requests for that same slot are automatically rejected. | 1 |
| BR-21 | Each automatically rejected request is remembered as an **interest** in that slot. | 1 |
| BR-22 | The owner can record that a booking did not happen (no-show), separately from a cancellation. | 1 |

### 6.4 Booking — the core rule

| ID | Requirement | Phase |
|---|---|---|
| BR-23 | **Two confirmed bookings can never overlap on the same pitch. There are no exceptions to this rule.** One pitch hosts one game at a time. | 1 |
| BR-24 | This rule must hold even if two approvals happen at the same moment. | 1 |
| BR-25 | Pending requests are *not* subject to this rule — many pending requests may overlap freely. | 1 |

### 6.5 Cancellation and the waiting list

| ID | Requirement | Phase |
|---|---|---|
| BR-26 | The owner can cancel a confirmed booking at any time. | 1 |
| BR-27 | Each stadium has its own cancellation policy — a number of hours before the game after which a player may no longer cancel (e.g. 24 hours). The owner sets this value. | 1 |
| BR-28 | The cancellation rule applies identically everywhere it appears in the system. | 1 |
| BR-29 | When a booking is cancelled, the freed slot shows the people who had previously shown interest in it. | 1 |
| BR-30 | The owner can notify those interested people with a single tap, using a ready-made message. | 1 |

### 6.6 Payment — the money model

| ID | Requirement | Phase |
|---|---|---|
| BR-31 | **The US Dollar is the accounting currency.** Every amount owed, every report, and every total is expressed in USD. | 1 |
| BR-32 | The Lebanese Pound is a **way of paying**, not a way of measuring. Amounts are never totalled in LBP across time. | 1 |
| BR-33 | A single payment may be made up of **several parts in different currencies** — for example $20 cash plus 900,000 LBP for one $30 game. | 1 |
| BR-34 | Each part of a payment records the exchange rate used at that moment, so past payments never change value when the rate changes later. | 1 |
| BR-35 | The exchange rate is **set by the owner**, not fetched automatically. He uses a rounded, real-world number (e.g. 90,000). | 1 |
| BR-36 | The current rate is visible in the app at all times and editable in one tap. | 1 |
| BR-37 | Changing the rate never alters payments already recorded. | 1 |
| BR-38 | When collecting, the owner sees the amount due, adds payment parts, and sees the **remaining amount** update live until it reaches zero. | 1 |
| BR-39 | The common case (one game, paid in full) must be collectable in about two taps. | 1 |
| BR-40 | Money amounts must always be exact. No rounding errors, ever. | 1 |

### 6.7 Payment — per-player collection

| ID | Requirement | Phase |
|---|---|---|
| BR-41 | A game's cost may be **split across the players** who played (e.g. $30 across 10 players = $3 each). | 1 |
| BR-42 | The owner can add players to a game by name and phone in seconds. | 1 |
| BR-43 | The owner can mark each player as paid individually, as they hand over the money. | 1 |
| BR-44 | Players may optionally be assigned to a team (Team A / Team B). | 1 |
| BR-45 | One person may pay for several players, or for the whole game. | 1 |
| BR-46 | The number of players who show up may differ from the number expected. The system must not block collection because of this. | 1 |
| BR-47 | If the sum of individual player amounts does not match the game price, the system shows a warning — it does not prevent the owner from continuing. | 1 |
| BR-48 | The owner can see, for any game, how much has been collected and how much is still outstanding. | 1 |
| BR-49 | The owner can see who still owes money across all games. | 1 |

### 6.8 Expenses

| ID | Requirement | Phase |
|---|---|---|
| BR-50 | The owner can record an expense in seconds: what it was, how much, and when. | 1 |
| BR-51 | Expenses can be categorised (e.g. electricity, water, maintenance, salaries, equipment). | 1 |
| BR-52 | Expenses can be paid in either currency, following the same rules as payments. | 1 |
| BR-53 | Expenses appear in the financial picture as money going out. | 1 |

### 6.9 Dashboard and reporting

| ID | Requirement | Phase |
|---|---|---|
| BR-54 | The owner sees a simple financial summary: money in, money out, and the difference, for a chosen period. | 1 |
| BR-55 | All figures are shown in USD. | 1 |
| BR-56 | The owner can choose to view figures converted to LBP, using a rate he selects for display. | 1 |
| BR-57 | The owner can see how many games were played in a period, and how busy each pitch was. | 1 |
| BR-58 | The owner can see outstanding (uncollected) money. | 1 |
| BR-59 | Reports must load quickly, even on a slow connection. | 1 |
| BR-60 | The dashboard shows shop profitability once the shop exists. | 2 |

### 6.10 The public page

| ID | Requirement | Phase |
|---|---|---|
| BR-61 | Each stadium has its **own public page**, at its own web address. | 1 |
| BR-62 | The page shows the stadium's name, location, contact details, and available slots. | 1 |
| BR-63 | A visitor can request a slot by entering a name and phone number. | 1 |
| BR-64 | **Stadiums are never shown alongside each other.** A visitor to one stadium's page never sees another stadium, its prices, or its slots. | 1 |
| BR-65 | The page must work well on a phone, on a weak connection. | 1 |
| BR-66 | The owner can display the page address as a QR code or link that he shares in WhatsApp groups. | 1 |
| BR-67 | The page shows products marked as publicly visible, with a WhatsApp link to order. | 2 |

**Reason for BR-64:** Showing competing stadiums to a customer's own players would turn the system into a competitor of the very people paying for it. In a village where owners know each other, this would end the business.

### 6.11 Notifications

| ID | Requirement | Phase |
|---|---|---|
| BR-68 | Notifications to players are sent through **WhatsApp**, because email and web notifications will not reach these users. | 1 |
| BR-69 | The system prepares the message; the owner sends it with a single tap. | 1 |
| BR-70 | The owner is notified inside the app when a new booking request arrives. | 1 |
| BR-71 | Message situations required: booking confirmed, booking rejected, booking cancelled, slot now available, payment reminder. | 1 |
| BR-72 | Fully automatic messaging may replace manual sending later, without changing how the owner works. | 4 |

### 6.12 Shop *(Phase 2)*

| ID | Requirement | Phase |
|---|---|---|
| BR-73 | The owner sells two kinds of goods: **consumables** (water, snacks — bought in boxes, sold by the unit) and **durables** (kits, shoes). | 2 |
| BR-74 | A product may have price variations (e.g. original vs copy) at different costs and prices. | 2 |
| BR-75 | Products with no variations must be as simple to create as possible — variations are an optional extra, not a required step. | 2 |
| BR-76 | Each product is marked as either **counter-only** (e.g. water) or **also shown publicly** (e.g. kits). | 2 |
| BR-77 | When recording a purchase, the owner enters the **cost of the whole lot** (e.g. 24 bottles for $6) and the system calculates the unit cost. | 2 |
| BR-78 | The system tracks stock quantity per product. | 2 |
| BR-79 | The owner can adjust stock manually, with a reason: spoilage, gift, theft, or stock count correction. | 2 |
| BR-80 | **A sale is never blocked because stock shows zero.** The system warns, but the owner is never stopped from taking money. | 2 |
| BR-81 | Each sale records the cost of the goods at the moment of sale, so profit can be calculated reliably later. | 2 |
| BR-82 | Shop sales are paid using the same payment rules as bookings, including mixed currency. | 2 |
| BR-83 | The owner can see profit by product and by category. | 2 |

### 6.13 Academy *(Phase 3 — the strategic target)*

| ID | Requirement | Phase |
|---|---|---|
| BR-84 | The academy is organised into **age groups** (e.g. U12, U14). | 3 |
| BR-85 | Each age group has one or more coaches. | 3 |
| BR-86 | Children are enrolled as academy players, linked to a guardian. | 3 |
| BR-87 | Academy players pay a **recurring subscription fee** (e.g. monthly). | 3 |
| BR-88 | The owner can see who has paid and who is late. | 3 |
| BR-89 | Training sessions are scheduled and **occupy the pitch**, so they cannot collide with bookings. | 3 |
| BR-90 | Attendance is recorded per session, quickly, for a whole group at once. | 3 |
| BR-91 | Coaches can record simple assessments of a player's performance over time. | 3 |
| BR-92 | Guardians can see their child's attendance, schedule, and fee status. | 3 |
| BR-93 | Academy equipment (balls, bibs, cones) can be tracked. | 3 |
| BR-94 | Fixtures and friendly matches can be scheduled. | 3 |
| BR-95 | A person who is an academy player may also book games and buy from the shop, as **one single person record** with one shared history. | 3 |

### 6.14 Access and permissions

| ID | Requirement | Phase |
|---|---|---|
| BR-96 | The owner has full access to his own business. | 1 |
| BR-97 | Staff have reduced access. Specifically, in the first version staff **cannot approve bookings**. | 1 |
| BR-98 | What staff can and cannot do must be adjustable without rebuilding the system. | 1 |
| BR-99 | Logging in is simple and does not require an email address the user does not have. | 1 |
| BR-100 | Users may log in by phone number confirmation in a later phase. | 2 |

### 6.15 Subscriptions and the platform

| ID | Requirement | Phase |
|---|---|---|
| BR-101 | Stadium owners pay a subscription to use the system. | 1 |
| BR-102 | Subscriptions are activated and managed manually at first — no card payments. | 1 |
| BR-103 | There may be several subscription plans with different limits or features. | 1 |
| BR-104 | The platform administrator can suspend a business that has not paid. | 1 |
| BR-105 | Pricing must reflect that a village stadium owner has limited spending power; the academy is expected to justify a higher price. | — |

---

## 7. Core business rules

These are the rules that must always hold, everywhere in the system.

| ID | Rule |
|---|---|
| **RULE-1** | One pitch hosts **one game at a time**. Two confirmed bookings never overlap. No exceptions. |
| **RULE-2** | A pending request does **not** hold or reserve a slot. Only approval does. |
| **RULE-3** | The owner's own bookings are confirmed immediately, without approval. |
| **RULE-4** | The **US Dollar is the unit of account**. The Lebanese Pound is only a means of payment. |
| **RULE-5** | A recorded payment never changes value later. The rate used is frozen at the moment of payment. |
| **RULE-6** | The exchange rate is chosen by the owner, never by the system. |
| **RULE-7** | Each stadium's data is completely separate from every other stadium's data. Nothing is ever shared between them. |
| **RULE-8** | The same phone number at two different stadiums represents two unrelated customers. Stadiums do not share customer lists. |
| **RULE-9** | The owner is **never blocked from taking money**, whatever the system believes about stock or amounts. |
| **RULE-10** | The system may warn the owner. It may not obstruct him. |
| **RULE-11** | Content written by the owner (pitch names, product names) is shown exactly as he wrote it, and is not translated. |
| **RULE-12** | Every owner-facing action must be faster than writing it on paper. |

---

## 8. Assumptions and constraints

| ID | Item |
|---|---|
| A-1 | Users are Arabic speakers. **Arabic is the primary language**, with full right-to-left layout. English is secondary. |
| A-2 | Numbers are displayed in Western digits (123), including in the Arabic interface. |
| A-3 | The owner uses the system on a phone, often standing outdoors, often in a hurry. |
| A-4 | Internet connections may be slow or intermittent. |
| A-5 | Electricity and connectivity in Lebanese villages are unreliable. |
| A-6 | The exchange rate changes frequently and is set informally in the real world. |
| A-7 | Players do not have and will not create accounts. |
| A-8 | Players use WhatsApp. They do not use email and will ignore browser notifications. |
| A-9 | The owner is not technical and will not read a manual. |
| A-10 | The system must run on a very low-cost server, with no noticeable delay for the user. |
| A-11 | The stadium owner does not accept card payments today; all money is cash. |
| A-12 | Some owners will want the system to feel like *their own* stadium's system, not a shared platform. |

---

## 9. Risks

| ID | Risk | Why it matters | Response |
|---|---|---|---|
| R-1 | **The owner does not enter his data and returns to paper.** | This is the end of the product. Every other risk is smaller. | Every action must beat paper. Test with a real owner during development. |
| R-2 | Village stadium owners cannot pay much. | The booking product alone may not sustain the business. | Bookings win the customer; the academy carries the revenue. |
| R-3 | Stock and cost figures drift from reality. | Once the owner stops trusting the numbers, he stops using the shop entirely. | Manual stock adjustments with reasons; never block a sale. |
| R-4 | Arabic layout problems are discovered by customers. | Damages trust immediately. | Arabic-first from day one, not translated at the end. |
| R-5 | Games crossing midnight are handled incorrectly. | Wrong schedule = wrong bookings = lost trust. | Handle and test this from the first version. |
| R-6 | The academy is designed too early and too rigidly. | Wasted work and a poor fit for the real need. | Keep it flexible; refine after one real season. |
| R-7 | Owners discover the system exposes them to competitors. | Ends the ability to sell to a second stadium in the same area. | Absolute separation between stadiums (RULE-7). |

---

## 10. Open questions

| ID | Question |
|---|---|
| Q-1 | What will a village stadium owner actually pay per month? |
| Q-2 | Should staff be able to collect payments, or only record bookings? |
| Q-3 | Should the owner be able to record a *partial* payment for a game and settle the rest later? (Assumed yes.) |
| Q-4 | Does the owner need to see today's schedule when the internet is down? |
| Q-5 | Should a player be able to cancel his own booking from the public page, or must he call the owner? |
| Q-6 | Are there discounts or special prices (regular customers, monthly deals)? |
| Q-7 | Does the owner need to record which staff member collected which payment? |
| Q-8 | For the academy: is the fee always monthly, or are there terms and seasons? |

---

## 11. Out of scope

The following are deliberately excluded and recorded here so they are not forgotten:

- A shared marketplace where players browse multiple stadiums *(may return in Phase 4)*
- Online card payment by players
- Shopping cart and online ordering
- Automatic exchange rate lookup
- Translation of owner-written content
- Sharing customer data between stadiums
- Supplier management as a full feature *(recorded as free text for now)*
- Barcode scanning in the shop

---

*End of document. Corrections welcome by requirement ID.*
