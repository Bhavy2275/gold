<!--
Sync Impact Report:
- Version change: [CONSTITUTION_VERSION] -> 1.0.0
- List of modified principles: Initialized principles (I. Strict Discount Control, II. Real-time Weight-based Pricing, III. Secure OTP Authentication, IV. Client-Centric CRM & Tagging, V. Double-Portal Architecture)
- Added sections: Tech Stack & Architecture Constraints, Quality Gates & Code Standards
- Templates requiring updates: ✅ Updated .specify/memory/constitution.md
- Follow-up TODOs: None
-->
# Aurum POS & E-Commerce Constitution

## Core Principles

### I. Strict Discount Control (NON-NEGOTIABLE)
Employees cannot apply discounts higher than the admin-configured limit. Any sale exceeding the assigned threshold must be rejected at the API/business-logic layer, regardless of client-side overrides. Every transaction must log the employee ID, customer ID, requested discount, and final approved amount for auditing.

### II. Real-time Weight-based Pricing
Jewelry pricing is volatile and must be calculated dynamically. The formula is: `Total Price = (Weight in grams * Live Gold Rate/gram) + Making Charges + Stone Value + Taxes`. The base calculations and gold rate fetching must reside in a single, central utility module.

### III. Secure OTP Authentication
Every transaction completed by employees or checked out by customers requires a valid One-Time Password (OTP) verification before final database commit. This ensures double-opt-in consent, prevents unauthorized sales, and validates client credentials.

### IV. Client-Centric CRM & Tagging
Client data must be saved securely upon checkout. Employees must be able to categorize customers with tags (e.g., `VIP`, `Frequent Buyer`, `Wants Rings`, `Referred`). These tags will influence eligibility for special discounts, automatic notifications, or customized product recommendations.

### V. Double-Portal Architecture
The application must present two separate, secure user flows: a premium, aesthetic customer-facing catalog/checkout site and a high-performance, data-dense employee point-of-sale (POS) terminal. 

## Tech Stack & Architecture Constraints
- **Core Stack**: HTML, CSS, and Javascript.
- **Styling**: Vanilla CSS with modern custom properties for glassmorphism, gold gradients, and responsive grids. No Tailwind unless requested.
- **Routing & State**: Clean separation of state between client, employee, and admin views to prevent privilege escalation.

## Quality Gates & Code Standards
- **Testing**: All discount limits, price calculators, and OTP state transitions must have unit tests.
- **Access Control**: Admin configuration (like changing maximum employee discounts) must be separated from general employee capabilities.

## Governance
All new features, code changes, and code reviews must verify compliance with this constitution. Any amendments to this constitution require a documentation update, version bump, and migration plan if database schemas are affected.

**Version**: 1.0.0 | **Ratified**: 2026-05-23 | **Last Amended**: 2026-05-23
