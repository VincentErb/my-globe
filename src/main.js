import { sha256hex } from './crypto.js'
import { parseUrl, verifyEditKey, resolvePermissions, generateSessionId, generateEditKey } from './session.js'
import { loadSessionData, createSession, createPin, deletePin } from './supabase.js'
import { initGlobe, addPinToScene, removePinFromScene, setAutoRotate } from './globe.js'
import {
  showCreateSessionPage,
  showShareOverlay,
  showGlobePage,
  showErrorPage,
  openCreatePinModal,
  openPinInfoModal,
  closeModal,
} from './ui.js'

async function main() {
  const { sessionId, editKey } = parseUrl()

  // ── No session → show "Create a Globe" landing page ───────────────────────
  if (!sessionId) {
    showCreateSessionPage(async ({ name, mode }) => {
      const id     = generateSessionId()
      const rawKey = generateEditKey()

      await createSession({ id, name, mode, editKeyHash: await sha256hex(rawKey) })

      const BASE_PATH = import.meta.env.VITE_BASE_PATH ?? ''
      const baseUrl = window.location.origin + BASE_PATH + '/'
      showShareOverlay({ sessionId: id, editKey: rawKey, baseUrl })
    })
    return
  }

  // ── Load session + pins ────────────────────────────────────────────────────
  let session, pins
  try {
    ;({ session, pins } = await loadSessionData(sessionId))
  } catch (err) {
    showErrorPage(err.message)
    return
  }

  // Verify edit key against the stored hash (client-side check)
  const keyVerified = editKey
    ? await verifyEditKey(editKey, session.edit_key_hash)
    : false

  const perms = resolvePermissions(session.mode, keyVerified)

  const isEmbedded = window.self !== window.top

  // ── Render globe page ──────────────────────────────────────────────────────
  showGlobePage(session.name, session.mode, keyVerified, isEmbedded)

  await initGlobe({
    enableZoom: !isEmbedded,

    onGlobeRightClick: ({ lat, lng }) => {
      if (!perms.canCreate) return
      openCreatePinModal({
        lat,
        lng,
        onSubmit: async (formData) => {
          const pin = await createPin({ sessionId, editKey, ...formData })
          addPinToScene(pin)
          closeModal()
        },
      })
    },

    onPinClick: (pinData) => {
      openPinInfoModal({
        pin: pinData,
        canDelete: perms.canDelete,
        onDelete: async () => {
          await deletePin({ pinId: pinData.id, sessionId, editKey })
          removePinFromScene(pinData.id)
          closeModal()
        },
      })
    },
  })

  // Add all existing pins to the scene
  pins.forEach((pin) => addPinToScene(pin))

  // Wire up rotate toggle (only rendered when not embedded)
  const rotateBtn = document.getElementById('rotate-toggle')
  if (rotateBtn) {
    rotateBtn.addEventListener('click', () => {
      const rotating = rotateBtn.dataset.rotating === 'true'
      setAutoRotate(!rotating)
      rotateBtn.dataset.rotating = String(!rotating)
      rotateBtn.textContent = !rotating ? '⏸ Pause rotation' : '▶ Resume rotation'
    })
  }

  // Pause rotation while any modal is open, resume when it closes.
  // Tracks user's intent so toggling the button while modal is open still works.
  const modalRoot = document.getElementById('modal-root')
  let rotatingBeforeModal = true
  new MutationObserver(() => {
    const modalOpen = modalRoot.children.length > 0
    if (modalOpen) {
      rotatingBeforeModal = rotateBtn ? rotateBtn.dataset.rotating === 'true' : true
      setAutoRotate(false)
    } else {
      if (rotatingBeforeModal) setAutoRotate(true)
    }
  }).observe(modalRoot, { childList: true })
}

main()
