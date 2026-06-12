/**
 * Unit Test Suite for Jewellery Shop POS & E-Commerce System.
 * Tests pricing logic, employee discount caps, OTP flows, CRM tagging, and admin configs.
 */

class TestRunner {
    constructor() {
        this.tests = [];
        this.results = [];
    }

    addTest(name, fn) {
        this.tests.push({ name, fn });
    }

    async runAll() {
        this.results = [];
        
        // Backup real safeLocalStorage
        const backup = {};
        const keys = ['jss_settings', 'jss_employees', 'jss_products', 'jss_transactions', 'jss_clients'];
        keys.forEach(k => {
            backup[k] = safeLocalStorage.getItem(k);
        });

        // Initialize repository for tests
        const repo = new DataRepository();
        const otp = new OTPService();

        for (const test of this.tests) {
            // Reset DB to clean seeded state before each test
            repo.resetDatabase();
            
            try {
                await test.fn(repo, otp);
                this.results.push({ name: test.name, passed: true, error: null });
            } catch (err) {
                this.results.push({ name: test.name, passed: false, error: err.message });
            }
        }

        // Restore real safeLocalStorage
        keys.forEach(k => {
            if (backup[k] === null) {
                safeLocalStorage.removeItem(k);
            } else {
                safeLocalStorage.setItem(k, backup[k]);
            }
        });

        return this.results;
    }
}

const suite = new TestRunner();

// --- Phase 3 / US1 Tests: Pricing & Cart ---
suite.addTest('US1: Dynamic Pricing calculation follows weight-based formula', async (repo) => {
    // Product 1: 4.5g weight, 600/g making, 25000 stone value
    const goldRate = 7500.00; // default rate in INR (₹)
    const taxRate = 3.00; // default GST tax rate in India
    const product = repo.getProductById('prod-001');
    
    const calculatedPrice = repo.calculateItemPrice(product, goldRate);
    // Formula: (4.5 * 7500) + (4.5 * 600) + 25000 = 33750 + 2700 + 25000 = 61450
    if (calculatedPrice !== 61450.00) {
        throw new Error(`Pricing formula failure. Expected 61450.00, got ${calculatedPrice}`);
    }
});

suite.addTest('US1: Cart calculations aggregate sums and apply correct tax', async (repo) => {
    // Cart with 1 item of prod-001 (61450) and 2 items of prod-002 (6.0g weight, 400/g making, 0 stone = (6*7500) + (6*400) = 47400)
    // Subtotal: 61450 * 1 + 47400 * 2 = 61450 + 94800 = 156250
    // Tax: 3% of 156250 = 4687.5
    // Total: 156250 + 4687.5 = 160937.5
    const cartItems = [
        { productId: 'prod-001', quantity: 1 },
        { productId: 'prod-002', quantity: 2 }
    ];

    const totals = repo.calculateCartTotals(cartItems, 0);
    if (totals.subtotal !== 156250.00) {
        throw new Error(`Subtotal mismatch. Expected 156250, got ${totals.subtotal}`);
    }
    if (totals.taxAmount !== 4687.50) {
        throw new Error(`Tax calculation mismatch. Expected 4687.5, got ${totals.taxAmount}`);
    }
    if (totals.totalAmount !== 160937.50) {
        throw new Error(`Total amount mismatch. Expected 160937.5, got ${totals.totalAmount}`);
    }
});

// --- Phase 4 / US2 Tests: Checkout, Inventory, & OTP ---
suite.addTest('US2: Successful OTP verification allows order and decrements stock', async (repo, otp) => {
    const phone = '9999999999';
    
    // 1. Request OTP
    const code = otp.generateOTP(phone);
    if (!code || code.length !== 6) {
        throw new Error(`OTP generation failed. Generated code: ${code}`);
    }

    // 2. Verify OTP
    const isVerified = otp.verifyOTP(phone, code);
    if (!isVerified) {
        throw new Error('OTP verification returned false for valid code.');
    }

    // 3. Process checkout
    const initialStock = repo.getProductById('prod-001').stockCount;
    const payload = {
        clientId: phone,
        clientName: 'Jane Doe',
        clientEmail: 'jane@example.com',
        employeeId: null, // direct customer
        items: [{ productId: 'prod-001', quantity: 1 }],
        discountApplied: 0,
        paymentMethod: 'UPI'
    };

    const tx = repo.createTransaction(payload);
    if (!tx || !tx.id.startsWith('INV-')) {
        throw new Error('Transaction creation failed.');
    }

    const finalStock = repo.getProductById('prod-001').stockCount;
    if (finalStock !== initialStock - 1) {
        throw new Error(`Stock count not decremented. Expected ${initialStock - 1}, got ${finalStock}`);
    }
});

suite.addTest('US2: Expired or exhausted OTP fails verification', async (repo, otp) => {
    const phone = '9999999999';
    otp.generateOTP(phone);

    // Fail 3 times should lock out and throw error
    try {
        otp.verifyOTP(phone, '000000');
        otp.verifyOTP(phone, '111111');
        otp.verifyOTP(phone, '222222');
        throw new Error('Should have locked out after 3 failed attempts.');
    } catch (err) {
        if (!err.message.includes('Too many incorrect attempts')) {
            throw new Error(`Unexpected error message on lock out: ${err.message}`);
        }
    }

    // Attempting valid code now should fail as it was consumed/locked
    const record = otp.activeOTPs.get(phone);
    if (record) {
        throw new Error('OTP record should have been deleted from activeOTPs after lock out.');
    }
});

suite.addTest('US2: Out of stock checkout is blocked', async (repo) => {
    const payload = {
        clientId: '9876543210',
        clientName: 'Rahul Kumar',
        employeeId: null,
        items: [{ productId: 'prod-001', quantity: 10 }], // only 5 available
        discountApplied: 0,
        paymentMethod: 'UPI'
    };

    try {
        repo.createTransaction(payload);
        throw new Error('Expected transaction to fail due to insufficient stock.');
    } catch (err) {
        if (!err.message.includes('out of stock')) {
            throw new Error(`Unexpected validation error message: ${err.message}`);
        }
    }
});

// --- Phase 5 / US3 Tests: Employee POS and Discount limits ---
suite.addTest('US3: Employee discount under limit succeeds; exceeding limit is blocked', async (repo) => {
    // Employee emp-101 has 10% limit
    const validPayload = {
        clientId: '9876543210',
        clientName: 'Rahul Kumar',
        employeeId: 'emp-101',
        items: [{ productId: 'prod-001', quantity: 1 }],
        discountApplied: 5.0, // under 10%
        paymentMethod: 'Cash'
    };

    const invalidPayload = {
        clientId: '9876543210',
        clientName: 'Rahul Kumar',
        employeeId: 'emp-101',
        items: [{ productId: 'prod-001', quantity: 1 }],
        discountApplied: 15.0, // exceeds 10%
        paymentMethod: 'Cash'
    };

    // Should succeed
    const tx = repo.createTransaction(validPayload);
    if (tx.discountApplied !== 5.0) {
        throw new Error('Discount not applied correctly in transaction.');
    }

    // Should fail
    try {
        repo.createTransaction(invalidPayload);
        throw new Error('Expected transaction to fail due to discount exceeding employee limit.');
    } catch (err) {
        if (!err.message.includes('Discount exceeds employee limit')) {
            throw new Error(`Unexpected validation error message: ${err.message}`);
        }
    }
});

// --- Phase 6 / US4 Tests: CRM Client Tagging ---
suite.addTest('US4: Client tagging adds, sanitizes, and prevents duplicate tags', async (repo) => {
    const phone = '9876543210';
    
    // Update tags
    repo.updateClientTags(phone, ['VIP', ' VIP ', 'Wants Rings!', 'New-Buyer']);
    
    const client = repo.getClientByPhone(phone);
    
    // ' VIP ' should be trimmed to 'VIP', duplicates removed.
    // 'Wants Rings!' has special characters '!' and should be skipped.
    // 'New-Buyer' is valid.
    const expectedTags = ['VIP', 'New-Buyer'];
    if (client.tags.length !== expectedTags.length || !expectedTags.every(t => client.tags.includes(t))) {
        throw new Error(`Tag serialization mismatch. Got tags: ${JSON.stringify(client.tags)}`);
    }
});

// --- Phase 7 / US5 Tests: Admin adjustments ---
suite.addTest('US5: Admin gold rate update recalculates product pricing', async (repo) => {
    // Change rate to 8000
    repo.updateGoldRate(8000.00, 'admin123');
    
    const product = repo.getProductById('prod-001'); // 4.5g weight, 600/g making, 25000 stone
    const newPrice = repo.calculateItemPrice(product, 8000.00);
    // Formula: (4.5 * 8000) + (4.5 * 600) + 25000 = 36000 + 2700 + 25000 = 63700
    if (newPrice !== 63700.00) {
        throw new Error(`Price update recalculation failure. Expected 63700.00, got ${newPrice}`);
    }
});

suite.addTest('US5: Unauthorized Admin gold rate update is blocked', async (repo) => {
    try {
        repo.updateGoldRate(100.00, 'wrong_pass');
        throw new Error('Expected rate update to fail due to incorrect admin password.');
    } catch (err) {
        if (!err.message.includes('Invalid admin password')) {
            throw new Error(`Unexpected error message: ${err.message}`);
        }
    }
});

// --- Phase 9: Admin Management (Users & Products) ---
suite.addTest('US6: Admin can add and remove employee profiles, unauthorized requests are blocked', async (repo) => {
    // 1. Success path for adding employee
    const newEmpData = {
        name: 'John Doe',
        role: 'Sales Associate',
        maxDiscountLimit: 15.0
    };
    const emp = repo.addEmployee(newEmpData, 'admin123');
    if (!emp.id || emp.name !== 'John Doe' || emp.role !== 'Sales Associate' || emp.maxDiscountLimit !== 15.0) {
        throw new Error('addEmployee did not return correct employee object.');
    }
    
    // Check they are in employees database
    const employees = repo.getEmployees();
    const found = employees.find(e => e.id === emp.id);
    if (!found) {
        throw new Error('Employee not saved to database.');
    }

    // 2. Unauthorized adding is blocked
    try {
        repo.addEmployee(newEmpData, 'wrong_admin_pass');
        throw new Error('Expected addEmployee to fail with wrong passcode.');
    } catch (err) {
        if (!err.message.includes('Invalid admin password')) {
            throw new Error(`Unexpected error message: ${err.message}`);
        }
    }

    // 3. Unauthorized removing is blocked
    try {
        repo.removeEmployee(emp.id, 'wrong_admin_pass');
        throw new Error('Expected removeEmployee to fail with wrong passcode.');
    } catch (err) {
        if (!err.message.includes('Invalid admin password')) {
            throw new Error(`Unexpected error message: ${err.message}`);
        }
    }

    // 4. Success path for removing employee
    const removeResult = repo.removeEmployee(emp.id, 'admin123');
    if (!removeResult.success || removeResult.id !== emp.id) {
        throw new Error('removeEmployee did not return success structure.');
    }
    const employeesAfterRemove = repo.getEmployees();
    if (employeesAfterRemove.some(e => e.id === emp.id)) {
        throw new Error('Employee was not removed from database.');
    }

    // 5. Deleting last remaining employee is blocked
    // The default setup starts with 2 employees (Rahul and Priya).
    // Let's delete Priya first, leaving only Rahul.
    const p1 = employeesAfterRemove[0]; // emp-101 (Rahul Sharma)
    const p2 = employeesAfterRemove[1]; // emp-102 (Priya Patel)
    repo.removeEmployee(p2.id, 'admin123');
    
    // Now trying to delete Rahul should fail
    try {
        repo.removeEmployee(p1.id, 'admin123');
        throw new Error('Expected removeEmployee to fail when deleting the last remaining employee.');
    } catch (err) {
        if (!err.message.includes('Cannot delete the last remaining staff user')) {
            throw new Error(`Unexpected error message: ${err.message}`);
        }
    }
});

suite.addTest('US7: Admin can add, modify, and delete product catalog entries, unauthorized requests are blocked', async (repo) => {
    // 1. Success path for adding product
    const newProdData = {
        name: '22K Gold Bangles',
        category: 'Bracelets',
        weightGrams: 10.5,
        makingChargePerGram: 450.0,
        stoneValue: 5000.0,
        imageUrl: 'https://images.unsplash.com/photo-test',
        stockCount: 5
    };
    
    const prod = repo.addProduct(newProdData, 'admin123');
    if (!prod.id || prod.name !== '22K Gold Bangles' || prod.category !== 'Bracelets' || prod.weightGrams !== 10.5) {
        throw new Error('addProduct did not return correct product object.');
    }

    // Check they are in database
    const products = repo.getProducts();
    const found = products.find(p => p.id === prod.id);
    if (!found) {
        throw new Error('Product not saved to database.');
    }

    // 2. Pricing recalculates immediately
    const price = repo.calculateItemPrice(prod, 7500.00); // 7500 gold rate
    // Formula: (10.5 * 7500) + (10.5 * 450) + 5000 = 78750 + 4725 + 5000 = 88475
    if (price !== 88475.00) {
        throw new Error(`Product pricing calculation mismatch. Expected 88475, got ${price}`);
    }

    // 3. Unauthorized add is blocked
    try {
        repo.addProduct(newProdData, 'wrong_pass');
        throw new Error('Expected addProduct to fail with wrong passcode.');
    } catch (err) {
        if (!err.message.includes('Invalid admin password')) {
            throw new Error(`Unexpected error: ${err.message}`);
        }
    }

    // 4. Success path for updateProduct
    const updatedProdData = {
        name: 'Updated Gold Bangles',
        category: 'Bracelets',
        weightGrams: 12.0,
        makingChargePerGram: 500.0,
        stoneValue: 6000.0,
        imageUrl: 'https://images.unsplash.com/photo-test',
        stockCount: 8
    };

    const updated = repo.updateProduct(prod.id, updatedProdData, 'admin123');
    if (updated.name !== 'Updated Gold Bangles' || updated.weightGrams !== 12.0 || updated.stockCount !== 8) {
        throw new Error('updateProduct did not update properties correctly.');
    }

    // Pricing recalculates immediately for updated product
    const updatedPrice = repo.calculateItemPrice(updated, 7500.00);
    // Formula: (12.0 * 7500) + (12.0 * 500) + 6000 = 90000 + 6000 + 6000 = 102000
    if (updatedPrice !== 102000.00) {
        throw new Error(`Updated pricing calculation mismatch. Expected 102000, got ${updatedPrice}`);
    }

    // 5. Unauthorized update is blocked
    try {
        repo.updateProduct(prod.id, updatedProdData, 'wrong_pass');
        throw new Error('Expected updateProduct to fail with wrong passcode.');
    } catch (err) {
        if (!err.message.includes('Invalid admin password')) {
            throw new Error(`Unexpected error: ${err.message}`);
        }
    }

    // 6. Unauthorized delete is blocked
    try {
        repo.deleteProduct(prod.id, 'wrong_pass');
        throw new Error('Expected deleteProduct to fail with wrong passcode.');
    } catch (err) {
        if (!err.message.includes('Invalid admin password')) {
            throw new Error(`Unexpected error: ${err.message}`);
        }
    }

    // 7. Success path for deleteProduct
    const deleteResult = repo.deleteProduct(prod.id, 'admin123');
    if (!deleteResult.success || deleteResult.id !== prod.id) {
        throw new Error('deleteProduct did not return success structure.');
    }
    const productsAfterDelete = repo.getProducts();
    if (productsAfterDelete.some(p => p.id === prod.id)) {
        throw new Error('Product was not removed from database.');
    }
});

// --- Phase 10: Customer Bargaining & Owner Approval Tests ---
suite.addTest('US8: Customer bargain proposal saves client details in CRM and creates a pending deal in database', async (repo) => {
    const clientDetails = { name: 'Aarav Mehta', phone: '9123456789', email: 'aarav@example.com' };
    const items = [{ productId: 'prod-001', quantity: 1 }];
    const proposedPrice = 50000.0;
    
    const deal = repo.createDeal(clientDetails, items, proposedPrice);
    
    // Verify deal was created and stored
    if (!deal || deal.status !== 'Pending Approval' || deal.proposedPrice !== proposedPrice) {
        throw new Error(`Deal creation failed. Deal properties mismatch.`);
    }
    
    const storedDeals = repo.getDeals();
    if (!storedDeals.some(d => d.id === deal.id)) {
        throw new Error('Deal was not persisted in database.');
    }
    
    // Verify customer saved in CRM
    const client = repo.getClientByPhone('9123456789');
    if (!client || client.name !== 'Aarav Mehta') {
        throw new Error('Customer was not saved in the CRM database.');
    }
    
    // Verify customer tag is 'Bargain Pending'
    if (!client.tags.includes('Bargain Pending')) {
        throw new Error(`Customer CRM tag not saved as "Bargain Pending". Current tags: ${JSON.stringify(client.tags)}`);
    }
});

suite.addTest('US8: Owner can approve or reject a deal with valid passcode, and updates CRM tags', async (repo) => {
    const clientDetails = { name: 'Aarav Mehta', phone: '9123456789', email: 'aarav@example.com' };
    const items = [{ productId: 'prod-001', quantity: 1 }];
    const proposedPrice = 50000.0;
    const deal = repo.createDeal(clientDetails, items, proposedPrice);

    // 1. Unauthorized attempt is blocked
    try {
        repo.updateDealStatus(deal.id, 'Approved', 'wrong_pass');
        throw new Error('Expected updateDealStatus to fail with incorrect passcode.');
    } catch (err) {
        if (!err.message.includes('Invalid owner password')) {
            throw new Error(`Unexpected error message: ${err.message}`);
        }
    }

    // 2. Success path for Approval
    const approvedDeal = repo.updateDealStatus(deal.id, 'Approved', 'owner123');
    if (approvedDeal.status !== 'Approved') {
        throw new Error('Deal status was not updated to Approved.');
    }

    // Check customer tags updated
    const client = repo.getClientByPhone('9123456789');
    if (!client.tags.includes('Bargain Approved') || client.tags.includes('Bargain Pending')) {
        throw new Error(`Client tags not updated correctly. Current tags: ${JSON.stringify(client.tags)}`);
    }
});

suite.addTest('US8: Finalizing an approved deal creates transaction and decrements stock', async (repo) => {
    const clientDetails = { name: 'Aarav Mehta', phone: '9123456789', email: 'aarav@example.com' };
    const items = [{ productId: 'prod-001', quantity: 1 }];
    const proposedPrice = 50000.0;
    
    const deal = repo.createDeal(clientDetails, items, proposedPrice);
    repo.updateDealStatus(deal.id, 'Approved', 'owner123');

    const initialStock = repo.getProductById('prod-001').stockCount;
    const initialSales = repo.getEmployeeById('emp-101').salesTotal;

    // Finalize the deal under employee emp-101
    const tx = repo.finalizeApprovedDeal(deal.id, 'Card', 'emp-101');
    
    if (!tx || tx.totalAmount !== proposedPrice) {
        throw new Error(`Transaction total does not match negotiated price. Expected ${proposedPrice}, got ${tx.totalAmount}`);
    }

    if (tx.employeeId !== 'emp-101' || tx.employeeName !== 'Rahul Sharma') {
        throw new Error(`Employee attribution failed. Expected emp-101 (Rahul Sharma), got ${tx.employeeId} (${tx.employeeName})`);
    }

    // Check salesperson sales volume updated
    const updatedSales = repo.getEmployeeById('emp-101').salesTotal;
    if (updatedSales !== initialSales + proposedPrice) {
        throw new Error(`Salesperson sales volume not updated correctly. Expected ${initialSales + proposedPrice}, got ${updatedSales}`);
    }

    // Check stock decremented
    const finalStock = repo.getProductById('prod-001').stockCount;
    if (finalStock !== initialStock - 1) {
        throw new Error(`Stock not decremented. Expected ${initialStock - 1}, got ${finalStock}`);
    }

    // Check deal status is Completed
    const storedDeal = repo.getDeals().find(d => d.id === deal.id);
    if (storedDeal.status !== 'Completed') {
        throw new Error(`Deal status not marked as Completed. Got ${storedDeal.status}`);
    }
});
