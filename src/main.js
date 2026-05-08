import { sha256hex } from './crypto.js'
import { parseUrl, verifyEditKey, resolvePermissions, generateSessionId, generateEditKey } from './session.js'
import { loadSessionData, createSession, createPin, deletePin } from './supabase.js'
import { initGlobe, addPinToScene, removePinFromScene } from './globe.js'
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

  // ── Render globe page ──────────────────────────────────────────────────────
  showGlobePage(session.name, session.mode, keyVerified)

  await initGlobe({
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
}

main()
