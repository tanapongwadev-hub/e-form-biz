import { Controller } from "@hotwired/stimulus"
import * as bootstrap from "bootstrap"

export default class extends Controller {
  static targets = [
    'age',
    'titleOther',
  ]

  calculateAge(e) {
    setTimeout(() => {
      if (!$(e.target).val()) return
      var parts = $(e.target).val().split("/");
      var birthDate = new Date(parseInt(parts[2] - 543),
                        parseInt(parts[1]) - 1,
                        parseInt(parts[0]));
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      this.ageTarget.value = age
    }, 100);
  }

  changeTitle(e) {
    if (e.target.value == 'อื่นๆ') {
      this.titleOtherTarget.classList.remove('d-none')
    } else {
      this.titleOtherTarget.classList.add('d-none')
      this.titleOtherTarget.querySelector('input').value = ''
    }
  }
}
