/**
 * PanguPay Footer Animation
 * 
 * Handles scroll-based floating animation for footer brand text
 * Uses IntersectionObserver for reliable detection across all scroll contexts
 */

let footerObserver = null;
let brandObserver = null;
let currentProgress = 0;
let animationFrame = null;

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

  // Setup IntersectionObserver for brand element
  setupBrandObserver();
  
  // Also listen for wheel events as a backup trigger
  setupWheelListener();
  
  // Initial animation state
  updateFloatingLetters(0);
}

/**
 * Setup IntersectionObserver to detect brand element visibility
 * Uses multiple thresholds for granular progress tracking
 */
function setupBrandObserver() {
  const brandElement = document.querySelector('.footer-brand');
  if (!brandElement) {
    console.log('❌ Brand element not found');
    return;
  }

  // Create thresholds from 0 to 1 in 0.01 increments for smooth animation
  const thresholds = [];
  for (let i = 0; i <= 100; i++) {
    thresholds.push(i / 100);
  }

  const options = {
    root: null, // viewport
    rootMargin: '0px',
    threshold: thresholds
  };

  brandObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // intersectionRatio: 0 = not visible, 1 = fully visible
      // We want: 0% progress when brand first appears at bottom
      //          100% progress when brand is at top of viewport
      
      const rect = entry.boundingClientRect;
      const windowHeight = window.innerHeight;
      
      // Calculate how far the element has traveled from bottom to top
      // When rect.bottom == windowHeight: element just entering from bottom (progress = 0)
      // When rect.top == 0: element at top of viewport (progress = 1)
      
      let progress = 0;
      
      if (entry.isIntersecting || rect.top < windowHeight) {
        // Distance from bottom of viewport to top of element
        const distanceFromBottom = windowHeight - rect.top;
        // Total travel distance = viewport height + element height
        const totalDistance = windowHeight + rect.height;
        
        progress = Math.min(1, Math.max(0, distanceFromBottom / totalDistance));
      }
      
      console.log(`🔍 IntersectionObserver - Ratio: ${(entry.intersectionRatio * 100).toFixed(1)}%, Progress: ${(progress * 100).toFixed(1)}%, Top: ${rect.top.toFixed(0)}px`);
      
      updateFloatingLetters(progress);
    });
  }, options);

  brandObserver.observe(brandElement);
  console.log('✅ Brand IntersectionObserver setup complete');
}

/**
 * Setup wheel event listener as backup animation trigger
 * This catches scroll-like interactions even when page doesn't actually scroll
 */
function setupWheelListener() {
  // Track cumulative wheel delta for pages that don't scroll
  let wheelAccumulator = 0;
  const maxWheelDelta = 1000; // Arbitrary max for full progress
  
  document.addEventListener('wheel', (e) => {
    const footer = document.querySelector('.page-footer');
    if (!footer || footer.classList.contains('hidden')) return;
    
    // Only process if footer is visible in viewport
    const footerRect = footer.getBoundingClientRect();
    if (footerRect.top > window.innerHeight) return;
    
    // Accumulate wheel delta
    wheelAccumulator += e.deltaY;
    wheelAccumulator = Math.max(0, Math.min(maxWheelDelta, wheelAccumulator));
    
    const wheelProgress = wheelAccumulator / maxWheelDelta;
    
    console.log(`🖱️ Wheel event - DeltaY: ${e.deltaY}, Accumulated: ${wheelAccumulator}, Progress: ${(wheelProgress * 100).toFixed(1)}%`);
    
    // Only use wheel progress if it's higher than observer progress
    // This ensures animation happens even without real scrolling
    if (wheelProgress > currentProgress) {
      updateFloatingLetters(wheelProgress);
    }
  }, { passive: true });
  
  console.log('✅ Wheel listener setup complete');
}

/**
 * Update the floating letters animation
 * @param {number} progress - Animation progress from 0 to 1
 */
function updateFloatingLetters(progress) {
  currentProgress = progress;
  
  const floatingLetters = document.querySelectorAll('.footer-brand-letter.float');
  if (floatingLetters.length === 0) return;
  
  // Get the font size to calculate half of 'u' height
  const brandText = document.querySelector('.footer-brand-text');
  if (!brandText) return;
  
  const fontSize = parseFloat(window.getComputedStyle(brandText).fontSize);
  const halfLetterHeight = fontSize * 0.5; // Half of 'u' height - max float distance
  
  // Apply easing for smoother animation
  const eased = easeOutCubic(progress);
  const translateY = -halfLetterHeight * eased; // Negative = upward
  
  console.log(`🎯 Floating letters - Progress: ${(progress * 100).toFixed(1)}%, Eased: ${(eased * 100).toFixed(1)}%, Offset: ${translateY.toFixed(1)}px`);
  
  // Apply transform to all floating letters
  floatingLetters.forEach((letter) => {
    letter.style.transform = `translateY(${translateY}px) translateZ(0)`;
    letter.style.transition = 'transform 0.15s ease-out'; // Smooth but responsive
  });
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
  if (brandObserver) {
    brandObserver.disconnect();
    brandObserver = null;
  }
  
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
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
