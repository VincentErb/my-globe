// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Escapes a string for safe insertion into HTML. */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const modeLabelMap = { owner: 'Private', mixed: 'Mixed', open: 'Open' }

function formatDate(dateStr) {
  if (!dateStr) return null
  try {
    // Append T00:00:00 to force local-time interpretation (not UTC midnight)
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function setupCopyBtn(btnId, text) {
  const btn = document.getElementById(btnId)
  if (!btn) return
  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = '✓ Copied'
      btn.classList.add('copied')
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied') }, 2000)
    })
  })
}

// ─── Landing page ─────────────────────────────────────────────────────────────

/**
 * Renders the "Create a Globe" form into #app-root.
 * `onCreated({ name, mode })` is called with the form values on submit.
 */
export function showCreateSessionPage(onCreated) {
  const root = document.getElementById('app-root')
  root.innerHTML = `
    <div class="landing">
      <div class="landing-card">
        <h1 class="landing-title">🌍 Create a Globe</h1>
        <p class="landing-subtitle">Set up a session to start pinning places on the map.</p>
        <form id="session-form">
          <div class="form-group">
            <label class="form-label" for="session-name">Session name</label>
            <input class="form-input" id="session-name" type="text"
              placeholder="e.g. My Travels" required maxlength="80">
          </div>
          <div class="form-group">
            <label class="form-label">Who can add pins?</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="mode" value="owner" checked>
                <div>
                  <div class="radio-option-label">Only me</div>
                  <div class="radio-option-desc">Edit key required to add or remove pins</div>
                </div>
              </label>
              <label class="radio-option">
                <input type="radio" name="mode" value="mixed">
                <div>
                  <div class="radio-option-label">Anyone can add, only I can delete</div>
                  <div class="radio-option-desc">Good for collecting pins from visitors</div>
                </div>
              </label>
              <label class="radio-option">
                <input type="radio" name="mode" value="open">
                <div>
                  <div class="radio-option-label">Fully open</div>
                  <div class="radio-option-desc">Anyone can add and remove any pin</div>
                </div>
              </label>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" id="create-btn">Create Globe</button>
        </form>
      </div>
    </div>
  `

  document.getElementById('session-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn  = document.getElementById('create-btn')
    const name = document.getElementById('session-name').value.trim()
    const mode = document.querySelector('input[name="mode"]:checked').value

    btn.disabled    = true
    btn.innerHTML   = '<span class="spinner"></span> Creating…'

    try {
      await onCreated({ name, mode })
    } catch (err) {
      btn.disabled  = false
      btn.textContent = 'Create Globe'
      showError(`Could not create session: ${err.message}`)
    }
  })
}

/**
 * Replaces the form inside the landing card with the share overlay.
 * Called immediately after a session is successfully created.
 */
export function showShareOverlay({ sessionId, editKey, baseUrl }) {
  const viewUrl = `${baseUrl}${sessionId}`
  const editUrl = `${baseUrl}${sessionId}?key=${editKey}`

  const card = document.querySelector('.landing-card')
  card.innerHTML = `
    <h1 class="landing-title">Your globe is ready!</h1>
    <p class="landing-subtitle">Share the view link freely. Keep the edit link private — it won't be shown again.</p>

    <div class="share-url-group">
      <div class="share-url-label">View link</div>
      <div class="share-url-row">
        <input class="share-url-input" readonly value="${esc(viewUrl)}" id="view-url-input">
        <button class="btn-copy" id="copy-view-btn">Copy</button>
      </div>
    </div>

    <div class="share-url-group">
      <div class="share-url-label">Edit link <span style="font-weight:400;color:#888">(private)</span></div>
      <div class="share-url-row">
        <input class="share-url-input" readonly value="${esc(editUrl)}" id="edit-url-input">
        <button class="btn-copy" id="copy-edit-btn">Copy</button>
      </div>
      <div class="share-warning">
        ⚠️ Save this link somewhere safe before continuing. You won't be able to retrieve the edit key again.
      </div>
    </div>

    <a href="/${esc(sessionId)}" class="btn btn-primary"
       style="display:block;text-align:center;text-decoration:none;margin-top:20px">
      Open Globe →
    </a>
  `

  setupCopyBtn('copy-view-btn', viewUrl)
  setupCopyBtn('copy-edit-btn', editUrl)
}

// ─── Globe page ───────────────────────────────────────────────────────────────

/**
 * Renders the globe page skeleton (session header + globe container) into #app-root.
 * Must be called BEFORE initGlobe() so that #globe-container exists in the DOM.
 */
export function showGlobePage(sessionName, mode, editMode) {
  const modeLabel = modeLabelMap[mode] ?? mode
  const root = document.getElementById('app-root')
  root.innerHTML = `
    <div class="page">
      <header class="page-header">
        <h1>${esc(sessionName)}</h1>
        <div class="page-header-meta">
          <span class="mode-badge mode-${esc(mode)}">${esc(modeLabel)}</span>
          ${editMode ? '<span class="edit-badge">✎ Editing</span>' : ''}
        </div>
      </header>
      <div id="globe-container"></div>
    </div>
  `
}

/**
 * Renders a full-page error message (session not found, network error, etc.)
 */
export function showErrorPage(message) {
  document.getElementById('app-root').innerHTML = `
    <div class="landing">
      <div class="landing-card" style="text-align:center">
        <p style="font-size:2rem;margin-bottom:16px">🌐</p>
        <h1 class="landing-title">Globe not found</h1>
        <p class="landing-subtitle">${esc(message)}</p>
        <a href="/" class="btn btn-primary"
           style="display:inline-block;text-decoration:none;margin-top:20px">
          Create a new Globe
        </a>
      </div>
    </div>
  `
}

// ─── Modals ───────────────────────────────────────────────────────────────────

export function closeModal() {
  document.getElementById('modal-root').innerHTML = ''
}

function openModal(innerHtml) {
  document.getElementById('modal-root').innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">${innerHtml}</div>
    </div>
  `
  // Trigger CSS transition on next frame
  requestAnimationFrame(() => {
    document.getElementById('modal-backdrop')?.classList.add('open')
  })
  // Click outside to close
  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal()
  })
}

/**
 * Opens the "Add pin" form modal.
 * `onSubmit({ lat, lng, type, message, date })` is called when the form is submitted.
 */
export function openCreatePinModal({ lat, lng, onSubmit }) {
  openModal(`
    <button class="modal-close" id="modal-close-btn">✕</button>
    <div class="modal-body">
      <h2>Add pin</h2>
      <form id="pin-form">
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label class="form-label">Latitude</label>
            <input class="form-input" value="${lat.toFixed(4)}" readonly tabindex="-1">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Longitude</label>
            <input class="form-input" value="${lng.toFixed(4)}" readonly tabindex="-1">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="pin-type">Type</label>
          <select class="form-select" id="pin-type">
            <option value="trip">◆ Trip</option>
            <option value="home">○ Home</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="pin-message">Message <span style="color:#aaa;font-weight:400">(optional)</span></label>
          <textarea class="form-textarea" id="pin-message"
            placeholder="What happened here?" maxlength="500" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="pin-date">Date <span style="color:#aaa;font-weight:400">(optional)</span></label>
          <input class="form-input" id="pin-date" type="date">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="pin-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="pin-save" style="width:auto;flex:1">Save pin</button>
        </div>
      </form>
    </div>
  `)

  document.getElementById('modal-close-btn').addEventListener('click', closeModal)
  document.getElementById('pin-cancel').addEventListener('click', closeModal)

  document.getElementById('pin-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const saveBtn = document.getElementById('pin-save')
    const type    = document.getElementById('pin-type').value
    const message = document.getElementById('pin-message').value.trim()
    const date    = document.getElementById('pin-date').value || null

    saveBtn.disabled  = true
    saveBtn.innerHTML = '<span class="spinner"></span>'

    try {
      await onSubmit({ lat, lng, type, message, date })
    } catch (err) {
      saveBtn.disabled  = false
      saveBtn.textContent = 'Save pin'
      showError(`Could not save pin: ${err.message}`)
    }
  })
}

/**
 * Opens the pin info modal.
 * Shows message, date, coordinates. Optionally shows a delete button.
 */
export function openPinInfoModal({ pin, canDelete, onDelete }) {
  const typeLabel    = pin.type === 'home' ? 'Home' : 'Trip'
  const formattedDate = formatDate(pin.date)

  openModal(`
    <button class="modal-close" id="modal-close-btn">✕</button>
    <div class="modal-body">
      <span class="pin-type-badge ${esc(pin.type)}">${esc(typeLabel)}</span>
      <p class="pin-message">
        ${pin.message ? esc(pin.message) : '<em style="color:#bbb">No message</em>'}
      </p>
      ${formattedDate ? `<p class="pin-date">📅 ${esc(formattedDate)}</p>` : ''}
      <p class="pin-coords">${pin.lat.toFixed(4)}°, ${pin.lng.toFixed(4)}°</p>

      ${canDelete ? `
        <div class="modal-actions" style="margin-top:20px">
          <button class="btn btn-danger-outline" id="pin-delete-btn">Delete pin</button>
        </div>
        <div id="pin-delete-confirm" style="display:none" class="modal-actions confirm-row">
          <span style="font-size:0.85rem;color:#666">Are you sure?</span>
          <button class="btn btn-danger" id="pin-delete-confirm-btn">Yes, delete</button>
          <button class="btn btn-ghost" id="pin-delete-cancel-btn">Cancel</button>
        </div>
      ` : ''}
    </div>
  `)

  document.getElementById('modal-close-btn').addEventListener('click', closeModal)

  if (canDelete) {
    const deleteBtn    = document.getElementById('pin-delete-btn')
    const confirmRow   = document.getElementById('pin-delete-confirm')
    const confirmBtn   = document.getElementById('pin-delete-confirm-btn')
    const cancelBtn    = document.getElementById('pin-delete-cancel-btn')

    deleteBtn.addEventListener('click', () => {
      deleteBtn.parentElement.style.display = 'none'
      confirmRow.style.display = 'flex'
    })

    cancelBtn.addEventListener('click', () => {
      deleteBtn.parentElement.style.display = ''
      confirmRow.style.display = 'none'
    })

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled  = true
      confirmBtn.innerHTML = '<span class="spinner"></span>'
      try {
        await onDelete()
      } catch (err) {
        confirmBtn.disabled  = false
        confirmBtn.textContent = 'Yes, delete'
        showError(`Could not delete pin: ${err.message}`)
      }
    })
  }
}

// ─── Inline error toast ───────────────────────────────────────────────────────

function showError(message) {
  const existing = document.getElementById('ui-error-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.id = 'ui-error-toast'
  toast.className = 'error-toast'
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => toast.remove(), 4000)
}
