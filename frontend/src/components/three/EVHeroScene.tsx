'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, RoundedBox, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

/** Stylized EV charging station built from drei primitives */
function ChargingStation() {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15
    }
  })

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.6}>
      <group ref={groupRef} position={[0, -0.2, 0]}>
        {/* Base platform */}
        <mesh position={[0, -1.2, 0]} receiveShadow>
          <cylinderGeometry args={[1.2, 1.4, 0.15, 32]} />
          <meshStandardMaterial color="#1a5c3a" metalness={0.6} roughness={0.3} />
        </mesh>

        {/* Station body */}
        <RoundedBox args={[0.8, 2.2, 0.5]} radius={0.08} smoothness={4} position={[0, 0, 0]} castShadow>
          <meshStandardMaterial color="#f0f0f0" metalness={0.15} roughness={0.4} />
        </RoundedBox>

        {/* Screen panel */}
        <RoundedBox args={[0.55, 0.6, 0.02]} radius={0.04} smoothness={4} position={[0, 0.35, 0.26]}>
          <meshStandardMaterial color="#0a2e1a" metalness={0.8} roughness={0.2} emissive="#26a866" emissiveIntensity={0.3} />
        </RoundedBox>

        {/* Charging port */}
        <mesh position={[0, -0.35, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
          <meshStandardMaterial color="#333" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* Status LED strip */}
        <mesh position={[0, 0.9, 0.26]}>
          <boxGeometry args={[0.5, 0.04, 0.02]} />
          <meshStandardMaterial color="#26a866" emissive="#26a866" emissiveIntensity={1.5} />
        </mesh>

        {/* Top cap */}
        <RoundedBox args={[0.9, 0.12, 0.6]} radius={0.04} smoothness={4} position={[0, 1.15, 0]} castShadow>
          <meshStandardMaterial color="#178750" metalness={0.4} roughness={0.3} />
        </RoundedBox>

        {/* Lightning bolt emblem */}
        <LightningBolt position={[0, 0.35, 0.28]} />

        {/* Cable */}
        <Cable />

        {/* Energy rings */}
        <EnergyRings />
      </group>
    </Float>
  )
}

/** Animated lightning bolt on the screen */
function LightningBolt({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.8 + Math.sin(state.clock.elapsedTime * 3) * 0.5
    }
  })

  const shape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0.05, 0.2)
    s.lineTo(-0.08, 0.03)
    s.lineTo(0.02, 0.03)
    s.lineTo(-0.05, -0.2)
    s.lineTo(0.08, -0.03)
    s.lineTo(-0.02, -0.03)
    s.closePath()
    return s
  }, [])

  return (
    <mesh ref={meshRef} position={position}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color="#34d399"
        emissive="#34d399"
        emissiveIntensity={1}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/** Curving cable from station */
function Cable() {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.35, 0.3),
      new THREE.Vector3(0.3, -0.6, 0.5),
      new THREE.Vector3(0.5, -0.9, 0.3),
      new THREE.Vector3(0.4, -1.1, 0.1),
    ])
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.02, 8, false)
    return tubeGeo
  }, [])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#555" metalness={0.5} roughness={0.6} />
    </mesh>
  )
}

/** Rotating energy rings around the station */
function EnergyRings() {
  const ring1 = useRef<THREE.Mesh>(null)
  const ring2 = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (ring1.current) {
      ring1.current.rotation.y = t * 0.5
      ring1.current.rotation.x = Math.sin(t * 0.3) * 0.2
    }
    if (ring2.current) {
      ring2.current.rotation.y = -t * 0.4
      ring2.current.rotation.z = Math.cos(t * 0.3) * 0.2
    }
  })

  return (
    <>
      <mesh ref={ring1} position={[0, 0.1, 0]}>
        <torusGeometry args={[1.0, 0.012, 8, 64]} />
        <meshStandardMaterial color="#26a866" emissive="#26a866" emissiveIntensity={0.8} transparent opacity={0.5} />
      </mesh>
      <mesh ref={ring2} position={[0, 0.1, 0]}>
        <torusGeometry args={[1.2, 0.008, 8, 64]} />
        <meshStandardMaterial color="#0c89eb" emissive="#0c89eb" emissiveIntensity={0.6} transparent opacity={0.35} />
      </mesh>
    </>
  )
}

/** Floating energy particles around the scene */
function EnergyParticles({ count = 40 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: [
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 3,
      ] as [number, number, number],
      speed: 0.2 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2,
      scale: 0.015 + Math.random() * 0.025,
    }))
  }, [count])

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime
    particles.forEach((p, i) => {
      dummy.position.set(
        p.position[0] + Math.sin(t * p.speed + p.offset) * 0.3,
        p.position[1] + Math.cos(t * p.speed * 0.7 + p.offset) * 0.4,
        p.position[2] + Math.sin(t * p.speed * 0.5) * 0.2,
      )
      dummy.scale.setScalar(p.scale * (1 + Math.sin(t * 2 + p.offset) * 0.3))
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={2} transparent opacity={0.7} />
    </instancedMesh>
  )
}

/** Main exported hero scene — render inside a div with set dimensions */
export default function EVHeroScene() {
  return (
    <Canvas
      camera={{ position: [2.5, 1.5, 3.5], fov: 35 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[512, 512]}
      />
      <pointLight position={[-3, 2, -2]} intensity={0.5} color="#0c89eb" />
      <pointLight position={[2, -1, 3]} intensity={0.3} color="#26a866" />

      <ChargingStation />
      <EnergyParticles count={35} />

      <ContactShadows
        position={[0, -1.35, 0]}
        opacity={0.4}
        scale={5}
        blur={2.5}
        far={4}
      />

      <Environment preset="city" environmentIntensity={0.3} />
    </Canvas>
  )
}
