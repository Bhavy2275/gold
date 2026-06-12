# API & Contract Definitions: Jewellery Shop POS & E-Commerce

Since this is a client-side Web Application with mock persistence, the following API contracts represent the boundaries of the `DataRepository` and `AuthService` JavaScript interfaces.

---

## 1. Settings Service

### `getSettings()`
Fetches current global rates and taxes.

* **Response Schema**:
```json
{
  "liveGoldRatePerGram": 85.00,
  "defaultTaxRate": 18.00,
  "adminPassword": "admin123",
  "employeePassword": "gold123"
}
```

### `updateGoldRate(newRate, adminPassword)`
Updates the live gold rate (Admin privileges required).

* **Parameters**:
  - `newRate`: Number
  - `adminPassword`: String
* **Validation**: Throws an error if `adminPassword` does not match the stored admin password.

---

## 2. Authentication & OTP Service

### `requestOTP(phoneNumber)`
Generates and registers a temporary 6-digit OTP code valid for 5 minutes.

* **Parameters**:
  - `phoneNumber`: String (10-digit number)
* **Behavior**: Simulates an SMS delivery by triggering a visible UI Notification Toast containing the generated code.

### `verifyOTP(phoneNumber, code)`
Verifies the submitted OTP code.

* **Parameters**:
  - `phoneNumber`: String
  - `code`: String (6 digits)
* **Response**: Boolean (`true` if valid and verified, `false` otherwise)

---

## 3. Transaction Service

### `createTransaction(payload)`
Submits a checkout request from the Customer Cart or the Employee POS.

* **Request Payload**:
```json
{
  "clientId": "9876543210",
  "clientName": "John Doe",
  "clientEmail": "john@example.com",
  "employeeId": "emp-101", // null for direct customer e-commerce checkout
  "items": [
    {
      "productId": "prod-001",
      "quantity": 1
    }
  ],
  "discountApplied": 5.00, // percentage
  "paymentMethod": "Card"
}
```

* **Validation Rules (Core Logic)**:
  1. If `employeeId` is provided:
     - Verify `employeeId` exists.
     - Verify `discountApplied` does not exceed the Employee's `maxDiscountLimit`. If exceeded, throw a **Validation Error: "Discount exceeds employee limit."**
  2. For each item:
     - Verify stock is available (`stockCount >= quantity`). If not, throw **Validation Error: "Item out of stock."**
     - Fetch product weight, stone value, making charges, and calculate price using today's gold rate.
  3. Verify payment details are complete.

* **Database Updates (Transaction Save)**:
  - Deduct quantity from `Product.stockCount`.
  - Create `Client` record (or update if already existing, appending new transaction).
  - Add transaction total to `Employee.salesTotal` and calculate commission.
  - Save invoice record in `Transaction` history.

---

## 4. CRM Client Service

### `updateClientTags(phoneNumber, tags)`
Updates the classification tags associated with a specific customer profile.

* **Parameters**:
  - `phoneNumber`: String
  - `tags`: Array of Strings
* **Response**: Updated Client Object.
