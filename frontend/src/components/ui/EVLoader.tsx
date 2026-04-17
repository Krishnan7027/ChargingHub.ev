'use client'

import { motion } from 'framer-motion'

interface EVLoaderProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

const sizes = {
  sm: { icon: 24, text: 'text-sm' },
  md: { icon: 40, text: 'text-base' },
  lg: { icon: 56, text: 'text-lg' },
}

export default function EVLoader({ size = 'md', text }: EVLoaderProps) {
  const s = sizes[size]

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <motion.div
        className="relative"
        style={{ width: s.icon, height: s.icon }}
      >
        {/* Glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(38,168,102,0.3) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.5, 0.2, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Lightning bolt SVG */}
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          width={s.icon}
          height={s.icon}
          animate={{
            scale: [1, 1.1, 1],
            filter: [
              'drop-shadow(0 0 4px rgba(38,168,102,0.4))',
              'drop-shadow(0 0 12px rgba(38,168,102,0.8))',
              'drop-shadow(0 0 4px rgba(38,168,102,0.4))',
            ],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <motion.path
            d="M13 2L4.5 12.5H11.5L10.5 22L19.5 11.5H12.5L13 2Z"
            fill="url(#bolt-gradient)"
            stroke="rgba(38,168,102,0.6)"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="bolt-gradient" x1="12" y1="2" x2="12" y2="22">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#178750" />
            </linearGradient>
          </defs>
        </motion.svg>
      </motion.div>

      {text && (
        <motion.p
          className={`${s.text} font-medium text-[var(--color-theme-secondary)]`}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {text}
        </motion.p>
      )}
    </div>
  )
}
