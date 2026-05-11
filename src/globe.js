import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { BASE_PATH } from './session.js'
import {
  latLngToVector3,
  buildPin,
  addPinToArrays,
  destroyPin,
  allPinGroups,
  pinMeshes,
  SCALE_DEFAULT,
  SCALE_HOVER,
} from './pins.js'

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_LNG        = 15      // longitude shown on load (≈ central Europe)
const AUTO_ROTATE        = true

// ─── Module-level state set by initGlobe ─────────────────────────────────────

let globeMesh    = null
let controls     = null

// ─── Geodesic sphere ─────────────────────────────────────────────────────────

function createGeodesicSphere(radius, detail) {
  let geo = new THREE.IcosahedronGeometry(radius, detail)
  geo = geo.toNonIndexed()     // unshared vertices → per-face normals
  geo.computeVertexNormals()   // flat / crystalline faceting
  return geo
}

// ─── Texture ─────────────────────────────────────────────────────────────────

async function loadTextures(renderer) {
  const loader    = new THREE.TextureLoader()
  const colorMap  = await loader.loadAsync(`${BASE_PATH}/textures/natural-earth-3-no-ice-clouds-8k.jpg`)
  colorMap.colorSpace  = THREE.SRGBColorSpace
  colorMap.anisotropy  = renderer.capabilities.getMaxAnisotropy()
  colorMap.minFilter   = THREE.LinearMipmapLinearFilter
  colorMap.magFilter   = THREE.LinearFilter
  return colorMap
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialises the Three.js scene inside #globe-container.
 * Must be called AFTER ui.showGlobePage() has injected #globe-container into the DOM.
 *
 * @param {{ onPinClick: (pinData) => void, onGlobeRightClick: ({lat, lng}) => void, enableZoom?: boolean }} callbacks
 */
export async function initGlobe({ onPinClick, onGlobeRightClick, enableZoom = true }) {
  const container = document.getElementById('globe-container')

  // ── Renderer ────────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping         = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.outputColorSpace    = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)

  // ── Scene & Camera ──────────────────────────────────────────────────────────
  const scene  = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    1000,
  )
  camera.position.set(0, 0, 3)

  // ── Globe ───────────────────────────────────────────────────────────────────
  const colorMap  = await loadTextures(renderer)
  const globeMat  = new THREE.MeshStandardMaterial({ map: colorMap, roughness: 0.85, metalness: 0.0 })
  const globeGeo  = createGeodesicSphere(1.0, 6)
  globeMesh       = new THREE.Mesh(globeGeo, globeMat)
  globeMesh.scale.set(1.0, 0.975, 1.0)                              // slight oblate flattening
  globeMesh.rotation.y = THREE.MathUtils.degToRad(90 + DEFAULT_LNG) // face Europe on load
  scene.add(globeMesh)

  // ── Lights ──────────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe8f0ff, 2.8))
  const sun = new THREE.DirectionalLight(0xffffff, 0.35)
  sun.position.set(1, 1, 2)
  scene.add(sun)

  // ── OrbitControls ───────────────────────────────────────────────────────────
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping    = true
  controls.dampingFactor    = 0.05
  controls.autoRotate       = AUTO_ROTATE
  controls.autoRotateSpeed  = 0.4
  controls.enableZoom       = enableZoom
  controls.minDistance      = 1.5
  controls.maxDistance      = 5.0
  controls.enablePan        = false
  controls.minPolarAngle    = Math.PI * 0.1
  controls.maxPolarAngle    = Math.PI * 0.9

  // ── Input tracking ──────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster()
  const mouse     = new THREE.Vector2(-9999, -9999)
  let   hoveredPin = null

  container.addEventListener('mousemove', (e) => {
    const r  = container.getBoundingClientRect()
    mouse.x  = ((e.clientX - r.left) / r.width)  * 2 - 1
    mouse.y  = -((e.clientY - r.top) / r.height) * 2 + 1
  })

  // Left-click → open info modal for hovered pin
  container.addEventListener('click', () => {
    if (hoveredPin) onPinClick(hoveredPin.userData.pin)
  })

  // Right-click → compute lat/lng at hit point, call onGlobeRightClick
  container.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    const r  = container.getBoundingClientRect()
    const cx = ((e.clientX - r.left) / r.width)  * 2 - 1
    const cy = -((e.clientY - r.top) / r.height) * 2 + 1

    raycaster.setFromCamera(new THREE.Vector2(cx, cy), camera)
    const hits = raycaster.intersectObject(globeMesh)
    if (!hits.length) return

    // Convert hit point from world space into the globe's local space, then
    // invert the latLngToVector3 transform to recover lat/lng.
    const local = globeMesh.worldToLocal(hits[0].point.clone()).normalize()
    const phi   = Math.acos(THREE.MathUtils.clamp(local.y, -1, 1))
    const lat   = 90 - phi * 180 / Math.PI
    const lng   = Math.atan2(local.z, local.x) * 180 / Math.PI - 180

    onGlobeRightClick({ lat, lng })
  })

  // ── Resize ──────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  })

  // ── Animate ─────────────────────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate)
    controls.update()

    // Hover detection — only consider pins facing the camera
    raycaster.setFromCamera(mouse, camera)
    const hits = raycaster.intersectObjects(pinMeshes)
    let newHovered = null
    for (const hit of hits) {
      const pin = hit.object.userData.pinGroup
      const wp  = new THREE.Vector3()
      pin.getWorldPosition(wp)
      if (wp.dot(camera.position) > 0) { newHovered = pin; break }
    }

    if (newHovered !== hoveredPin) {
      hoveredPin = newHovered
      container.style.cursor = hoveredPin ? 'pointer' : ''
    }

    // Smooth scale animation for all pins
    allPinGroups.forEach((pin) => {
      pin.scale.lerp(pin === hoveredPin ? SCALE_HOVER : SCALE_DEFAULT, 0.1)
    })

    renderer.render(scene, camera)
  }
  animate()
}

/**
 * Adds a pin to the scene from a Supabase pin row object.
 * Safe to call at any time after initGlobe().
 */
export function addPinToScene(pinData) {
  const group = buildPin(pinData)
  globeMesh.add(group)
  addPinToArrays(group)
}

/**
 * Removes the pin with the given id from the scene.
 */
export function removePinFromScene(pinId) {
  const group = allPinGroups.find((g) => g.userData.pin.id === pinId)
  if (group) destroyPin(group, globeMesh)
}

/**
 * Pauses or resumes auto-rotation (e.g. while a modal is open).
 */
export function setAutoRotate(enabled) {
  if (controls) controls.autoRotate = enabled
}
