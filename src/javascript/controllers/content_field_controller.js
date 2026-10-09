import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.element.querySelectorAll('a').forEach(function(link) {
      if (link.host !== window.location.host) {
        link.target = "_blank"
      }
    })
  }
}
