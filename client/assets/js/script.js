// Age Gate — shown on shop and index pages to confirm user is 18+
(function initAgeGate() {
    const gatedPages = ['index.html', 'shop.html', ''];
    const currentPage = window.location.pathname.split('/').pop();
    if (!gatedPages.includes(currentPage)) return;
    if (localStorage.getItem('ageVerified') === 'true') return;

    // Build and inject the modal
    const overlay = document.createElement('div');
    overlay.id = 'ageGateOverlay';
    overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:99999',
        'background:rgba(0,0,0,0.85)', 'display:flex',
        'align-items:center', 'justify-content:center',
        'padding:1rem'
    ].join(';');

    overlay.innerHTML = `
        <div style="background:#1a1a2e;border:1px solid var(--secondary-color,#d4af37);border-radius:12px;padding:2.5rem;max-width:440px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.6);">
            <h2 style="color:var(--secondary-color,#d4af37);margin-bottom:1rem;font-size:1.6rem;">Age Verification</h2>
            <p style="color:#ccc;margin-bottom:0.5rem;line-height:1.6;">
                Heart of Acheron is intended for users aged <strong style="color:#fff;">18 and older</strong>.
            </p>
            <p style="color:#ccc;margin-bottom:2rem;line-height:1.6;">
                By entering you confirm you meet this requirement and agree to our
                <a href="terms-of-service.html" style="color:var(--secondary-color,#d4af37);">Terms of Service</a>.
            </p>
            <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
                <button id="ageGateYes" style="background:var(--secondary-color,#d4af37);color:#000;border:none;padding:0.75rem 2rem;border-radius:6px;font-size:1rem;font-weight:700;cursor:pointer;">
                    I am 18 or older — Enter
                </button>
                <button id="ageGateNo" style="background:transparent;color:#ccc;border:1px solid #555;padding:0.75rem 2rem;border-radius:6px;font-size:1rem;cursor:pointer;">
                    I am under 18 — Leave
                </button>
            </div>
        </div>`;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    document.getElementById('ageGateYes').addEventListener('click', function () {
        localStorage.setItem('ageVerified', 'true');
        overlay.remove();
        document.body.style.overflow = '';
    });

    document.getElementById('ageGateNo').addEventListener('click', function () {
        window.location.replace('https://www.google.com');
    });
})();

// Mobile Menu Toggle
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const navMenu = document.querySelector('.nav-menu');

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });
}

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (navMenu && mobileMenuToggle && !navMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
        navMenu.classList.remove('active');
    }
});

// Active Navigation Link Detection
function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        const linkHref = link.getAttribute('href');
        if (linkHref === currentPage || (currentPage === '' && linkHref === 'index.html')) {
            link.classList.add('active');
        }
    });
}

// Set active nav link on page load
setActiveNavLink();

// Form Submission Handler
const contactForm = document.querySelector('.contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form values
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const subject = document.getElementById('subject')?.value.trim() || 'No subject';
        const message = document.getElementById('message').value.trim();
        
        // Simple validation
        if (!name || !email || !message) {
            alert('Please fill in all required fields.');
            return;
        }
        
        // Disable submit button
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        
        try {
            const API_BASE = window.API_BASE_URL || 'http://localhost:3000';
            const response = await fetch(`${API_BASE}/api/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    email,
                    subject,
                    message
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to send message');
            }
            
            alert('Thank you for your message, ' + name + '! We will get back to you soon at ' + email + '.');
            contactForm.reset();
        } catch (error) {
            console.error('Error submitting contact form:', error);
            alert('Failed to send message. Please try again later.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

// Add scroll animation to cards
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe cards and feature cards
document.querySelectorAll('.feature-card, .product-card, .server-info-card, .contact-method').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
});
