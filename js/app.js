// Global application state
let repo;
let otpService;
let cart = [];
let activePortal = 'customer'; // 'customer', 'employee', 'owner', 'admin'
let activeEmployee = null; // logged in employee object
let activeCRMClient = null; // client object being viewed in CRM modal
let activeCategoryFilter = 'All';
let searchQuery = '';
let activeDealId = null;
let activeDealProposedPrice = 0;

document.addEventListener('DOMContentLoaded', () => {
    repo = new DataRepository();
    otpService = new OTPService();
    
    // Bind main routing tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            switchPortal(view);
        });
    });

    // Initialize UI elements and events
    initCustomerCatalog();
    initCartEvents();
    initCheckoutEvents();
    initEmployeePortal();
    initOwnerPortal();
    initAdminPortal();
    initTestPanel();
    initOldGoldExchange();
    initStaffAddItem();
    initSplitPayment();
    initMakingChargePreference();

    // Initial render
    renderCatalog();
    updateLiveRateTicker();
});

// --- Portal Switcher / Router ---
function switchPortal(portalName) {
    activePortal = portalName;
    
    // Update active tab styling
    document.querySelectorAll('.nav-tab').forEach(tab => {
        if (tab.dataset.view === portalName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Hide all main view sections
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected portal
    if (portalName === 'customer') {
        document.getElementById('customer-view').classList.add('active');
        renderCatalog();
    } else if (portalName === 'employee') {
        if (activeEmployee) {
            document.getElementById('employee-portal-view').classList.add('active');
            switchEmployeeSubView('pos');
            checkEmployeeNotifications();
        } else {
            document.getElementById('employee-lock-view').classList.add('active');
            document.getElementById('employee-passcode').value = '';
            renderEmployeeSelect();
        }
    } else if (portalName === 'admin') {
        const isAdminLoggedIn = safeSessionStorage.getItem('isAdminLoggedIn') === 'true';
        if (isAdminLoggedIn) {
            document.getElementById('admin-portal-view').classList.add('active');
            switchAdminSubView('settings');
        } else {
            document.getElementById('admin-lock-view').classList.add('active');
            document.getElementById('admin-passcode').value = '';
        }
    } else if (portalName === 'owner') {
        const isOwnerLoggedIn = safeSessionStorage.getItem('isOwnerLoggedIn') === 'true';
        if (isOwnerLoggedIn) {
            document.getElementById('owner-portal-view').classList.add('active');
            renderOwnerDashboard();
        } else {
            document.getElementById('owner-lock-view').classList.add('active');
            document.getElementById('owner-passcode').value = '';
        }
    }

    // Show staff "New Item" shortcut in catalog (#2)
    const staffBtn = document.getElementById('staff-add-product-shortcut-btn');
    if (staffBtn) {
        staffBtn.style.display = 'inline-flex';
    }
}

// --- Customer View: Product catalog & Details ---
function initCustomerCatalog() {
    // Category filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeCategoryFilter = e.target.dataset.category;
            renderCatalog();
        });
    });

    // Search filter
    const searchInp = document.getElementById('search-products');
    if (searchInp) {
        searchInp.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            renderCatalog();
        });
    }

    // Check Bargain Deals button
    const checkBargainBtn = document.getElementById('customer-check-bargain-btn');
    if (checkBargainBtn) {
        checkBargainBtn.addEventListener('click', () => {
            const phone = document.getElementById('customer-bargain-phone').value.trim();
            if (!/^\d{10}$/.test(phone)) {
                showGlobalAlert('Please enter a valid 10-digit mobile number.', 'error');
                return;
            }
            renderCustomerDeals(phone);
        });
    }
}

function updateLiveRateTicker() {
    const settings = repo.getSettings();
    const ticker = document.getElementById('live-gold-ticker');
    if (ticker) {
        const valSpan = ticker.querySelector('.value');
        const oldVal = parseFloat(valSpan.innerText.replace(/[^0-9.]/g, ''));
        const newVal = settings.liveGoldRatePerGram;
        
        valSpan.innerText = `₹${newVal.toFixed(2)}/g`;
        
        ticker.classList.remove('trend-up', 'trend-down');
        if (!isNaN(oldVal) && oldVal !== newVal) {
            if (newVal > oldVal) {
                ticker.classList.add('trend-up');
                ticker.querySelector('.trend-indicator').innerText = '▲';
            } else {
                ticker.classList.add('trend-down');
                ticker.querySelector('.trend-indicator').innerText = '▼';
            }
        }
    }
}

function renderCatalog() {
    const products = repo.getProducts();
    const settings = repo.getSettings();
    const liveRate = settings.liveGoldRatePerGram;
    const grid = document.getElementById('products-grid-container');
    if (!grid) return;

    grid.innerHTML = '';

    const filtered = products.filter(p => {
        const matchesCategory = activeCategoryFilter === 'All' || p.category === activeCategoryFilter;
        const matchesSearch = p.name.toLowerCase().includes(searchQuery) || p.category.toLowerCase().includes(searchQuery);
        return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">No products found matching your search.</div>';
        return;
    }

    filtered.forEach(p => {
        const price = repo.calculateItemPrice(p, liveRate);
        const card = document.createElement('div');
        card.className = 'glass-card product-card';
        card.innerHTML = `
            <div class="product-image">${getCategoryEmoji(p.category)}</div>
            <div class="product-category">${p.category}</div>
            <h3 class="product-title">${p.name}</h3>
            <div class="product-specs">
                <table>
                    <tr><td>Weight</td><td>${p.weightGrams}g</td></tr>
                    <tr><td>Making Charges</td><td>₹${p.makingChargePerGram}/g</td></tr>
                    <tr><td>Stone Value</td><td>₹${p.stoneValue}</td></tr>
                    <tr><td>Stock Available</td><td>${p.stockCount > 0 ? `${p.stockCount} units` : '<span style="color: var(--error)">Out of Stock</span>'}</td></tr>
                </table>
            </div>
            <div class="product-footer">
                <span class="product-price">₹${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                <button class="btn-primary" onclick="addToCart('${p.id}')" ${p.stockCount <= 0 ? 'disabled' : ''}>
                    Add To Cart
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function getCategoryEmoji(cat) {
    switch (cat) {
        case 'Rings': return '💍';
        case 'Necklaces': return '📿';
        case 'Earrings': return '💎';
        case 'Bracelets': return '🪮';
        default: return '✨';
    }
}

// --- Cart Drawer Logic ---
function initCartEvents() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    const closeBtn = document.getElementById('cart-close-btn');
    const trigger = document.getElementById('cart-trigger');

    if (trigger) {
        trigger.addEventListener('click', () => {
            drawer.classList.add('active');
            overlay.classList.add('active');
            renderCart();
        });
    }

    const closeCart = () => {
        drawer.classList.remove('active');
        overlay.classList.remove('active');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeCart);
    if (overlay) overlay.addEventListener('click', closeCart);
}

function addToCart(productId) {
    const product = repo.getProductById(productId);
    if (!product || product.stockCount <= 0) return;

    const existing = cart.find(item => item.productId === productId);
    const cartQty = existing ? existing.quantity : 0;

    if (cartQty >= product.stockCount) {
        showGlobalAlert('Stock limit reached for this item.', 'error');
        return;
    }

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ productId, quantity: 1 });
    }

    updateCartBadge();
    showGlobalAlert(`Added ${product.name} to cart.`, 'success');
}

function updateCartBadge() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-badge-count');
    if (badge) {
        badge.innerText = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function renderCart() {
    const listContainer = document.getElementById('cart-items-container');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (cart.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 40px 0;">Your cart is empty.</div>';
        document.getElementById('checkout-btn-drawer').disabled = true;
        
        // Clear sums
        document.getElementById('cart-subtotal').innerText = '₹0.00';
        document.getElementById('cart-tax').innerText = '₹0.00';
        document.getElementById('cart-total').innerText = '₹0.00';
        return;
    }

    document.getElementById('checkout-btn-drawer').disabled = false;

    // Calculate totals using DataRepository pricing engine
    const totals = repo.calculateCartTotals(cart, 0);

    totals.items.forEach(item => {
        const itemRow = document.createElement('div');
        itemRow.className = 'cart-item';
        itemRow.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>${item.weightGrams}g | Live Rate: ₹${item.liveRate}/g</p>
                <p style="font-weight: 600; color: var(--gold-light);">₹${(item.price * item.quantity).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
            </div>
            <div class="cart-item-actions">
                <span class="cart-item-qty">${item.quantity}x</span>
                <button class="cart-remove-btn" onclick="removeFromCart('${item.productId}')">Remove</button>
            </div>
        `;
        listContainer.appendChild(itemRow);
    });

    document.getElementById('cart-subtotal').innerText = `₹${totals.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('cart-tax').innerText = `₹${totals.taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('cart-total').innerText = `₹${totals.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function removeFromCart(productId) {
    const idx = cart.findIndex(item => item.productId === productId);
    if (idx !== -1) {
        if (cart[idx].quantity > 1) {
            cart[idx].quantity -= 1;
        } else {
            cart.splice(idx, 1);
        }
    }
    updateCartBadge();
    renderCart();
}

function proceedToCheckout() {
    // Close cart drawer
    document.getElementById('cart-drawer').classList.remove('active');
    document.getElementById('cart-overlay').classList.remove('active');

    // Switch view to checkout
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.getElementById('customer-checkout-view').classList.add('active');
    
    renderCheckoutSummary();
}

// --- Customer View: Checkout & OTP ---
function renderCheckoutSummary() {
    const listContainer = document.getElementById('checkout-items-summary');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const settings = repo.getSettings();
    const liveRate = settings.liveGoldRatePerGram;
    const makingPref = document.getElementById('checkout-making-charge-preference')?.value || 'standard';
    const customMakingVal = parseFloat(document.getElementById('checkout-custom-making-value')?.value) || 0;

    let totalGoldCost = 0;
    let totalStandardMakingCost = 0;
    let totalStoneCost = 0;

    cart.forEach(item => {
        const product = repo.getProductById(item.productId);
        if (!product) return;

        const karat = product.name.includes('24K') ? 24 : product.name.includes('22K') ? 22 : product.name.includes('18K') ? 18 : product.name.includes('14K') ? 14 : 22;
        const purity = karat === 24 ? '999' : karat === 22 ? '916' : karat === 18 ? '750' : '585';
        const grossWeight = product.weightGrams;
        const stoneWeight = product.stoneValue > 0 ? (product.stoneValue / 12000).toFixed(2) : '0.00';
        const netWeight = Math.max(0.1, grossWeight - parseFloat(stoneWeight)).toFixed(2);
        const hsnCode = '7113'; // HSN Code for articles of jewellery
        const goldCost = parseFloat(netWeight) * liveRate;

        let unitMakingCost = 0;
        let makingLabel = '';
        if (product.makingChargeType === 'percent') {
            unitMakingCost = goldCost * (product.makingChargePerGram / 100);
            makingLabel = `${product.makingChargePerGram}% of Gold (₹${unitMakingCost.toFixed(2)})`;
        } else {
            unitMakingCost = grossWeight * (product.makingChargePerGram || 0);
            makingLabel = `₹${product.makingChargePerGram}/g (₹${unitMakingCost.toFixed(2)})`;
        }

        const stoneValue = product.stoneValue || 0;
        const diamondDetails = product.diamondDetails || (stoneValue > 0 ? `Natural Diamond / Precious Stones (~${stoneWeight} ct)` : 'None (Plain Hallmarked Gold)');

        totalGoldCost += goldCost * item.quantity;
        totalStandardMakingCost += unitMakingCost * item.quantity;
        totalStoneCost += stoneValue * item.quantity;

        const unitTotal = goldCost + unitMakingCost + stoneValue;
        const lineTotal = unitTotal * item.quantity;

        const row = document.createElement('div');
        row.style.cssText = 'margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px dashed rgba(255,255,255,0.08);';
        row.innerHTML = `
            <div style="font-weight: 600; font-size: 13px; color: var(--gold-light); margin-bottom: 8px;">${item.name} <span style="color: var(--text-muted); font-weight: 400;">(${item.quantity}x)</span></div>
            <table style="width: 100%; font-size: 11px; color: var(--text-secondary); border-collapse: collapse;">
                <tr><td style="padding: 2px 0;">HSN Code</td><td style="text-align: right; color: var(--text-primary); font-family: monospace;">${hsnCode}</td></tr>
                <tr><td style="padding: 2px 0;">Purity / Karat</td><td style="text-align: right; color: var(--text-primary);">${karat}K (${purity} Hallmarked)</td></tr>
                <tr><td style="padding: 2px 0;">Gross Weight</td><td style="text-align: right; color: var(--text-primary);">${grossWeight}g</td></tr>
                <tr><td style="padding: 2px 0;">Net Weight (Pure Gold)</td><td style="text-align: right; color: var(--text-primary);">${netWeight}g</td></tr>
                <tr><td style="padding: 2px 0;">Live Gold Rate</td><td style="text-align: right; color: var(--text-primary);">₹${liveRate.toLocaleString()}/g</td></tr>
                <tr><td style="padding: 2px 0;">Gold Metal Amount</td><td style="text-align: right; color: var(--text-primary);">₹${goldCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td></tr>
                <tr><td style="padding: 2px 0;">Making Charges</td><td style="text-align: right; color: var(--text-primary);">${makingLabel}</td></tr>
                <tr><td style="padding: 2px 0;">Diamond / Stone Specs</td><td style="text-align: right; color: var(--text-primary);">${diamondDetails}</td></tr>
                <tr><td style="padding: 2px 0;">Diamond / Stone Price</td><td style="text-align: right; color: var(--text-primary);">₹${stoneValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td></tr>
                <tr style="border-top: 1px dashed rgba(255,255,255,0.1); font-weight: 700;">
                    <td style="padding: 4px 0; color: var(--gold-light);">Total Item Amount</td>
                    <td style="text-align: right; color: var(--gold-primary);">₹${lineTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                </tr>
            </table>
        `;
        listContainer.appendChild(row);
    });

    // Calculate effective making charges based on preference (#6)
    let effectiveMakingCost = totalStandardMakingCost;
    let makingSavings = 0;
    if (makingPref === 'festive_25') {
        makingSavings = totalStandardMakingCost * 0.25;
        effectiveMakingCost = totalStandardMakingCost - makingSavings;
    } else if (makingPref === 'festive_50') {
        makingSavings = totalStandardMakingCost * 0.50;
        effectiveMakingCost = totalStandardMakingCost - makingSavings;
    } else if (makingPref === 'zero_making') {
        makingSavings = totalStandardMakingCost;
        effectiveMakingCost = 0;
    } else if (makingPref === 'custom') {
        effectiveMakingCost = customMakingVal;
        makingSavings = Math.max(0, totalStandardMakingCost - effectiveMakingCost);
    }

    const savingsNote = document.getElementById('checkout-making-savings-note');
    const savingsAmt = document.getElementById('checkout-making-savings-amt');
    if (savingsNote && savingsAmt) {
        if (makingSavings > 0) {
            savingsNote.style.display = 'block';
            savingsAmt.innerText = `₹${makingSavings.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        } else {
            savingsNote.style.display = 'none';
        }
    }

    const subtotal = totalGoldCost + effectiveMakingCost + totalStoneCost;
    const tax = subtotal * 0.03;
    const grandTotal = subtotal + tax;

    document.getElementById('checkout-subtotal').innerText = `₹${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('checkout-tax').innerText = `₹${tax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('checkout-total').innerText = `₹${grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    // Re-apply old gold deduction and split calculations
    updateOldGoldSummaryRow(grandTotal);
}

let activeOTPPhone = '';
let otpVerified = false;
let otpTimer = null;

function initCheckoutEvents() {
    const checkoutForm = document.getElementById('customer-checkout-form');
    const bargainToggle = document.getElementById('checkout-bargain-toggle');
    const bargainFields = document.getElementById('checkout-bargain-fields');
    const submitBtn = document.getElementById('checkout-submit-btn');

    if (bargainToggle) {
        bargainToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                bargainFields.style.display = 'block';
                submitBtn.innerText = 'Submit Bargain Proposal';
                document.getElementById('checkout-proposed-price').required = true;
            } else {
                bargainFields.style.display = 'none';
                submitBtn.innerText = 'Send OTP & Verify Order';
                document.getElementById('checkout-proposed-price').required = false;
            }
        });
    }

    if (checkoutForm) {
        checkoutForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            if (cart.length === 0) {
                showGlobalAlert('Your cart is empty.', 'error');
                return;
            }

            const name = document.getElementById('checkout-name').value.trim();
            const phone = document.getElementById('checkout-phone').value.trim();
            const email = document.getElementById('checkout-email').value.trim();

            if (!name || !phone) {
                showGlobalAlert('Name and Phone Number are required.', 'error');
                return;
            }

            if (!/^\d{10}$/.test(phone)) {
                showGlobalAlert('Phone number must be exactly 10 digits.', 'error');
                return;
            }

            // Check if bargaining
            if (bargainToggle && bargainToggle.checked) {
                const proposedPrice = parseFloat(document.getElementById('checkout-proposed-price').value);
                const totals = repo.calculateCartTotals(cart, 0);

                if (isNaN(proposedPrice) || proposedPrice <= 0) {
                    showGlobalAlert('Please enter a valid positive proposed price.', 'error');
                    return;
                }
                if (proposedPrice >= totals.totalAmount) {
                    showGlobalAlert(`Proposed price must be lower than the original total of ₹${totals.totalAmount.toFixed(2)}.`, 'error');
                    return;
                }

                try {
                    const deal = repo.createDeal({
                        name: name,
                        phone: phone,
                        email: email
                    }, cart, proposedPrice);
                    showGlobalAlert(`Bargain proposal of ₹${proposedPrice.toFixed(2)} submitted to owner! Deal ID: ${deal.id}`, 'success');
                    
                    // Reset form and cart
                    cart = [];
                    updateCartBadge();
                    checkoutForm.reset();
                    bargainFields.style.display = 'none';
                    submitBtn.innerText = 'Send OTP & Verify Order';
                    switchPortal('customer');
                } catch (err) {
                    showGlobalAlert(err.message, 'error');
                }
            } else {
                activeOTPPhone = phone;
                otpVerified = false;
                activeDealId = null; // standard checkout

                // Trigger OTP Service and open Modal
                try {
                    otpService.generateOTP(phone);
                    openOTPModal();
                } catch (err) {
                    showGlobalAlert(err.message, 'error');
                }
            }
        });
    }

    // OTP Verify Form
    const otpForm = document.getElementById('otp-verify-form');
    if (otpForm) {
        otpForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const val1 = document.getElementById('otp-c1').value;
            const val2 = document.getElementById('otp-c2').value;
            const val3 = document.getElementById('otp-c3').value;
            const val4 = document.getElementById('otp-c4').value;
            const val5 = document.getElementById('otp-c5').value;
            const val6 = document.getElementById('otp-c6').value;
            const enteredCode = val1 + val2 + val3 + val4 + val5 + val6;

            if (enteredCode.length !== 6) {
                showGlobalAlert('Please enter all 6 digits of the OTP.', 'error');
                return;
            }

            try {
                const verified = otpService.verifyOTP(activeOTPPhone, enteredCode);
                if (verified) {
                    otpVerified = true;
                    clearInterval(otpTimer);
                    closeOTPModal();
                    showGlobalAlert('OTP Verification Successful!', 'success');
                    
                    // Proceed to finalize transaction
                    if (activeDealId) {
                        finalizeBargainCheckout();
                    } else {
                        finalizeCheckout();
                    }
                } else {
                    showGlobalAlert('Incorrect OTP. Please try again.', 'error');
                    clearOTPinp();
                }
            } catch (err) {
                showGlobalAlert(err.message, 'error');
                closeOTPModal();
                clearOTPinp();
            }
        });
    }

    // Modal Close
    const closeOtpBtn = document.getElementById('otp-modal-close');
    if (closeOtpBtn) {
        closeOtpBtn.addEventListener('click', () => {
            clearInterval(otpTimer);
            closeOTPModal();
        });
    }

    // Bargain Billing Form Submit
    const bargainBillingForm = document.getElementById('bargain-billing-payment-form');
    if (bargainBillingForm) {
        bargainBillingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!activeDealId) return;

            // Trigger OTP validation
            try {
                otpService.generateOTP(activeOTPPhone);
                openOTPModal();
            } catch (err) {
                showGlobalAlert(err.message, 'error');
            }
        });
    }
}

// --- Old Gold Exchange Logic ---
function initOldGoldExchange() {
    const toggle = document.getElementById('checkout-old-gold-toggle');
    const fields = document.getElementById('checkout-old-gold-fields');
    const weightInp = document.getElementById('checkout-old-gold-weight');
    const puritySel = document.getElementById('checkout-old-gold-purity');
    const valueInp = document.getElementById('checkout-old-gold-value');

    if (!toggle) return;

    toggle.addEventListener('change', () => {
        fields.style.display = toggle.checked ? 'block' : 'none';
        if (!toggle.checked) {
            document.getElementById('checkout-old-gold-deduction-row').style.display = 'none';
            document.getElementById('checkout-old-gold-summary').style.display = 'none';
            updateOldGoldSummaryRow();
        }
    });

    const recalc = () => {
        const weight = parseFloat(weightInp.value) || 0;
        const karat = parseInt(puritySel.value) || 22;
        const settings = repo.getSettings();
        const liveRate = settings.liveGoldRatePerGram;
        const estimatedValue = weight * liveRate * (karat / 24);
        valueInp.value = estimatedValue > 0 ? estimatedValue.toFixed(2) : '';
        updateOldGoldSummaryRow();
    };

    weightInp.addEventListener('input', recalc);
    puritySel.addEventListener('change', recalc);
}

function updateOldGoldSummaryRow(computedGrandTotal) {
    const toggle = document.getElementById('checkout-old-gold-toggle');
    const deductionRow = document.getElementById('checkout-old-gold-deduction-row');
    const deductionSpan = document.getElementById('checkout-old-gold-deduction');
    const oldGoldSummary = document.getElementById('checkout-old-gold-summary');
    const totalSpan = document.getElementById('checkout-total');

    if (!toggle || !toggle.checked) {
        if (deductionRow) deductionRow.style.display = 'none';
        if (oldGoldSummary) oldGoldSummary.style.display = 'none';
        return;
    }

    const valueInp = document.getElementById('checkout-old-gold-value');
    const weightInp = document.getElementById('checkout-old-gold-weight');
    const puritySel = document.getElementById('checkout-old-gold-purity');
    const exchangeValue = parseFloat(valueInp ? valueInp.value : 0) || 0;

    let baseTotal = computedGrandTotal;
    if (baseTotal === undefined) {
        const subtotalText = document.getElementById('checkout-subtotal')?.innerText.replace(/[₹,]/g, '') || '0';
        const taxText = document.getElementById('checkout-tax')?.innerText.replace(/[₹,]/g, '') || '0';
        baseTotal = (parseFloat(subtotalText) || 0) + (parseFloat(taxText) || 0);
    }

    if (exchangeValue > 0 && deductionRow) {
        deductionRow.style.display = 'flex';
        deductionSpan.innerText = `-₹${exchangeValue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

        const newTotal = Math.max(0, baseTotal - exchangeValue);
        if (totalSpan) totalSpan.innerText = `₹${newTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

        if (oldGoldSummary) {
            const weight = parseFloat(weightInp ? weightInp.value : 0) || 0;
            const karat = parseInt(puritySel ? puritySel.value : 22) || 22;
            oldGoldSummary.style.display = 'block';
            oldGoldSummary.innerHTML = `
                ⚖️ Old Gold: <strong>${weight}g @ ${karat}K</strong> &nbsp;&nbsp;|&nbsp;&nbsp;
                Value: <strong>₹${exchangeValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong> &nbsp;&nbsp;|&nbsp;&nbsp;
                Net Payable: <strong>₹${newTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong>
            `;
        }
    } else if (deductionRow) {
        deductionRow.style.display = 'none';
        if (oldGoldSummary) oldGoldSummary.style.display = 'none';
    }
}

// --- Staff: Add Item for Sale Modal Handler (#2) ---
function initStaffAddItem() {
    const btn = document.getElementById('staff-add-product-shortcut-btn');
    const modal = document.getElementById('staff-add-item-modal-overlay');
    const closeBtn = document.getElementById('staff-add-item-modal-close');
    const cancelBtn = document.getElementById('staff-add-item-cancel-btn');
    const authPrompt = document.getElementById('staff-auth-prompt');
    const quickPinInp = document.getElementById('staff-quick-pin');
    const verifyPinBtn = document.getElementById('staff-quick-verify-btn');
    const form = document.getElementById('staff-quick-add-product-form');

    if (!btn || !modal) return;

    btn.addEventListener('click', () => {
        modal.classList.add('active');
        if (activeEmployee) {
            authPrompt.style.display = 'none';
            form.style.display = 'block';
        } else {
            authPrompt.style.display = 'block';
            form.style.display = 'none';
            quickPinInp.value = '';
            quickPinInp.focus();
        }
    });

    const closeModal = () => {
        modal.classList.remove('active');
        form.reset();
        quickPinInp.value = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    const handleVerifyPin = () => {
        const pin = quickPinInp.value.trim();
        const employees = repo.getEmployees() || [];
        const settings = repo.getSettings();
        
        // Match employee PIN, fallback PIN 1234/5678, or admin/employee password
        let found = employees.find(e => e.pin === pin);
        if (!found && (pin === '1234' || pin === '5678')) {
            found = pin === '1234' ? employees[0] : (employees[1] || employees[0]);
        }
        if (!found && (pin === settings.employeePassword || pin === settings.adminPassword)) {
            found = employees[0];
        }

        if (found) {
            activeEmployee = found;
            authPrompt.style.display = 'none';
            form.style.display = 'block';
            showGlobalAlert(`Staff Verified: Welcome ${found.name}`, 'success');
        } else {
            showGlobalAlert('Invalid Staff PIN. Default PIN is 1234 (or 5678).', 'error');
        }
    };

    if (verifyPinBtn) {
        verifyPinBtn.addEventListener('click', handleVerifyPin);
    }
    if (quickPinInp) {
        quickPinInp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleVerifyPin();
            }
        });
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('staff-prod-name').value.trim();
            const category = document.getElementById('staff-prod-category').value;
            const purity = document.getElementById('staff-prod-purity').value;
            const weight = parseFloat(document.getElementById('staff-prod-weight').value);
            const making = parseFloat(document.getElementById('staff-prod-making').value);
            const makingType = document.getElementById('staff-prod-making-type').value;
            const stone = parseFloat(document.getElementById('staff-prod-stone').value) || 0;
            const stock = parseInt(document.getElementById('staff-prod-stock').value, 10) || 1;
            const diamondDetails = document.getElementById('staff-prod-diamond-details').value.trim();
            let image = document.getElementById('staff-prod-image').value.trim();

            if (!image) {
                if (category === 'Rings') image = 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=400&q=80';
                else if (category === 'Earrings') image = 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=400&q=80';
                else if (category === 'Necklaces') image = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80';
                else image = 'https://images.unsplash.com/photo-1611591475871-331215bfa602?auto=format&fit=crop&w=400&q=80';
            }

            const fullName = name.includes(purity) ? name : `${purity} ${name}`;

            try {
                repo.addProduct({
                    name: fullName,
                    category,
                    weightGrams: weight,
                    makingChargePerGram: making,
                    makingChargeType: makingType,
                    stoneValue: stone,
                    diamondDetails,
                    stockCount: stock,
                    imageUrl: image
                }, 'STAFF_AUTHORIZED');

                showGlobalAlert(`New item "${fullName}" added to sale catalogue!`, 'success');
                renderCatalog();
                closeModal();
            } catch (err) {
                showGlobalAlert(err.message, 'error');
            }
        });
    }
}

// --- Multiple / Split Payment Option Handler (#3) ---
function initSplitPayment() {
    const methodSel = document.getElementById('checkout-payment-method');
    const container = document.getElementById('checkout-split-payment-container');
    const cashInp = document.getElementById('split-cash-amount');
    const cardInp = document.getElementById('split-card-amount');
    const upiInp = document.getElementById('split-upi-amount');
    const allocTotal = document.getElementById('split-allocated-total');
    const remBal = document.getElementById('split-remaining-balance');

    if (!methodSel || !container) return;

    const updateSplitTotals = () => {
        const cash = parseFloat(cashInp?.value) || 0;
        const card = parseFloat(cardInp?.value) || 0;
        const upi = parseFloat(upiInp?.value) || 0;
        const allocated = cash + card + upi;

        const totalText = document.getElementById('checkout-total')?.innerText.replace(/[₹,]/g, '') || '0';
        const netPayable = parseFloat(totalText) || 0;
        const remaining = netPayable - allocated;

        if (allocTotal) allocTotal.innerText = `₹${allocated.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        if (remBal) {
            if (Math.abs(remaining) < 0.01) {
                remBal.innerText = '₹0.00 (Fully Settled)';
                remBal.style.color = 'var(--success)';
            } else if (remaining > 0) {
                remBal.innerText = `₹${remaining.toLocaleString(undefined, {minimumFractionDigits: 2})} (Remaining)`;
                remBal.style.color = 'var(--error)';
            } else {
                remBal.innerText = `-₹${Math.abs(remaining).toLocaleString(undefined, {minimumFractionDigits: 2})} (Overpaid)`;
                remBal.style.color = 'var(--warning)';
            }
        }
    };

    methodSel.addEventListener('change', () => {
        container.style.display = methodSel.value === 'Split' ? 'block' : 'none';
        updateSplitTotals();
    });

    [cashInp, cardInp, upiInp].forEach(inp => {
        if (inp) inp.addEventListener('input', updateSplitTotals);
    });
}

// --- Making Charges Option Preference Handler (#6) ---
function initMakingChargePreference() {
    const prefSel = document.getElementById('checkout-making-charge-preference');
    const customContainer = document.getElementById('checkout-custom-making-container');
    const customInp = document.getElementById('checkout-custom-making-value');

    if (!prefSel) return;

    prefSel.addEventListener('change', () => {
        if (customContainer) {
            customContainer.style.display = prefSel.value === 'custom' ? 'block' : 'none';
        }
        renderCheckoutSummary();
    });

    if (customInp) {
        customInp.addEventListener('input', () => {
            renderCheckoutSummary();
        });
    }
}

function clearOTPinp() {
    document.querySelectorAll('.otp-code-inp').forEach(inp => inp.value = '');
    document.getElementById('otp-c1').focus();
}

function openOTPModal() {
    const modal = document.getElementById('otp-modal-overlay');
    modal.classList.add('active');
    clearOTPinp();
    
    // Auto-focus behavior for OTP inputs
    const inputs = document.querySelectorAll('.otp-code-inp');
    inputs.forEach((inp, idx) => {
        inp.addEventListener('keyup', (e) => {
            if (e.target.value.length === 1 && idx < inputs.length - 1) {
                inputs[idx + 1].focus();
            }
            if (e.key === 'Backspace' && idx > 0 && e.target.value.length === 0) {
                inputs[idx - 1].focus();
            }
        });
    });

    // Start 5 min countdown timer
    let timeRemaining = 5 * 60;
    const timerSpan = document.getElementById('otp-countdown');
    
    clearInterval(otpTimer);
    otpTimer = setInterval(() => {
        const mins = Math.floor(timeRemaining / 60);
        const secs = timeRemaining % 60;
        timerSpan.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
        timeRemaining--;

        if (timeRemaining < 0) {
            clearInterval(otpTimer);
            closeOTPModal();
            showGlobalAlert('OTP has expired. Please request a new one.', 'error');
        }
    }, 1000);
}

function closeOTPModal() {
    document.getElementById('otp-modal-overlay').classList.remove('active');
}

function finalizeCheckout() {
    if (!otpVerified) {
        showGlobalAlert('Order cannot be submitted without active OTP verification.', 'error');
        return;
    }

    const name = document.getElementById('checkout-name').value.trim();
    const phone = document.getElementById('checkout-phone').value.trim();
    const email = document.getElementById('checkout-email').value.trim();
    const methodSel = document.getElementById('checkout-payment-method').value;
    const oldGoldToggle = document.getElementById('checkout-old-gold-toggle');
    const oldGoldValue = oldGoldToggle && oldGoldToggle.checked
        ? parseFloat(document.getElementById('checkout-old-gold-value').value) || 0
        : 0;
    const oldGoldWeight = oldGoldToggle && oldGoldToggle.checked
        ? parseFloat(document.getElementById('checkout-old-gold-weight').value) || 0
        : 0;
    const oldGoldKarat = oldGoldToggle && oldGoldToggle.checked
        ? parseInt(document.getElementById('checkout-old-gold-purity').value) || 0
        : 0;

    let finalPaymentMethod = methodSel;
    if (methodSel === 'Split') {
        const cash = parseFloat(document.getElementById('split-cash-amount')?.value) || 0;
        const card = parseFloat(document.getElementById('split-card-amount')?.value) || 0;
        const upi = parseFloat(document.getElementById('split-upi-amount')?.value) || 0;
        finalPaymentMethod = `Split (Cash: ₹${cash.toFixed(2)}, Card: ₹${card.toFixed(2)}, UPI: ₹${upi.toFixed(2)})`;
    }

    const totals = repo.calculateCartTotals(cart, 0);
    const netPayable = Math.max(0, totals.totalAmount - oldGoldValue);

    const payload = {
        clientId: phone,
        clientName: name,
        clientEmail: email,
        employeeId: null, // direct online
        items: cart,
        discountApplied: 0,
        paymentMethod: finalPaymentMethod,
        oldGoldExchange: oldGoldValue > 0 ? { weightGrams: oldGoldWeight, karat: oldGoldKarat, estimatedValue: oldGoldValue } : null,
        netPayable: oldGoldValue > 0 ? netPayable : totals.totalAmount
    };

    try {
        const transaction = repo.createTransaction(payload);
        showGlobalAlert(`Order placed successfully! Inv No: ${transaction.id}`, 'success');
        
        // Show Invoice Receipt print modal
        showReceipt(transaction);

        // Reset cart
        cart = [];
        updateCartBadge();

        // Redirect back to catalog
        switchPortal('customer');
        
        // Clear checkout form
        document.getElementById('customer-checkout-form').reset();
    } catch (err) {
        showGlobalAlert(err.message, 'error');
    }
}

// --- Invoice Receipt Printer ---
function showReceipt(tx) {
    const modal = document.getElementById('receipt-modal-overlay');
    if (!modal) return;

    const printArea = document.getElementById('receipt-print-area');
    printArea.innerHTML = `
        <div class="receipt-header" style="text-align: center; margin-bottom: 20px;">
            <h2>⚜ AURELIA GOLD JEWELLERS ⚜</h2>
            <p style="font-size: 12px; color: #5e6166;">100 Gold Arcade, Karol Bagh, Delhi</p>
            <p style="font-size: 12px; color: #5e6166;">Phone: +91 98765 43210</p>
        </div>
        <div style="border-bottom: 1px dashed #ccc; margin-bottom: 16px; padding-bottom: 8px;">
            <p><strong>Invoice No:</strong> ${tx.id}</p>
            <p><strong>Date:</strong> ${new Date(tx.timestamp).toLocaleString()}</p>
            <p><strong>Customer:</strong> ${tx.clientName} (${tx.clientId})</p>
            ${tx.employeeName ? `<p><strong>Sales Rep:</strong> ${tx.employeeName} (${tx.employeeId})</p>` : ''}
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px;">
            <thead>
                <tr style="border-bottom: 1px solid #ccc;">
                    <th style="text-align: left; padding: 4px 0;">Item</th>
                    <th style="text-align: right; padding: 4px 0;">Qty</th>
                    <th style="text-align: right; padding: 4px 0;">Rate/g</th>
                    <th style="text-align: right; padding: 4px 0;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${tx.items.map(item => `
                    <tr>
                        <td style="padding: 4px 0;">${item.name} (${item.weightGrams}g)</td>
                        <td style="text-align: right;">${item.quantity}</td>
                        <td style="text-align: right;">₹${item.liveRate.toFixed(2)}</td>
                        <td style="text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div style="border-top: 1px dashed #ccc; padding-top: 8px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Subtotal:</span>
                <span>₹${tx.subtotal.toFixed(2)}</span>
            </div>
            ${tx.discountApplied > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #ff5454;">
                    <span>Discount (${tx.discountApplied}%):</span>
                    <span>-₹${tx.discountAmount.toFixed(2)}</span>
                </div>
            ` : ''}
            ${tx.oldGoldExchange ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #16a34a;">
                    <span>Old Gold Exchange (${tx.oldGoldExchange.weightGrams}g @ ${tx.oldGoldExchange.karat}K):</span>
                    <span>-₹${tx.oldGoldExchange.estimatedValue.toFixed(2)}</span>
                </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Tax (${tx.taxRate}%):</span>
                <span>₹${tx.taxAmount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 16px; margin-top: 8px; border-top: 1px solid #000; padding-top: 8px;">
                <span>Total Paid:</span>
                <span>₹${(tx.netPayable !== undefined ? tx.netPayable : tx.totalAmount).toFixed(2)}</span>
            </div>
            <div style="margin-top: 6px; font-size: 11px; text-transform: uppercase;">
                <span>Payment Method: <strong>${tx.paymentMethod}</strong></span>
            </div>
        </div>
        <div style="text-align: center; margin-top: 30px; font-size: 11px; font-style: italic; color: #5e6166;">
            Thank you for shopping with Aurelia!
        </div>
    `;

    modal.classList.add('active');

    const closeBtn = document.getElementById('receipt-close');
    closeBtn.onclick = () => modal.classList.remove('active');

    const printBtn = document.getElementById('receipt-print-btn');
    printBtn.onclick = () => {
        window.print();
    };
}

// --- Employee Portal Logic ---
function initEmployeePortal() {
    const loginForm = document.getElementById('employee-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const passcode = document.getElementById('employee-passcode').value;
            const empSelect = document.getElementById('employee-select');
            const empId = empSelect.value;

            const settings = repo.getSettings();
            if (passcode === settings.employeePassword) {
                activeEmployee = repo.getEmployeeById(empId);
                showGlobalAlert(`Welcome, ${activeEmployee.name}!`, 'success');
                switchPortal('employee');
                checkEmployeeNotifications();
            } else {
                showGlobalAlert('Invalid employee passcode.', 'error');
            }
        });
    }

    // Portal sidebar navigation
    document.querySelectorAll('.employee-sidebar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const subView = e.target.dataset.subview;
            switchEmployeeSubView(subView);
        });
    });

    // Employee Logout
    const logoutBtn = document.getElementById('employee-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            activeEmployee = null;
            switchPortal('employee');
        });
    }

    // Close employee bargain checkout modal
    const closeCheckoutBtn = document.getElementById('employee-bargain-checkout-modal-close');
    if (closeCheckoutBtn) {
        closeCheckoutBtn.addEventListener('click', () => {
            document.getElementById('employee-bargain-checkout-modal-overlay').classList.remove('active');
        });
    }

    // Submit employee bargain checkout form
    const checkoutBargainForm = document.getElementById('employee-bargain-checkout-form');
    if (checkoutBargainForm) {
        checkoutBargainForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const dealId = document.getElementById('emp-checkout-deal-id').value;
            const paymentMethod = document.getElementById('emp-checkout-payment-method').value;

            try {
                const tx = repo.finalizeApprovedDeal(dealId, paymentMethod, activeEmployee ? activeEmployee.id : null);
                showGlobalAlert(`In-Store Bargain Checkout complete. Inv No: ${tx.id}`, 'success');
                document.getElementById('employee-bargain-checkout-modal-overlay').classList.remove('active');
                showReceipt(tx);
                renderEmployeeApprovedDeals();
            } catch (err) {
                showGlobalAlert(err.message, 'error');
            }
        });
    }

    // POS builder controls
    initPOSBuilder();
    // CRM dashboard controls
    initCRMDashboard();
}

function switchEmployeeSubView(viewName) {
    document.querySelectorAll('.employee-sidebar-btn').forEach(btn => {
        if (btn.dataset.subview === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.employee-sub-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`employee-${viewName}-view`).classList.add('active');

    // Load sub-view context data
    if (viewName === 'pos') {
        renderPOSBuilder();
    } else if (viewName === 'deals') {
        renderEmployeeApprovedDeals();
    } else if (viewName === 'crm') {
        renderCRMDashboard();
    } else if (viewName === 'leaderboard') {
        renderEmployeeLeaderboard();
    }
}

// --- Employee Subview: POS Builder ---
let posCart = []; // array of { productId, quantity }
let selectedPOSClient = null;

function initPOSBuilder() {
    const clientLookupBtn = document.getElementById('pos-client-lookup-btn');
    if (clientLookupBtn) {
        clientLookupBtn.addEventListener('click', () => {
            const phone = document.getElementById('pos-client-phone').value.trim();
            if (!/^\d{10}$/.test(phone)) {
                showGlobalAlert('Please enter a valid 10-digit phone number.', 'error');
                return;
            }
            
            const client = repo.getClientByPhone(phone);
            if (client) {
                selectedPOSClient = client;
                document.getElementById('pos-client-name').value = client.name;
                document.getElementById('pos-client-email').value = client.email || '';
                
                // Show client details tags
                let tagHtml = client.tags.map(t => `<span class="tag-badge">${t}</span>`).join('');
                document.getElementById('pos-client-status').innerHTML = `Existing Customer | Tags: ${tagHtml || 'None'}`;
                showGlobalAlert('Customer profile retrieved.', 'success');
            } else {
                selectedPOSClient = null;
                document.getElementById('pos-client-name').value = '';
                document.getElementById('pos-client-email').value = '';
                document.getElementById('pos-client-status').innerHTML = '<span style="color: var(--warning)">New Client Profile (Will be saved on checkout)</span>';
                showGlobalAlert('Customer profile not found. Complete form to create new profile.', 'warning');
            }
        });
    }

    const posCheckoutForm = document.getElementById('pos-checkout-form');
    if (posCheckoutForm) {
        posCheckoutForm.addEventListener('submit', (e) => {
            e.preventDefault();

            if (posCart.length === 0) {
                showGlobalAlert('POS transaction cart is empty.', 'error');
                return;
            }

            const phone = document.getElementById('pos-client-phone').value.trim();
            const name = document.getElementById('pos-client-name').value.trim();
            const email = document.getElementById('pos-client-email').value.trim();
            const discountVal = parseFloat(document.getElementById('pos-discount').value) || 0;
            const paymentMethod = document.getElementById('pos-payment-method').value;

            if (!phone || !name) {
                showGlobalAlert('Client Name and Phone are required.', 'error');
                return;
            }

            const payload = {
                clientId: phone,
                clientName: name,
                clientEmail: email,
                employeeId: activeEmployee.id,
                items: posCart,
                discountApplied: discountVal,
                paymentMethod: paymentMethod
            };

            try {
                // Submit transaction - repository handles Core Principle I discount bounds validation
                const tx = repo.createTransaction(payload);
                showGlobalAlert(`In-Store transaction created. Inv No: ${tx.id}`, 'success');
                
                // Reset POS builder
                posCart = [];
                selectedPOSClient = null;
                document.getElementById('pos-checkout-form').reset();
                document.getElementById('pos-client-status').innerHTML = '';
                
                renderPOSBuilder();
                showReceipt(tx);
            } catch (err) {
                showGlobalAlert(err.message, 'error');
            }
        });
    }
}

function renderPOSBuilder() {
    // Show active employee name and limits
    const badge = document.getElementById('pos-employee-badge-container');
    if (badge) {
        // Fetch fresh employee object to get up to date sales limits and totals
        activeEmployee = repo.getEmployeeById(activeEmployee.id);
        badge.innerHTML = `
            <div>
                <strong>Rep:</strong> ${activeEmployee.name} (${activeEmployee.role})
            </div>
            <div>
                <strong>Allowed Discount Cap:</strong> <span style="color: var(--gold-primary); font-weight: 700;">${activeEmployee.maxDiscountLimit}%</span>
            </div>
        `;
    }

    // Render products catalog select list
    const prodSelect = document.getElementById('pos-product-select');
    if (prodSelect) {
        prodSelect.innerHTML = '<option value="">-- Select Product to Add --</option>';
        const products = repo.getProducts();
        products.forEach(p => {
            prodSelect.innerHTML += `
                <option value="${p.id}" ${p.stockCount <= 0 ? 'disabled' : ''}>
                    ${p.name} (Stock: ${p.stockCount} | Wt: ${p.weightGrams}g)
                </option>
            `;
        });
    }

    renderPOSCartTable();
}

function addProductToPOSCart() {
    const sel = document.getElementById('pos-product-select');
    const pid = sel.value;
    if (!pid) return;

    const product = repo.getProductById(pid);
    const existing = posCart.find(item => item.productId === pid);
    const cartQty = existing ? existing.quantity : 0;

    if (cartQty >= product.stockCount) {
        showGlobalAlert('Cannot add more than available stock.', 'error');
        return;
    }

    if (existing) {
        existing.quantity += 1;
    } else {
        posCart.push({ productId: pid, quantity: 1 });
    }

    sel.value = ''; // reset select
    renderPOSCartTable();
}

function renderPOSCartTable() {
    const tbody = document.getElementById('pos-cart-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const discountVal = parseFloat(document.getElementById('pos-discount').value) || 0;

    if (posCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">No items added.</td></tr>';
        document.getElementById('pos-subtotal').innerText = '₹0.00';
        document.getElementById('pos-tax').innerText = '₹0.00';
        document.getElementById('pos-total').innerText = '₹0.00';
        return;
    }

    const totals = repo.calculateCartTotals(posCart, discountVal);

    totals.items.forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td>${item.name} (${item.weightGrams}g)</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span>${item.quantity}</span>
                        <button type="button" class="cart-remove-btn" onclick="removePOSCartQty('${item.productId}')">✖</button>
                    </div>
                </td>
                <td>₹${item.price.toFixed(2)}</td>
                <td style="text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `;
    });

    document.getElementById('pos-subtotal').innerText = `₹${totals.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    // Live update dynamic discount and taxes
    document.getElementById('pos-tax').innerText = `₹${totals.taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('pos-total').innerText = `₹${totals.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function removePOSCartQty(productId) {
    const idx = posCart.findIndex(item => item.productId === productId);
    if (idx !== -1) {
        if (posCart[idx].quantity > 1) {
            posCart[idx].quantity -= 1;
        } else {
            posCart.splice(idx, 1);
        }
    }
    renderPOSCartTable();
}

function updatePOSDiscountDisplay() {
    renderPOSCartTable();
}

// --- Employee Subview: CRM Dashboard ---
function initCRMDashboard() {
    const searchCRM = document.getElementById('crm-search-input');
    if (searchCRM) {
        searchCRM.addEventListener('input', () => {
            renderCRMDashboard();
        });
    }

    // Modal Close
    const closeCrmBtn = document.getElementById('crm-modal-close');
    if (closeCrmBtn) {
        closeCrmBtn.addEventListener('click', closeCRMModal);
    }

    // Add tag form
    const tagForm = document.getElementById('crm-add-tag-form');
    if (tagForm) {
        tagForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!activeCRMClient) return;

            const tagInp = document.getElementById('crm-new-tag-input');
            const newTag = tagInp.value.trim();

            if (!newTag) return;
            if (!/^[a-zA-Z0-9\s-]+$/.test(newTag)) {
                showGlobalAlert('Tag cannot contain special characters.', 'error');
                return;
            }

            const updatedTags = [...activeCRMClient.tags, newTag];
            try {
                activeCRMClient = repo.updateClientTags(activeCRMClient.phone, updatedTags);
                tagInp.value = '';
                renderCRMClientModal();
                renderCRMDashboard();
                showGlobalAlert(`Tag "${newTag}" added successfully.`, 'success');
            } catch (err) {
                showGlobalAlert(err.message, 'error');
            }
        });
    }
}

function renderCRMDashboard() {
    const listTable = document.getElementById('crm-tbody');
    if (!listTable) return;
    listTable.innerHTML = '';

    const query = document.getElementById('crm-search-input').value.toLowerCase().trim();
    const clients = repo.getClients();

    const filtered = clients.filter(c => {
        return c.name.toLowerCase().includes(query) || 
               c.phone.includes(query) || 
               (c.email && c.email.toLowerCase().includes(query)) ||
               c.tags.some(t => t.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
        listTable.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No clients in CRM directory.</td></tr>';
        return;
    }

    filtered.forEach(c => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td>${c.email || '<span style="color: var(--text-muted)">-</span>'}</td>
            <td>
                ${c.tags.map(t => `<span class="tag-badge">${t}</span>`).join('')}
            </td>
            <td style="text-align: right;">
                <button type="button" class="sidebar-btn" style="padding: 4px 12px; font-size: 12px;" onclick="openCRMClientModal('${c.phone}')">View Detail</button>
            </td>
        `;
        listTable.appendChild(row);
    });
}

function openCRMClientModal(phone) {
    const client = repo.getClientByPhone(phone);
    if (!client) return;

    activeCRMClient = client;
    renderCRMClientModal();

    document.getElementById('crm-modal-overlay').classList.add('active');
}

function closeCRMModal() {
    document.getElementById('crm-modal-overlay').classList.remove('active');
    activeCRMClient = null;
}

function renderCRMClientModal() {
    if (!activeCRMClient) return;

    document.getElementById('crm-client-name').innerText = activeCRMClient.name;
    document.getElementById('crm-client-phone').innerText = activeCRMClient.phone;
    document.getElementById('crm-client-email').innerText = activeCRMClient.email || 'None';
    document.getElementById('crm-client-joined').innerText = new Date(activeCRMClient.createdDate).toLocaleDateString();

    // Render tags chips list with remove buttons
    const tagsContainer = document.getElementById('crm-client-tags-chips');
    tagsContainer.innerHTML = '';

    if (activeCRMClient.tags.length === 0) {
        tagsContainer.innerHTML = '<span style="color: var(--text-muted)">No tags assigned yet.</span>';
    } else {
        activeCRMClient.tags.forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'tag-badge';
            chip.style.padding = '4px 10px';
            chip.style.margin = '4px';
            chip.innerHTML = `
                ${tag}
                <button class="tag-btn-delete" onclick="removeClientTag('${activeCRMClient.phone}', '${tag}')">✖</button>
            `;
            tagsContainer.appendChild(chip);
        });
    }

    // Render purchase history lists
    const txHistory = repo.getTransactions().filter(tx => tx.clientId === activeCRMClient.phone);
    const txHistoryContainer = document.getElementById('crm-client-purchases');
    txHistoryContainer.innerHTML = '';

    if (txHistory.length === 0) {
        txHistoryContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">No transaction logs found for this client.</div>';
    } else {
        txHistory.forEach(tx => {
            const date = new Date(tx.timestamp).toLocaleString();
            const itemsSummary = tx.items.map(item => `${item.name} (${item.quantity}x)`).join(', ');
            txHistoryContainer.innerHTML += `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 10px 14px; border-radius: 8px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
                        <span>${tx.id}</span>
                        <span style="color: var(--gold-light);">₹${tx.totalAmount.toFixed(2)}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                        ${date}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                        ${itemsSummary}
                    </div>
                </div>
            `;
        });
    }
}

function removeClientTag(phone, tagToRemove) {
    if (!activeCRMClient) return;

    const remainingTags = activeCRMClient.tags.filter(t => t !== tagToRemove);
    try {
        activeCRMClient = repo.updateClientTags(phone, remainingTags);
        renderCRMClientModal();
        renderCRMDashboard();
        showGlobalAlert(`Tag "${tagToRemove}" removed.`, 'warning');
    } catch (err) {
        showGlobalAlert(err.message, 'error');
    }
}

// --- Employee Subview: Leaderboard ---
function renderEmployeeLeaderboard() {
    const list = document.getElementById('employee-leaderboard-list');
    if (!list) return;
    list.innerHTML = '';

    const employees = repo.getEmployees();
    // Sort descending by salesTotal
    employees.sort((a, b) => b.salesTotal - a.salesTotal);

    employees.forEach((emp, index) => {
        const medal = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
        list.innerHTML += `
            <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <span style="font-size: 24px;">${medal}</span>
                    <div>
                        <h4 style="font-size: 16px; font-weight: 600;">${emp.name}</h4>
                        <span style="font-size: 12px; color: var(--text-secondary);">${emp.role} | Max Discount: ${emp.maxDiscountLimit}%</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 18px; font-weight: 700; color: var(--gold-primary);">₹${emp.salesTotal.toFixed(2)}</div>
                    <div style="font-size: 11px; color: var(--success);">Commission: ₹${emp.commissionEarned.toFixed(2)}</div>
                </div>
            </div>
        `;
    });
}

// --- Admin Portal Logic ---
function initAdminPortal() {
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const passcode = document.getElementById('admin-passcode').value;

            const settings = repo.getSettings();
            if (passcode === settings.adminPassword) {
                safeSessionStorage.setItem('isAdminLoggedIn', 'true');
                safeSessionStorage.setItem('adminPassword', passcode);
                showGlobalAlert('Welcome, System Administrator!', 'success');
                switchPortal('admin');
            } else {
                showGlobalAlert('Invalid admin access passcode.', 'error');
            }
        });
    }

    // Admin Logout
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            safeSessionStorage.removeItem('isAdminLoggedIn');
            safeSessionStorage.removeItem('adminPassword');
            switchPortal('admin');
        });
    }

    // Admin sub-navigation tabs toggling
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetView = e.target.dataset.subview;
            switchAdminSubView(targetView);
        });
    });

    // Form Submissions
    const rateForm = document.getElementById('admin-rate-form');
    if (rateForm) {
        rateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const rate = parseFloat(document.getElementById('admin-gold-rate').value);
            const pass = document.getElementById('admin-rate-pass').value;

            try {
                const makingChargePct = parseFloat(document.getElementById('admin-global-making-charge').value) || null;
                repo.updateGoldRate(rate, pass);
                if (makingChargePct !== null) {
                    const settings = repo.getSettings();
                    settings.globalMakingChargePct = makingChargePct;
                    safeLocalStorage.setItem('jss_settings', JSON.stringify(settings));
                    showGlobalAlert(`Gold rate & global making charge (${makingChargePct}%) updated!`, 'success');
                } else {
                    showGlobalAlert('Live gold price updated successfully!', 'success');
                }
                document.getElementById('admin-rate-pass').value = '';
                updateLiveRateTicker();
                renderAdminDashboard();
            } catch (err) {
                showGlobalAlert(err.message, 'error');
            }
        });
    }

    // Admin Add Staff Form Submit
    const addStaffForm = document.getElementById('admin-add-staff-form');
    if (addStaffForm) {
        addStaffForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('admin-staff-name').value.trim();
            const role = document.getElementById('admin-staff-role').value;
            const limit = parseFloat(document.getElementById('admin-staff-discount').value);

            const employeeData = {
                name,
                role,
                maxDiscountLimit: limit
            };

            const pass = safeSessionStorage.getItem('adminPassword');
            try {
                repo.addEmployee(employeeData, pass);
                addStaffForm.reset();
                showGlobalAlert('Staff profile created successfully.', 'success');
                renderAdminStaffTable();
            } catch (err) {
                showGlobalAlert(err.message, 'error');
            }
        });
    }

    // Admin Add Product Form Submit
    const addProductForm = document.getElementById('admin-add-product-form');
    if (addProductForm) {
        addProductForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('admin-prod-name').value.trim();
            const category = document.getElementById('admin-prod-category').value;
            const weight = parseFloat(document.getElementById('admin-prod-weight').value);
            const making = parseFloat(document.getElementById('admin-prod-making').value);
            const makingType = document.getElementById('admin-prod-making-type')?.value || 'perGram';
            const stone = parseFloat(document.getElementById('admin-prod-stone').value);
            const stock = parseInt(document.getElementById('admin-prod-stock').value, 10);
            const image = document.getElementById('admin-prod-image').value.trim();

            const productData = {
                name,
                category,
                weightGrams: weight,
                makingChargePerGram: making,
                makingChargeType: makingType,
                stoneValue: stone,
                stockCount: stock,
                imageUrl: image
            };

            const pass = safeSessionStorage.getItem('adminPassword');
            try {
                repo.addProduct(productData, pass);
                addProductForm.reset();
                showGlobalAlert('Product added to catalog successfully.', 'success');
                renderAdminProductsTable();
                renderCatalog(); // Update catalog view immediately
            } catch (err) {
                showGlobalAlert(err.message, 'error');
            }
        });
    }

    // Admin Edit Product Form Submit
    const editProductForm = document.getElementById('admin-edit-product-form');
    if (editProductForm) {
        editProductForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('admin-edit-prod-id').value;
            const name = document.getElementById('admin-edit-prod-name').value.trim();
            const category = document.getElementById('admin-edit-prod-category').value;
            const weight = parseFloat(document.getElementById('admin-edit-prod-weight').value);
            const making = parseFloat(document.getElementById('admin-edit-prod-making').value);
            const stone = parseFloat(document.getElementById('admin-edit-prod-stone').value);
            const stock = parseInt(document.getElementById('admin-edit-prod-stock').value, 10);
            const image = document.getElementById('admin-edit-prod-image').value.trim();

            const productData = {
                name,
                category,
                weightGrams: weight,
                makingChargePerGram: making,
                stoneValue: stone,
                stockCount: stock,
                imageUrl: image
            };

            const pass = safeSessionStorage.getItem('adminPassword');
            try {
                repo.updateProduct(id, productData, pass);
                closeAdminEditProductModal();
                showGlobalAlert('Product updated successfully.', 'success');
                renderAdminProductsTable();
                renderCatalog(); // Update catalog view immediately
            } catch (err) {
                showGlobalAlert(err.message, 'error');
            }
        });
    }

    // Modal Close
    const closeEditProductBtn = document.getElementById('admin-edit-product-modal-close');
    if (closeEditProductBtn) {
        closeEditProductBtn.addEventListener('click', closeAdminEditProductModal);
    }

    // Admin Limit Form Submit
    const limitForm = document.getElementById('admin-limit-form');
    if (limitForm) {
        limitForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const empId = document.getElementById('admin-limit-employee').value;
            const limit = parseFloat(document.getElementById('admin-limit-value').value);
            const pass = document.getElementById('admin-limit-pass').value;

            try {
                repo.updateEmployeeDiscountLimit(empId, limit, pass);
                document.getElementById('admin-limit-pass').value = '';
                showGlobalAlert('Employee discount limit updated successfully.', 'success');
                renderAdminDashboard();
                if (activeEmployee && activeEmployee.id === empId) {
                    renderPOSBuilder(); // Update POS builder if logged in
                }
            } catch (err) {
                showGlobalAlert(err.message, 'error');
            }
        });
    }
}

function renderAdminDashboard() {
    const settings = repo.getSettings();
    
    // Fill values
    document.getElementById('admin-current-rate').innerText = `₹${settings.liveGoldRatePerGram.toFixed(2)}/g`;
    document.getElementById('admin-gold-rate').value = settings.liveGoldRatePerGram;

    // Load making charge setting
    const adminGlobalMakingInput = document.getElementById('admin-global-making-charge');
    if (adminGlobalMakingInput && settings.globalMakingChargePct !== undefined) {
        adminGlobalMakingInput.value = settings.globalMakingChargePct;
    }

    // Fill employees dropdown and discount limits
    const employees = repo.getEmployees();
    const dropdown = document.getElementById('admin-limit-employee');
    const tableBody = document.getElementById('admin-limits-tbody');

    if (dropdown) {
        dropdown.innerHTML = '';
        employees.forEach(e => {
            dropdown.innerHTML += `<option value="${e.id}">${e.name} (${e.role})</option>`;
        });
    }

    if (tableBody) {
        tableBody.innerHTML = '';
        employees.forEach(e => {
            tableBody.innerHTML += `
                <tr>
                    <td><strong>${e.name}</strong></td>
                    <td>${e.role}</td>
                    <td><span style="color: var(--gold-light); font-weight: 700;">${e.maxDiscountLimit}%</span></td>
                    <td>₹${e.salesTotal.toFixed(2)}</td>
                </tr>
            `;
        });
    }

    // Render employees leaderboard in admin view also
    const analyticsContainer = document.getElementById('admin-leaderboard-container');
    if (analyticsContainer) {
        analyticsContainer.innerHTML = '';
        
        // Sort descending by salesTotal
        const sorted = [...employees].sort((a, b) => b.salesTotal - a.salesTotal);
        sorted.forEach((emp, index) => {
            const medal = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
            analyticsContainer.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: rgba(255,255,255,0.01); border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <div style="display: flex; align-items: center; gap: 12px; font-size: 13px;">
                        <span>${medal}</span>
                        <div>
                            <strong>${emp.name}</strong>
                            <div style="font-size: 10px; color: var(--text-secondary)">${emp.role}</div>
                        </div>
                    </div>
                    <div style="text-align: right; font-size: 13px;">
                        <strong>₹${emp.salesTotal.toFixed(2)}</strong>
                        <div style="font-size: 10px; color: var(--success)">Commission: ₹${emp.commissionEarned.toFixed(2)}</div>
                    </div>
                </div>
            `;
        });
    }

    // Render price history table
    renderAdminPriceHistory();
}

// --- Admin: Price History Table (#9) ---
function renderAdminPriceHistory() {
    const tbody = document.getElementById('admin-price-history-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const transactions = repo.getTransactions();
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">No transaction history yet.</td></tr>';
        return;
    }

    // Sort newest first
    const sorted = [...transactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sorted.forEach(tx => {
        const date = new Date(tx.timestamp).toLocaleDateString();
        const liveRate = tx.items[0] ? tx.items[0].liveRate : 0;

        tx.items.forEach(item => {
            // Cost price estimate per item (gold cost + making + stone at approximate acquisition)
            const goldCost = item.weightGrams * liveRate;
            const product = repo.getProductById(item.productId);
            const makingCost = product ? item.weightGrams * product.makingChargePerGram : 0;
            const stoneVal = product ? product.stoneValue : 0;
            const costPrice = (goldCost * 0.85) + (makingCost * 0.7) + (stoneVal * 0.8);
            const soldPerUnit = item.price || 0;
            const profitPerUnit = soldPerUnit - costPrice;
            const totalProfit = profitPerUnit * item.quantity;
            const profitColor = totalProfit >= 0 ? 'var(--success)' : 'var(--error)';
            const profitSign = totalProfit >= 0 ? '+' : '';

            tbody.innerHTML += `
                <tr>
                    <td><strong style="font-size: 11px;">${tx.id}</strong></td>
                    <td style="font-size: 11px;">${date}</td>
                    <td style="font-size: 11px;">${tx.clientName}</td>
                    <td style="font-size: 11px;">${item.name} (${item.quantity}x, ${item.weightGrams}g)</td>
                    <td style="font-size: 11px;">\u20b9${liveRate.toFixed(2)}/g</td>
                    <td style="font-size: 11px; color: var(--text-muted);">\u20b9${costPrice.toFixed(2)} <span style="font-size: 10px;">(est.)</span></td>
                    <td style="font-size: 11px; color: var(--gold-light);">\u20b9${soldPerUnit.toFixed(2)}</td>
                    <td style="font-size: 11px; font-weight: 700; color: ${profitColor};">${profitSign}\u20b9${totalProfit.toFixed(2)}</td>
                </tr>
            `;
        });
    });
}

// --- Global Alerts system (Custom gold notification toasts) ---
function showGlobalAlert(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'sim-toast';
    
    // Customize style based on type
    if (type === 'error') {
        toast.style.borderLeftColor = 'var(--error)';
    } else if (type === 'warning') {
        toast.style.borderLeftColor = 'var(--warning)';
    } else {
        toast.style.borderLeftColor = 'var(--gold-primary)';
    }

    toast.innerHTML = `
        <div class="sim-toast-header">
            <span>NOTIFICATION</span>
            <span style="font-size: 8px; opacity: 0.6">JUST NOW</span>
        </div>
        <div class="sim-toast-body">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease-in reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- Floating Tests Panel Control ---
function initTestPanel() {
    const runBtn = document.getElementById('run-tests-btn');
    if (runBtn) {
        runBtn.addEventListener('click', async () => {
            const resultsBox = document.getElementById('test-results-log');
            if (resultsBox) {
                resultsBox.innerHTML = '<div class="test-line">Running tests...</div>';
            }

            // Run suite
            const results = await suite.runAll();

            if (resultsBox) {
                resultsBox.innerHTML = '';
                let passedCount = 0;
                results.forEach(res => {
                    if (res.passed) {
                        passedCount++;
                        resultsBox.innerHTML += `<div class="test-line pass">✔ ${res.name} (PASS)</div>`;
                    } else {
                        resultsBox.innerHTML += `<div class="test-line fail">✘ ${res.name} (FAIL: ${res.error})</div>`;
                    }
                });

                resultsBox.innerHTML += `
                    <div style="margin-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 10px; font-weight: 700; color: ${passedCount === results.length ? 'var(--success)' : 'var(--error)'}">
                        Result: ${passedCount}/${results.length} Tests Passed.
                    </div>
                `;
            }
        });
    }
}

// --- Admin Helper Functions ---
function switchAdminSubView(viewName) {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        if (btn.dataset.subview === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.admin-subview').forEach(v => {
        v.style.display = 'none';
        v.classList.remove('active');
    });

    const targetSubview = document.getElementById(`admin-${viewName}-subview`);
    if (targetSubview) {
        targetSubview.style.display = 'block';
        targetSubview.classList.add('active');
    }

    if (viewName === 'settings') {
        renderAdminDashboard();
    } else if (viewName === 'staff') {
        renderAdminStaffTable();
    } else if (viewName === 'products') {
        renderAdminProductsTable();
    }
}

function renderAdminStaffTable() {
    const tbody = document.getElementById('admin-staff-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const employees = repo.getEmployees();
    employees.forEach(emp => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${emp.name}</strong></td>
                <td>${emp.role}</td>
                <td><span style="color: var(--gold-light); font-weight: 700;">${emp.maxDiscountLimit}%</span></td>
                <td>₹${emp.salesTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="text-align: right;">
                    <button type="button" class="sidebar-btn" style="padding: 4px 12px; font-size: 12px; background: var(--error);" onclick="adminDeleteEmployee('${emp.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
}

function adminDeleteEmployee(empId) {
    const pass = safeSessionStorage.getItem('adminPassword');
    try {
        repo.removeEmployee(empId, pass);
        showGlobalAlert('Staff profile deleted successfully.', 'success');
        renderAdminStaffTable();
        renderEmployeeSelect();
    } catch (err) {
        showGlobalAlert(err.message, 'error');
    }
}

function renderAdminProductsTable() {
    const tbody = document.getElementById('admin-products-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const products = repo.getProducts();
    const settings = repo.getSettings();
    const liveRate = settings.liveGoldRatePerGram;

    products.forEach(p => {
        const price = repo.calculateItemPrice(p, liveRate);
        tbody.innerHTML += `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.category}</td>
                <td>
                    <div style="font-size: 11px; color: var(--text-secondary);">
                        Wt: ${p.weightGrams}g<br>
                        Making: ₹${p.makingChargePerGram}/g<br>
                        Stone: ₹${p.stoneValue}
                    </div>
                </td>
                <td>${p.stockCount} units</td>
                <td><strong>₹${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 6px; justify-content: flex-end;">
                        <button type="button" class="sidebar-btn" style="padding: 4px 12px; font-size: 12px;" onclick="openAdminEditProductModal('${p.id}')">Edit</button>
                        <button type="button" class="sidebar-btn" style="padding: 4px 12px; font-size: 12px; background: var(--error);" onclick="adminDeleteProduct('${p.id}')">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function adminDeleteProduct(productId) {
    const pass = safeSessionStorage.getItem('adminPassword');
    try {
        repo.deleteProduct(productId, pass);
        showGlobalAlert('Product deleted from catalog successfully.', 'success');
        renderAdminProductsTable();
        renderCatalog();
    } catch (err) {
        showGlobalAlert(err.message, 'error');
    }
}

function openAdminEditProductModal(productId) {
    const product = repo.getProductById(productId);
    if (!product) return;

    document.getElementById('admin-edit-prod-id').value = product.id;
    document.getElementById('admin-edit-prod-name').value = product.name;
    document.getElementById('admin-edit-prod-category').value = product.category;
    document.getElementById('admin-edit-prod-weight').value = product.weightGrams;
    document.getElementById('admin-edit-prod-making').value = product.makingChargePerGram;
    document.getElementById('admin-edit-prod-stone').value = product.stoneValue;
    document.getElementById('admin-edit-prod-stock').value = product.stockCount;
    document.getElementById('admin-edit-prod-image').value = product.imageUrl || '';

    document.getElementById('admin-edit-product-modal-overlay').classList.add('active');
}

function closeAdminEditProductModal() {
    document.getElementById('admin-edit-product-modal-overlay').classList.remove('active');
}

function renderEmployeeSelect() {
    const select = document.getElementById('employee-select');
    if (!select) return;
    select.innerHTML = '';
    const employees = repo.getEmployees();
    employees.forEach(e => {
        select.innerHTML += `<option value="${e.id}">${e.name} (${e.role})</option>`;
    });
}

// --- Owner Portal Logic ---
function initOwnerPortal() {
    const loginForm = document.getElementById('owner-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const passcode = document.getElementById('owner-passcode').value;

            const settings = repo.getSettings();
            if (passcode === settings.ownerPassword || passcode === settings.adminPassword) {
                safeSessionStorage.setItem('isOwnerLoggedIn', 'true');
                safeSessionStorage.setItem('ownerPassword', passcode);
                showGlobalAlert('Welcome, Owner!', 'success');
                switchPortal('owner');
            } else {
                showGlobalAlert('Invalid owner access passcode.', 'error');
            }
        });
    }

    const logoutBtn = document.getElementById('owner-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            safeSessionStorage.removeItem('isOwnerLoggedIn');
            safeSessionStorage.removeItem('ownerPassword');
            switchPortal('owner');
        });
    }
}

function renderOwnerDashboard() {
    const deals = repo.getDeals();
    const pendingTbody = document.getElementById('owner-deals-tbody');
    const historyContainer = document.getElementById('owner-history-container');
    
    if (pendingTbody) {
        pendingTbody.innerHTML = '';
        const pending = deals.filter(d => d.status === 'Pending Approval');
        if (pending.length === 0) {
            pendingTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No pending bargain proposals.</td></tr>';
        } else {
            pending.forEach(d => {
                const itemsSummary = d.items.map(i => `${i.name} (${i.quantity}x)`).join('<br>');
                // Calculate cost price for the items at time of deal creation
                let costPrice = 0;
                d.items.forEach(item => {
                    const product = repo.getProductById(item.productId);
                    if (product) {
                        costPrice += (item.weightGrams * item.liveRate * 0.85) + (item.weightGrams * product.makingChargePerGram * 0.7) + (product.stoneValue * 0.8);
                    }
                });
                const profit = d.proposedPrice - costPrice;
                const profitColor = profit >= 0 ? 'var(--success)' : 'var(--error)';
                const profitSign = profit >= 0 ? '+' : '';

                pendingTbody.innerHTML += `
                    <tr>
                        <td>
                            <strong>${d.clientName}</strong><br>
                            <span style="font-size: 11px; color: var(--text-secondary);">${d.clientId}</span>
                        </td>
                        <td style="font-size: 11px;">${itemsSummary}</td>
                        <td>₹${d.originalTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td style="color: var(--gold-primary); font-weight: 700;">₹${d.proposedPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td style="color: ${profitColor}; font-weight: 700; font-size: 12px;">${profitSign}₹${profit.toFixed(2)}</td>
                        <td style="text-align: right;">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <button type="button" class="btn-primary" style="padding: 4px 10px; font-size: 11px; background: var(--success); color: var(--bg-primary);" onclick="ownerDecision('${d.id}', 'Approved')">Approve</button>
                                <button type="button" class="btn-primary" style="padding: 4px 10px; font-size: 11px; background: var(--error); color: var(--text-primary);" onclick="ownerDecision('${d.id}', 'Rejected')">Reject</button>
                                <button type="button" class="filter-btn" style="padding: 4px 10px; font-size: 11px;" onclick="showDealProfitDetails('${d.id}')">📊 Details</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
    }
    
    if (historyContainer) {
        historyContainer.innerHTML = '';
        const history = deals.filter(d => d.status !== 'Pending Approval');
        if (history.length === 0) {
            historyContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">No historical decisions.</div>';
        } else {
            history.forEach(d => {
                const date = new Date(d.timestamp).toLocaleString();
                let statusColor = 'var(--success)';
                if (d.status === 'Rejected') statusColor = 'var(--error)';
                if (d.status === 'Completed') statusColor = 'var(--text-muted)';
                
                historyContainer.innerHTML += `
                    <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 10px 14px; border-radius: 8px; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
                            <span>${d.id}</span>
                            <span style="color: ${statusColor}; font-weight: 700;">${d.status}</span>
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                            Client: ${d.clientName} (${d.clientId})
                        </div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                            Price: ₹${d.proposedPrice.toFixed(2)} (Original: ₹${d.originalTotal.toFixed(2)})
                        </div>
                        <div style="margin-top: 8px; text-align: right;">
                            <button type="button" class="filter-btn" style="padding: 2px 8px; font-size: 11px;" onclick="showDealProfitDetails('${d.id}')">📊 Deal Details & Profit</button>
                        </div>
                    </div>
                `;
            });
        }
    }
}

function ownerDecision(dealId, status) {
    const ownerPasscode = safeSessionStorage.getItem('ownerPassword');
    try {
        repo.updateDealStatus(dealId, status, ownerPasscode);
        showGlobalAlert(`Deal ${status === 'Approved' ? 'approved' : 'rejected'} successfully.`, 'success');
        renderOwnerDashboard();
    } catch (err) {
        showGlobalAlert(err.message, 'error');
    }
}

function showDealProfitDetails(dealId) {
    const deals = repo.getDeals();
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const panel = document.getElementById('owner-profit-panel');
    const content = document.getElementById('owner-profit-content');
    if (!panel || !content) return;

    let itemsHtml = '';
    let totalCostPrice = 0;

    deal.items.forEach(item => {
        const product = repo.getProductById(item.productId);
        const goldCost = item.weightGrams * item.liveRate;
        const makingCost = product ? item.weightGrams * product.makingChargePerGram : 0;
        const stoneValue = product ? product.stoneValue : 0;
        // Estimated cost to the shop (approximate acquisition cost: 85% of gold cost + 70% of making + 80% of stone)
        const approxCost = (goldCost * 0.85) + (makingCost * 0.7) + (stoneValue * 0.8);
        const catalogPrice = goldCost + makingCost + stoneValue;
        totalCostPrice += approxCost * item.quantity;

        itemsHtml += `
            <div style="margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">${item.name} (${item.quantity}x)</div>
                <table style="width: 100%; font-size: 12px; color: var(--text-secondary);">
                    <tr><td>Gold at Rate ₹${item.liveRate}/g × ${item.weightGrams}g</td><td style="text-align:right;">₹${goldCost.toFixed(2)}</td></tr>
                    <tr><td>Making Charges</td><td style="text-align:right;">₹${makingCost.toFixed(2)}</td></tr>
                    <tr><td>Stone / Diamond Value</td><td style="text-align:right;">₹${stoneValue.toFixed(2)}</td></tr>
                    <tr style="border-top: 1px dashed rgba(255,255,255,0.1); font-weight: 600; color: var(--gold-light);"><td>Catalogue Unit Price</td><td style="text-align:right;">₹${catalogPrice.toFixed(2)}</td></tr>
                    <tr style="color: var(--text-muted);"><td>Est. Acquisition Cost (~)</td><td style="text-align:right;">₹${approxCost.toFixed(2)}</td></tr>
                </table>
            </div>
        `;
    });

    const agreedPrice = deal.proposedPrice;
    const discount = deal.originalTotal - agreedPrice;
    const discountPct = ((discount / deal.originalTotal) * 100).toFixed(1);
    const estimatedProfit = agreedPrice - totalCostPrice;
    const profitColor = estimatedProfit >= 0 ? 'var(--success)' : 'var(--error)';
    const marginPct = agreedPrice > 0 ? ((estimatedProfit / agreedPrice) * 100).toFixed(1) : 0;

    content.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div>
                <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Original Catalogue Total</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--text-primary);">₹${deal.originalTotal.toFixed(2)}</div>
            </div>
            <div>
                <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Proposed / Agreed Price</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--gold-primary);">₹${agreedPrice.toFixed(2)}</div>
            </div>
            <div>
                <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Discount Given</div>
                <div style="font-size: 18px; font-weight: 700; color: var(--error);">-₹${discount.toFixed(2)} (${discountPct}%)</div>
            </div>
            <div>
                <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Estimated Gross Profit</div>
                <div style="font-size: 18px; font-weight: 700; color: ${profitColor};">₹${estimatedProfit.toFixed(2)} (${marginPct}% margin)</div>
            </div>
        </div>
        <div style="margin-bottom: 16px; font-size: 11px; color: var(--text-muted); background: rgba(255,165,0,0.05); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,165,0,0.15);">
            ⚠️ Note: Estimated profit uses approximate acquisition cost ratios (85% gold, 70% making, 80% stone). Actual profit depends on purchase records.
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">${itemsHtml}</div>
    `;

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCustomerDeals(phone) {
    const deals = repo.getDeals().filter(d => d.clientId === phone);
    const container = document.getElementById('customer-deals-status-list');
    container.innerHTML = '';
    
    if (deals.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px; padding: 10px;">No negotiated deals found for this number.</div>';
        container.style.display = 'block';
        return;
    }
    
    deals.forEach(d => {
        const date = new Date(d.timestamp).toLocaleString();
        let statusColor = 'var(--warning)';
        if (d.status === 'Approved') statusColor = 'var(--success)';
        if (d.status === 'Rejected') statusColor = 'var(--error)';
        if (d.status === 'Completed') statusColor = 'var(--text-muted)';
        
        let actionHtml = '';
        if (d.status === 'Approved') {
            actionHtml = `
                <div style="margin-top: 10px; color: var(--success); font-weight: 600; font-size: 12px;">
                    Approved (Visit Store representative to complete checkout)
                </div>
            `;
        }
        
        container.innerHTML += `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
                    <span>Deal ID: ${d.id}</span>
                    <span style="color: ${statusColor}; font-weight: 700;">${d.status}</span>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                    Date: ${date} | Original: ₹${d.originalTotal.toFixed(2)}
                </div>
                <div style="font-size: 13px; font-weight: 700; color: var(--gold-light); margin-top: 4px;">
                    Proposed Price: ₹${d.proposedPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                    Items: ${d.items.map(i => `${i.name} (${i.quantity}x)`).join(', ')}
                </div>
                ${actionHtml}
            </div>
        `;
    });
    container.style.display = 'block';
}

function showBargainBillingSection(dealId) {
    const deals = repo.getDeals();
    const deal = deals.find(d => d.id === dealId);
    if (!deal || deal.status !== 'Approved') return;

    // Save state for final checkout
    activeDealId = deal.id;
    activeDealProposedPrice = deal.proposedPrice;
    activeOTPPhone = deal.clientId;
    otpVerified = false;

    // Populate customer/deal info
    document.getElementById('bargain-bill-name').innerText = deal.clientName;
    document.getElementById('bargain-bill-phone').innerText = deal.clientId;
    document.getElementById('bargain-bill-email').innerText = deal.clientEmail || 'None';
    document.getElementById('bargain-bill-deal-id').innerText = deal.id;

    // Build dynamic specs listing all details of the product like weight, making charges, stone value, live rate
    let specsHtml = '';
    deal.items.forEach(item => {
        const product = repo.getProductById(item.productId);
        const goldCost = item.weightGrams * item.liveRate;
        const makingCost = item.weightGrams * (product ? product.makingChargePerGram : 0);
        const stoneValue = product ? product.stoneValue : 0;
        const unitPrice = goldCost + makingCost + stoneValue;

        specsHtml += `
            <div style="margin-bottom: 16px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 12px;">
                <strong style="color: var(--text-primary); font-size: 13px; text-transform: uppercase;">${item.name} (${item.quantity}x)</strong>
                <table style="width: 100%; margin-top: 6px; font-size: 12px; color: var(--text-secondary);">
                    <tr><td>Item Weight</td><td style="text-align: right;">${item.weightGrams}g</td></tr>
                    <tr><td>Live Gold Rate</td><td style="text-align: right;">₹${item.liveRate.toLocaleString(undefined, {minimumFractionDigits: 2})}/g</td></tr>
                    <tr><td>Making Charge</td><td style="text-align: right;">₹${product ? product.makingChargePerGram.toLocaleString() : 0}/g</td></tr>
                    <tr><td>Stone Value</td><td style="text-align: right;">₹${stoneValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td></tr>
                    <tr style="border-top: 1px dashed rgba(255,255,255,0.05); font-weight: 600; color: var(--gold-light);">
                        <td>Item Calculations</td>
                        <td style="text-align: right;">
                            Gold Cost: ₹${goldCost.toLocaleString(undefined, {minimumFractionDigits: 2})}<br>
                            Making Cost: ₹${makingCost.toLocaleString(undefined, {minimumFractionDigits: 2})}<br>
                            Stone Value: ₹${stoneValue.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                    </tr>
                    <tr style="font-weight: 700; color: var(--text-primary);">
                        <td>Unit Catalogue Price</td>
                        <td style="text-align: right; color: var(--gold-primary);">₹${unitPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                </table>
            </div>
        `;
    });
    document.getElementById('bargain-bill-specs-container').innerHTML = specsHtml;

    // Calculate and set calculations breakdown
    const totals = repo.calculateCartTotals(deal.items, 0);
    const finalTotal = deal.proposedPrice;
    const taxRate = totals.taxRate;
    const discountedSubtotal = finalTotal / (1 + taxRate / 100);
    const taxAmount = finalTotal - discountedSubtotal;
    const discountAmount = totals.subtotal - discountedSubtotal;

    document.getElementById('bargain-bill-original-subtotal').innerText = `₹${totals.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('bargain-bill-discount-amount').innerText = `-₹${discountAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('bargain-bill-discounted-subtotal').innerText = `₹${discountedSubtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('bargain-bill-tax').innerText = `₹${taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('bargain-bill-total').innerText = `₹${finalTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    // Show billing view section
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById('customer-bargain-billing-view').classList.add('active');
}

function finalizeBargainCheckout() {
    if (!otpVerified || !activeDealId) {
        showGlobalAlert('Order cannot be submitted without active OTP verification.', 'error');
        return;
    }
    
    const payMethodSelect = document.getElementById('bargain-bill-payment-method');
    const paymentMethod = payMethodSelect ? payMethodSelect.value : 'UPI';
    
    try {
        const tx = repo.finalizeApprovedDeal(activeDealId, paymentMethod);
        showGlobalAlert(`Bargained Order placed successfully! Inv No: ${tx.id}`, 'success');
        
        // Show Invoice Receipt print modal
        showReceipt(tx);
        
        // Refresh customer deals list
        renderCustomerDeals(activeOTPPhone);
        
        // Switch back to customer catalog view
        switchPortal('customer');
        
        // Reset state
        activeDealId = null;
        activeDealProposedPrice = 0;
    } catch (err) {
        showGlobalAlert(err.message, 'error');
    }
}

// --- Salesperson-Led Bargain Checkout Helpers ---
function checkEmployeeNotifications() {
    if (!activeEmployee) return;
    const deals = repo.getDeals();
    const approvedDeals = deals.filter(d => d.status === 'Approved');
    if (approvedDeals.length > 0) {
        showGlobalAlert(`${approvedDeals.length} deal(s) have been approved by the Owner and are ready for checkout!`, 'warning');
    }
    updateEmployeeDealsBadge();
}

function updateEmployeeDealsBadge() {
    const badge = document.getElementById('emp-deals-badge');
    if (!badge) return;
    const deals = repo.getDeals();
    const approvedCount = deals.filter(d => d.status === 'Approved').length;
    badge.innerText = approvedCount;
    badge.style.display = approvedCount > 0 ? 'inline-block' : 'none';
}

function renderEmployeeApprovedDeals() {
    const tbody = document.getElementById('employee-deals-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const deals = repo.getDeals();
    const approvedDeals = deals.filter(d => d.status === 'Approved');

    updateEmployeeDealsBadge();

    if (approvedDeals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No pending approved bargain deals.</td></tr>';
        return;
    }

    approvedDeals.forEach(d => {
        const clientInfo = `
            <strong>${d.clientName}</strong><br>
            <span style="font-size: 11px; color: var(--text-secondary);">${d.clientId}</span>
        `;
        tbody.innerHTML += `
            <tr>
                <td><strong>${d.id}</strong></td>
                <td>${clientInfo}</td>
                <td>₹${d.originalTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td style="color: var(--gold-primary); font-weight: 700;">₹${d.proposedPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td style="text-align: right;">
                    <button type="button" class="btn-primary" style="padding: 4px 12px; font-size: 12px;" onclick="showEmployeeBargainCheckout('${d.id}')">Checkout Deal</button>
                </td>
            </tr>
        `;
    });
}

function showEmployeeBargainCheckout(dealId) {
    const deals = repo.getDeals();
    const deal = deals.find(d => d.id === dealId);
    if (!deal || deal.status !== 'Approved') return;

    // Set hidden inputs
    document.getElementById('emp-checkout-deal-id').value = deal.id;

    // Set customer details
    document.getElementById('emp-checkout-client-name').innerText = deal.clientName;
    document.getElementById('emp-checkout-client-phone').innerText = deal.clientId;
    document.getElementById('emp-checkout-client-email').innerText = deal.clientEmail || 'None';

    // Populate specs
    let specsHtml = '';
    deal.items.forEach(item => {
        const product = repo.getProductById(item.productId);
        const goldCost = item.weightGrams * item.liveRate;
        const makingCost = item.weightGrams * (product ? product.makingChargePerGram : 0);
        const stoneValue = product ? product.stoneValue : 0;
        const unitPrice = goldCost + makingCost + stoneValue;

        specsHtml += `
            <div style="margin-bottom: 12px; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 8px;">
                <strong>${item.name} (${item.quantity}x)</strong>
                <table style="width: 100%; margin-top: 4px; font-size: 11px; color: var(--text-secondary);">
                    <tr><td>Weight</td><td style="text-align: right;">${item.weightGrams}g</td></tr>
                    <tr><td>Live Rate</td><td style="text-align: right;">₹${item.liveRate.toLocaleString()}/g</td></tr>
                    <tr><td>Making Charge</td><td style="text-align: right;">₹${product ? product.makingChargePerGram : 0}/g</td></tr>
                    <tr><td>Stone Value</td><td style="text-align: right;">₹${stoneValue.toLocaleString()}</td></tr>
                    <tr style="color: var(--gold-light);">
                        <td>Cost Breakdown</td>
                        <td style="text-align: right;">
                            Gold: ₹${goldCost.toLocaleString()}<br>
                            Making: ₹${makingCost.toLocaleString()}<br>
                            Stone: ₹${stoneValue.toLocaleString()}
                        </td>
                    </tr>
                </table>
            </div>
        `;
    });
    document.getElementById('emp-checkout-specs-container').innerHTML = specsHtml;

    // Calculate totals
    const totals = repo.calculateCartTotals(deal.items, 0);
    const finalTotal = deal.proposedPrice;
    const taxRate = totals.taxRate;
    const discountedSubtotal = finalTotal / (1 + taxRate / 100);
    const taxAmount = finalTotal - discountedSubtotal;
    const discountAmount = totals.subtotal - discountedSubtotal;

    document.getElementById('emp-checkout-original-total').innerText = `₹${totals.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('emp-checkout-discount-amount').innerText = `-₹${discountAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('emp-checkout-discounted-subtotal').innerText = `₹${discountedSubtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('emp-checkout-tax').innerText = `₹${taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('emp-checkout-total').innerText = `₹${finalTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    // Reset payment dropdown
    document.getElementById('emp-checkout-payment-method').value = 'UPI';

    // Open overlay
    document.getElementById('employee-bargain-checkout-modal-overlay').classList.add('active');
}
