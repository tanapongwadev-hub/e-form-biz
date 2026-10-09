import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    // Grab a reference to the toolbar(s) on the page.
    const toolbar = this.element.previousSibling
    // HTML for our buttons
    const h1ButtonHTML = '<button type="button" class="trix-button" data-trix-attribute="heading1" title="H1">H1</button>'
    const h2ButtonHTML = '<button type="button" class="trix-button" data-trix-attribute="heading2" title="H2">H2</button>'
    const h3ButtonHTML = '<button type="button" class="trix-button" data-trix-attribute="heading3" title="H3">H3</button>'

    // Only apply event listeners once to the toolbars
    const once = {
        once: true
    }

    addEventListener("trix-initialize", function(event) {
      const sibling1 = toolbar.querySelector(".trix-button--icon-heading-1")
      sibling1.insertAdjacentHTML("beforeBegin", h1ButtonHTML)
      sibling1.insertAdjacentHTML("beforeBegin", h2ButtonHTML)
      sibling1.insertAdjacentHTML("beforeBegin", h3ButtonHTML)
    }, once)
  }
}
