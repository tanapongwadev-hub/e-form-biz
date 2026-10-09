export const currentFormCode = () => {
  const pathCode = window.location.pathname.match(/\/forms\/([^/]+)/)?.[1]
  const formCode = decodeURIComponent(pathCode || document.documentElement.dataset.formCode || "")
    .trim()
    .toUpperCase()
  if (!formCode) throw new Error("Missing formCode")
  return formCode
}

class EformApi {
  constructor(q, formCode = currentFormCode()) {
    if (!q) throw new Error("Missing q")
    this.q = q
    this.formCode = formCode
  }

  bootstrap() {
    return this.request("/api/eform/bootstrap")
  }

  createDraft(payload) {
    return this.request("/api/eform/draft", { payload })
  }

  sendOtp() {
    return this.request("/api/eform/send-otp")
  }

  submit(otp, payload) {
    return this.request("/api/eform/submit", { otp, payload })
  }

  fileUrl(fileId, contentType) {
    return `/api/eform/files/${encodeURIComponent(fileId)}?${new URLSearchParams({
      formCode: this.formCode,
      q: this.q,
      contentType: contentType || ""
    })}`
  }

  deleteFile(fileId) {
    return fetch(`/api/eform/files/${encodeURIComponent(fileId)}?${new URLSearchParams({
      formCode: this.formCode,
      q: this.q
    })}`, {
      method: "DELETE"
    })
  }

  async request(url, body = {}) {
    let response
    try {
      response = await fetch(url, {
        body: JSON.stringify({ formCode: this.formCode, q: this.q, ...body }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    } catch {
      throw new Error("ไม่สามารถเชื่อมต่อ E-Form API ได้ กรุณาลองใหม่อีกครั้ง")
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || `E-Form API HTTP ${response.status}`)
    return data
  }
}

export const createEformApi = (q, formCode) => new EformApi(q, formCode)
