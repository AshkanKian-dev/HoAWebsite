// Payment System Implementation
// Initialize payment providers and handle payment processing

// Escape HTML to prevent XSS attacks
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Production Mode Configuration
// Test mode is determined by checking if credentials are configured
// If credentials are missing or invalid, fall back to test mode
const TEST_MODE_DELAY = 1500; // Simulated payment processing delay in milliseconds

// Backend API Configuration
// Use API_BASE_URL from auth.js if available, otherwise set it
const API_BASE = window.API_BASE_URL || 'http://localhost:3000';
window.API_BASE_URL = API_BASE; // Make sure it's available globally

// Payment configuration - will be initialized from environment/config
const paymentConfig = {
    stripe: {
        publishableKey: '', // Will be set from config or environment
        initialized: false
    },
    paypal: {
        clientId: '', // Will be set from config or environment
        initialized: false
    },
    applePay: {
        merchantId: '', // Will be set from config or environment
        initialized: false
    },
    googlePay: {
        merchantId: '', // Will be set from config or environment
        initialized: false
    },
    currentProduct: null,
    currentPaymentMethod: 'stripe',
    testMode: false // Will be determined dynamically
};

// Determine if we're in test mode based on credentials
function determineTestMode() {
    // Check if we have valid credentials
    const hasStripeKey = paymentConfig.stripe.publishableKey && 
                         paymentConfig.stripe.publishableKey.startsWith('pk_');
    const hasPayPalKey = paymentConfig.paypal.clientId && 
                         paymentConfig.paypal.clientId !== 'YOUR_PAYPAL_CLIENT_ID';
    
    // If we're on localhost or missing credentials, use test mode
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    // Check for dev mode override
    const isDevMode = window.devMode && window.devMode.isEnabled();
    
    return isDevMode || isLocalhost || (!hasStripeKey && !hasPayPalKey);
}

// Load payment configuration from meta tags or window config
function loadPaymentConfig() {
    // Try to get Stripe key from meta tag or window config
    const stripeMeta = document.querySelector('meta[name="stripe-publishable-key"]');
    if (stripeMeta && stripeMeta.getAttribute('content')) {
        paymentConfig.stripe.publishableKey = stripeMeta.getAttribute('content');
    } else if (window.STRIPE_PUBLISHABLE_KEY) {
        paymentConfig.stripe.publishableKey = window.STRIPE_PUBLISHABLE_KEY;
    }
    
    // Try to get PayPal client ID from meta tag or window config
    const paypalMeta = document.querySelector('meta[name="paypal-client-id"]');
    if (paypalMeta && paypalMeta.getAttribute('content')) {
        paymentConfig.paypal.clientId = paypalMeta.getAttribute('content');
        // Load PayPal SDK dynamically
        loadPayPalSDK(paymentConfig.paypal.clientId);
    } else if (window.PAYPAL_CLIENT_ID) {
        paymentConfig.paypal.clientId = window.PAYPAL_CLIENT_ID;
        loadPayPalSDK(paymentConfig.paypal.clientId);
    }
    
    // Try to get Apple Pay merchant ID
    const applePayMeta = document.querySelector('meta[name="apple-pay-merchant-id"]');
    if (applePayMeta && applePayMeta.getAttribute('content')) {
        paymentConfig.applePay.merchantId = applePayMeta.getAttribute('content');
    } else if (window.APPLE_PAY_MERCHANT_ID) {
        paymentConfig.applePay.merchantId = window.APPLE_PAY_MERCHANT_ID;
    }
    
    // Try to get Google Pay merchant ID
    const googlePayMeta = document.querySelector('meta[name="google-pay-merchant-id"]');
    if (googlePayMeta && googlePayMeta.getAttribute('content')) {
        paymentConfig.googlePay.merchantId = googlePayMeta.getAttribute('content');
    } else if (window.GOOGLE_PAY_MERCHANT_ID) {
        paymentConfig.googlePay.merchantId = window.GOOGLE_PAY_MERCHANT_ID;
    }
    
    // Determine test mode
    paymentConfig.testMode = determineTestMode();
}

// Load PayPal SDK dynamically
function loadPayPalSDK(clientId) {
    if (!clientId || clientId === 'YOUR_PAYPAL_CLIENT_ID' || clientId === '') {
        console.warn('PayPal client ID not configured');
        return;
    }

    // Check if PayPal SDK is already loaded
    if (typeof paypal !== 'undefined') {
        console.log('PayPal SDK already loaded');
        return;
    }

    // Check if script is already in the DOM
    const existingScript = document.querySelector('script[data-paypal-sdk]');
    if (existingScript) {
        console.log('PayPal SDK script already exists');
        return;
    }

    // Create and load PayPal SDK script
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD`;
    script.setAttribute('data-sdk-integration-source', 'button-factory');
    script.setAttribute('data-paypal-sdk', 'true');
    script.async = true;
    
    script.onload = function() {
        console.log('PayPal SDK loaded successfully');
        paymentConfig.paypal.initialized = true;
    };
    
    script.onerror = function() {
        console.error('Failed to load PayPal SDK');
    };
    
    document.head.appendChild(script);
}

// Initialize Stripe
let stripe = null;
let stripeElements = null;
let stripeCardElement = null;

// Initialize payment providers
function initializePaymentProviders() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePaymentProviders);
        return;
    }
    
    // Load configuration first
    loadPaymentConfig();
    
    if (paymentConfig.testMode) {
        console.log('🧪 Running in TEST MODE - Payment providers will simulate behavior');
        console.log('💡 Configure payment credentials for production mode');
        
        // Initialize test mode - allow UI to work without real credentials
        paymentConfig.stripe.initialized = true;
        paymentConfig.paypal.initialized = true;
        
        // Show test mode indicator after a short delay to ensure DOM is ready
        setTimeout(() => {
            showTestModeIndicator();
        }, 100);
    } else {
        // Initialize Stripe (Production Mode)
        if (typeof Stripe !== 'undefined' && paymentConfig.stripe.publishableKey && paymentConfig.stripe.publishableKey.startsWith('pk_')) {
            try {
                stripe = Stripe(paymentConfig.stripe.publishableKey);
                stripeElements = stripe.elements();
                paymentConfig.stripe.initialized = true;
                console.log('✅ Stripe initialized');
            } catch (e) {
                console.warn('Stripe initialization failed:', e);
            }
        } else {
            console.warn('Stripe not initialized: Missing publishable key');
        }

        // Initialize PayPal (Production Mode)
        if (typeof paypal !== 'undefined' && paymentConfig.paypal.clientId && paymentConfig.paypal.clientId !== 'YOUR_PAYPAL_CLIENT_ID') {
            paymentConfig.paypal.initialized = true;
            console.log('✅ PayPal initialized');
        } else {
            console.warn('PayPal not initialized: Missing client ID');
        }
    }

    // Check for Apple Pay availability (only works on HTTPS or in test mode)
    if (window.location.protocol === 'https:' || paymentConfig.testMode) {
        if (paymentConfig.testMode) {
            // In test mode, show Apple Pay button for UI testing
            const applePayBtn = document.getElementById('applePayBtn');
            if (applePayBtn) applePayBtn.style.display = 'block';
        } else {
            checkApplePayAvailability();
        }
    }
    
    // Check for Google Pay availability (only works on HTTPS or in test mode)
    if (window.location.protocol === 'https:' || paymentConfig.testMode) {
        if (paymentConfig.testMode) {
            // In test mode, show Google Pay button for UI testing
            const googlePayBtn = document.getElementById('googlePayBtn');
            if (googlePayBtn) googlePayBtn.style.display = 'block';
        } else {
            checkGooglePayAvailability();
        }
    }
}

// Show test mode indicator
function showTestModeIndicator() {
    // Remove existing indicator if any
    const existing = document.getElementById('testModeIndicator');
    if (existing) {
        existing.remove();
    }
    
    const indicator = document.createElement('div');
    indicator.id = 'testModeIndicator';
    indicator.innerHTML = '🧪 TEST MODE - Payments are simulated';
    indicator.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: rgba(212, 175, 55, 0.95);
        color: #000;
        padding: 0.75rem 1.25rem;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: bold;
        z-index: 99999;
        box-shadow: 0 4px 20px rgba(212, 175, 55, 0.5);
        border: 2px solid var(--secondary-color);
        pointer-events: none;
    `;
    document.body.appendChild(indicator);
    console.log('✅ Test mode indicator displayed');
}

// Check Apple Pay availability
function checkApplePayAvailability() {
    if (window.ApplePaySession && ApplePaySession.canMakePayments()) {
        document.getElementById('applePayBtn').style.display = 'block';
        return true;
    }
    return false;
}

// Check Google Pay availability
function checkGooglePayAvailability() {
    if (window.google && google.payments) {
        const environment = paymentConfig.testMode ? 'TEST' : 'PRODUCTION';
        const paymentsClient = new google.payments.api.PaymentsClient({
            environment: environment
        });
        
        paymentsClient.isReadyToPay({
            apiVersion: 2,
            apiVersionMinor: 0,
            allowedPaymentMethods: [{
                type: 'CARD',
                parameters: {
                    allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                    allowedCardNetworks: ['AMEX', 'DISCOVER', 'JCB', 'MASTERCARD', 'VISA']
                }
            }]
        }).then(response => {
            if (response.result) {
                const googlePayBtn = document.getElementById('googlePayBtn');
                if (googlePayBtn) googlePayBtn.style.display = 'block';
                initializeGooglePay();
            }
        }).catch(err => {
            console.log('Google Pay not available:', err);
        });
    }
}

// Initialize Google Pay
function initializeGooglePay() {
    const googlePayForm = document.getElementById('googlePayPaymentForm');
    if (!googlePayForm) {
        console.error('Google Pay form not found');
        return;
    }
    
    googlePayForm.classList.add('active');
    
    const container = document.getElementById('googlePayButtonContainer');
    if (!container) {
        console.error('Google Pay button container not found');
        return;
    }
    
    // Clear any existing buttons
    container.innerHTML = '';
    
    if (paymentConfig.testMode) {
        // Test mode - show mock Google Pay button
        console.log('🧪 TEST MODE: Showing mock Google Pay button');
        const mockButton = document.createElement('button');
        mockButton.className = 'btn btn-primary payment-submit-btn';
        mockButton.style.width = '100%';
        mockButton.style.marginTop = '1rem';
        mockButton.style.background = '#4285f4';
        mockButton.innerHTML = `
            <span class="btn-text">Pay with Google Pay (Test Mode)</span>
        `;
        mockButton.onclick = onGooglePayButtonClicked;
        container.appendChild(mockButton);
        return;
    }

    // Production mode - use real Google Pay
    if (typeof google === 'undefined' || !google.payments) {
        console.error('Google Pay SDK not loaded');
        // Show a fallback button
        const fallbackButton = document.createElement('button');
        fallbackButton.className = 'btn btn-primary payment-submit-btn';
        fallbackButton.style.width = '100%';
        fallbackButton.style.marginTop = '1rem';
        fallbackButton.style.background = '#4285f4';
        fallbackButton.innerHTML = '<span class="btn-text">Pay with Google Pay</span>';
        fallbackButton.onclick = onGooglePayButtonClicked;
        container.appendChild(fallbackButton);
        return;
    }

    const environment = paymentConfig.testMode ? 'TEST' : 'PRODUCTION';
    const paymentsClient = new google.payments.api.PaymentsClient({
        environment: environment
    });

    const button = paymentsClient.createButton({
        onClick: onGooglePayButtonClicked,
        buttonColor: 'black',
        buttonType: 'pay',
        buttonSizeMode: 'fill'
    });

    container.appendChild(button);
}

// Open payment modal
function openPaymentModal(productData) {
    console.log('💳 Opening payment modal for:', productData);
    
    if (!productData) {
        console.error('No product data provided');
        alert('Error: No product data provided');
        return;
    }
    
    paymentConfig.currentProduct = productData;
    
    // Wait for DOM if needed
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            openPaymentModal(productData);
        });
        return;
    }
    
    // Set product details
    const productNameEl = document.getElementById('paymentProductName');
    const productPriceEl = document.getElementById('paymentProductPrice');
    const productImageEl = document.getElementById('paymentProductImage');
    const customerForm = document.getElementById('customerInfoForm');
    const paymentModal = document.getElementById('paymentModal');
    
    if (!productNameEl || !productPriceEl || !productImageEl || !customerForm || !paymentModal) {
        console.error('Payment modal elements not found. Available IDs:', {
            productName: !!productNameEl,
            productPrice: !!productPriceEl,
            productImage: !!productImageEl,
            customerForm: !!customerForm,
            paymentModal: !!paymentModal
        });
        alert('Error: Payment modal not found. Please refresh the page.');
        return;
    }
    
    productNameEl.textContent = productData.title;
    productPriceEl.textContent = productData.price;
    productImageEl.src = productData.image;
    productImageEl.alt = '';
    // Hide image if it fails to load, show gradient background instead
    productImageEl.onerror = function() {
        this.style.display = 'none';
        this.parentElement.style.background = 'linear-gradient(135deg, rgba(107,44,145,0.5), rgba(212,175,55,0.3))';
    };
    productImageEl.onload = function() {
        this.style.display = 'block';
        this.parentElement.style.background = '';
    };
    
    // Reset form
    customerForm.reset();
    paymentModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Initialize payment method
    initializePaymentMethod('stripe');
    
    console.log('✅ Payment modal opened');
}

// Expose function immediately when script loads
window.openPaymentModal = openPaymentModal;

// Close payment modal
function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
    document.body.style.overflow = '';
    
    // Reset forms
    document.getElementById('customerInfoForm').reset();
    if (stripeCardElement) {
        stripeCardElement.clear();
    }
    
    // Hide all payment forms
    document.querySelectorAll('.payment-form').forEach(form => {
        form.classList.remove('active');
    });
}

// Close payment success modal
function closePaymentSuccessModal() {
    document.getElementById('paymentSuccessModal').classList.remove('active');
    document.body.style.overflow = '';
    closePaymentModal();
}

// Initialize payment system when DOM is ready
function initPaymentSystem() {
    console.log('🚀 Payment system initializing...');
    
    // Payment method buttons
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const method = this.getAttribute('data-method');
            selectPaymentMethod(method);
        });
    });

    // Payment modal close button
    const paymentCloseBtn = document.querySelector('.payment-modal-close');
    if (paymentCloseBtn) {
        paymentCloseBtn.addEventListener('click', closePaymentModal);
    }

    // Overlay click to close
    const paymentOverlay = document.querySelector('#paymentModal .modal-overlay');
    if (paymentOverlay) {
        paymentOverlay.addEventListener('click', closePaymentModal);
    }

    // Initialize payment providers
    initializePaymentProviders();
    
    console.log('✅ Payment system initialized');
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPaymentSystem);
} else {
    // DOM is already ready
    initPaymentSystem();
}

// Select payment method
function selectPaymentMethod(method) {
    paymentConfig.currentPaymentMethod = method;
    
    // Update button states
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-method="${method}"]`).classList.add('active');
    
    // Hide all payment forms
    document.querySelectorAll('.payment-form').forEach(form => {
        form.classList.remove('active');
    });
    
    // Show selected payment form
    initializePaymentMethod(method);
}

// Initialize payment method
function initializePaymentMethod(method) {
    switch(method) {
        case 'stripe':
            initializeStripe();
            break;
        case 'paypal':
            initializePayPal();
            break;
        case 'applepay':
            initializeApplePay();
            break;
        case 'googlepay':
            initializeGooglePay();
            break;
    }
}

// Initialize Stripe Elements
function initializeStripe() {
    if (!paymentConfig.stripe.initialized) {
        console.error('Stripe not initialized');
        return;
    }

    const stripeForm = document.getElementById('stripePaymentForm');
    stripeForm.classList.add('active');

    if (paymentConfig.testMode) {
        // In test mode, show a mock card input form
        const stripeElement = document.getElementById('stripeCardElement');
        if (stripeElement) {
            stripeElement.innerHTML = `
                <div class="test-card-form">
                    <div class="form-group">
                        <label>Card Number (Test Mode)</label>
                        <input type="text" placeholder="4242 4242 4242 4242" class="test-card-input" maxlength="19">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label>Expiry</label>
                            <input type="text" placeholder="12/25" class="test-card-input" maxlength="5">
                        </div>
                        <div class="form-group">
                            <label>CVC</label>
                            <input type="text" placeholder="123" class="test-card-input" maxlength="3">
                        </div>
                    </div>
                    <p style="color: var(--secondary-color); font-size: 0.85rem; margin-top: 0.5rem;">
                        💡 Test Mode: Any card details will work
                    </p>
                </div>
            `;
        }
        
        // Handle form submission
        const submitBtn = document.getElementById('stripeSubmitBtn');
        if (submitBtn) submitBtn.onclick = handleStripePayment;
    } else {
        // Production mode - use real Stripe Elements
        // Create card element if not exists
        if (!stripeCardElement) {
            const style = {
                base: {
                    color: '#ffffff',
                    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
                    fontSmoothing: 'antialiased',
                    fontSize: '16px',
                    '::placeholder': {
                        color: '#aab7c4'
                    }
                },
                invalid: {
                    color: '#fa755a',
                    iconColor: '#fa755a'
                }
            };

            stripeCardElement = stripeElements.create('card', { style: style });
            stripeCardElement.mount('#stripeCardElement');
            
            // Handle real-time validation errors
            stripeCardElement.on('change', function(event) {
                const displayError = document.getElementById('stripeCardErrors');
                if (event.error) {
                    displayError.textContent = event.error.message;
                } else {
                    displayError.textContent = '';
                }
            });
        }

        // Handle form submission
        const submitBtn = document.getElementById('stripeSubmitBtn');
        submitBtn.onclick = handleStripePayment;
    }
}

// Handle Stripe payment
async function handleStripePayment() {
    // Validate customer info form
    const customerForm = document.getElementById('customerInfoForm');
    if (!customerForm.checkValidity()) {
        customerForm.reportValidity();
        return;
    }

    const submitBtn = document.getElementById('stripeSubmitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline';
    submitBtn.disabled = true;

    // Get customer info
    const customerData = {
        name: document.getElementById('customerName').value,
        email: document.getElementById('customerEmail').value,
        phone: document.getElementById('customerPhone').value,
        characterName: document.getElementById('characterName').value.trim(),
        steamId: document.getElementById('steamId').value.trim() || null,
        createAccount: document.getElementById('createAccount').checked
    };

    // Validate character name
    if (!customerData.characterName) {
        showPaymentError('Character name is required for delivery');
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
        return;
    }

    // Check for developer mode
    const isDevMode = window.devMode && window.devMode.isEnabled();
    
    if (paymentConfig.testMode || isDevMode) {
        // Test/Dev mode - simulate payment processing
        console.log(isDevMode ? '🔧 DEV MODE' : '🧪 TEST MODE', ': Simulating Stripe payment...');
        console.log('Customer Data:', customerData);
        console.log('Product:', paymentConfig.currentProduct);
        
        setTimeout(() => {
            // In dev mode, add mock order
            if (isDevMode && window.mockData) {
                const mockOrder = window.mockData.addOrder({
                    customer_email: customerData.email,
                    steam_id: customerData.steamId,
                    character_name: customerData.characterName,
                    product_id: paymentConfig.currentProduct.productId || paymentConfig.currentProduct.id || 'mock_product',
                    product_name: paymentConfig.currentProduct.title,
                    price: parseFloat(getAmountFromPrice(paymentConfig.currentProduct.price)),
                    payment_provider: 'stripe',
                    payment_intent_id: 'dev_mode_' + Date.now(),
                    status: 'delivered'
                });
                console.log('Mock order created:', mockOrder);
            }
            
            showPaymentSuccess(customerData);
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
            submitBtn.disabled = false;
        }, TEST_MODE_DELAY);
        return;
    }

    // Production mode - actual Stripe payment processing
    try {
        // Get product ID from current product
        const productId = paymentConfig.currentProduct.productId || 
                         paymentConfig.currentProduct.id || 
                         getProductIdFromTitle(paymentConfig.currentProduct.title);

        // Create payment intent with metadata
        const response = await fetch(`${API_BASE}/api/create-payment-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: Math.round(parseFloat(getAmountFromPrice(paymentConfig.currentProduct.price)) * 100), // Convert to cents
                currency: 'usd',
                product_id: productId,
                metadata: {
                    character_name: customerData.characterName,
                    steam_id: customerData.steamId,
                    email: customerData.email,
                    product_name: paymentConfig.currentProduct.title
                }
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create payment intent');
        }

        const { clientSecret } = await response.json();

        // Confirm payment with Stripe
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: stripeCardElement,
                billing_details: {
                    name: customerData.name,
                    email: customerData.email,
                    phone: customerData.phone
                }
            }
        });

        if (error) {
            throw error;
        }

        // Payment successful - webhook will handle delivery
        showPaymentSuccess(customerData, paymentIntent.id);
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;

    } catch (error) {
        console.error('Payment error:', error);
        showPaymentError(error.message || 'Payment failed. Please try again.');
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
    }
}

// Initialize PayPal
function initializePayPal() {
    const paypalForm = document.getElementById('paypalPaymentForm');
    paypalForm.classList.add('active');

    const container = document.getElementById('paypalButtonContainer');
    container.innerHTML = ''; // Clear previous button

    if (paymentConfig.testMode) {
        // Test mode - show mock PayPal button
        console.log('🧪 TEST MODE: Showing mock PayPal button');
        const mockButton = document.createElement('button');
        mockButton.className = 'btn btn-primary payment-submit-btn';
        mockButton.style.width = '100%';
        mockButton.style.marginTop = '1rem';
        mockButton.innerHTML = `
            <span class="btn-text">Pay with PayPal (Test Mode)</span>
        `;
        mockButton.onclick = async function() {
            // Validate customer info form
            const customerForm = document.getElementById('customerInfoForm');
            if (!customerForm.checkValidity()) {
                customerForm.reportValidity();
                return;
            }
            
            const customerData = {
                name: document.getElementById('customerName').value,
                email: document.getElementById('customerEmail').value,
                characterName: document.getElementById('characterName').value.trim(),
                steamId: document.getElementById('steamId').value.trim() || null
            };

            if (!customerData.characterName) {
                showPaymentError('Character name is required for delivery');
                return;
            }
            
            mockButton.disabled = true;
            mockButton.innerHTML = '<span class="btn-loader">Processing...</span>';
            
            const isDevMode = window.devMode && window.devMode.isEnabled();
            console.log(isDevMode ? '🔧 DEV MODE' : '🧪 TEST MODE', ': Simulating PayPal payment...');
            
            setTimeout(() => {
                // In dev mode, add mock order
                if (isDevMode && window.mockData) {
                    const mockOrder = window.mockData.addOrder({
                        customer_email: customerData.email,
                        steam_id: customerData.steamId,
                        character_name: customerData.characterName,
                        product_id: paymentConfig.currentProduct.productId || paymentConfig.currentProduct.id || 'mock_product',
                        product_name: paymentConfig.currentProduct.title,
                        price: parseFloat(getAmountFromPrice(paymentConfig.currentProduct.price)),
                        payment_provider: 'paypal',
                        payment_intent_id: 'dev_mode_paypal_' + Date.now(),
                        status: 'delivered'
                    });
                    console.log('Mock order created:', mockOrder);
                }
                
                showPaymentSuccess(customerData);
                mockButton.disabled = false;
                mockButton.innerHTML = '<span class="btn-text">Pay with PayPal (Test Mode)</span>';
            }, TEST_MODE_DELAY);
        };
        container.appendChild(mockButton);
        return;
    }

    // Production mode - use real PayPal SDK with backend order creation
    if (typeof paypal === 'undefined') {
        console.error('PayPal SDK not loaded');
        return;
    }

    // Get customer data when button is clicked
    const getCustomerData = () => {
        return {
            name: document.getElementById('customerName').value,
            email: document.getElementById('customerEmail').value,
            characterName: document.getElementById('characterName').value.trim(),
            steamId: document.getElementById('steamId').value.trim() || null
        };
    };

    const productId = paymentConfig.currentProduct.productId || 
                     paymentConfig.currentProduct.id || 
                     getProductIdFromTitle(paymentConfig.currentProduct.title);

    paypal.Buttons({
        createOrder: async function(data, actions) {
            // Validate customer info form first
            const customerForm = document.getElementById('customerInfoForm');
            if (!customerForm.checkValidity()) {
                customerForm.reportValidity();
                throw new Error('Please fill in all required fields');
            }

            const customerData = getCustomerData();
            if (!customerData.characterName) {
                throw new Error('Character name is required');
            }

            try {
                // Create order on backend
                const response = await fetch(`${API_BASE}/api/create-paypal-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: getAmountFromPrice(paymentConfig.currentProduct.price),
                        currency: 'USD',
                        product_id: productId,
                        metadata: {
                            character_name: customerData.characterName,
                            steam_id: customerData.steamId,
                            email: customerData.email,
                            product_name: paymentConfig.currentProduct.title
                        }
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to create PayPal order');
                }

                const { orderId } = await response.json();
                return orderId;
            } catch (error) {
                console.error('Error creating PayPal order:', error);
                showPaymentError(error.message || 'Failed to create PayPal order');
                throw error;
            }
        },
        onApprove: async function(data, actions) {
            try {
                // Capture the order on backend
                const response = await fetch(`${API_BASE}/api/capture-paypal-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId: data.orderID
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to capture PayPal order');
                }

                const result = await response.json();
                const customerData = getCustomerData();
                showPaymentSuccess(customerData, result.captureId || result.orderId);
            } catch (error) {
                console.error('Error capturing PayPal order:', error);
                showPaymentError(error.message || 'PayPal payment failed. Please try again.');
            }
        },
        onError: function(err) {
            console.error('PayPal error:', err);
            showPaymentError('PayPal payment failed. Please try again.');
        },
        onCancel: function(data) {
            console.log('PayPal payment cancelled');
        },
        style: {
            color: 'gold',
            shape: 'rect',
            label: 'pay',
            height: 50
        }
    }).render('#paypalButtonContainer');
}

// Initialize Apple Pay
function initializeApplePay() {
    const applePayForm = document.getElementById('applePayPaymentForm');
    applePayForm.classList.add('active');

    const button = document.getElementById('applePayButton');
    button.style.display = 'block';
    
    button.onclick = function() {
        // Validate customer info form
        const customerForm = document.getElementById('customerInfoForm');
        if (!customerForm.checkValidity()) {
            customerForm.reportValidity();
            return;
        }

        const isDevMode = window.devMode && window.devMode.isEnabled();
        
        if (paymentConfig.testMode || isDevMode) {
            // Test/Dev mode - simulate Apple Pay
            console.log(isDevMode ? '🔧 DEV MODE' : '🧪 TEST MODE', ': Simulating Apple Pay payment...');
            button.disabled = true;
            button.innerHTML = '<span class="btn-loader">Processing...</span>';
            
            setTimeout(() => {
                // In dev mode, add mock order
                if (isDevMode && window.mockData) {
                    const customerData = {
                        name: document.getElementById('customerName').value,
                        email: document.getElementById('customerEmail').value,
                        characterName: document.getElementById('characterName').value.trim(),
                        steamId: document.getElementById('steamId').value.trim() || null
                    };
                    const mockOrder = window.mockData.addOrder({
                        customer_email: customerData.email,
                        steam_id: customerData.steamId,
                        character_name: customerData.characterName,
                        product_id: paymentConfig.currentProduct.productId || paymentConfig.currentProduct.id || 'mock_product',
                        product_name: paymentConfig.currentProduct.title,
                        price: parseFloat(getAmountFromPrice(paymentConfig.currentProduct.price)),
                        payment_provider: 'apple_pay',
                        payment_intent_id: 'dev_mode_apple_' + Date.now(),
                        status: 'delivered'
                    });
                    console.log('Mock order created:', mockOrder);
                }
                
                const customerData = {
                    name: document.getElementById('customerName').value,
                    email: document.getElementById('customerEmail').value,
                    characterName: document.getElementById('characterName').value.trim()
                };
                showPaymentSuccess(customerData);
                button.disabled = false;
                button.innerHTML = '<span class="btn-text">Pay with Apple Pay</span>';
            }, TEST_MODE_DELAY);
            return;
        }

        // Production mode - use real Apple Pay
        if (!window.ApplePaySession || !ApplePaySession.canMakePayments()) {
            showPaymentError('Apple Pay is not available on this device');
            return;
        }

        const productId = paymentConfig.currentProduct.productId || 
                         paymentConfig.currentProduct.id || 
                         getProductIdFromTitle(paymentConfig.currentProduct.title);

        const request = {
            countryCode: 'US',
            currencyCode: 'USD',
            supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
            merchantCapabilities: ['supports3DS'],
            total: {
                label: paymentConfig.currentProduct.title,
                amount: getAmountFromPrice(paymentConfig.currentProduct.price)
            }
        };

        const session = new ApplePaySession(3, request);

        session.onvalidatemerchant = async function(event) {
            try {
                // Validate merchant with backend
                const response = await fetch(`${API_BASE}/api/apple-pay/validate-merchant`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        validationURL: event.validationURL
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error('Apple Pay merchant validation failed:', error);
                    session.abort();
                    showPaymentError('Apple Pay validation failed. Please try another payment method.');
                    return;
                }

                const { merchantSession } = await response.json();
                session.completeMerchantValidation(merchantSession);
            } catch (error) {
                console.error('Error validating Apple Pay merchant:', error);
                session.abort();
                showPaymentError('Apple Pay validation failed. Please try another payment method.');
            }
        };

        session.onpaymentauthorized = async function(event) {
            try {
                const customerData = {
                    name: document.getElementById('customerName').value,
                    email: document.getElementById('customerEmail').value,
                    characterName: document.getElementById('characterName').value.trim(),
                    steamId: document.getElementById('steamId').value.trim() || null
                };

                // Process payment through Stripe using Apple Pay token
                const productId = paymentConfig.currentProduct.productId || 
                                 paymentConfig.currentProduct.id || 
                                 getProductIdFromTitle(paymentConfig.currentProduct.title);

                // Create payment intent first
                const intentResponse = await fetch(`${API_BASE}/api/create-payment-intent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: Math.round(parseFloat(getAmountFromPrice(paymentConfig.currentProduct.price)) * 100),
                        currency: 'usd',
                        product_id: productId,
                        metadata: {
                            character_name: customerData.characterName,
                            steam_id: customerData.steamId,
                            email: customerData.email,
                            product_name: paymentConfig.currentProduct.title,
                            payment_method: 'apple_pay'
                        }
                    })
                });

                if (!intentResponse.ok) {
                    throw new Error('Failed to create payment intent');
                }

                const { clientSecret } = await intentResponse.json();
                
                // Convert Apple Pay token to Stripe payment method
                // Apple Pay provides a payment token that needs to be converted
                const paymentMethod = await stripe.createPaymentMethod({
                    type: 'card',
                    card: {
                        token: event.payment.token.paymentData
                    },
                    billing_details: {
                        name: customerData.name,
                        email: customerData.email
                    }
                });

                if (paymentMethod.error) {
                    throw paymentMethod.error;
                }

                // Confirm payment with the payment method
                const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: paymentMethod.paymentMethod.id
                });

                if (error) {
                    throw error;
                }

                session.completePayment(ApplePaySession.STATUS_SUCCESS);
                showPaymentSuccess(customerData, paymentIntent.id);
            } catch (error) {
                console.error('Apple Pay payment error:', error);
                session.completePayment(ApplePaySession.STATUS_FAILURE);
                showPaymentError(error.message || 'Apple Pay payment failed. Please try again.');
            }
        };

        session.begin();
    };
}

// Handle Google Pay button click
function onGooglePayButtonClicked() {
    // Validate customer info form
    const customerForm = document.getElementById('customerInfoForm');
    if (!customerForm.checkValidity()) {
        customerForm.reportValidity();
        return;
    }

    const isDevMode = window.devMode && window.devMode.isEnabled();
    
    if (paymentConfig.testMode || isDevMode) {
        // Test/Dev mode - simulate Google Pay
        console.log(isDevMode ? '🔧 DEV MODE' : '🧪 TEST MODE', ': Simulating Google Pay payment...');
        
        // Show loading state
        const button = document.querySelector('#googlePayButtonContainer button');
        if (button) {
            button.disabled = true;
            button.style.opacity = '0.6';
        }
        
        setTimeout(() => {
            // In dev mode, add mock order
            if (isDevMode && window.mockData) {
                const customerData = {
                    name: document.getElementById('customerName').value,
                    email: document.getElementById('customerEmail').value,
                    characterName: document.getElementById('characterName').value.trim(),
                    steamId: document.getElementById('steamId').value.trim() || null
                };
                const mockOrder = window.mockData.addOrder({
                    customer_email: customerData.email,
                    steam_id: customerData.steamId,
                    character_name: customerData.characterName,
                    product_id: paymentConfig.currentProduct.productId || paymentConfig.currentProduct.id || 'mock_product',
                    product_name: paymentConfig.currentProduct.title,
                    price: parseFloat(getAmountFromPrice(paymentConfig.currentProduct.price)),
                    payment_provider: 'google_pay',
                    payment_intent_id: 'dev_mode_google_' + Date.now(),
                    status: 'delivered'
                });
                console.log('Mock order created:', mockOrder);
            }
            
            const customerData = {
                name: document.getElementById('customerName').value,
                email: document.getElementById('customerEmail').value,
                characterName: document.getElementById('characterName').value.trim()
            };
            showPaymentSuccess(customerData);
            if (button) {
                button.disabled = false;
                button.style.opacity = '1';
            }
        }, TEST_MODE_DELAY);
        return;
    }

    // Production mode - use real Google Pay
    if (!window.google || !google.payments) {
        showPaymentError('Google Pay SDK not loaded');
        return;
    }

    const environment = paymentConfig.testMode ? 'TEST' : 'PRODUCTION';
    const paymentsClient = new google.payments.api.PaymentsClient({
        environment: environment
    });

    const productId = paymentConfig.currentProduct.productId || 
                     paymentConfig.currentProduct.id || 
                     getProductIdFromTitle(paymentConfig.currentProduct.title);

    const paymentDataRequest = {
        apiVersion: 2,
        apiVersionMinor: 0,
        merchantInfo: {
            merchantId: paymentConfig.googlePay.merchantId || 'YOUR_MERCHANT_ID',
            merchantName: 'Heart of Acheron'
        },
        allowedPaymentMethods: [{
            type: 'CARD',
            parameters: {
                allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                allowedCardNetworks: ['AMEX', 'DISCOVER', 'JCB', 'MASTERCARD', 'VISA']
            },
            tokenizationSpecification: {
                type: 'PAYMENT_GATEWAY',
                parameters: {
                    gateway: 'stripe',
                    'stripe:version': '2018-10-31',
                    'stripe:publishableKey': paymentConfig.stripe.publishableKey
                }
            }
        }],
        transactionInfo: {
            totalPriceStatus: 'FINAL',
            totalPriceLabel: 'Total',
            totalPrice: getAmountFromPrice(paymentConfig.currentProduct.price),
            currencyCode: 'USD'
        }
    };

    paymentsClient.loadPaymentData(paymentDataRequest)
        .then(async function(paymentData) {
            try {
                const customerData = {
                    name: document.getElementById('customerName').value,
                    email: document.getElementById('customerEmail').value,
                    characterName: document.getElementById('characterName').value.trim(),
                    steamId: document.getElementById('steamId').value.trim() || null
                };

                // Process payment through backend
                const response = await fetch(`${API_BASE}/api/google-pay/process-payment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        paymentData: paymentData,
                        amount: getAmountFromPrice(paymentConfig.currentProduct.price),
                        currency: 'usd',
                        product_id: productId,
                        metadata: {
                            character_name: customerData.characterName,
                            steam_id: customerData.steamId,
                            email: customerData.email,
                            product_name: paymentConfig.currentProduct.title
                        }
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to process Google Pay payment');
                }

                const result = await response.json();
                showPaymentSuccess(customerData, result.paymentIntentId);
            } catch (error) {
                console.error('Google Pay processing error:', error);
                showPaymentError(error.message || 'Google Pay payment failed. Please try again.');
            }
        })
        .catch(function(err) {
            console.error('Google Pay error:', err);
            showPaymentError('Google Pay payment failed. Please try again.');
        });
}

// Get amount from price string (e.g., "$25.00" -> "25.00")
function getAmountFromPrice(priceString) {
    return priceString.replace('$', '').trim();
}

// Show payment success
function showPaymentSuccess(customerData = null, orderId = null) {
    closePaymentModal();
    const successModal = document.getElementById('paymentSuccessModal');
    const successBody = successModal.querySelector('.payment-success-body');
    
    // Update success message with delivery info
    if (customerData && customerData.characterName) {
        const message = successBody.querySelector('p');
        if (message) {
            // Escape HTML to prevent XSS
            const safeCharacterName = escapeHtml(customerData.characterName);
            const safeOrderId = orderId ? escapeHtml(orderId) : '';
            message.innerHTML = `Thank you for your purchase! Your items are being delivered to <strong>${safeCharacterName}</strong> right now. You will receive a confirmation email shortly.${safeOrderId ? `<br><br><small>Order ID: ${safeOrderId}</small>` : ''}`;
        }
    }
    
    successModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Helper function to get product ID from title
function getProductIdFromTitle(title) {
    const productMap = {
        'Supporter Package': 'supporter',
        'Hero Package': 'hero',
        'Legend Package': 'legend',
        'Legendary Weapon': 'weapon',
        'Elite Armor Set': 'armor',
        'Resource Pack': 'resources',
        'VIP Status (1 Month)': 'vip',
        'Experience Boost (7 Days)': 'boost',
        'Custom Name Color': 'custom'
    };
    return productMap[title] || title.toLowerCase().replace(/\s+/g, '-');
}

// Show payment error
function showPaymentError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'payment-error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(196, 30, 58, 0.95); color: white; padding: 1rem 2rem; border-radius: 5px; z-index: 10003; box-shadow: 0 5px 20px rgba(0,0,0,0.5);';
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Make functions globally available immediately (before DOM ready)
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.closePaymentSuccessModal = closePaymentSuccessModal;

// Also expose on window load for safety
window.addEventListener('load', function() {
    window.openPaymentModal = openPaymentModal;
    window.closePaymentModal = closePaymentModal;
    window.closePaymentSuccessModal = closePaymentSuccessModal;
    console.log('✅ Payment functions exposed to window');
});

