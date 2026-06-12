# Research Report: Jewellery Shop POS & E-Commerce System

## Technical Decisions

### 1. Architectural Pattern: Single-Page Application (SPA) with Dual-Portal Routing
* **Decision**: Implement the application as a unified HTML5, CSS3, and modern ES6 JavaScript Single-Page Application. Secure client-side routing will switch between the Customer E-Commerce catalog and the Employee/Admin POS portal.
* **Rationale**: Keeps the application lightweight, fully offline-capable, and simple to run on any computer (just open `index.html`). Separation of views is handled via modular component state, with access codes protecting the Employee ("gold123") and Admin ("admin123") interfaces.
* **Alternatives Considered**: 
  - *Multi-Page App (MPA)*: Rejected because passing dynamic cart state, mock database state, and live gold rate updates between multiple physical pages would require heavy localStorage sync and result in clunky page transitions.

### 2. State & Database Layer: LocalStorage Repository Pattern
* **Decision**: Centralize all data access in a `DataRepository` class that interfaces with `window.localStorage`.
* **Rationale**: Simulates a persistent database. It allows products, clients, employee sales totals, and admin discount caps to persist across page refreshes, providing a highly realistic experience for demonstrating features.
* **Alternatives Considered**:
  - *In-memory state only*: Rejected because refreshing the page would wipe all clients, transaction history, and employee progress, breaking the core workflow.
  - *SQLite/PostgreSQL*: Rejected as it introduces heavy backend setup and installation overhead for the user.

### 3. Dynamic Jewelry Price Engine
* **Decision**: Implement a core `PriceCalculator` service. Every product price displayed in the catalog or checkout will call:
  `TotalPrice = (Weight * LiveGoldRate) + MakingCharges + StoneValue + Taxes`
  The live gold rate is stored in the database repository and can be simulated/updated in real-time.
* **Rationale**: Enforces mathematical consistency across both the Customer Catalog and the Employee checkout, satisfying Core Principle II.
* **Alternatives Considered**:
  - *Hardcoded static pricing*: Rejected, as it violates the live gold rate recalculation constraint.

### 4. Limited Discount Control Enforcement
* **Decision**: Embed the discount validation inside the transaction commit logic in `DataRepository`. If an employee tries to submit a transaction payload with a discount greater than their allowed limit, the repository will throw an error and block the write.
* **Rationale**: Satisfies Core Principle I by enforcing discount security at the logic layer, preventing any client-side UI tampering from submitting illegal transactions.
* **Alternatives Considered**:
  - *UI-only input limits*: Rejected because developers or users could bypass UI inputs via console commands.

### 5. Simulated SMS/Email OTP Verification Gateway
* **Decision**: Create an `OTPService` that generates 6-digit random codes. Since there is no real SMS gateway, the OTP will be displayed in an on-screen modal alert ("SMS simulator toast"), which the user must copy and enter into the confirmation screen.
* **Rationale**: Demonstrates the checkout verification flow seamlessly without requiring third-party API keys or internet dependencies.
* **Alternatives Considered**:
  - *No OTP, direct checkout*: Rejected, as it violates Core Principle III (Double-Opt-In Transactions).
