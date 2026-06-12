# Quickstart Guide: Jewellery Shop POS & E-Commerce

This project is built as a portable client-side web application using HTML5, CSS3, and Vanilla JavaScript. No external web server or database installation is required.

---

## Getting Started

### 1. Launch the Application
Simply open the `index.html` file in any modern web browser (Chrome, Edge, Firefox, or Safari):
* Locate the project root folder.
* Double-click `index.html` (or drag and drop it into your browser window).

---

## Default Access & Configurations

To test the dual-portal capabilities, use the following default codes:

### Employee POS Access
* **Access Code**: `gold123`
* **Default Employees**:
  - `emp-101`: **Rahul Sharma** (Sales Associate, Max Discount: **10%**)
  - `emp-102`: **Priya Patel** (Store Manager, Max Discount: **25%**)

### Admin Dashboard Access
* **Access Code**: `admin123`
* **Privileges**:
  - Adjust global gold price per gram.
  - Modify maximum employee discount limits.
  - Track employee sales totals, commission progress, and leaderboard.

---

## Seed Data

Upon opening the application for the first time, the `DataRepository` will automatically initialize your `localStorage` with the following default items:

### 1. Products Catalog
* **18K Gold Diamond Solitaire Ring** (Weight: `4.5g`, Making Charge: `$15/g`, Stone Value: `$800`, Stock: `5`)
* **22K Gold Classic Wedding Band** (Weight: `6.0g`, Making Charge: `$10/g`, Stone Value: `$0`, Stock: `8`)
* **18K Gold Emerald Drop Earrings** (Weight: `8.2g`, Making Charge: `$18/g`, Stone Value: `$1200`, Stock: `3`)
* **22K Gold Bridal Choker Necklace** (Weight: `24.0g`, Making Charge: `$12/g`, Stone Value: `$350`, Stock: `2`)

---

## Running the Unit Tests

The project includes a self-contained testing suite that verifies pricing engines, discount restrictions, and OTP state logic.

* **How to run**: Click the **"Run Unit Tests"** button located in the footer of the application.
* A popup overlay will run the Javascript test cases dynamically, verifying the math and security gates, and print a test report in real-time.
