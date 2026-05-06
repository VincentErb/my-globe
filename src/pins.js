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

const TRIP_MAT = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.1 })
const HOME_MAT = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3, metalness: 0.15 })

export const SCALE_DEFAULT = new THREE.Vector3(1, 1, 1)
export const SCALE_HOVER   = new THREE.Vector3(1.5, 1.5, 1.5)

// ─── Live pin tracking (mutated by addPinToArrays / destroyPin) ───────────────

/** All pin THREE.Group objects currently in the scene. */
export const allPinGroups = []

/** All pin child Mesh objects — used by the raycaster. */
export const pinMeshes = []

// ─── Build / destroy ──────────────────────────────────────────────────────────

/**
 * Builds a Three.js Group representing a pin at pinData.lat / pinData.lng.
 * pinData must include: { id, lat, lng, type, message, date }
 *
 * trip → red rotated-box (diamond) on a thin stem
 * home → blue torus ring on a thin stem
 */
export function buildPin(pinData) {
  const STEM_H = 0.055
  const isHome = pinData.type === 'home'
  const mat = isHome ? HOME_MAT : TRIP_MAT

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.003, STEM_H, 6),
    mat,
  )
  stem.position.y = STEM_H / 2

  let marker
  if (isHome) {
    marker = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 8, 24), mat)
    marker.rotation.x = Math.PI / 2   // hole faces outward (+Y normal)
    marker.position.y = STEM_H + 0.012
  } else {
    marker = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.009, 0.038), mat)
    marker.rotation.y = Math.PI / 4   // 45° → diamond silhouette from above
    marker.position.y = STEM_H + 0.005
  }

  const group = new THREE.Group()
  group.add(stem, marker)

  // Back-references so the raycaster can climb from mesh → group → pin data
  stem.userData.pinGroup   = group
  marker.userData.pinGroup = group
  group.userData.pin       = pinData   // full Supabase row incl. id

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
