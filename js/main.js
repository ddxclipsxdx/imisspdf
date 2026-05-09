(function() {
    'use strict';

    const header = document.getElementById('header');
    const navLinks = document.getElementById('navLinks');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');

    function handleScroll() {
        if (!header) return;
        
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }

    function toggleMobileMenu() {
        if (!mobileMenuBtn || !navLinks) return;
        
        mobileMenuBtn.classList.toggle('active');
        navLinks.classList.toggle('active');
        
        // Toggle body scroll when menu is open
        if (navLinks.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    function closeMobileMenu() {
        if (!mobileMenuBtn || !navLinks) return;
        
        mobileMenuBtn.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.style.overflow = '';
    }
    const allNavLinks = document.querySelectorAll(".nav-link");

    allNavLinks.forEach(link => {
        link.classList.remove("active");
        let linkPath = link.getAttribute("href").replace(/\/$/, "");

        if (linkPath === "" || linkPath === "/index.html") {
            linkPath = "/";
        }
        const currentNoHtml = currentPath.replace(".html", "");
        const linkNoHtml = linkPath.replace(".html", "");
        if (currentNoHtml === linkNoHtml) {
            link.classList.add("active");
        }
    });
}
        
        
        allNavLinks.forEach(link => {
            link.classList.remove('active');
            
            const linkPath = link.getAttribute('href');
            
            if (currentPath.endsWith(linkPath) || 
                (currentPath === '/' && linkPath === 'index.html') ||
                (currentPath.endsWith('/') && linkPath === 'index.html')) {
                link.classList.add('active');
            }
            
            if ((currentPath === '/' || currentPath === '') && linkPath === 'index.html') {
                link.classList.add('active');
            }
        });
    }

    function handleHashLinks(e) {
        const link = e.target.closest('a[href^="#"]');
        if (!link) return;
        
        const targetId = link.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            e.preventDefault();
            closeMobileMenu();
            
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    function createRipple(event, card) {
        // Prevent multiple ripples
        const existingRipple = card.querySelector('.ripple');
        if (existingRipple) {
            existingRipple.remove();
        }

        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        
        const rect = card.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2;
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.width = size + 'px';
        ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        card.appendChild(ripple);
        
        ripple.addEventListener('animationend', () => {
            if (ripple.parentNode) {
                ripple.remove();
            }
        });
    }

    function attachRippleEffects() {
        const toolCards = document.querySelectorAll('.tool-card-light');
        
        toolCards.forEach(card => {
            card.addEventListener('click', function(e) {
                createRipple(e, this);
            });
        });
    }

    // ===== Form Validation (Contact Page) =====
    function handleFormSubmit(e) {
        const form = e.target.closest('.contact-form');
        if (!form) return;
        
        e.preventDefault();
        
        const nameInput = form.querySelector('#name');
        const emailInput = form.querySelector('#email');
        const messageInput = form.querySelector('#message');
        
        let isValid = true;
        
        form.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('has-error');
        });
        
        // Validate name
        if (nameInput && !nameInput.value.trim()) {
            nameInput.closest('.form-group').classList.add('has-error');
            isValid = false;
        }
        
        // Validate email
        if (emailInput) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailInput.value.trim() || !emailRegex.test(emailInput.value.trim())) {
                emailInput.closest('.form-group').classList.add('has-error');
                isValid = false;
            }
        }
        
        // Validate message
        if (messageInput && !messageInput.value.trim()) {
            messageInput.closest('.form-group').classList.add('has-error');
            isValid = false;
        }
        
        if (isValid) {
            const submitBtn = form.querySelector('.btn-submit');
            if (submitBtn) {
                const originalHTML = submitBtn.innerHTML;
                submitBtn.innerHTML = 'Sending...';
                submitBtn.disabled = true;
                
                // Simulate API call
                setTimeout(() => {
                    submitBtn.innerHTML = '✓ Message Sent!';
                    submitBtn.style.background = '#16a34a';
                    
                    // Reset form
                    form.reset();
                    
                    // Reset button after delay
                    setTimeout(() => {
                        submitBtn.innerHTML = originalHTML;
                        submitBtn.style.background = '';
                        submitBtn.disabled = false;
                    }, 3000);
                }, 1500);
            }
        } else {
            // Scroll to first error
            const firstError = form.querySelector('.has-error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    function setupScrollAnimations() {
        const animatedElements = document.querySelectorAll('.tool-card-light');
        if (animatedElements.length === 0) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        
        animatedElements.forEach(el => {
            // Set initial state
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            observer.observe(el);
        });
    }

    // ===== Initialize Everything =====
    function init() {
        // Scroll events
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Mobile menu toggle
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', toggleMobileMenu);
        }
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', function(e) {
            if (navLinks && navLinks.classList.contains('active')) {
                const isClickInside = navLinks.contains(e.target) || 
                                      (mobileMenuBtn && mobileMenuBtn.contains(e.target));
                if (!isClickInside) {
                    closeMobileMenu();
                }
            }
        });
        
        // Close mobile menu on window resize (desktop)
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                closeMobileMenu();
            }
        });
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && navLinks && navLinks.classList.contains('active')) {
                closeMobileMenu();
            }
        });
        
        document.addEventListener('click', handleHashLinks);
        
        // Form submission
        document.addEventListener('submit', handleFormSubmit);
        
        attachRippleEffects();
        
        setActiveNavLink();
        
        setupScrollAnimations();
        
        handleScroll();
    }

    // ===== Start on DOM Ready =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
