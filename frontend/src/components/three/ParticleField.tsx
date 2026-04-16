'use client'

import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Floating particles that respond to cursor position */
function Particles({ count = 80 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const mouse = useRef({ x: 0, y: 0 })
  const { viewport } = useThree()

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', handleMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * viewport.width * 2,
      y: (Math.random() - 0.5) * viewport.height * 2,
      z: (Math.random() - 0.5) * 4,
      speed: 0.1 + Math.random() * 0.3,
      offset: Math.random() * Math.PI * 2,
      scale: 0.01 + Math.random() * 0.03,
    }))
  }, [count, viewport.width, viewport.height])

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime
    const mx = mouse.current.x
    const my = mouse.current.y

    particles.forEach((p, i) => {
      const parallaxX = mx * p.z * 0.15
      const parallaxY = my * p.z * 0.15

      dummy.position.set(
        p.x + Math.sin(t * p.speed + p.offset) * 0.4 + parallaxX,
        p.y + Math.cos(t * p.speed * 0.8 + p.offset) * 0.3 + parallaxY,
        p.z,
      )
      const s = p.scale * (1 + Math.sin(t * 1.5 + p.offset) * 0.4)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#34d399" transparent opacity={0.4} />
    </instancedMesh>
  )
}

/** Subtle connection lines between nearby particles */
function ConnectionLines({ count = 80 }: { count?: number }) {
  const linesRef = useRef<THREE.LineSegments>(null)
  const { viewport } = useThree()

  const positions = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * viewport.width * 2,
      y: (Math.random() - 0.5) * viewport.height * 2,
      z: (Math.random() - 0.5) * 2,
      speed: 0.1 + Math.random() * 0.2,
      offset: Math.random() * Math.PI * 2,
    }))
  }, [count, viewport.width, viewport.height])

  useFrame((state) => {
    if (!linesRef.current) return
    const t = state.clock.elapsedTime
    const linePositions: number[] = []

    const maxDist = 1.5

    for (let i = 0; i < positions.length; i++) {
      const pi = positions[i]
      const xi = pi.x + Math.sin(t * pi.speed + pi.offset) * 0.4
      const yi = pi.y + Math.cos(t * pi.speed * 0.8 + pi.offset) * 0.3

      for (let j = i + 1; j < positions.length; j++) {
        const pj = positions[j]
        const xj = pj.x + Math.sin(t * pj.speed + pj.offset) * 0.4
        const yj = pj.y + Math.cos(t * pj.speed * 0.8 + pj.offset) * 0.3

        const dx = xi - xj
        const dy = yi - yj
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < maxDist) {
          linePositions.push(xi, yi, pi.z, xj, yj, pj.z)
        }
      }
    }

    const geo = linesRef.current.geometry as THREE.BufferGeometry
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(linePositions, 3),
    )
    geo.attributes.position.needsUpdate = true
  })

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry />
      <lineBasicMaterial color="#26a866" transparent opacity={0.08} />
    </lineSegments>
  )
}

export default function ParticleField() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
  }, [])

  if (reducedMotion) return null

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Particles count={60} />
        <ConnectionLines count={60} />
      </Canvas>
    </div>
  )
}
