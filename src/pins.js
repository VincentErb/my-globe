import * as THREE from 'three'

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/**
 * Converts geographic lat/lng to a Three.js Vector3 on a sphere of radius r.
 * The 180+lng offset aligns with Three.js IcosahedronGeometry's UV mapping.
 */
export function latLngToVector3(lat, lng, r) {
  const phi = (90 - lat) * Math.PI / 180
  const theta = (180 + lng) * Math.PI / 180
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

// ─── Shared materials ─────────────────────────────────────────────────────────

// All matte (roughness=1, metalness=0) for a flat, 2D-friendly look
const MARKER_MAT = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 1, metalness: 0 })
const STAR_MAT   = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 1, metalness: 0 })
const DOT_MAT    = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 1, metalness: 0 })
const GEM_MAT    = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 1, metalness: 0 })

export const SCALE_DEFAULT = new THREE.Vector3(1, 1, 1)
export const SCALE_HOVER   = new THREE.Vector3(1.5, 1.5, 1.5)

// ─── Live pin tracking (mutated by addPinToArrays / destroyPin) ───────────────

/** All pin THREE.Group objects currently in the scene. */
export const allPinGroups = []

/** All pin child Mesh objects — used by the raycaster. */
export const pinMeshes = []

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function makeStem(mat, stemH) {
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, stemH, 6), mat)
  stem.position.y = stemH / 2
  return stem
}

function makeStarShape(outerR, innerR, points) {
  const shape = new THREE.Shape()
  const step = Math.PI / points
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = i * step - Math.PI / 2
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
}

// ─── Build / destroy ──────────────────────────────────────────────────────────

/**
 * Builds a Three.js Group representing a pin at pinData.lat / pinData.lng.
 * pinData must include: { id, lat, lng, type, message, date }
 *
 * marker → coral teardrop on stem (with stem)
 * star   → amber 5-pointed star on stem (with stem)
 * dot    → sky-blue flat circle, no stem
 * gem    → emerald flat diamond, no stem
 */
export function buildPin(pinData) {
  const STEM_H = 0.055
  const group  = new THREE.Group()
  let marker

  if (pinData.type === 'marker') {
    const stem = makeStem(MARKER_MAT, STEM_H)
    stem.userData.pinGroup = group
    group.add(stem)

    // Teardrop: semicircle top + two lines converging to a point
    const shape = new THREE.Shape()
    const r = 0.024
    shape.moveTo(-r, 0)
    shape.absarc(0, 0, r, Math.PI, 0, false)  // top semicircle
    shape.lineTo(0, -0.034)                   // right edge to tip
    shape.closePath()                          // closes back to (-r, 0)
    marker = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), MARKER_MAT)
    marker.rotation.x = -Math.PI / 2          // lay flat, face outward from globe
    marker.position.y = STEM_H + 0.004

  } else if (pinData.type === 'star') {
    const stem = makeStem(STAR_MAT, STEM_H)
    stem.userData.pinGroup = group
    group.add(stem)

    marker = new THREE.Mesh(
      new THREE.ShapeGeometry(makeStarShape(0.028, 0.012, 5)),
      STAR_MAT,
    )
    marker.rotation.x = -Math.PI / 2
    marker.position.y = STEM_H + 0.004

  } else if (pinData.type === 'dot') {
    marker = new THREE.Mesh(new THREE.CircleGeometry(0.038, 32), DOT_MAT)
    marker.rotation.x = -Math.PI / 2          // flat on globe surface
    marker.position.y = 0.005

  } else {
    // gem (default fallback)
    const shape = new THREE.Shape()
    shape.moveTo(0, 0.036)
    shape.lineTo(0.026, 0)
    shape.lineTo(0, -0.036)
    shape.lineTo(-0.026, 0)
    shape.closePath()
    marker = new THREE.Mesh(new THREE.ShapeGeometry(shape), GEM_MAT)
    marker.rotation.x = -Math.PI / 2
    marker.position.y = 0.005
  }

  marker.userData.pinGroup = group
  group.add(marker)
  group.userData.pin = pinData   // full Supabase row incl. id

  // Orient the pin perpendicular to the globe surface at (lat, lng)
  const normal = latLngToVector3(pinData.lat, pinData.lng, 1.0).normalize()
  group.position.copy(normal)
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)

  return group
}

/**
 * Registers a newly built pin group in the tracking arrays so the
 * animate loop and raycaster can see it.
 */
export function addPinToArrays(group) {
  allPinGroups.push(group)
  group.children.forEach((m) => pinMeshes.push(m))
}

/**
 * Removes a pin group from the scene and disposes its geometries.
 */
export function destroyPin(group, globe) {
  group.children.forEach((mesh) => {
    mesh.geometry.dispose()
    const i = pinMeshes.indexOf(mesh)
    if (i !== -1) pinMeshes.splice(i, 1)
  })
  globe.remove(group)
  const i = allPinGroups.indexOf(group)
  if (i !== -1) allPinGroups.splice(i, 1)
}
