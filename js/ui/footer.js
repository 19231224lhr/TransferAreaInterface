/**
 * PanguPay Footer Animation
 * 
 * Handles scroll-based floating animation for footer brand text
 * Optimized for performance using RAF and throttling
 */

let footerAnimationFrame = null;
let lastScrollY = 0;
let ticking = false;

/**
 * Initialize footer animations
 */
export function initFooter() {
  const footer = document.querySelector('.page-footer');
  if (!footer) {
    console.log('❌ Footer element not found');
    return;
  }

  const floatingLetters = document.querySelectorAll('.footer-brand-letter.float');
  console.log(`✅ Footer animations initialized - Found ${floatingLetters.length} floating letters`);
  
  // Log each floating letter for debugging
  floatingLetters.forEach((letter, i) => {
    console.log(`  Letter ${i}: "${letter.textContent}" - has .float class: ${letter.classList.contains('float')}`);
  });

  // Set up scroll listener with throttling
  window.addEventListener('scroll', handleFooterScroll, { passive: true });
  
  // Initial animation state
  updateFooterAnimation();
}

/**
 * Handle scroll event with throttling
 */
function handleFooterScroll() {
  lastScrollY = window.scrollY;
  
  if (!ticking) {
    footerAnimationFrame = requestAnimationFrame(updateFooterAnimation);
    ticking = true;
  }
}

/**
 * Update footer animation based on scroll position
 */
function updateFooterAnimation() {
  ticking = false;
  
  const footer = document.querySelector('.page-footer');
  if (!footer) {
    return;
  }

  // Check if footer is hidden
  if (footer.classList.contains('hidden')) {
    return;
  }

  // Get footer position relative to viewport
  const footerRect = footer.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  
  // Calculate progress based on footer visibility
  // 0 = footer just entering viewport (top at bottom of screen)
  // 1 = footer fully scrolled into view (top at top of screen)
  const footerTop = footerRect.top;
  
  let progress = 0;
  if (footerTop < windowHeight) {
    // Progress from 0 to 1 as footer scrolls from bottom to top of viewport
    progress = Math.min(1, Math.max(0, (windowHeight - footerTop) / windowHeight));
  }
  
  console.log(`📊 Scroll Progress: ${(progress * 100).toFixed(1)}% | FooterTop: ${footerTop.toFixed(0)}px`);

  // Animate floating letters
  animateFloatingLetters(progress);
  
  // Animate footer content fade-in
  animateFooterContent(progress);
}

/**
 * Animate the floating letters (Pay)
 * @param {number} progress - Scroll progress from 0 to 1
 * 0 = footer just visible, 1 = scrolled to bottom
 */
function animateFloatingLetters(progress) {
  const floatingLetters = document.querySelectorAll('.footer-brand-letter.float');
  
  if (floatingLetters.length === 0) {
    return;
  }
  
  // Start floating immediately when footer becomes visible (progress > 0)
  // Reach maximum float when progress = 1 (scrolled to bottom)
  
  if (progress <= 0) {
    // Footer not visible yet - reset
    floatingLetters.forEach(letter => {
      letter.style.transform = 'translateY(0px) translateZ(0)';
      letter.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
    });
    return;
  }
  
  console.log(`🎯 Floating active! Progress: ${(progress * 100).toFixed(1)}%`);
  
  floatingLetters.forEach((letter, index) => {
    // Each letter has a stagger delay
    const delay = index * 0.08;
    const letterProgress = Math.max(0, Math.min(1, (progress - delay) / (1 - delay)));
    
    // Easing
    const eased = easeOutCubic(letterProgress);
    
    // Calculate float distance
    // P: -100px, a: -150px, y: -200px
    const floatDistances = [-100, -150, -200];
    const translateY = floatDistances[index] * eased;
    
    // Apply transform
    letter.style.transform = `translateY(${translateY}px) translateZ(0)`;
    letter.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
    
    // Debug
    if (eased > 0.01) {
      console.log(`  ${letter.textContent}: ${translateY.toFixed(0)}px (${(eased * 100).toFixed(0)}%)`);
    }
  });
}

/**
 * Animate footer content fade-in
 * @param {number} progress - Footer visibility progress from 0 to 1
 */
function animateFooterContent(progress) {
  // DO NOTHING - Keep content always visible
  // The CSS already sets opacity: 1
}

/**
 * Easing function for smooth animation
 * @param {number} t - Progress from 0 to 1
 * @returns {number} Eased value
 */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Cleanup footer animations
 */
export function cleanupFooter() {
  window.removeEventListener('scroll', handleFooterScroll);
  
  if (footerAnimationFrame) {
    cancelAnimationFrame(footerAnimationFrame);
    footerAnimationFrame = null;
  }
}

/**
 * Reset footer animation state
 */
export function resetFooterAnimation() {
  const floatingLetters = document.querySelectorAll('.footer-brand-letter.float');
  floatingLetters.forEach(letter => {
    letter.style.transform = 'translateY(0) rotate(0deg) translateZ(0)';
  });
  
  const footerContent = document.querySelector('.footer-content');
  const footerBottom = document.querySelector('.footer-bottom');
  
  if (footerContent) {
    footerContent.style.opacity = '0';
    footerContent.style.transform = 'translateY(30px)';
  }
  
  if (footerBottom) {
    footerBottom.style.opacity = '0';
  }
}
