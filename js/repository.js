/**
 * DataRepository: Handles all data storage and retrieval in safeLocalStorage,
 * as well as core business rules, price calculations, and transaction processing.
 */
// Safe storage fallbacks for file:// protocol browser security blocks
const _global = typeof window !== 'undefined' ? window : global;
_global.safeLocalStorage = (() => {
    try {
        localStorage.setItem('__test_ls__', '1');
        localStorage.removeItem('__test_ls__');
        return localStorage;
    } catch (e) {
        console.warn('localStorage is blocked or unavailable. Falling back to in-memory storage.', e);
        const store = {};
        return {
            getItem(key) { return store.hasOwnProperty(key) ? store[key] : null; },
            setItem(key, value) { store[key] = String(value); },
            removeItem(key) { delete store[key]; },
            clear() { for (const key in store) delete store[key]; }
        };
    }
})();

_global.safeSessionStorage = (() => {
    try {
        sessionStorage.setItem('__test_ss__', '1');
        sessionStorage.removeItem('__test_ss__');
        return sessionStorage;
    } catch (e) {
        console.warn('sessionStorage is blocked or unavailable. Falling back to in-memory storage.', e);
        const store = {};
        return {
            getItem(key) { return store.hasOwnProperty(key) ? store[key] : null; },
            setItem(key, value) { store[key] = String(value); },
            removeItem(key) { delete store[key]; },
            clear() { for (const key in store) delete store[key]; }
        };
    }
})();

class DataRepository {
    constructor() {
        this.initDatabase();
    }

    initDatabase() {
        // Default settings
        let settings = safeLocalStorage.getItem('jss_settings');
        if (!settings) {
            const defaultSettings = {
                liveGoldRatePerGram: 7500.00, // in INR (₹)
                defaultTaxRate: 3.00, // 3% GST on gold jewelry in India
                adminPassword: 'admin123',
                employeePassword: 'gold123',
                ownerPassword: 'owner123'
            };
            safeLocalStorage.setItem('jss_settings', JSON.stringify(defaultSettings));
        } else {
            // Ensure ownerPassword exists
            try {
                const parsed = JSON.parse(settings);
                if (!parsed.ownerPassword) {
                    parsed.ownerPassword = 'owner123';
                    safeLocalStorage.setItem('jss_settings', JSON.stringify(parsed));
                }
            } catch (e) {
                console.error("Error patching jss_settings", e);
            }
        }

        // Default employees
        const existingEmp = safeLocalStorage.getItem('jss_employees');
        if (!existingEmp) {
            const defaultEmployees = [
                {
                    id: 'emp-101',
                    name: 'Rahul Sharma',
                    role: 'Sales Associate',
                    pin: '1234',
                    maxDiscountLimit: 10.00, // 10%
                    salesTotal: 0.00,
                    commissionEarned: 0.00
                },
                {
                    id: 'emp-102',
                    name: 'Priya Patel',
                    role: 'Store Manager',
                    pin: '5678',
                    maxDiscountLimit: 25.00, // 25%
                    salesTotal: 0.00,
                    commissionEarned: 0.00
                }
            ];
            safeLocalStorage.setItem('jss_employees', JSON.stringify(defaultEmployees));
        } else {
            // Ensure pin exists on existing employees in localStorage
            try {
                const emps = JSON.parse(existingEmp);
                let changed = false;
                emps.forEach((emp, idx) => {
                    if (!emp.pin) {
                        emp.pin = idx === 0 ? '1234' : (idx === 1 ? '5678' : `123${idx}`);
                        changed = true;
                    }
                });
                if (changed) {
                    safeLocalStorage.setItem('jss_employees', JSON.stringify(emps));
                }
            } catch (e) {
                console.error("Error patching employee PINs", e);
            }
        }

        // Default products
        if (!safeLocalStorage.getItem('jss_products')) {
            const defaultProducts = [
                {
                    id: 'prod-001',
                    name: '18K Gold Diamond Solitaire Ring',
                    category: 'Rings',
                    weightGrams: 4.5,
                    makingChargePerGram: 600.0,
                    stoneValue: 25000.0,
                    imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=400&q=80',
                    stockCount: 5
                },
                {
                    id: 'prod-002',
                    name: '22K Gold Classic Wedding Band',
                    category: 'Rings',
                    weightGrams: 6.0,
                    makingChargePerGram: 400.0,
                    stoneValue: 0.0,
                    imageUrl: 'https://images.unsplash.com/photo-1598560917505-59a3ad559071?auto=format&fit=crop&w=400&q=80',
                    stockCount: 8
                },
                {
                    id: 'prod-003',
                    name: '18K Gold Emerald Drop Earrings',
                    category: 'Earrings',
                    weightGrams: 8.2,
                    makingChargePerGram: 700.0,
                    stoneValue: 35000.0,
                    imageUrl: 'https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=400&q=80',
                    stockCount: 3
                },
                {
                    id: 'prod-004',
                    name: '22K Gold Bridal Choker Necklace',
                    category: 'Necklaces',
                    weightGrams: 24.0,
                    makingChargePerGram: 500.0,
                    stoneValue: 12000.0,
                    imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80',
                    stockCount: 2
                }
            ];
            safeLocalStorage.setItem('jss_products', JSON.stringify(defaultProducts));
        }

        // Transactions list - seed with realistic purchase/sale records for price history (#9)
        const existingTx = safeLocalStorage.getItem('jss_transactions');
        if (!existingTx || JSON.parse(existingTx).length === 0) {
            const seedTx = [
                {
                    id: 'INV-20260521-0001',
                    timestamp: new Date('2026-05-21T11:30:00Z').toISOString(),
                    clientId: '9876543210',
                    clientName: 'Karan Johar',
                    clientEmail: 'karan@example.com',
                    employeeId: 'EMP001',
                    employeeName: 'Rahul Verma',
                    items: [
                        {
                            productId: 'PROD-22K-BRCLT',
                            name: '22K Gold Traditional Kada Bracelet',
                            quantity: 1,
                            liveRate: 7150,
                            weightGrams: 28.5,
                            price: 218550
                        }
                    ],
                    subtotal: 218550,
                    discountApplied: 0,
                    discountAmount: 0,
                    taxRate: 3,
                    taxAmount: 6556.50,
                    totalAmount: 225106.50,
                    paymentMethod: 'Split (Cash: ₹1,00,000 + Card: ₹1,25,106.50)'
                },
                {
                    id: 'INV-20260522-0002',
                    timestamp: new Date('2026-05-22T14:15:00Z').toISOString(),
                    clientId: '9876543211',
                    clientName: 'Priya Sharma',
                    clientEmail: 'priya@example.com',
                    employeeId: 'EMP002',
                    employeeName: 'Ananya Sharma',
                    items: [
                        {
                            productId: 'PROD-18K-RING',
                            name: '18K Diamond Solitaire Engagement Ring',
                            quantity: 1,
                            liveRate: 7200,
                            weightGrams: 4.8,
                            price: 66560
                        }
                    ],
                    subtotal: 66560,
                    discountApplied: 2,
                    discountAmount: 1331.20,
                    taxRate: 3,
                    taxAmount: 1956.86,
                    totalAmount: 67185.66,
                    paymentMethod: 'UPI'
                },
                {
                    id: 'INV-20260523-0003',
                    timestamp: new Date('2026-05-23T16:45:00Z').toISOString(),
                    clientId: '9876543212',
                    clientName: 'Amit Patel',
                    clientEmail: 'amit@example.com',
                    employeeId: 'EMP001',
                    employeeName: 'Rahul Verma',
                    items: [
                        {
                            productId: 'PROD-22K-NCKL',
                            name: '22K Temple Heritage Gold Necklace',
                            quantity: 1,
                            liveRate: 7250,
                            weightGrams: 45.2,
                            price: 357080
                        }
                    ],
                    subtotal: 357080,
                    discountApplied: 0,
                    discountAmount: 0,
                    taxRate: 3,
                    taxAmount: 10712.40,
                    totalAmount: 367792.40,
                    paymentMethod: 'Card'
                }
            ];
            safeLocalStorage.setItem('jss_transactions', JSON.stringify(seedTx));
        }

        // Clients CRM list
        if (!safeLocalStorage.getItem('jss_clients')) {
            const defaultClients = [
                {
                    id: '9876543210',
                    name: 'Karan Johar',
                    email: 'karan@example.com',
                    phone: '9876543210',
                    tags: ['VIP'],
                    createdDate: new Date('2026-05-20').toISOString()
                }
            ];
            safeLocalStorage.setItem('jss_clients', JSON.stringify(defaultClients));
        }

        // Deals list for Bargaining
        if (!safeLocalStorage.getItem('jss_deals')) {
            safeLocalStorage.setItem('jss_deals', JSON.stringify([]));
        }
    }

    // --- Settings Methods ---
    getSettings() {
        return JSON.parse(safeLocalStorage.getItem('jss_settings'));
    }

    updateGoldRate(newRate, adminPassword) {
        const settings = this.getSettings();
        if (adminPassword !== settings.adminPassword) {
            throw new Error('Authentication Error: Invalid admin password.');
        }
        if (typeof newRate !== 'number' || newRate <= 0) {
            throw new Error('Validation Error: Gold rate must be a positive number.');
        }
        settings.liveGoldRatePerGram = newRate;
        safeLocalStorage.setItem('jss_settings', JSON.stringify(settings));
        return settings;
    }

    updateEmployeeDiscountLimit(employeeId, newLimit, adminPassword) {
        const settings = this.getSettings();
        if (adminPassword !== settings.adminPassword) {
            throw new Error('Authentication Error: Invalid admin password.');
        }
        if (typeof newLimit !== 'number' || newLimit < 0 || newLimit > 100) {
            throw new Error('Validation Error: Discount limit must be between 0% and 100%.');
        }
        const employees = this.getEmployees();
        const empIndex = employees.findIndex(e => e.id === employeeId);
        if (empIndex === -1) {
            throw new Error('Employee Not Found.');
        }
        employees[empIndex].maxDiscountLimit = newLimit;
        safeLocalStorage.setItem('jss_employees', JSON.stringify(employees));
        return employees[empIndex];
    }

    // --- Employee Methods ---
    getEmployees() {
        return JSON.parse(safeLocalStorage.getItem('jss_employees'));
    }

    getEmployeeById(id) {
        const employees = this.getEmployees();
        return employees.find(e => e.id === id) || null;
    }

    // --- Product Methods ---
    getProducts() {
        return JSON.parse(safeLocalStorage.getItem('jss_products'));
    }

    getProductById(id) {
        const products = this.getProducts();
        return products.find(p => p.id === id) || null;
    }

    updateProductStock(id, newStock) {
        const products = this.getProducts();
        const pIndex = products.findIndex(p => p.id === id);
        if (pIndex === -1) throw new Error('Product not found');
        if (newStock < 0) throw new Error('Stock cannot be negative');
        products[pIndex].stockCount = newStock;
        safeLocalStorage.setItem('jss_products', JSON.stringify(products));
    }

    // --- Client CRM Methods ---
    getClients() {
        return JSON.parse(safeLocalStorage.getItem('jss_clients'));
    }

    getClientByPhone(phone) {
        const clients = this.getClients();
        return clients.find(c => c.phone === phone) || null;
    }

    saveClient(clientData) {
        const clients = this.getClients();
        const phone = clientData.phone.trim();
        
        // Validate phone format: 10 digits
        if (!/^\d{10}$/.test(phone)) {
            throw new Error('Validation Error: Phone number must be exactly 10 digits.');
        }

        // Validate email format
        if (clientData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientData.email)) {
            throw new Error('Validation Error: Invalid email format.');
        }

        let client = clients.find(c => c.phone === phone);
        if (client) {
            client.name = clientData.name;
            client.email = clientData.email;
            // keep existing tags unless explicitly specified
            if (clientData.tags) {
                client.tags = [...new Set(clientData.tags)];
            }
        } else {
            client = {
                id: phone,
                name: clientData.name,
                email: clientData.email || '',
                phone: phone,
                tags: clientData.tags || [],
                createdDate: new Date().toISOString()
            };
            clients.push(client);
        }
        safeLocalStorage.setItem('jss_clients', JSON.stringify(clients));
        return client;
    }

    updateClientTags(phone, tags) {
        const clients = this.getClients();
        const clientIndex = clients.findIndex(c => c.phone === phone);
        if (clientIndex === -1) {
            throw new Error('Client Not Found.');
        }
        
        // Sanitize tags (no special characters except space/hyphen, unique)
        const sanitizedTags = tags
            .map(t => t.trim())
            .filter(t => t.length > 0 && /^[a-zA-Z0-9\s-]+$/.test(t));
        
        clients[clientIndex].tags = [...new Set(sanitizedTags)];
        safeLocalStorage.setItem('jss_clients', JSON.stringify(clients));
        return clients[clientIndex];
    }

    // --- Pricing Engine ---
    calculateItemPrice(product, liveRate) {
        if (!product) return 0;
        // Formula: Price = (Weight * Live Gold Rate) + (Making Charge) + Stone Value
        const goldCost = product.weightGrams * liveRate;
        let makingCost = 0;
        if (product.makingChargeType === 'percent') {
            makingCost = goldCost * (product.makingChargePerGram / 100);
        } else {
            makingCost = product.weightGrams * (product.makingChargePerGram || 0);
        }
        return goldCost + makingCost + (product.stoneValue || 0);
    }

    calculateCartTotals(cartItems, discountApplied = 0) {
        const settings = this.getSettings();
        const liveRate = settings.liveGoldRatePerGram;
        const taxRate = settings.defaultTaxRate;

        let subtotal = 0;
        const items = cartItems.map(item => {
            const product = this.getProductById(item.productId);
            if (!product) throw new Error(`Product not found: ${item.productId}`);
            const itemPrice = this.calculateItemPrice(product, liveRate);
            const linePrice = itemPrice * item.quantity;
            subtotal += linePrice;

            return {
                productId: product.id,
                name: product.name,
                weightGrams: product.weightGrams,
                quantity: item.quantity,
                liveRate: liveRate,
                price: itemPrice // unit price before discount
            };
        });

        const discountAmount = subtotal * (discountApplied / 100);
        const subtotalAfterDiscount = subtotal - discountAmount;
        const taxAmount = subtotalAfterDiscount * (taxRate / 100);
        const totalAmount = subtotalAfterDiscount + taxAmount;

        return {
            items,
            subtotal,
            discountApplied,
            discountAmount,
            taxRate,
            taxAmount,
            totalAmount
        };
    }

    // --- Transaction Engine ---
    createTransaction(payload) {
        const {
            clientId, // phone number
            clientName,
            clientEmail,
            employeeId, // null for online checkout
            items, // array of { productId, quantity }
            discountApplied, // percentage (0 - 100)
            paymentMethod
        } = payload;

        // 1. Basic Validations
        if (!clientId || !clientName) {
            throw new Error('Validation Error: Client Name and Phone are required.');
        }
        if (!items || items.length === 0) {
            throw new Error('Validation Error: Transaction cart cannot be empty.');
        }
        if (discountApplied < 0 || discountApplied > 100) {
            throw new Error('Validation Error: Discount must be between 0% and 100%.');
        }
        if (!['Card', 'Cash', 'UPI'].includes(paymentMethod)) {
            throw new Error('Validation Error: Invalid payment method.');
        }

        // 2. Employee Validation & Discount Cap check (Core Principle I)
        let employee = null;
        if (employeeId) {
            employee = this.getEmployeeById(employeeId);
            if (!employee) {
                throw new Error('Validation Error: Specified employee does not exist.');
            }
            if (discountApplied > employee.maxDiscountLimit) {
                throw new Error(`Validation Error: Discount exceeds employee limit. (Max allowed: ${employee.maxDiscountLimit}%)`);
            }
        } else {
            // E-commerce checkout cannot apply employee discount
            if (discountApplied > 0) {
                throw new Error('Validation Error: Customer direct checkouts cannot have manual discounts.');
            }
        }

        // 3. Stock Verification & Price Fetching
        const settings = this.getSettings();
        const liveRate = settings.liveGoldRatePerGram;
        
        for (const item of items) {
            const product = this.getProductById(item.productId);
            if (!product) {
                throw new Error(`Validation Error: Product ${item.productId} not found.`);
            }
            if (product.stockCount < item.quantity) {
                throw new Error(`Validation Error: Item "${product.name}" is out of stock. (Requested: ${item.quantity}, Available: ${product.stockCount})`);
            }
        }

        // 4. Calculate Totals
        const totals = this.calculateCartTotals(items, discountApplied);

        // 5. Decrement Stock
        for (const item of items) {
            const product = this.getProductById(item.productId);
            this.updateProductStock(product.id, product.stockCount - item.quantity);
        }

        // 6. Save/Update Client in CRM
        const client = this.saveClient({
            name: clientName,
            email: clientEmail,
            phone: clientId
        });

        // 7. Update Employee Sales Progress
        if (employee) {
            const employees = this.getEmployees();
            const empIndex = employees.findIndex(e => e.id === employeeId);
            employees[empIndex].salesTotal += totals.totalAmount;
            
            // Commission calculation: e.g., 2% of the sales volume for sales associate, 5% for manager
            const commRate = employee.role === 'Store Manager' ? 0.05 : 0.02;
            employees[empIndex].commissionEarned += totals.totalAmount * commRate;
            safeLocalStorage.setItem('jss_employees', JSON.stringify(employees));
        }

        // 8. Commit Transaction to History
        const transactions = JSON.parse(safeLocalStorage.getItem('jss_transactions'));
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
        const invNum = `INV-${dateStr}-${String(transactions.length + 1).padStart(4, '0')}`;

        const transactionRecord = {
            id: invNum,
            clientId: client.phone,
            clientName: client.name,
            employeeId: employeeId || null,
            employeeName: employee ? employee.name : null,
            items: totals.items,
            subtotal: totals.subtotal,
            discountApplied: totals.discountApplied,
            discountAmount: totals.discountAmount,
            taxRate: totals.taxRate,
            taxAmount: totals.taxAmount,
            totalAmount: totals.totalAmount,
            paymentMethod: paymentMethod,
            timestamp: new Date().toISOString()
        };

        transactions.push(transactionRecord);
        safeLocalStorage.setItem('jss_transactions', JSON.stringify(transactions));

        return transactionRecord;
    }

    getTransactions() {
        return JSON.parse(safeLocalStorage.getItem('jss_transactions'));
    }

    // --- Admin-only Employee CRUD (Core User Management) ---
    addEmployee(employeeData, adminPassword) {
        const settings = this.getSettings();
        if (adminPassword !== settings.adminPassword) {
            throw new Error('Authentication Error: Invalid admin password.');
        }

        const name = (employeeData.name || '').trim();
        const role = (employeeData.role || '').trim();
        const limit = parseFloat(employeeData.maxDiscountLimit);

        if (!name) {
            throw new Error('Validation Error: Employee name is required.');
        }
        if (!['Sales Associate', 'Store Manager'].includes(role)) {
            throw new Error('Validation Error: Invalid employee role.');
        }
        if (isNaN(limit) || limit < 0 || limit > 100) {
            throw new Error('Validation Error: Discount cap must be between 0% and 100%.');
        }

        const employees = this.getEmployees();
        const newId = `emp-${Date.now()}`;
        const newEmp = {
            id: newId,
            name,
            role,
            maxDiscountLimit: limit,
            salesTotal: 0.00,
            commissionEarned: 0.00
        };

        employees.push(newEmp);
        safeLocalStorage.setItem('jss_employees', JSON.stringify(employees));
        return newEmp;
    }

    removeEmployee(employeeId, adminPassword) {
        const settings = this.getSettings();
        if (adminPassword !== settings.adminPassword) {
            throw new Error('Authentication Error: Invalid admin password.');
        }

        const employees = this.getEmployees();
        if (employees.length <= 1) {
            throw new Error('Validation Error: Cannot delete the last remaining staff user.');
        }

        const filtered = employees.filter(e => e.id !== employeeId);
        if (filtered.length === employees.length) {
            throw new Error('Validation Error: Employee not found.');
        }

        safeLocalStorage.setItem('jss_employees', JSON.stringify(filtered));
        return { id: employeeId, success: true };
    }

    // --- Admin & Staff Product CRUD (Core Product Management) ---
    addProduct(productData, adminOrStaffAuth) {
        const settings = this.getSettings();
        const isStaff = this.getEmployees().some(e => e.pin === adminOrStaffAuth || e.id === adminOrStaffAuth) || adminOrStaffAuth === 'STAFF_AUTHORIZED';
        if (adminOrStaffAuth !== settings.adminPassword && !isStaff) {
            throw new Error('Authentication Error: Invalid admin password.');
        }

        const name = (productData.name || '').trim();
        const category = (productData.category || '').trim();
        const weight = parseFloat(productData.weightGrams);
        const making = parseFloat(productData.makingChargePerGram);
        const stone = parseFloat(productData.stoneValue || 0);
        const stock = parseInt(productData.stockCount, 10);
        const imageUrl = (productData.imageUrl || '').trim() || 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=400&q=80';
        const makingChargeType = productData.makingChargeType || 'perGram';
        const diamondDetails = (productData.diamondDetails || '').trim();

        if (!name) throw new Error('Validation Error: Product name is required.');
        if (!['Rings', 'Earrings', 'Necklaces', 'Bracelets'].includes(category)) {
            throw new Error('Validation Error: Invalid category.');
        }
        if (isNaN(weight) || weight <= 0) throw new Error('Validation Error: Weight must be a positive number.');
        if (isNaN(making) || making < 0) throw new Error('Validation Error: Making charge cannot be negative.');
        if (isNaN(stone) || stone < 0) throw new Error('Validation Error: Stone value cannot be negative.');
        if (isNaN(stock) || stock < 0) throw new Error('Validation Error: Stock count cannot be negative.');

        const products = this.getProducts();
        const newId = `prod-${Date.now()}`;
        const newProduct = {
            id: newId,
            name,
            category,
            weightGrams: weight,
            makingChargePerGram: making,
            makingChargeType,
            stoneValue: stone,
            diamondDetails,
            imageUrl,
            stockCount: stock
        };

        products.push(newProduct);
        safeLocalStorage.setItem('jss_products', JSON.stringify(products));
        return newProduct;
    }

    updateProduct(productId, productData, adminPassword) {
        const settings = this.getSettings();
        if (adminPassword !== settings.adminPassword) {
            throw new Error('Authentication Error: Invalid admin password.');
        }

        const name = (productData.name || '').trim();
        const category = (productData.category || '').trim();
        const weight = parseFloat(productData.weightGrams);
        const making = parseFloat(productData.makingChargePerGram);
        const stone = parseFloat(productData.stoneValue);
        const stock = parseInt(productData.stockCount, 10);
        const imageUrl = (productData.imageUrl || '').trim();

        if (!name) throw new Error('Validation Error: Product name is required.');
        if (!['Rings', 'Earrings', 'Necklaces', 'Bracelets'].includes(category)) {
            throw new Error('Validation Error: Invalid category.');
        }
        if (isNaN(weight) || weight <= 0) throw new Error('Validation Error: Weight must be a positive number.');
        if (isNaN(making) || making < 0) throw new Error('Validation Error: Making charge cannot be negative.');
        if (isNaN(stone) || stone < 0) throw new Error('Validation Error: Stone value cannot be negative.');
        if (isNaN(stock) || stock < 0) throw new Error('Validation Error: Stock count cannot be negative.');

        const products = this.getProducts();
        const productIndex = products.findIndex(p => p.id === productId);
        if (productIndex === -1) {
            throw new Error('Validation Error: Product not found.');
        }

        products[productIndex] = {
            id: productId,
            name,
            category,
            weightGrams: weight,
            makingChargePerGram: making,
            stoneValue: stone,
            imageUrl: imageUrl || products[productIndex].imageUrl,
            stockCount: stock
        };

        safeLocalStorage.setItem('jss_products', JSON.stringify(products));
        return products[productIndex];
    }

    deleteProduct(productId, adminPassword) {
        const settings = this.getSettings();
        if (adminPassword !== settings.adminPassword) {
            throw new Error('Authentication Error: Invalid admin password.');
        }

        const products = this.getProducts();
        const filtered = products.filter(p => p.id !== productId);
        if (filtered.length === products.length) {
            throw new Error('Validation Error: Product not found.');
        }

        safeLocalStorage.setItem('jss_products', JSON.stringify(filtered));
        return { id: productId, success: true };
    }

    // --- Deal Methods ---
    getDeals() {
        return JSON.parse(safeLocalStorage.getItem('jss_deals')) || [];
    }

    createDeal(clientDetails, items, proposedPrice) {
        const { name, phone, email } = clientDetails;
        if (!name || !phone) {
            throw new Error('Validation Error: Client Name and Phone are required.');
        }
        if (!/^\d{10}$/.test(phone.trim())) {
            throw new Error('Validation Error: Phone number must be exactly 10 digits.');
        }
        if (!items || items.length === 0) {
            throw new Error('Validation Error: Proposed deal items cannot be empty.');
        }
        if (typeof proposedPrice !== 'number' || proposedPrice <= 0) {
            throw new Error('Validation Error: Proposed price must be a positive number.');
        }

        // Save/Update client in CRM immediately
        const existingClient = this.getClientByPhone(phone.trim());
        let initialTags = ['Bargain Pending'];
        if (existingClient) {
            initialTags = [...new Set([...existingClient.tags, 'Bargain Pending'])];
        }
        const client = this.saveClient({
            name: name.trim(),
            email: (email || '').trim(),
            phone: phone.trim(),
            tags: initialTags
        });

        // Compute original cart totals
        const totals = this.calculateCartTotals(items, 0);

        const deals = this.getDeals();
        const dealId = `DEAL-${Date.now()}`;
        const newDeal = {
            id: dealId,
            clientId: client.phone,
            clientName: client.name,
            clientEmail: client.email || '',
            items: totals.items,
            originalTotal: totals.totalAmount,
            proposedPrice: proposedPrice,
            status: 'Pending Approval',
            timestamp: new Date().toISOString()
        };

        deals.push(newDeal);
        safeLocalStorage.setItem('jss_deals', JSON.stringify(deals));
        return newDeal;
    }

    updateDealStatus(dealId, newStatus, ownerPassword) {
        const settings = this.getSettings();
        if (ownerPassword !== settings.ownerPassword && ownerPassword !== settings.adminPassword) {
            throw new Error('Authentication Error: Invalid owner password.');
        }
        if (!['Approved', 'Rejected'].includes(newStatus)) {
            throw new Error('Validation Error: Invalid deal status.');
        }

        const deals = this.getDeals();
        const dealIndex = deals.findIndex(d => d.id === dealId);
        if (dealIndex === -1) {
            throw new Error('Deal Not Found.');
        }

        deals[dealIndex].status = newStatus;
        safeLocalStorage.setItem('jss_deals', JSON.stringify(deals));

        // Update CRM client tag
        const deal = deals[dealIndex];
        const client = this.getClientByPhone(deal.clientId);
        if (client) {
            let tags = client.tags.filter(t => t !== 'Bargain Pending' && t !== 'Bargain Approved' && t !== 'Bargain Rejected');
            tags.push(newStatus === 'Approved' ? 'Bargain Approved' : 'Bargain Rejected');
            this.updateClientTags(client.phone, tags);
        }

        return deals[dealIndex];
    }

    finalizeApprovedDeal(dealId, paymentMethod, employeeId = null) {
        const deals = this.getDeals();
        const dealIndex = deals.findIndex(d => d.id === dealId);
        if (dealIndex === -1) {
            throw new Error('Deal Not Found.');
        }

        const deal = deals[dealIndex];
        if (deal.status !== 'Approved') {
            throw new Error(`Validation Error: Only approved deals can be finalized. (Current status: ${deal.status})`);
        }
        if (!['Card', 'Cash', 'UPI'].includes(paymentMethod)) {
            throw new Error('Validation Error: Invalid payment method.');
        }

        // Verify Stock count
        for (const item of deal.items) {
            const product = this.getProductById(item.productId);
            if (!product) {
                throw new Error(`Validation Error: Product ${item.productId} not found.`);
            }
            if (product.stockCount < item.quantity) {
                throw new Error(`Validation Error: Item "${product.name}" is out of stock. (Requested: ${item.quantity}, Available: ${product.stockCount})`);
            }
        }

        // Decrement Stock
        for (const item of deal.items) {
            const product = this.getProductById(item.productId);
            this.updateProductStock(product.id, product.stockCount - item.quantity);
        }

        // Create transaction record
        const transactions = JSON.parse(safeLocalStorage.getItem('jss_transactions')) || [];
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
        const invNum = `INV-${dateStr}-${String(transactions.length + 1).padStart(4, '0')}`;

        // Backward calculate subtotal and tax so that subtotal + tax = proposedPrice
        const settings = this.getSettings();
        const taxRate = settings.defaultTaxRate;
        const totalAmount = deal.proposedPrice;
        const subtotal = totalAmount / (1 + taxRate / 100);
        const taxAmount = totalAmount - subtotal;

        // Calculate original subtotal to show discount amount if any
        let originalSubtotal = 0;
        deal.items.forEach(item => {
            originalSubtotal += item.price * item.quantity;
        });
        const discountAmount = Math.max(0, deal.originalTotal - totalAmount);
        const discountPct = (discountAmount / deal.originalTotal) * 100;

        let employee = null;
        if (employeeId) {
            employee = this.getEmployeeById(employeeId);
        }

        // Update Employee Sales Progress
        if (employee) {
            const employees = this.getEmployees();
            const empIndex = employees.findIndex(e => e.id === employeeId);
            employees[empIndex].salesTotal += totalAmount;
            
            // Commission calculation: e.g., 2% of the sales volume for sales associate, 5% for manager
            const commRate = employee.role === 'Store Manager' ? 0.05 : 0.02;
            employees[empIndex].commissionEarned += totalAmount * commRate;
            safeLocalStorage.setItem('jss_employees', JSON.stringify(employees));
        }

        const transactionRecord = {
            id: invNum,
            clientId: deal.clientId,
            clientName: deal.clientName,
            employeeId: employee ? employee.id : null,
            employeeName: employee ? employee.name : 'Owner Approved Deal',
            items: deal.items,
            subtotal: subtotal,
            discountApplied: parseFloat(discountPct.toFixed(2)),
            discountAmount: discountAmount,
            taxRate: taxRate,
            taxAmount: taxAmount,
            totalAmount: totalAmount,
            paymentMethod: paymentMethod,
            timestamp: new Date().toISOString()
        };

        transactions.push(transactionRecord);
        safeLocalStorage.setItem('jss_transactions', JSON.stringify(transactions));

        // Mark deal as Completed
        deals[dealIndex].status = 'Completed';
        safeLocalStorage.setItem('jss_deals', JSON.stringify(deals));

        // Update Client CRM tags: remove Bargain Approved tag
        const client = this.getClientByPhone(deal.clientId);
        if (client) {
            let tags = client.tags.filter(t => t !== 'Bargain Approved');
            this.updateClientTags(client.phone, tags);
        }

        return transactionRecord;
    }

    resetDatabase() {
        safeLocalStorage.removeItem('jss_settings');
        safeLocalStorage.removeItem('jss_employees');
        safeLocalStorage.removeItem('jss_products');
        safeLocalStorage.removeItem('jss_transactions');
        safeLocalStorage.removeItem('jss_clients');
        safeLocalStorage.removeItem('jss_deals');
        this.initDatabase();
    }
}

// --- OTP Service (Core Principle III) ---
class OTPService {
    constructor() {
        this.activeOTPs = new Map(); // Store phone -> { code, expiresAt, attempts }
    }

    generateOTP(phone) {
        // Clean phone number
        const cleanPhone = phone.trim();
        if (!/^\d{10}$/.test(cleanPhone)) {
            throw new Error('Validation Error: Phone number must be 10 digits to send OTP.');
        }

        // 6 digit code
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiration

        this.activeOTPs.set(cleanPhone, {
            code,
            expiresAt,
            attempts: 0
        });

        // Simulate SMS toast
        this.showOTPSimulatorToast(cleanPhone, code);
        return code;
    }

    verifyOTP(phone, code) {
        const cleanPhone = phone.trim();
        const record = this.activeOTPs.get(cleanPhone);

        if (!record) {
            return false;
        }

        // Check expiration
        if (Date.now() > record.expiresAt) {
            this.activeOTPs.delete(cleanPhone);
            return false;
        }

        // Check attempts limit
        if (record.attempts >= 3) {
            this.activeOTPs.delete(cleanPhone);
            return false;
        }

        if (record.code === code.trim()) {
            this.activeOTPs.delete(cleanPhone); // verify success, consume it
            return true;
        } else {
            record.attempts += 1;
            this.activeOTPs.set(cleanPhone, record);
            if (record.attempts >= 3) {
                this.activeOTPs.delete(cleanPhone); // locked out
                throw new Error('Validation Error: Too many incorrect attempts. OTP invalidated.');
            }
            return false;
        }
    }

    showOTPSimulatorToast(phone, code) {
        // Create container if not exists
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'sim-toast';
        toast.innerHTML = `
            <div class="sim-toast-header">
                <span>SMS SIMULATOR</span>
                <span style="font-size: 8px; opacity: 0.6">JUST NOW</span>
            </div>
            <div class="sim-toast-body">
                OTP code for <b>${phone}</b>: <span style="font-weight: 700; color: var(--gold-light); font-size: 16px; letter-spacing: 2px;">${code}</span>
                <br><span style="font-size: 10px; color: var(--text-muted)">Valid for 5 mins. Enter this code to confirm your order.</span>
            </div>
        `;

        container.appendChild(toast);

        // Auto remove after 15 seconds so user has time to copy/paste
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease-in reverse';
            setTimeout(() => toast.remove(), 300);
        }, 15000);
    }
}
