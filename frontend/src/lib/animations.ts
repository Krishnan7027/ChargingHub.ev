import type { Variants, Transition } from 'framer-motion'

// ── Shared Transitions ─────────────────────────────────────────────
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 24,
}

export const smoothTransition: Transition = {
  duration: 0.4,
  ease: [0.25, 0.46, 0.45, 0.94],
}

export const quickTransition: Transition = {
  duration: 0.2,
  ease: 'easeOut',
}

// ── Page Transitions ────────────────────────────────────────────────
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export const pageTransition: Transition = {
  duration: 0.35,
  ease: [0.25, 0.46, 0.45, 0.94],
}

// ── Fade In ─────────────────────────────────────────────────────────
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: smoothTransition },
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: smoothTransition },
}

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: smoothTransition },
}

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: smoothTransition },
}

// ── Scale ───────────────────────────────────────────────────────────
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: springTransition },
}

// ── Stagger Container ───────────────────────────────────────────────
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
}

// ── Stagger Children ────────────────────────────────────────────────
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: smoothTransition },
}

// ── Card Hover ──────────────────────────────────────────────────────
export const cardHover = {
  rest: {
    scale: 1,
    y: 0,
    transition: smoothTransition,
  },
  hover: {
    scale: 1.02,
    y: -4,
    transition: springTransition,
  },
}

// ── Button Interactions ─────────────────────────────────────────────
export const buttonTap = {
  scale: 0.97,
  transition: quickTransition,
}

export const buttonHover = {
  scale: 1.03,
  transition: quickTransition,
}

// ── Dropdown / Modal ────────────────────────────────────────────────
export const dropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -4,
    transition: quickTransition,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -4,
    transition: quickTransition,
  },
}

export const modalOverlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

export const modalContentVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springTransition },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: quickTransition },
}

// ── Scroll-triggered Section ────────────────────────────────────────
export const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

// ── Pulse (availability indicator) ──────────────────────────────────
export const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.15, 1],
    opacity: [1, 0.7, 1],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
}

// ── Navbar Scroll ───────────────────────────────────────────────────
export const navbarVariants = {
  top: {
    paddingTop: '1rem',
    paddingBottom: '1rem',
  },
  scrolled: {
    paddingTop: '0.5rem',
    paddingBottom: '0.5rem',
  },
}
