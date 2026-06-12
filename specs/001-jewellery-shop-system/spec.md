# Feature Specification: Jewellery Shop POS & E-Commerce System

**Feature Branch**: `001-jewellery-shop-system`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "E-Commerce app for a jewellery shop used by both customers (catalog, dynamic price calculation, checkout, OTP verification, payment, CRM data saving) and employees (POS terminal, sales tracking, limited discount overrides controlled by admin limits, client tagging)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer Product Browsing & Shopping (Priority: P1)

Customers can browse the jewelry catalog, view dynamic pricing (automatically calculated using gold weight, live gold rate, and making charges), view detailed product views with high-quality images, and add items to a shopping cart.

**Why this priority**: This is the fundamental customer journey that drives traffic and catalog discovery.

**Independent Test**: A customer can successfully search, filter, select a jewelry item, and see it in their cart with the correct calculated price.

**Acceptance Scenarios**:

1. **Given** a customer is on the homepage, **When** they filter for "Rings", **Then** they see only ring items with their weight and calculated prices.
2. **Given** a customer is viewing a ring detail page, **When** today's live gold rate changes, **Then** the product's price updates instantly based on the weight.

---

### User Story 2 - Secure Customer Checkout with OTP (Priority: P1)

Customer adds checkout details (name, email, phone number) and proceeds to payment. They must verify their phone number via OTP to authorize and finalize the order.

**Why this priority**: Prevents fraudulent checkouts and validates customer contact data.

**Independent Test**: A customer inputs contact details, receives a verification OTP, enters it, and successfully places the order, saving their profile.

**Acceptance Scenarios**:

1. **Given** a customer is checking out, **When** they click "Send OTP", **Then** a 6-digit OTP is sent to their phone number.
2. **Given** they enter the correct OTP, **When** they click "Confirm", **Then** the order is successfully created and client data saved.

---

### User Story 3 - Employee Sales Portal with Strict Discount Limits (Priority: P2)

Employee logs in and makes a sale directly to an in-store customer. The employee inputs the customer details, chooses the product, and inputs a discount. The system enforces that the discount is below the admin-configured limit.

**Why this priority**: Allows employees to close in-store sales while protecting profit margins from excessive discounting.

**Independent Test**: Employee applies a 5% discount (under a 10% limit) and completes the checkout; applying a 15% discount fails.

**Acceptance Scenarios**:

1. **Given** an employee is creating a sale, **When** they input a discount of 8% (limit is 10%), **Then** the discount is applied, showing the updated price.
2. **Given** they input a discount of 12%, **When** they try to save, **Then** the system displays an error and blocks transaction completion.

---

### User Story 4 - Client CRM & Interaction Tagging (Priority: P2)

Employees can view a customer's profile, view their purchase history, and add/remove tags (e.g. "VIP", "Frequent Buyer", "Wants Rings") to categorize them.

**Why this priority**: Helps staff customize service and track customer preferences.

**Independent Test**: Employee opens a customer file, adds the tag "Frequent Buyer", and verifies that the tag is persisted and visible on the customer list.

**Acceptance Scenarios**:

1. **Given** an employee is on a customer details page, **When** they add the tag "VIP", **Then** the tag is immediately displayed in the customer's profile and persisted.

---

### User Story 5 - Admin Dashboard for Discount Limits & Employee Progress Tracking (Priority: P3)

Admins can view overall sales metrics, track individual employee sales totals and commission progress, and set/update the discount limits allowed for each employee or role.

**Why this priority**: Keeps management in control of margins and employee performance.

**Independent Test**: Admin updates employee discount limit to 8%, and employee portal immediately restricts discounts to 8%.

**Acceptance Scenarios**:

1. **Given** an admin is on the dashboard, **When** they view the "Employee Performance" tab, **Then** they see a chart showing each employee's total sales volume and active tags.

---

### Edge Cases

- **Out of stock during checkout**: If a customer or employee attempts to buy an item that just went out of stock, the transaction must be blocked with an informative error.
- **Incorrect/Expired OTP**: If the OTP is expired (longer than 5 minutes) or entered incorrectly 3 times, the OTP is invalidated, and a new one must be requested.
- **Bypassing client discount cap**: If a user attempts to bypass the client-side discount cap by editing frontend payloads, the backend/business-logic layer MUST validate the employee ID, cross-reference their max discount cap, and reject the transaction.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST calculate product pricing dynamically using the formula: `Total Price = (Weight in grams * Live Gold Rate/gram) + Making Charges + Stone Value + Taxes`.
- **FR-002**: The system MUST enforce employee discount limits at the business-logic layer, rejecting any transaction above the admin-configured cap.
- **FR-003**: The system MUST generate a 6-digit OTP for order confirmation and invalidate it after 5 minutes or upon successful verification.
- **FR-004**: The system MUST persist customer data (name, contact details, tags, purchase history) upon order finalization.
- **FR-005**: The system MUST track and display sales progress metrics (total sales, average discount applied) per employee.
- **FR-006**: The system MUST support multiple payment options (Card, Bank Transfer, Cash).
- **FR-007**: The system MUST support receipt generation/printing upon transaction completion.

### Key Entities

- **Product**: Represents a jewelry item. Attributes: ID, Name, Category, Weight (g), Base Making Charges, Stone Value, Stock Status.
- **Client**: Represents a customer. Attributes: ID, Name, Phone, Email, Purchase History, Tags.
- **Employee**: Represents a shop employee. Attributes: ID, Name, Role, Sales Total, Commission Earned, Allowed Discount Limit.
- **Transaction**: Represents a finalized sale. Attributes: ID, Client ID, Employee ID (optional), Product List, Live Gold Rate, Total Price, Discount Applied, Payment Method, OTP Verification Status, Timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Customers can browse catalog and complete a checkout in under 3 minutes.
- **SC-002**: System blocks 100% of unauthorized employee discount attempts at the business-logic layer.
- **SC-003**: OTP verification completes within 10 seconds of user input.
- **SC-004**: Employees can view client tagging updates in real-time (<1 second from edit to save).

## Assumptions

- Shop employees have access to a tablet or desktop browser connected to the local network/internet.
- Live gold price API feed is mockable or simulated if actual API connectivity is unavailable.
- High security for customer data; CRM data is stored securely.
- Mobile support for customer-facing site is required; employee portal is optimized for desktop and tablet screens.
