// ============================================
// SHARED CART MANAGEMENT FUNCTIONS
// ============================================

const CartManager = {
    // Cache cart to reduce localStorage reads
    _cartCache: null,
    _cartCacheTime: 0,
    _CACHE_DURATION: 1000, // 1 second cache
    
    // Get cart from localStorage with caching
    getCart: function() {
        const now = Date.now();
        if (this._cartCache && (now - this._cartCacheTime) < this._CACHE_DURATION) {
            return this._cartCache;
        }
        
        try {
            const cartData = localStorage.getItem('kodijongCart');
            const cart = cartData ? JSON.parse(cartData) : [];
            this._cartCache = Array.isArray(cart) ? cart : [];
            this._cartCacheTime = now;
            return this._cartCache;
        } catch (error) {
            console.error('Error reading cart:', error);
            return [];
        }
    },
    
    // Save cart to localStorage with cache invalidation
    saveCart: function(cart) {
        if (!Array.isArray(cart)) {
            console.error('Attempted to save non-array cart');
            return false;
        }
        
        try {
            localStorage.setItem('kodijongCart', JSON.stringify(cart));
            this._cartCache = cart;
            this._cartCacheTime = Date.now();
            return true;
        } catch (error) {
            console.error('Error saving cart:', error);
            return false;
        }
    },
    
    // Debounced cart count update
    updateCartCount: (function() {
        let updateTimeout = null;
        let pendingUpdate = false;
        
        return function() {
            if (updateTimeout) {
                pendingUpdate = true;
                return;
            }
            
            updateTimeout = setTimeout(() => {
                updateTimeout = null;
                if (pendingUpdate) {
                    pendingUpdate = false;
                    this._updateCartCountImmediate();
                }
            }, 50); // Batch updates within 50ms
        };
    })(),
    
    // Immediate cart count update (called by debounced version)
    _updateCartCountImmediate: function() {
        const cart = this.getCart();
        const totalItems = cart.reduce((sum, item) => {
            const quantity = parseInt(item.quantity) || 0;
            return sum + (quantity > 0 ? quantity : 0);
        }, 0);
        
        // Batch DOM reads/writes
        const cartElements = [
            document.getElementById('cartCount'),
            document.getElementById('floatingCartCount'),
            ...document.querySelectorAll('.cart-count')
        ].filter(el => el !== null);
        
        cartElements.forEach(el => {
            const currentCount = parseInt(el.textContent) || 0;
            if (currentCount !== totalItems) {
                el.textContent = totalItems.toString();
                if (el.classList.contains('badge')) {
                    el.style.display = totalItems > 0 ? 'flex' : 'none';
                }
            }
        });
    },
    
    // Generate order number
    generateOrderNumber: function() {
        // Use crypto if available for better randomness
        if (window.crypto && window.crypto.getRandomValues) {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            return (array[0] % 9000) + 1000;
        }
        return Math.floor(Math.random() * 9000) + 1000;
    },
    
    // Notification system with queue
    _notificationQueue: [],
    _notificationShowing: false,
    
    showNotification: function(message, type = 'success') {
        // Add to queue
        this._notificationQueue.push({ message, type });
        
        // Show next notification if none showing
        if (!this._notificationShowing) {
            this._showNextNotification();
        }
    },
    
    _showNextNotification: function() {
        if (this._notificationQueue.length === 0) {
            this._notificationShowing = false;
            return;
        }
        
        this._notificationShowing = true;
        const { message, type } = this._notificationQueue.shift();
        
        // Remove existing notification
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.setAttribute('role', 'alert');
        
        const icon = document.createElement('i');
        icon.className = `fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`;
        
        const textSpan = document.createElement('span');
        textSpan.textContent = String(message).replace(/[<>]/g, '');
        
        notification.appendChild(icon);
        notification.appendChild(textSpan);
        document.body.appendChild(notification);
        
        // Auto remove and show next
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this._showNextNotification();
            }, 300);
        }, 3000);
    },
    
    // Format options for display (optimized)
    formatOptionsForDisplay: function(item) {
        const fragments = [];
        
        // Greens and Sauces
        if (item.options && typeof item.options === 'string') {
            const options = item.options.split(' | ');
            for (const opt of options) {
                if (opt.startsWith('Greens:')) {
                    const greens = opt.replace('Greens:', '').trim();
                    fragments.push(`<div class="cart-option-item">🥬 ${greens || 'Not specified'}</div>`);
                } else if (opt.startsWith('Sauces:')) {
                    const sauces = opt.replace('Sauces:', '').trim();
                    fragments.push(`<div class="cart-option-item">🍶 ${sauces || 'Not specified'}</div>`);
                }
            }
        }
        
        // Extras
        if (item.extras && Array.isArray(item.extras)) {
            let hasExtras = false;
            let extrasHtml = '';
            
            for (const extra of item.extras) {
                const quantity = parseInt(extra.quantity) || 0;
                if (quantity > 0) {
                    if (!hasExtras) {
                        extrasHtml = '<div class="cart-option-item">📦 Extras:</div>';
                        hasExtras = true;
                    }
                    const safeName = String(extra.name || '').replace(/[<>]/g, '');
                    extrasHtml += `<div class="cart-sub-option">➕ ${safeName} x${quantity}</div>`;
                }
            }
            
            if (hasExtras) {
                fragments.push(extrasHtml);
            }
        }
        
        // Drinks
        if (item.drinks && Array.isArray(item.drinks)) {
            let hasDrinks = false;
            let drinksHtml = '';
            
            for (const drink of item.drinks) {
                const quantity = parseInt(drink.quantity) || 0;
                if (quantity > 0) {
                    if (!hasDrinks) {
                        drinksHtml = '<div class="cart-option-item">🥤 Drinks:</div>';
                        hasDrinks = true;
                    }
                    const safeName = String(drink.name || '').replace(/[<>]/g, '');
                    drinksHtml += `<div class="cart-sub-option">🥤 ${safeName} x${quantity}</div>`;
                }
            }
            
            if (hasDrinks) {
                fragments.push(drinksHtml);
            }
        }
        
        return fragments.join('');
    },
    
    // WhatsApp order with optimizations
    sendWhatsAppOrder: function() {
        // Early return if cart empty
        const cart = this.getCart();
        if (cart.length === 0) {
            this.showNotification('Your cart is empty!', 'error');
            return false;
        }
        
        // Get form values
        const nameInput = document.getElementById('customer-name');
        const phoneInput = document.getElementById('customer-phone');
        const instructionsInput = document.getElementById('special-instructions');
        
        const name = nameInput?.value.trim() || '';
        const phone = phoneInput?.value.trim() || '';
        const instructions = instructionsInput?.value.trim() || '';
        
        // Validate inputs
        if (!name || !phone) {
            this.showNotification('Please enter your name and phone number', 'error');
            return false;
        }
        
        // Phone validation
        const phoneRegex = /^(\+27|0)[1-9]\d{8}$/;
        const cleanedPhone = phone.replace(/\s/g, '');
        
        if (!phoneRegex.test(cleanedPhone)) {
            this.showNotification('Please enter a valid South African phone number', 'error');
            return false;
        }
        
        // Generate WhatsApp message (optimized string building)
        const orderNumber = this.generateOrderNumber();
        const displayPhone = cleanedPhone.replace(/^\+27/, '0').replace(/^27/, '0');
        const now = new Date();
        
        let message = `*KODIJONG WEBSITE ORDER*\n\n`;
        message += `*ORDER NO:* ${orderNumber}\n\n`;
        message += `*CUSTOMER DETAILS:*\n`;
        message += `👤 *Name:* ${name.replace(/[*_~`]/g, '')}\n`;
        message += `📞 *Phone:* ${displayPhone}\n\n`;
        message += `*ORDER SUMMARY:*\n`;
        
        let cartTotal = 0;
        for (let i = 0; i < cart.length; i++) {
            const item = cart[i];
            const basePrice = parseFloat(item.basePrice) || 0;
            const quantity = parseInt(item.quantity) || 1;
            const itemTotal = basePrice * quantity;
            cartTotal += itemTotal;
            
            const safeName = String(item.name || '').replace(/[*_~`]/g, '');
            message += `\n${i + 1}. *${safeName}* x${quantity}`;
            message += `\n💰 *Price:* R${itemTotal.toFixed(2)}`;
            
            // Options
            if (item.options && typeof item.options === 'string') {
                const options = item.options.split(' | ');
                for (const opt of options) {
                    if (opt.startsWith('Greens:')) {
                        const greens = opt.replace('Greens:', '').trim();
                        message += `\n🥬 *Greens:* ${greens === 'with greens' ? 'with greens' : 'no greens'}`;
                    } else if (opt.startsWith('Sauces:')) {
                        const sauces = opt.replace('Sauces:', '').trim();
                        if (sauces === 'all sauces') {
                            message += `\n🍶 *Sauces:* all sauces`;
                        } else if (sauces === 'no sauces') {
                            message += `\n🍶 *Sauces:* no sauces`;
                        } else {
                            message += `\n🍶 *Sauces:* ${sauces.replace(/[*_~`]/g, '')}`;
                        }
                    }
                }
            }
            
            // Extras
            if (item.extras && Array.isArray(item.extras)) {
                const extrasList = [];
                for (const extra of item.extras) {
                    const quantity = parseInt(extra.quantity) || 0;
                    if (quantity > 0) {
                        const safeExtraName = String(extra.name || '').replace(/[*_~`]/g, '');
                        extrasList.push(`${safeExtraName} x${quantity}`);
                    }
                }
                if (extrasList.length > 0) {
                    message += `\n➕ *Extras:* ${extrasList.join(', ')}`;
                }
            }
            
            // Drinks
            if (item.drinks && Array.isArray(item.drinks)) {
                const drinksList = [];
                for (const drink of item.drinks) {
                    const quantity = parseInt(drink.quantity) || 0;
                    if (quantity > 0) {
                        const safeDrinkName = String(drink.name || '').replace(/[*_~`]/g, '');
                        drinksList.push(`${safeDrinkName} x${quantity}`);
                    }
                }
                if (drinksList.length > 0) {
                    message += `\n🥤 *Drinks:* ${drinksList.join(', ')}`;
                }
            }
            
            if (i < cart.length - 1) {
                message += `\n────────────────────`;
            }
        }
        
        message += `\n\n💰 *TOTAL AMOUNT:* R${cartTotal.toFixed(2)}\n`;
        message += `\n⏰ *Order Time:* ${now.toLocaleString('en-ZA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}\n`;
        
        if (instructions) {
            message += `\n📝 *Special Instructions:*\n${instructions.replace(/[*_~`]/g, '')}\n`;
        }
        
        message += `\n────────────────────\n`;
        message += `*KODIJONG THE FOOD HUB*\n`;
        message += `📍 232 Far East Bank, Sandton, 2014\n`;
        message += `⏰ Open: Mon-Sat 9AM-10PM\n`;
        message += `📞 +27 83 967 9365\n\n`;
        message += `✅ *We will contact you shortly to confirm your order!*`;
        
        // Create WhatsApp URL
        const businessPhone = '27839679365';
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${businessPhone}?text=${encodedMessage}`;
        
        // Open WhatsApp
        try {
            const newWindow = window.open(whatsappUrl, '_blank');
            if (!newWindow) {
                this.showNotification('Please allow pop-ups to send the order', 'error');
                return false;
            }
        } catch (error) {
            this.showNotification('Could not open WhatsApp', 'error');
            return false;
        }
        
        // Clear cart and form
        this.saveCart([]);
        this._updateCartCountImmediate();
        
        if (nameInput) nameInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (instructionsInput) instructionsInput.value = '';
        
        this.showNotification('Order sent successfully! Check WhatsApp.', 'success');
        return true;
    }
};

// Make CartManager available globally
window.CartManager = CartManager;

// ============================================
// MAIN PAGE LOGIC (index.html)
// ============================================

if (document.querySelector('.hero')) {
    // Performance optimized main page
    document.addEventListener('DOMContentLoaded', function() {
        // Use passive event listeners for better scrolling performance
        const passiveOptions = { passive: true };
        const activeOptions = { passive: false };
        
        // Cache DOM elements
        const elements = {
            cartToggle: document.getElementById('cartToggle'),
            floatingCartBtn: document.getElementById('floatingCartBtn'),
            cartSidebar: document.getElementById('cart-sidebar'),
            closeCartBtn: document.getElementById('close-cart'),
            backdrop: document.getElementById('backdrop'),
            orderList: document.getElementById('order-list'),
            totalPriceElement: document.getElementById('total-price'),
            whatsappBtn: document.getElementById('whatsapp-btn'),
            mobileMenuBtn: document.getElementById('mobileMenuBtn'),
            navbarCollapse: document.getElementById('navbarNav'),
            menuTabs: document.querySelectorAll('#menuTab button[data-bs-toggle="tab"]'),
            tabContent: document.querySelectorAll('.tab-pane')
        };
        
        // State
        let scrollRestored = false;
        let scrollTimeout = null;
        let activeSection = '';
        
        // ========== OPTIMIZED SCROLL HANDLING ==========
        const scrollPositions = {
            save: function() {
                try {
                    localStorage.setItem('kodijongScrollPosition', Math.floor(window.pageYOffset).toString());
                    localStorage.setItem('kodijongScrollTimestamp', Date.now().toString());
                } catch (error) {
                    console.error('Error saving scroll:', error);
                }
            },
            
            restore: function() {
                try {
                    const savedPos = localStorage.getItem('kodijongScrollPosition');
                    const savedTime = localStorage.getItem('kodijongScrollTimestamp');
                    
                    if (savedPos && savedTime) {
                        const timeSince = Date.now() - parseInt(savedTime, 10);
                        if (timeSince < 300000) {
                            requestAnimationFrame(() => {
                                window.scrollTo(0, parseInt(savedPos, 10));
                                scrollRestored = true;
                                updateActiveNavLink();
                            });
                        } else {
                            localStorage.removeItem('kodijongScrollPosition');
                            localStorage.removeItem('kodijongScrollTimestamp');
                        }
                    }
                } catch (error) {
                    console.error('Error restoring scroll:', error);
                }
            }
        };
        
        // Save on unload
        window.addEventListener('beforeunload', scrollPositions.save);
        
        // Restore on load
        scrollPositions.restore();
        
        // ========== OPTIMIZED CART DISPLAY ==========
        function updateCartDisplay() {
            const cart = CartManager.getCart();
            if (!elements.orderList) return;
            
            // Use DocumentFragment for batch DOM updates
            const fragment = document.createDocumentFragment();
            let total = 0;
            
            if (cart.length === 0) {
                const emptyItem = document.createElement('li');
                emptyItem.className = 'empty-cart';
                emptyItem.textContent = 'Your cart is empty';
                fragment.appendChild(emptyItem);
            } else {
                for (let i = 0; i < cart.length; i++) {
                    const item = cart[i];
                    const li = document.createElement('li');
                    li.className = 'cart-item';
                    
                    const basePrice = parseFloat(item.basePrice) || 0;
                    const quantity = parseInt(item.quantity) || 1;
                    const itemTotal = basePrice * quantity;
                    total += itemTotal;
                    
                    const productImage = item.image && typeof item.image === 'string' ? item.image : 'ORDERING/placeholder.jpg';
                    const optionsDisplay = CartManager.formatOptionsForDisplay(item);
                    
                    li.innerHTML = `
                        <div class="cart-item-info">
                            <div class="cart-item-image">
                                <img src="${productImage.replace(/"/g, '&quot;')}" 
                                     alt="${String(item.name || '').replace(/"/g, '&quot;')}" 
                                     loading="lazy"
                                     onerror="this.onerror=null; this.src='ORDERING/placeholder.jpg'">
                            </div>
                            <div class="cart-item-details">
                                <div class="cart-item-header">
                                    <span class="cart-item-name">${String(item.name || '').replace(/[<>]/g, '')} x${quantity}</span>
                                    <span class="cart-item-price">R${itemTotal.toFixed(2)}</span>
                                </div>
                                ${optionsDisplay ? `<div class="cart-item-options">${optionsDisplay}</div>` : ''}
                            </div>
                        </div>
                        <button class="remove-item" data-index="${i}">&times;</button>
                    `;
                    
                    fragment.appendChild(li);
                }
            }
            
            // Batch DOM update
            elements.orderList.innerHTML = '';
            elements.orderList.appendChild(fragment);
            
            if (elements.totalPriceElement) {
                elements.totalPriceElement.textContent = `R${total.toFixed(2)}`;
            }
            
            // Add remove handlers with event delegation
            elements.orderList.addEventListener('click', function(e) {
                if (e.target.classList.contains('remove-item')) {
                    const index = parseInt(e.target.dataset.index, 10);
                    if (!isNaN(index)) {
                        const cart = CartManager.getCart();
                        if (index >= 0 && index < cart.length) {
                            cart.splice(index, 1);
                            CartManager.saveCart(cart);
                            updateCartDisplay();
                            CartManager.updateCartCount();
                        }
                    }
                }
            });
        }
        
        // ========== OPTIMIZED CART CONTROLS ==========
        const cartControls = {
            open: function() {
                if (elements.cartSidebar) elements.cartSidebar.classList.add('active');
                if (elements.backdrop) elements.backdrop.classList.add('active');
                updateCartDisplay();
            },
            
            close: function() {
                if (elements.cartSidebar) elements.cartSidebar.classList.remove('active');
                if (elements.backdrop) elements.backdrop.classList.remove('active');
            }
        };
        
        // Add event listeners
        if (elements.cartToggle) elements.cartToggle.addEventListener('click', cartControls.open);
        if (elements.floatingCartBtn) elements.floatingCartBtn.addEventListener('click', cartControls.open);
        if (elements.closeCartBtn) elements.closeCartBtn.addEventListener('click', cartControls.close);
        if (elements.backdrop) elements.backdrop.addEventListener('click', cartControls.close);
        
        // ========== OPTIMIZED WHATSAPP ==========
        if (elements.whatsappBtn) {
            elements.whatsappBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const result = CartManager.sendWhatsAppOrder();
                if (result) {
                    updateCartDisplay();
                    cartControls.close();
                    scrollPositions.save();
                }
            });
        }
        
        // ========== OPTIMIZED TAB HANDLING ==========
        if (elements.menuTabs.length > 0) {
            const handleTabClick = function(e) {
                e.preventDefault();
                const tabId = this.getAttribute('data-bs-target')?.substring(1);
                if (!tabId) return;
                
                // Update tabs
                elements.menuTabs.forEach(tab => {
                    const isActive = tab === this;
                    tab.classList.toggle('active', isActive);
                    tab.setAttribute('aria-selected', isActive.toString());
                });
                
                // Update content
                elements.tabContent.forEach(content => {
                    content.classList.toggle('active', content.id === tabId);
                    content.classList.toggle('show', content.id === tabId);
                });
                
                scrollPositions.save();
            };
            
            elements.menuTabs.forEach(tab => {
                tab.addEventListener('click', handleTabClick);
            });
        }
        
        // ========== OPTIMIZED SMOOTH SCROLL ==========
        function smoothScrollTo(targetId) {
            const target = document.getElementById(targetId);
            if (!target) return;
            
            // Close mobile menu
            if (window.innerWidth < 992 && elements.navbarCollapse && elements.navbarCollapse.classList.contains('show')) {
                elements.navbarCollapse.classList.remove('show');
                if (elements.mobileMenuBtn) {
                    elements.mobileMenuBtn.setAttribute('aria-expanded', 'false');
                    const icon = elements.mobileMenuBtn.querySelector('i');
                    if (icon) icon.className = 'fas fa-bars';
                }
            }
            
            // Use requestAnimationFrame for smooth scrolling
            const yOffset = -80;
            const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
            
            window.scrollTo({
                top: y,
                behavior: 'smooth'
            });
            
            // Update URL
            history.replaceState(null, null, `#${targetId}`);
            
            // Update active nav
            setTimeout(updateActiveNavLink, 500);
            scrollPositions.save();
        }
        
        // Event delegation for all anchor clicks
        document.addEventListener('click', function(e) {
            const link = e.target.closest('a[href^="#"]');
            if (!link) return;
            
            const href = link.getAttribute('href');
            if (href.includes('product-detail.html') || href === '#') return;
            
            e.preventDefault();
            smoothScrollTo(href.substring(1));
        });
        
        // ========== OPTIMIZED ACTIVE NAV ==========
        const sections = Array.from(document.querySelectorAll('section[id]'));
        const navLinks = Array.from(document.querySelectorAll('.navbar-nav .nav-link'));
        
        function updateActiveNavLink() {
            const scrollPos = window.pageYOffset + 100;
            let newActiveSection = '';
            
            // Find current section
            for (const section of sections) {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.clientHeight;
                
                if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                    newActiveSection = section.id;
                    break;
                }
            }
            
            // Update only if changed
            if (newActiveSection !== activeSection) {
                activeSection = newActiveSection;
                
                // Update nav links
                for (const link of navLinks) {
                    const isActive = link.getAttribute('href') === `#${activeSection}`;
                    link.classList.toggle('active', isActive);
                }
                
                // If at top, highlight home
                if (window.pageYOffset < 100) {
                    for (const link of navLinks) {
                        link.classList.toggle('active', link.getAttribute('href') === '#home');
                    }
                }
            }
            
            // Debounced scroll save
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(scrollPositions.save, 250);
        }
        
        // Throttled scroll handler
        let scrollThrottle = null;
        window.addEventListener('scroll', function() {
            if (!scrollThrottle) {
                scrollThrottle = setTimeout(() => {
                    scrollThrottle = null;
                    updateActiveNavLink();
                }, 100); // Update every 100ms max during scroll
            }
        }, passiveOptions);
        
        // ========== INITIALIZE ==========
        CartManager.updateCartCount();
        updateCartDisplay();
        
        // Clear old scroll data after delay
        setTimeout(() => {
            try {
                localStorage.removeItem('kodijongScrollPosition');
                localStorage.removeItem('kodijongScrollTimestamp');
            } catch (error) {
                console.error('Error clearing scroll data:', error);
            }
        }, 10000);
    });
}

// ============================================
// PRODUCT DETAIL PAGE LOGIC (product-detail.html)
// ============================================

if (document.querySelector('.product-detail')) {
    // Performance optimized product page
    document.addEventListener('DOMContentLoaded', function() {
        // ========== PRODUCT DATA ==========
        const products = {
            'big-boss': {
                name: 'BIG BOSS',
                description: 'FRESH BREAD, GREENS, POLONY, SPECIAL, EGG, CHEESE, VIENNA, RUSSIAN SAUSAGE, GRILLED BACON, MOUTH WATERING BEEF PATTY, TANTALIZING SAUCES AND CHIPS.',
                price: 85,
                image: 'ORDERING/ORDERING 19.jpg'
            },
            'mac-gee': {
                name: 'MAC GEE',
                description: 'BURGER BUNS TOASTED, FRESH LETTUCE, SLICE OF ORGANIC TOMATOES, SEASONAL CUCUMBER OR PICKLED CUCUMBER, MOUTH WATERING BEEF PATTY X2, EGG, CHEESE X2, GRILLED BACON X2, SIDE CHIPS AND ONION RINGS.(EXCLUDING THE DRINK)',
                price: 70,
                image: 'ORDERING/ORDERING 15.jpg'
            },
            'zuumba': {
                name: 'ZUUMBA',
                description: 'FRESH BREAD, GREENS, POLONY, SPECIAL, EGG, CHEESE, CRISPY FRIED CHICKEN FILLET, TANTALIZING SAUCES AND CHIPS.',
                price: 62,
                image: 'ORDERING/ORDERING 20.jpg'
            },
            'goliath': {
                name: 'GOLIATH',
                description: '3 SLICES OF TOASTED BREAD, GREENS, EGG, CHEESE, RUSSIAN SAUSAGE, VIENNA AND TANTALIZING SAUCES.(EXCLUDING THE DRINK)',
                price: 46,
                image: 'ORDERING/ORDERING 22.jpg'
            },
            'mac-buza': {
                name: 'MAC BUZA',
                description: 'BURGER BUNS TOASTED, FRESH LETTUCE, SLICE OF ORGANIC TOMATOES, SEASONAL CUCUMBER OR PICKLED CUCUMBER, MOUTH WATERING BEEF PATTY, EGG, CHEESE AND SIDE CHIPS.(EXCLUDING THE DRINK)',
                price: 43,
                image: 'ORDERING/ORDERING 18.jpg'
            },
            'jericho': {
                name: 'JERICHO',
                description: 'SLICES OF TOASTED BREAD, GREENS, EGG, CHEESE, RUSSIAN SAUSAGE, GRILLED BACON AND TANTALIZING SAUCES.',
                price: 50,
                image: 'ORDERING/ORDERING 16.jpg'
            },
            'nix-mapha': {
                name: 'NIX MAPHA',
                description: 'FRESH BREAD, GREENS, POLONY, SECRET SAUCE AND CHIPS.(EXCLUDING THE DRINK)',
                price: 17,
                image: 'ORDERING/ORDERING 8.jpg'
            },
            'kwela-kwela': {
                name: 'KWELA KWELA',
                description: 'FRESH BREAD, GREENS, POLONY, CHEESE, SECRET SAUCE AND CHIPS.(EXCLUDING THE LAYS)',
                price: 22,
                image: 'ORDERING/ORDERING 2.jpg'
            },
            'skaftin': {
                name: 'SKAFTIN',
                description: 'FRESH BREAD, GREENS, EGG, POLONY, SECRET SAUCE AND CHIPS.',
                price: 25,
                image: 'ORDERING/ORDERING 10.jpg'
            },
            'sporo': {
                name: 'SPORO',
                description: 'FRESH BREAD, GREENS, POLONY, VIENNA, SECRET SAUCE AND CHIPS.(EXCLUDING THE DRINK)',
                price: 27,
                image: 'ORDERING/ORDERING 1.jpg'
            },
            'tjovitjo': {
                name: 'TJOVITJO',
                description: 'FRESH BREAD, GREENS, POLONY, SPECIAL, EGG, CHEESE, TANTALIZING SAUCES AND CHIPS.',
                price: 30,
                image: 'ORDERING/ORDERING 6.jpg'
            },
            'nomthandazo': {
                name: 'NOMTHANDAZO',
                description: 'FRESH BREAD, GREENS, POLONY, SPECIAL, EGG, CHEESE, VIENNA, TANTALIZING SAUCES AND CHIPS.(EXCLUDING THE DRINK)',
                price: 35,
                image: 'ORDERING/ORDERING 24.jpg'
            },
            'cheeseboy': {
                name: 'CHEESEBOY',
                description: 'FRESH BREAD, GREENS, POLONY, SPECIAL, EGG, CHEESE, GRILLED BACON, TANTALIZING SAUCES AND CHIPS.',
                price: 40,
                image: 'ORDERING/ORDERING 5.jpg'
            },
            'da-ja-vu': {
                name: 'DA JA VU',
                description: 'FRESH BREAD, GREENS, POLONY, SPECIAL, CHEESE, RUSSIAN SAUSAGE, TANTALIZING SAUCES AND CHIPS.',
                price: 44,
                image: 'ORDERING/ORDERING 7.jpg'
            },
            'kings-of-gomora': {
                name: 'KINGS OF GOMORA',
                description: 'FRESH BREAD, GREENS, POLONY, SPECIAL, EGG, CHEESE, RUSSIAN SAUSAGE, TANTALIZING SAUCES AND CHIPS.(EXCLUDING THE DRINK)',
                price: 47,
                image: 'ORDERING/ORDERING 21.jpg'
            },
            'papuka': {
                name: 'PAPUKA',
                description: 'FRESH BREAD, GREENS, POLONY, SPECIAL, EGG, CHEESE, BEEF BURGER PATTY, TANTALIZING SAUCES AND CHIPS.(EXCLUDING THE DRINK)',
                price: 50,
                image: 'ORDERING/ORDERING 26.jpg'
            },
            'makhelwane': {
                name: 'MAKHELWANE',
                description: 'SLICES OF TOASTED BREAD, GREENS, EGG, CHEESE AND TANTALIZING SAUCES.(EXCLUDING THE DRINK)',
                price: 18,
                image: 'ORDERING/ORDERING 3.jpg'
            },
            'kasablanca': {
                name: 'KASABLANCA',
                description: 'SLICES OF TOASTED BREAD, GREENS, EGG, CHEESE, VIENNA AND TANTALIZING SAUCES.(EXCLUDING THE DRINK)',
                price: 27,
                image: 'ORDERING/ORDERING 11.jpg'
            },
            'spongebob': {
                name: 'SPONGEBOB',
                description: 'SLICES OF TOASTED BREAD, GREENS, EGG, CHEESE, GRILLED BACON AND TANTALIZING SAUCES.',
                price: 30,
                image: 'ORDERING/ORDERING 23.jpg'
            },
            'cool-guy': {
                name: 'COOL GUY',
                description: 'SLICES OF TOASTED BREAD, GREENS, EGG, CHEESE, RUSSIAN SAUSAGE AND TANTALIZING SAUCES.',
                price: 36,
                image: 'ORDERING/ORDERING 27.jpg'
            },
            'mac-love': {
                name: 'MAC LOVE',
                description: 'BURGER BUNS TOASTED, FRESH LETTUCE, SLICE OF ORGANIC TOMATOES, SEASONAL CUCUMBER OR PICKLED CUCUMBER, MOUTH WATERING BEEF PATTY, EGG, CHEESE, GRILLED BACON AND SIDE CHIPS.(EXCLUDING THE DRINK)',
                price: 48,
                image: 'ORDERING/ORDERING 4.jpg'
            },
            'kediboni': {
                name: 'KEDIBONI',
                description: 'BURGER BUNS TOASTED, FRESH LETTUCE, SLICE OF ORGANIC TOMATOES, SEASONAL CUCUMBER OR PICKLED CUCUMBER, CRISPY FRIED CHICKEN FILLET, EGG, CHEESE, SIDE CHIPS AND ONION RINGS.(EXCLUDING THE DRINK)',
                price: 53,
                image: 'ORDERING/ORDERING 25.jpg'
            },
            'ugogo': {
                name: 'UGOGO UYANG THANDA',
                description: '1/2 FRESH BREAD, GREENS, POLONY, SPECIAL, EGG x2, CHEESE x2, VIENNA x2, GRILLED BACON x2, RUSSIAN SAUSAGE x2, BEEF BURGER PATTY x2, TANTALIZING SAUCES AND CHIPS.(EXCLUDING THE DRINK)',
                price: 130,
                image: 'ORDERING/ORDERING 28.jpg'
            },
            'small-chips': {
                name: 'SMALL CHIPS',
                description: 'Delicious golden fries served with our special sauce.',
                price: 25,
                image: 'ORDERING/ORDERING 12.jpg'
            },
            'medium-chips': {
                name: 'MEDIUM CHIPS',
                description: 'Delicious golden fries served with our special sauce.',
                price: 30,
                image: 'ORDERING/ORDERING 12.jpg'
            },
            'large-chips': {
                name: 'LARGE CHIPS',
                description: 'Delicious golden fries served with our special sauce.',
                price: 40,
                image: 'ORDERING/ORDERING 12.jpg'
            }
        };
        
        // Cache DOM elements
        const elements = {
            productContent: document.getElementById('productContent'),
            productTitle: document.querySelector('.product-title'),
            productDesc: document.querySelector('.product-description'),
            productPrice: document.querySelector('.product-price'),
            productImage: document.querySelector('.product-image img'),
            modalAddToCart: document.getElementById('modalAddToCart'),
            cartToggle: document.getElementById('cartToggle'),
            floatingCartBtn: document.getElementById('floatingCartBtn'),
            cartSidebar: document.getElementById('cart-sidebar'),
            closeCartBtn: document.getElementById('close-cart'),
            backdrop: document.getElementById('backdrop'),
            orderList: document.getElementById('order-list'),
            totalPriceElement: document.getElementById('total-price'),
            whatsappBtn: document.getElementById('whatsapp-btn'),
            customSaucesDiv: document.getElementById('customSauces'),
            qtyMinus: document.querySelector('.qty-minus'),
            qtyPlus: document.querySelector('.qty-plus'),
            quantityInput: document.querySelector('.modal-qty')
        };
        
        // State
        let currentBasePrice = 0;
        let currentExtrasTotal = 0;
        let currentDrinksTotal = 0;
        let currentQuantity = 1;
        let extras = [];
        let drinks = [];
        
        // ========== FIXED: CUSTOM SAUCES HANDLER ==========
        function handleSauceSelection() {
            const sauceRadios = document.querySelectorAll('input[name="sauce"]');
            const customSaucesDiv = document.getElementById('customSauces');
            
            if (!sauceRadios.length || !customSaucesDiv) return;
            
            // Initialize sauce selection
            sauceRadios.forEach(radio => {
                if (radio.value === 'Custom' && radio.checked) {
                    customSaucesDiv.classList.add('show');
                }
            });
            
            // Add event listeners to sauce radio buttons
            sauceRadios.forEach(radio => {
                radio.addEventListener('change', function() {
                    if (this.value === 'Custom') {
                        customSaucesDiv.classList.add('show');
                    } else {
                        customSaucesDiv.classList.remove('show');
                        // Uncheck all custom sauce checkboxes when not in custom mode
                        document.querySelectorAll('input[name="custom-sauce"]').forEach(cb => {
                            cb.checked = false;
                        });
                    }
                });
            });
        }
        
        // ========== OPTIMIZED PRODUCT LOADING ==========
        function loadProduct() {
            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get('product');
            const product = products[productId];
            
            if (!product || !elements.productContent) {
                if (elements.productContent) {
                    elements.productContent.innerHTML = `
                        <div class="product-not-found">
                            <h2>Product Not Found</h2>
                            <p>The requested product does not exist.</p>
                            <a href="index.html" class="back-btn">Back to Menu</a>
                        </div>
                    `;
                }
                return;
            }
            
            // Update product info
            if (elements.productTitle) elements.productTitle.textContent = product.name;
            if (elements.productDesc) elements.productDesc.textContent = product.description;
            if (elements.productPrice) elements.productPrice.textContent = `R${product.price.toFixed(2)}`;
            
            // Lazy load image
            if (elements.productImage) {
                elements.productImage.loading = 'lazy';
                elements.productImage.src = product.image;
                elements.productImage.alt = product.name;
                elements.productImage.onerror = function() {
                    this.src = 'ORDERING/placeholder.jpg';
                };
            }
            
            // Store product data
            elements.productContent.dataset.productId = productId;
            elements.productContent.dataset.productName = product.name;
            elements.productContent.dataset.basePrice = product.price.toString();
            elements.productContent.dataset.productImage = product.image;
            
            // Reset state
            currentBasePrice = product.price;
            currentExtrasTotal = 0;
            currentDrinksTotal = 0;
            currentQuantity = 1;
            extras = [];
            drinks = [];
            
            // Initialize sauce selection handler
            handleSauceSelection();
            
            // Set default sauce selection
            const defaultSauce = document.querySelector('input[name="sauce"][value="No Sauce"]');
            if (defaultSauce) {
                defaultSauce.checked = true;
            }
            
            // Hide custom sauces by default
            if (elements.customSaucesDiv) {
                elements.customSaucesDiv.classList.remove('show');
            }
            
            updateTotalDisplay();
        }
        
        // ========== FIXED: QUANTITY CONTROLS ==========
        function setupQuantityControls() {
            const qtyMinus = document.querySelector('.qty-minus');
            const qtyPlus = document.querySelector('.qty-plus');
            const quantityInput = elements.quantityInput;
            
            if (qtyMinus && qtyPlus && quantityInput) {
                qtyMinus.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (currentQuantity > 1) {
                        currentQuantity--;
                        quantityInput.value = currentQuantity;
                        updateTotalDisplay();
                    }
                });
                
                qtyPlus.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (currentQuantity < 10) {
                        currentQuantity++;
                        quantityInput.value = currentQuantity;
                        updateTotalDisplay();
                    }
                });
                
                quantityInput.addEventListener('input', function() {
                    let value = parseInt(this.value, 10);
                    if (isNaN(value) || value < 1) value = 1;
                    if (value > 10) value = 10;
                    currentQuantity = value;
                    this.value = value;
                    updateTotalDisplay();
                });
            }
        }
        
        // ========== FIXED: EXTRAS AND DRINKS CONTROLS FOR YOUR HTML STRUCTURE ==========
        function setupExtrasAndDrinksControls() {
            // Event delegation for extras
            document.addEventListener('click', function(e) {
                // Extra controls
                if (e.target.classList.contains('extra-minus')) {
                    e.preventDefault();
                    const extraOption = e.target.closest('.extra-option');
                    if (!extraOption) return;
                    
                    const name = e.target.dataset.name;
                    const price = parseFloat(e.target.dataset.price || 0);
                    const input = extraOption.querySelector('.extra-qty');
                    if (!input) return;
                    
                    let value = parseInt(input.value, 10) || 0;
                    if (value > 0) {
                        value--;
                        input.value = value;
                        updateExtra(name, price, value);
                    }
                    return;
                }
                
                if (e.target.classList.contains('extra-plus')) {
                    e.preventDefault();
                    const extraOption = e.target.closest('.extra-option');
                    if (!extraOption) return;
                    
                    const name = e.target.dataset.name;
                    const price = parseFloat(e.target.dataset.price || 0);
                    const input = extraOption.querySelector('.extra-qty');
                    if (!input) return;
                    
                    let value = parseInt(input.value, 10) || 0;
                    if (value < 10) {
                        value++;
                        input.value = value;
                        updateExtra(name, price, value);
                    }
                    return;
                }
                
                // Drink controls
                if (e.target.classList.contains('drink-minus')) {
                    e.preventDefault();
                    const drinkOption = e.target.closest('.drink-option');
                    if (!drinkOption) return;
                    
                    const name = e.target.dataset.name;
                    const price = parseFloat(e.target.dataset.price || 0);
                    const input = drinkOption.querySelector('.drink-qty');
                    if (!input) return;
                    
                    let value = parseInt(input.value, 10) || 0;
                    if (value > 0) {
                        value--;
                        input.value = value;
                        updateDrink(name, price, value);
                    }
                    return;
                }
                
                if (e.target.classList.contains('drink-plus')) {
                    e.preventDefault();
                    const drinkOption = e.target.closest('.drink-option');
                    if (!drinkOption) return;
                    
                    const name = e.target.dataset.name;
                    const price = parseFloat(e.target.dataset.price || 0);
                    const input = drinkOption.querySelector('.drink-qty');
                    if (!input) return;
                    
                    let value = parseInt(input.value, 10) || 0;
                    if (value < 10) {
                        value++;
                        input.value = value;
                        updateDrink(name, price, value);
                    }
                }
            });
            
            // Input handlers for extras and drinks
            document.addEventListener('input', function(e) {
                if (e.target.classList.contains('extra-qty')) {
                    const name = e.target.dataset.name;
                    const price = parseFloat(e.target.dataset.price || 0);
                    let value = parseInt(e.target.value, 10) || 0;
                    if (value < 0) value = 0;
                    if (value > 10) value = 10;
                    e.target.value = value;
                    
                    updateExtra(name, price, value);
                    return;
                }
                
                if (e.target.classList.contains('drink-qty')) {
                    const name = e.target.dataset.name;
                    const price = parseFloat(e.target.dataset.price || 0);
                    let value = parseInt(e.target.value, 10) || 0;
                    if (value < 0) value = 0;
                    if (value > 10) value = 10;
                    e.target.value = value;
                    
                    updateDrink(name, price, value);
                }
            });
        }
        
        // Optimized extra/drink updates
        function updateExtra(name, price, quantity) {
            const index = extras.findIndex(e => e.name === name);
            
            if (quantity === 0 && index > -1) {
                extras.splice(index, 1);
            } else if (quantity > 0) {
                if (index > -1) {
                    extras[index].quantity = quantity;
                } else {
                    extras.push({ name, price, quantity });
                }
            }
            
            currentExtrasTotal = extras.reduce((total, extra) => {
                return total + (extra.price * extra.quantity);
            }, 0);
            
            updateTotalDisplay();
        }
        
        function updateDrink(name, price, quantity) {
            const index = drinks.findIndex(d => d.name === name);
            
            if (quantity === 0 && index > -1) {
                drinks.splice(index, 1);
            } else if (quantity > 0) {
                if (index > -1) {
                    drinks[index].quantity = quantity;
                } else {
                    drinks.push({ name, price, quantity });
                }
            }
            
            currentDrinksTotal = drinks.reduce((total, drink) => {
                return total + (drink.price * drink.quantity);
            }, 0);
            
            updateTotalDisplay();
        }
        
        function updateTotalDisplay() {
            const total = (currentBasePrice + currentExtrasTotal + currentDrinksTotal) * currentQuantity;
            const totalElement = document.getElementById('modalTotalDisplay');
            if (totalElement) {
                totalElement.textContent = `R${total.toFixed(2)}`;
            }
        }
        
        // ========== OPTIMIZED ADD TO CART ==========
        if (elements.modalAddToCart) {
            elements.modalAddToCart.addEventListener('click', function(e) {
                e.preventDefault();
                
                const productContent = elements.productContent;
                if (!productContent) return;
                
                const productId = productContent.dataset.productId;
                const productName = productContent.dataset.productName;
                const basePrice = parseFloat(productContent.dataset.basePrice || 0);
                const productImage = productContent.dataset.productImage || 'ORDERING/placeholder.jpg';
                
                // Validate
                if (!productId || !productName || isNaN(basePrice)) {
                    CartManager.showNotification('Product data incomplete', 'error');
                    return;
                }
                
                // Collect options
                const options = [];
                const greensEl = document.querySelector('input[name="greens"]:checked');
                const sauceEl = document.querySelector('input[name="sauce"]:checked');
                
                if (greensEl) {
                    const greens = greensEl.value;
                    options.push(`Greens: ${greens === 'Yes' ? 'with greens' : 'no greens'}`);
                }
                
                if (sauceEl) {
                    const sauce = sauceEl.value;
                    if (sauce === 'Custom') {
                        const customSauces = Array.from(
                            document.querySelectorAll('input[name="custom-sauce"]:checked')
                        ).map(cb => cb.value);
                        
                        if (customSauces.length > 0) {
                            options.push(`Sauces: ${customSauces.join(', ')}`);
                        } else {
                            options.push(`Sauces: no sauces`);
                        }
                    } else if (sauce === 'All') {
                        options.push(`Sauces: all sauces`);
                    } else if (sauce === 'No Sauce') {
                        options.push(`Sauces: no sauces`);
                    } else {
                        options.push(`Sauces: ${sauce}`);
                    }
                }
                
                // Create cart item
                const uniqueId = `${productId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const itemBasePrice = basePrice + currentExtrasTotal + currentDrinksTotal;
                
                const cartItem = {
                    id: uniqueId,
                    productId,
                    name: productName,
                    basePrice: itemBasePrice,
                    quantity: currentQuantity,
                    options: options.join(' | '),
                    image: productImage,
                    timestamp: Date.now(),
                    extras: extras.filter(e => e.quantity > 0),
                    drinks: drinks.filter(d => d.quantity > 0),
                    baseProductPrice: basePrice
                };
                
                // Add to cart
                const cart = CartManager.getCart();
                cart.push(cartItem);
                
                if (CartManager.saveCart(cart)) {
                    CartManager.showNotification(`${productName} added to cart!`, 'success');
                    openCart();
                    CartManager.updateCartCount();
                    resetProductForm();
                } else {
                    CartManager.showNotification('Failed to add item', 'error');
                }
            });
        }
        
        function resetProductForm() {
            currentQuantity = 1;
            if (elements.quantityInput) elements.quantityInput.value = 1;
            
            document.querySelectorAll('.extra-qty, .drink-qty').forEach(input => {
                input.value = 0;
            });
            
            extras = [];
            drinks = [];
            currentExtrasTotal = 0;
            currentDrinksTotal = 0;
            
            // Reset radios
            const defaultGreens = document.querySelector('input[name="greens"][value="Yes"]');
            const defaultSauce = document.querySelector('input[name="sauce"][value="No Sauce"]');
            if (defaultGreens) defaultGreens.checked = true;
            if (defaultSauce) defaultSauce.checked = true;
            
            // Hide custom sauces div
            if (elements.customSaucesDiv) {
                elements.customSaucesDiv.classList.remove('show');
            }
            
            // Uncheck custom sauce checkboxes
            document.querySelectorAll('input[name="custom-sauce"]').forEach(cb => {
                cb.checked = false;
            });
            
            updateTotalDisplay();
        }
        
        // ========== OPTIMIZED CART DISPLAY ==========
        function updateCartDisplay() {
            const cart = CartManager.getCart();
            if (!elements.orderList) return;
            
            const fragment = document.createDocumentFragment();
            let total = 0;
            
            if (cart.length === 0) {
                const emptyItem = document.createElement('li');
                emptyItem.className = 'empty-cart';
                emptyItem.textContent = 'Your cart is empty';
                fragment.appendChild(emptyItem);
            } else {
                for (let i = 0; i < cart.length; i++) {
                    const item = cart[i];
                    const li = document.createElement('li');
                    li.className = 'cart-item';
                    
                    const basePrice = parseFloat(item.basePrice) || 0;
                    const quantity = parseInt(item.quantity) || 1;
                    const itemTotal = basePrice * quantity;
                    total += itemTotal;
                    
                    const productImage = item.image && typeof item.image === 'string' ? item.image : 'ORDERING/placeholder.jpg';
                    const optionsDisplay = CartManager.formatOptionsForDisplay(item);
                    
                    li.innerHTML = `
                        <div class="cart-item-info">
                            <div class="cart-item-image">
                                <img src="${productImage.replace(/"/g, '&quot;')}" 
                                     alt="${String(item.name || '').replace(/"/g, '&quot;')}" 
                                     loading="lazy"
                                     onerror="this.onerror=null; this.src='ORDERING/placeholder.jpg'">
                            </div>
                            <div class="cart-item-details">
                                <div class="cart-item-header">
                                    <span class="cart-item-name">${String(item.name || '').replace(/[<>]/g, '')} x${quantity}</span>
                                    <span class="cart-item-price">R${itemTotal.toFixed(2)}</span>
                                </div>
                                ${optionsDisplay ? `<div class="cart-item-options">${optionsDisplay}</div>` : ''}
                            </div>
                        </div>
                        <button class="remove-item" data-index="${i}">&times;</button>
                    `;
                    
                    fragment.appendChild(li);
                }
            }
            
            elements.orderList.innerHTML = '';
            elements.orderList.appendChild(fragment);
            
            if (elements.totalPriceElement) {
                elements.totalPriceElement.textContent = `R${total.toFixed(2)}`;
            }
            
            // Event delegation for remove buttons
            elements.orderList.addEventListener('click', function(e) {
                if (e.target.classList.contains('remove-item')) {
                    const index = parseInt(e.target.dataset.index, 10);
                    if (!isNaN(index)) {
                        const cart = CartManager.getCart();
                        if (index >= 0 && index < cart.length) {
                            cart.splice(index, 1);
                            CartManager.saveCart(cart);
                            updateCartDisplay();
                            CartManager.updateCartCount();
                        }
                    }
                }
            });
        }
        
        function openCart() {
            if (elements.cartSidebar) elements.cartSidebar.classList.add('active');
            if (elements.backdrop) elements.backdrop.classList.add('active');
            updateCartDisplay();
        }
        
        function closeCart() {
            if (elements.cartSidebar) elements.cartSidebar.classList.remove('active');
            if (elements.backdrop) elements.backdrop.classList.remove('active');
        }
        
        // Add cart event listeners
        if (elements.cartToggle) elements.cartToggle.addEventListener('click', openCart);
        if (elements.floatingCartBtn) elements.floatingCartBtn.addEventListener('click', openCart);
        if (elements.closeCartBtn) elements.closeCartBtn.addEventListener('click', closeCart);
        if (elements.backdrop) elements.backdrop.addEventListener('click', closeCart);
        
        // ========== INITIALIZE ==========
        loadProduct();
        setupQuantityControls();
        setupExtrasAndDrinksControls();
        CartManager.updateCartCount();
        updateCartDisplay();
        
        // Set default sauce on page load
        const defaultSauceRadio = document.querySelector('input[name="sauce"][value="No Sauce"]');
        if (defaultSauceRadio) {
            defaultSauceRadio.checked = true;
            if (elements.customSaucesDiv) {
                elements.customSaucesDiv.classList.remove('show');
            }
        }
    });
}

// ============================================
// COMMON STYLES (only added once)
// ============================================

if (!document.querySelector('#kodijong-styles')) {
    const style = document.createElement('style');
    style.id = 'kodijong-styles';
    style.textContent = `
        /* Notification styles */
        .notification {
            position: fixed;
            top: 100px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10010;
            animation: slideInRight 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            max-width: 350px;
            min-width: 300px;
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            border: 2px solid;
            font-weight: 600;
            overflow: hidden;
            cursor: pointer;
            transition: transform 0.2s ease;
            will-change: transform;
        }
        
        .notification:hover {
            transform: translateY(-2px);
        }
        
        .notification-success {
            background: linear-gradient(135deg, rgba(37, 211, 102, 0.9), rgba(18, 140, 126, 0.9));
            color: white;
            border-color: rgba(255, 255, 255, 0.3);
        }
        
        .notification-error {
            background: linear-gradient(135deg, rgba(255, 0, 0, 0.9), rgba(204, 0, 0, 0.9));
            color: white;
            border-color: rgba(255, 255, 255, 0.3);
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        /* Cart item styles */
        .cart-item-image {
            width: 60px;
            height: 60px;
            min-width: 60px;
            border-radius: 8px;
            overflow: hidden;
            margin-right: 12px;
            background: rgba(255, 255, 255, 0.1);
        }
        
        .cart-item-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        
        .cart-item-info {
            display: flex;
            align-items: flex-start;
            flex: 1;
        }
        
        .cart-item-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 4px;
        }
        
        .cart-item-name {
            font-weight: 600;
            font-size: 14px;
            color: white;
            flex: 1;
            margin-right: 8px;
        }
        
        .cart-item-price {
            font-weight: 700;
            font-size: 14px;
            color: #FFC107;
            white-space: nowrap;
        }
        
        .cart-item-options {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.4;
        }
        
        .remove-item {
            background: rgba(255, 0, 0, 0.2);
            color: #ff6b6b;
            border: none;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
            margin-left: 10px;
        }
        
        /* FIXED: Responsive extras and drinks for your HTML structure */
        .extras-list,
        .drinks-list {
            margin-top: var(--space-md);
        }
        
        .extra-option,
        .drink-option {
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 215, 0, 0.1);
            border-radius: var(--radius-md);
            padding: var(--space-sm);
            margin-bottom: var(--space-sm);
            transition: var(--transition-base);
        }
        
        .extra-option:hover,
        .drink-option:hover {
            background: rgba(255,215,0,0.1);
            border-color: var(--gold-yellow);
        }
        
        .option-details {
            flex: 1;
            min-width: 0;
            margin-bottom: 0.5rem;
        }
        
        .extra-name,
        .drink-name {
            display: block;
            font-weight: 600;
            color: var(--pure-white);
            font-size: 0.95rem;
            line-height: 1.3;
            margin-bottom: 0.25rem;
        }
        
        .extra-price,
        .drink-price {
            display: block;
            color: var(--gold-yellow);
            font-weight: 700;
            font-size: 0.95rem;
        }
        
        .option-controls {
            display: flex;
            align-items: center;
            justify-content: flex-end;
        }
        
        /* Make buttons more touch-friendly on mobile */
        .extra-minus,
        .extra-plus,
        .drink-minus,
        .drink-plus {
            min-width: 36px !important;
            min-height: 36px !important;
            padding: 0.25rem 0.5rem !important;
            font-size: 0.9rem !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        
        .extra-qty,
        .drink-qty {
            width: 50px !important;
            min-height: 36px !important;
            padding: 0.25rem !important;
            font-size: 0.9rem !important;
            text-align: center !important;
            background: rgba(0, 0, 0, 0.5) !important;
            border-color: var(--gold-yellow) !important;
            color: var(--pure-white) !important;
        }
        
        /* Responsive fixes for mobile */
        @media (max-width: 768px) {
            .extra-option,
            .drink-option {
                flex-direction: column !important;
                align-items: flex-start !important;
                padding: 0.75rem;
            }
            
            .option-details {
                width: 100%;
                margin-bottom: 0.75rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .extra-name,
            .drink-name {
                display: inline-block;
                margin-bottom: 0;
                font-size: 0.9rem;
                max-width: 60%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .extra-price,
            .drink-price {
                display: inline-block;
                font-size: 0.9rem;
                text-align: right;
                flex-shrink: 0;
            }
            
            .option-controls {
                width: 100%;
                justify-content: center;
            }
            
            .extra-minus,
            .extra-plus,
            .drink-minus,
            .drink-plus {
                min-width: 42px !important;
                min-height: 42px !important;
                padding: 0.5rem !important;
                font-size: 1rem !important;
            }
            
            .extra-qty,
            .drink-qty {
                width: 60px !important;
                min-height: 42px !important;
                margin: 0 0.5rem !important;
                font-size: 1rem !important;
            }
        }
        
        /* Extra small devices */
        @media (max-width: 576px) {
            .extra-option,
            .drink-option {
                padding: 0.5rem;
            }
            
            .extra-name,
            .drink-name {
                font-size: 0.85rem;
                max-width: 55%;
            }
            
            .extra-price,
            .drink-price {
                font-size: 0.85rem;
            }
            
            .extra-minus,
            .extra-plus,
            .drink-minus,
            .drink-plus {
                min-width: 38px !important;
                min-height: 38px !important;
                padding: 0.4rem !important;
            }
            
            .extra-qty,
            .drink-qty {
                width: 50px !important;
                min-height: 38px !important;
                margin: 0 0.25rem !important;
            }
            
            /* For very long drink names */
            .drink-name {
                max-width: 50%;
            }
        }
        
        /* For long drink names on all screens */
        .drink-name {
            word-break: break-word;
            white-space: normal;
            line-height: 1.2;
        }
        
        @media (min-width: 769px) {
            .extra-option,
            .drink-option {
                padding: 0.75rem 1rem;
            }
            
            .option-details {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 0;
            }
            
            .extra-name,
            .drink-name {
                flex: 1;
                margin-bottom: 0;
                margin-right: 1rem;
            }
            
            .extra-price,
            .drink-price {
                flex-shrink: 0;
                text-align: right;
                min-width: 60px;
            }
            
            .option-controls {
                flex-shrink: 0;
            }
        }
        
        /* Make sure the buttons don't get too small on desktop */
        @media (min-width: 992px) {
            .extra-minus,
            .extra-plus,
            .drink-minus,
            .drink-plus {
                min-width: 40px !important;
                min-height: 40px !important;
            }
            
            .extra-qty,
            .drink-qty {
                width: 60px !important;
                min-height: 40px !important;
            }
        }
        
        /* Improve spacing between items */
        .extras-list .extra-option:last-child,
        .drinks-list .drink-option:last-child {
            margin-bottom: 0;
        }
        
        /* Hover effects for better UX */
        .extra-minus:hover,
        .extra-plus:hover,
        .drink-minus:hover,
        .drink-plus:hover {
            transform: scale(1.05);
            box-shadow: var(--shadow-sm);
        }
        
        .extra-qty:focus,
        .drink-qty:focus {
            outline: 2px solid var(--gold-yellow);
            outline-offset: 2px;
        }
        
        /* Animation for quantity changes */
        .extra-qty,
        .drink-qty {
            transition: all 0.2s ease;
        }
        
        .extra-minus:active,
        .extra-plus:active,
        .drink-minus:active,
        .drink-plus:active {
            transform: scale(0.95);
        }
        
        /* Ensure proper contrast for readability */
        .extras-list h4,
        .drinks-list h4 {
            color: var(--gold-yellow);
            font-size: 1.2rem;
            margin-bottom: var(--space-md);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .extras-list h4 i,
        .drinks-list h4 i {
            color: var(--fire-red);
            animation: iconPulse 2s infinite alternate;
        }
        
        /* Mobile optimizations */
        @media (max-width: 768px) {
            .notification {
                top: 70px;
                right: 10px;
                max-width: calc(100% - 20px);
                min-width: auto;
                font-size: 14px;
                padding: 12px 15px;
            }
            
            .cart-item-image {
                width: 50px;
                height: 50px;
                min-width: 50px;
            }
        }
    `;
    document.head.appendChild(style);
}

// Initialize cart count on all pages
document.addEventListener('DOMContentLoaded', function() {
    CartManager.updateCartCount();
});
