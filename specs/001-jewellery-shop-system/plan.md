# Implementation Plan: Jewellery Shop POS & E-Commerce System

**Branch**: `master` | **Date**: 2026-05-23 | **Spec**: [/specs/001-jewellery-shop-system/spec.md](file:///C:/Users/sonib/Desktop/gold/specs/001-jewellery-shop-system/spec.md)

**Input**: Feature specification from `/specs/001-jewellery-shop-system/spec.md`

## Summary
The goal is to implement a dual-portal jewelry shop web application. It combines a premium public e-commerce store with an interactive Point-of-Sale (POS) terminal for store staff. The design uses live weight-based pricing, enforces strict administrative discount caps on employee checkouts, requires client verification via OTP code alerts, and saves clients to a tagged CRM database.

We'll build this as a high-fidelity client-side Single-Page Application (SPA) utilizing Vanilla JS, CSS3 custom properties, and HTML5. State is persisted in `localStorage` to simulate backend DB storage.

## Technical Context

**Language/Version**: HTML5, CSS3, modern ES6 JavaScript.

**Primary Dependencies**: None (pure client-side vanilla app).

**Storage**: `localStorage` (simulated Database).

**Testing**: Self-contained Vanilla JS browser unit testing engine.

**Target Platform**: Desktop, Mobile, and Tablet Browsers.

**Project Type**: Web Application.

**Performance Goals**: Instant UI rendering (<100ms), dynamic pricing update calculations in real-time, CRM query search under 200ms.

**Constraints**: Local/offline capability (no external database server required).

**Scale/Scope**: 2 portals (Customer Front, Employee POS/Admin Back), 4 seed products, mock OTP alerts.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Gate 1: Discount Override Lock (I. Strict Discount Control)**:
  - *Requirement*: The database/logic layer must block any transaction with a discount exceeding the employee's cap.
  - *Verification*: A unit test will verify that passing an unauthorized discount to the transaction engine throws an exception and halts transaction logging.
  - *Status*: **PASSED** (Enforced in `js/repository.js`).

- **Gate 2: Weight Pricing Formula (II. Real-time Weight-based Pricing)**:
  - *Requirement*: Centralized formula calculations.
  - *Verification*: Verify that all UI elements render price by querying the same central pricing calculator helper.
  - *Status*: **PASSED** (Enforced in `js/repository.js`).

- **Gate 3: Double-Opt-In Order Auth (III. Secure OTP Authentication)**:
  - *Requirement*: OTP validation required before database commit.
  - *Verification*: Transaction save will fail if no active verified OTP flag is present for that session.
  - *Status*: **PASSED** (Enforced in `js/repository.js`).

- **Gate 4: Customer Tags (IV. Client-Centric CRM & Tagging)**:
  - *Requirement*: Tag lists must be queryable and persist with the customer profile.
  - *Status*: **PASSED**.

- **Gate 5: Distinct Portals (V. Double-Portal Architecture)**:
  - *Requirement*: Independent customer and staff interfaces.
  - *Status*: **PASSED**.

## Project Structure

### Documentation (this feature)

```text
specs/001-jewellery-shop-system/
├── plan.md              # This file
├── research.md          # Research findings (live gold rate, mock DB patterns)
├── data-model.md        # Database schema definitions & transitions
├── quickstart.md        # Launching and user credentials guide
├── contracts/
│   └── pricing-and-transactions.md  # API boundary contracts
└── checklists/
    └── requirements.md  # Specification Quality checklist (Passed)
```

### Source Code (repository root)

```text
C:\Users\sonib\Desktop\gold\
├── index.html           # Main SPA layout, views, and overlays
├── css/
│   └── styles.css       # Core design tokens, gradients, layout
└── js/
    ├── app.js           # Controller: routing, portal switching, cart UI, CRM events
    ├── repository.js    # Data Layer: central logic, discount cap enforcement, pricing engine
    └── tests.js         # Dynamic unit test suite runs in the browser
```

**Structure Decision**: Single project structure using standard separation of views within `index.html`, styled with CSS, and driven by clean ES6 controller/model separation.

## Complexity Tracking

*No constitutional checks have been violated; no complexity bypass is needed.*
