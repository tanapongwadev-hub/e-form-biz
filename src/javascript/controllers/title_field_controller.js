import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    'titleOther',
  ]

  changeTitle(e) {
    if (e.target.value == 'อื่นๆ') {
      this.titleOtherTarget.classList.remove('d-none')
      this.titleOtherTarget.querySelector('input').disabled = false
    } else {
      this.titleOtherTarget.classList.add('d-none')
      this.titleOtherTarget.querySelector('input').disabled = true
      this.titleOtherTarget.querySelector('input').value = ''
    }
  }
}
