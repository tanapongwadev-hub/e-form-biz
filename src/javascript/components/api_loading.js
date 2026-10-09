export function installApiLoading(win = window, doc = document) {
  let pending = 0
  let overlay

  const start = () => {
    pending += 1
    overlay ||= createOverlay(doc)
    overlay.hidden = false
    doc.body.setAttribute("aria-busy", "true")
  }

  const stop = () => {
    pending = Math.max(0, pending - 1)
    if (pending) return

    overlay.hidden = true
    doc.body.removeAttribute("aria-busy")
  }

  const originalFetch = win.fetch
  win.fetch = function (...args) {
    start()
    try {
      return Promise.resolve(originalFetch.apply(this, args)).finally(stop)
    } catch (error) {
      stop()
      throw error
    }
  }

  const originalSend = win.XMLHttpRequest.prototype.send
  win.XMLHttpRequest.prototype.send = function (...args) {
    start()
    this.addEventListener("loadend", stop, { once: true })
    try {
      return originalSend.apply(this, args)
    } catch (error) {
      stop()
      throw error
    }
  }
}

function createOverlay(doc) {
  const overlay = doc.createElement("div")
  overlay.className = "api-loading-overlay"
  overlay.hidden = true
  overlay.setAttribute("role", "status")
  overlay.setAttribute("aria-live", "polite")
  overlay.innerHTML = `
    <div class="api-loading-content">
      <span class="spinner-border text-primary" aria-hidden="true"></span>
      <span>กำลังโหลด...</span>
    </div>
  `
  doc.body.append(overlay)
  return overlay
}

if (typeof window !== "undefined") installApiLoading()
