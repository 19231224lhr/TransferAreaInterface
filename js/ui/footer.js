/**
 * PanguPay Footer Animation
 * 
 * Handles scroll-based floating animation for footer brand text
 * Uses IntersectionObserver for reliable detection across all scroll contexts
 */

let brandObserver = null;
let animationFrame = null;

const FLOAT_TRANSITION = 'transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)';

function ensureFloatLetterTransition(letter) {
  // Important: transition must be set BEFORE the first transform update.
  // If we set transform first and transition second, the browser will snap (jump)
  // and only animate subsequent corrections, which looks like "jump up then fall".
  if (letter && letter.style.transition !== FLOAT_TRANSITION) {
    letter.style.transition = FLOAT_TRANSITION;
  }
}

/**
 * Initialize footer animations
 */
export function initFooter() {
  const footer = document.querySelector('.page-footer');
  if (!footer) return;

  const floatingLetters = document.querySelectorAll('.footer-brand-letter.float');
  if (floatingLetters.length === 0) return;

  // Ensure transitions exist before any transform updates (prevents first-frame snapping).
  floatingLetters.forEach((letter) => ensureFloatLetterTransition(letter));

  // Setup IntersectionObserver for brand element
  setupBrandObserver();
  
  // Initial animation state
  updateFloatingLetters(0);
}

/**
 * Setup IntersectionObserver to detect brand element visibility
 * Uses fewer thresholds for better performance
 */
function setupBrandObserver() {
  const brandElement = document.querySelector('.footer-brand');
  if (!brandElement) return;

  // Reduced thresholds for better performance (21 instead of 101)
  const thresholds = [];
  for (let i = 0; i <= 20; i++) {
    thresholds.push(i / 20);
  }

  const options = {
    root: null, // viewport
    rootMargin: '0px',
    threshold: thresholds
  };

  brandObserver = new IntersectionObserver(() => {
    calculateAndUpdateProgress();
  }, options);

  brandObserver.observe(brandElement);
  
  // Also add scroll listener for more precise updates - only bind once
  if (!window._footerScrollBind) {
    let scrollTicking = false;
    window.addEventListener('scroll', () => {
      if (!scrollTicking) {
        window.requestAnimationFrame(() => {
          calculateAndUpdateProgress();
          scrollTicking = false;
        });
        scrollTicking = true;
      }
    }, { passive: true });
    window._footerScrollBind = true;
  }
}

/**
 * Calculate progress based on brand element position
 * This function is called by both IntersectionObserver and scroll events
 */
function calculateAndUpdateProgress() {
  const brandElement = document.querySelector('.footer-brand');
  if (!brandElement) return;

  // If footer/brand is hidden (display:none), DOMRect becomes {top:0,height:0}
  // which incorrectly produces progress=1 and makes "Pay" jump.
  // Guard against non-rendered state and keep letters at rest.
  const style = window.getComputedStyle(brandElement);
  if (style.display === 'none' || style.visibility === 'hidden') {
    updateFloatingLetters(0);
    return;
  }
  
  const rect = brandElement.getBoundingClientRect();
  if (rect.height === 0 || rect.width === 0) {
    updateFloatingLetters(0);
    return;
  }
  const windowHeight = window.innerHeight;
  
  let progress = 0;
  
  if (rect.top < windowHeight) {
    // Distance from bottom of viewport to top of element
    const distanceFromBottom = windowHeight - rect.top;
    // Total travel distance = viewport height + element height
    const totalDistance = windowHeight + rect.height;
    
    progress = Math.min(1, Math.max(0, distanceFromBottom / totalDistance));
  }
  
  updateFloatingLetters(progress);
}

/**
 * Update the floating letters animation
 * Each letter floats at different rate and height:
 * - y (index 2): floats first, highest (100% of max height)
 * - a (index 1): floats second (70% of max height)  
 * - P (index 0): floats last, lowest (45% of max height)
 * 
 * @param {number} progress - Animation progress from 0 to 1
 */
function updateFloatingLetters(progress) {
  const floatingLetters = document.querySelectorAll('.footer-brand-letter.float');
  if (floatingLetters.length === 0) return;
  
  // Get the font size to calculate max float distance
  const brandText = document.querySelector('.footer-brand-text');
  if (!brandText) return;
  
  const fontSize = parseFloat(window.getComputedStyle(brandText).fontSize);
  const maxFloatHeight = fontSize * 0.65; // Base max float height (increased from 0.45)
  
  // Letter configuration: [heightMultiplier, progressOffset, easingPower]
  // progressOffset: delays when the letter starts moving (0 = immediate, 0.3 = starts at 30% progress)
  // heightMultiplier: how high relative to maxFloatHeight
  const letterConfig = [
    { heightMult: 0.60, progressOffset: 0.25, easePower: 2.5 },  // P - starts late, lower height
    { heightMult: 0.85, progressOffset: 0.12, easePower: 2.2 },  // a - medium delay, medium height
    { heightMult: 1.10, progressOffset: 0.00, easePower: 2.0 },  // y - starts first, highest
  ];
  
  // Apply transform to each floating letter with different timing
  floatingLetters.forEach((letter, index) => {
    const config = letterConfig[index] || letterConfig[0];

    ensureFloatLetterTransition(letter);
    
    // Calculate adjusted progress for this letter (with offset)
    const adjustedProgress = Math.max(0, (progress - config.progressOffset) / (1 - config.progressOffset));
    
    // Apply easing with custom power
    const eased = 1 - Math.pow(1 - adjustedProgress, config.easePower);
    
    // Calculate final translate
    const translateY = -maxFloatHeight * config.heightMult * eased;
    
    letter.style.transform = `translateY(${translateY}px) translateZ(0)`;
  });
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
