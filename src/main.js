import "./styles/application.bootstrap.scss"
import "bootstrap-icons/font/bootstrap-icons.css"
import "cropperjs/dist/cropper.css"
import "./javascript/components/api_loading"
import { createEformApi, currentFormCode } from "./stores/biz_portal"

const start = async () => {
  const q = new URLSearchParams(window.location.search).get("q")
  window.eformBootstrapData = await createEformApi(q, currentFormCode()).bootstrap()
  const [{ default: jquery }, { default: select2 }] = await Promise.all([
    import("jquery"),
    import("select2"),
  ])

  window.$ = window.jQuery = jquery
  select2(window, jquery)
  await import("./javascript/application.js")

  const controllers = ["form", "eform", "notification", "select-field", "select-search-field", "location-field", "list-field", "radio-buttons-field", "group-field", "copy-address-field", "file-field", "file-multiple-field", "basic-information-field", "checkbox-field", "tag-field", "title-field", "content-field", "organization-checking", "power-of-attorney-field", "datepicker", "trix-customization", "nested-form", "sortable"]
  const missing = controllers.filter((identifier) => !window.Stimulus.router.modulesByIdentifier.has(identifier))
  const status = document.getElementById("controller-status")

  if (status) status.textContent = missing.length ? `ไม่พบ controller: ${missing.join(", ")}` : `Stimulus controllers พร้อมใช้ ${controllers.length} รายการ`
  console.assert(!missing.length, "Missing Stimulus controllers", missing)
}

start().catch((error) => {
  console.error(error)
  window.alert("ไม่สามารถโหลดข้อมูลเริ่มต้นได้ กรุณาลองใหม่อีกครั้ง")
})
