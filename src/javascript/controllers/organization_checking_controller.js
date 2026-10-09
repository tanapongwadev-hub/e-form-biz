import ApplicationController from './application_controller'
import { Turbo, cable } from "@hotwired/turbo-rails"
import Swal from 'sweetalert2/dist/sweetalert2'

export default class extends ApplicationController {
  static values = {
    q: String,
    slug: String,
    consumerKey: String,
    userType: String,
    personId: String,
    personFirstNameTh: String,
    personLastNameTh: String,
    juristicId: String
  }


  static targets = [
    "registrationNo",
    "debug"
  ]

  token = null

  async connect() {
    super.connect()

    this.subscription = await cable.subscribeTo(this.organizationCheckingChannel, {
      received: this.dispatchMessageEvent.bind(this)
    })
  }

  async checkOrganization(event) {
    event.preventDefault()

    Swal.fire({
      title: 'กำลังตรวจสอบข้อมูลนิติบุคคล',
      text: 'กรุณารอสักครู่',
      didOpen: () => {
        Swal.showLoading()
      },
    })
    this.stimulate('Eform#check_organization', this.registrationNoTarget.value)
  }

  get organizationCheckingChannel() {
    const channel = "OrganizationCheckingChannel"
    const slug = this.slugValue
    const q = this.qValue

    return { channel, slug, q }
  }

  dispatchMessageEvent({key, status, data}) {
    switch (key) {
      case 'checking_result':
        const isSuccess = data.status.code === "S100"
        Swal.close()
        setTimeout(() => {
          if (this.userTypeValue == "entity_signatory") {
            Swal.fire({
              title: isSuccess ? 'ตรวจสอบข้อมูลสำเร็จ' : 'ตรวจสอบข้อมูลไม่สำเร็จ',
              text: data.status.descTH,
              icon: isSuccess ? 'success' : 'info',
              confirmButtonText: isSuccess ? 'ต่อไป' : 'ปิด',
            }).then((result) => {
              if (result.isConfirmed && isSuccess) {
                window.location.href = `/forms/${this.slugValue}?q=${encodeURIComponent(this.qValue)}&user_type=entity_signatory`
                // Turbo.visit(`/forms/${this.slugValue}?q=${encodeURIComponent(this.qValue)}&user_type=entity_signatory`)
              }
            })
          } else if (this.userTypeValue == "authorized_entity") {
            if (isSuccess) {
              Swal.fire({
                title: 'ตรวจสอบข้อมูลสำเร็จ',
                text: data.status.descTH,
                icon: 'success',
                confirmButtonText: 'ต่อไป',
              }).then((result) => {
                if (result.isConfirmed) {
                  window.location.href = `/forms/${this.slugValue}?q=${encodeURIComponent(this.qValue)}&user_type=authorized_entity`
                  // Turbo.visit(`/forms/${this.slugValue}?q=${encodeURIComponent(this.qValue)}&user_type=authorized_entity`)
                }
              })
            } else {
              Swal.fire({
                title: 'ไม่พบข้อมูลนิติบุคคล',
                text: data.status.descTH,
                icon: 'info',
                confirmButtonText: 'กรอกข้อมูลนิติด้วยตนเอง',
                showCancelButton: true,
                cancelButtonText: 'ปิด',
              }).then((result) => {
                if (result.isConfirmed) {
                  window.location.href = `/forms/${this.slugValue}?q=${encodeURIComponent(this.qValue)}&user_type=authorized_entity`
                  // Turbo.visit(`/forms/${this.slugValue}?q=${encodeURIComponent(this.qValue)}&user_type=authorized_entity`)
                }
              })
            }

          }
        }, 500)
        break
    }
  }

  // afterReflex(element, reflex, noop, reflexId) {
  //   if (!!this.juristicIdValue) {
  //     window.location.href = `/forms/${this.slugValue}?q=${encodeURIComponent(this.qValue)}&user_type=entity_signatory`
  //   }
  // }
}
