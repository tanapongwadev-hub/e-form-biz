import { Controller } from "@hotwired/stimulus"
import { cable } from "@hotwired/turbo-rails"
import Swal from 'sweetalert2/dist/sweetalert2'

export default class extends Controller {
  static values = {
    slug: String,
    q: String,
    bizCallbackUrl: String
  }

  async connect() {
    this.subscription = await cable.subscribeTo(this.notificationChannel, {
      received: this.dispatchMessageEvent.bind(this)
    })
  }

  get notificationChannel() {
    const channel = "NotificationChannel"
    const slug = this.slugValue
    const q = this.qValue

    return { channel, slug, q }
  }

  dispatchMessageEvent({status, data, key, errorMessage, message}) {
    switch(key) {
      case 'draft':
        if (status == 0) {
          Swal.fire({
            title: 'บันทึกร่างคำร้องสำเร็จ',
            text: message,
            icon: 'success',
            confirmButtonText: 'ตกลง'
          })
        } else {
          Swal.fire({
            title: 'บันทึกร่างคำร้องไม่สำเร็จ',
            icon: 'error',
            text: errorMessage || message,
            confirmButtonText: 'ตกลง'
          })
        }
        break
      case 'submit-form':
        if (status == 0) {
          Swal.fire({
            title: 'ยื่นคำร้องสำเร็จ',
            text: message,
            icon: 'success',
            confirmButtonText: 'ตกลง'
          }).then(() => {
            window.location.href = `${this.bizCallbackUrlValue}?requestId=${data.requestId}`
          })
        } else {
          Swal.fire({
            title: 'ยื่นคำร้องไม่สำเร็จ',
            icon: 'error',
            text: errorMessage || message,
            confirmButtonText: 'ตกลง'
          })
        }
        break
      case 'save-form-field':
        Swal.fire({
          text: message || 'บันทึกข้อมูลสำเร็จ',
          target: '#custom-target',
          customClass: {
            container: 'position-fixed'
          },
          showConfirmButton: false,
          showDenyButton: false,
          showCancelButton: false,
          toast: true,
          icon: 'success',
          timer: 1500,
          position: 'top-right'
        })
        break;
      case 'auth-fail':
        Swal.fire({
          title: 'เซสชันหมดอายุ',
          icon: 'error',
          text: errorMessage || message || 'กรุณาเข้าสู่ระบบอีกครั้ง',
          confirmButtonText: 'ตกลง'
        })
        break;
      case 'token_not_exist':
        Swal.fire({
          title: 'ไม่พบข้อมูลการเข้าสู่ระบบ',
          icon: 'error',
          text: errorMessage || message || 'กรุณาเข้าสู่ระบบอีกครั้ง',
          confirmButtonText: 'ตกลง'
        })
        break;
      case 'form-error':
        Swal.fire({
          title: 'กรุณากรอกข้อมูลให้ถูกต้อง',
          icon: 'error',
          text: errorMessage || message,
          confirmButtonText: 'ตกลง'
        })
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent("formError"))
          const element = document.querySelector(".is-invalid");
          if (element) {
            document.documentElement.scrollTop = element.offsetTop
          }
          document.dispatchEvent(new CustomEvent("form-error"))
          this.initMap()
        }, 100)
        break;
      case 'refresh-token':
        Swal.fire({
          title: 'ต่ออายุการใช้งานสำเร็จ',
          icon: 'success',
          text: message || 'กรุณาดำเนินการอีกครั้ง',
          confirmButtonText: 'ตกลง'
        })
        break;
      case 'refresh-token-silencer':
        document.dispatchEvent(new CustomEvent("refreshTokenSilencer"))
        console.log("refreshTokenSilencer")
        break;
      case 'request-number-not-found':
        Swal.fire({
          title: 'ไม่พบเลขที่คำร้อง',
          icon: 'error',
          text: errorMessage || message,
          confirmButtonText: 'ตกลง'
        })
        break
      case 'error':
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: errorMessage || message,
          confirmButtonText: 'ตกลง'
        })
        break;
    }
  }

  disconnect() {
    if (this.subscription) this.subscription.unsubscribe()
  }
  initMap() {
    const locationFields = document.querySelectorAll('.location-field')

    Array.from(locationFields).forEach(locationField => {
      const mapElement = locationField.querySelector(".map")

      const center = { lat: 13.736717, lng: 100.523186 }
      const map = new google.maps.Map(mapElement, {
        center: center,
        zoom: 8,
      });

      const marker = new google.maps.Marker({
        map,
        anchorPoint: new google.maps.Point(0, -29),
      });

      const defaultBounds = {
        north: center.lat + 0.1,
        south: center.lat - 0.1,
        east: center.lng + 0.1,
        west: center.lng - 0.1,
      };
      const options = {
        bounds: defaultBounds,
        componentRestrictions: { country: "th" },
        fields: ["address_components", "geometry", "icon", "name"],
        strictBounds: false,
        types: ["establishment"],
      };
      const pacInput = mapElement.previousElementSibling
      const autocomplete = new google.maps.places.Autocomplete(pacInput, options);

      map.addListener('click', (e) => {
        map.setCenter(e.latLng);
        marker.setPosition(e.latLng);
        map.setZoom(10);
      })

      const lat = locationField.querySelector('.lat')
      const lng = locationField.querySelector('.lng')
      const confirmButton = locationField.querySelector('.confirm')
      confirmButton.addEventListener('click', (e) => {
        const position = marker.getPosition()
        lat.value = position.lat()
        lng.value = position.lng()
      })

      autocomplete.bindTo("bounds", map);
      autocomplete.addListener("place_changed", () => {
        marker.setVisible(false);

        const place = autocomplete.getPlace();

        if (!place.geometry || !place.geometry.location) {
          // User entered the name of a Place that was not suggested and
          // pressed the Enter key, or the Place Details request failed.
          window.alert("No details available for input: '" + place.name + "'");
          return;
        }

        // If the place has a geometry, then present it on a map.
        if (place.geometry.viewport) {
          map.fitBounds(place.geometry.viewport);
        } else {
          map.setCenter(place.geometry.location);
          map.setZoom(10);
        }

        marker.setPosition(place.geometry.location);
        marker.setVisible(true);
      });
    })
  }
}
