import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    checked: Boolean,
    defaultValue: String,
    selector: String
  }

  connect() {
    this.targetElements = []
    this.checkboxInput = this.element.querySelector('input[type="checkbox"]')
    if (!this.checkboxInput) return

    if (!this.checkboxInput.value) {
      this.checkboxInput.value = this.defaultValueValue
    }

    this.triggerChangeHandler = () => this.triggerChange()
    this.checkboxInput.addEventListener('triggerChange', this.triggerChangeHandler)
    document.addEventListener('bizportal:profile-loaded', this.triggerChangeHandler)
    this.triggerChange()
  }

  disconnect() {
    this.checkboxInput?.removeEventListener('triggerChange', this.triggerChangeHandler)
    document.removeEventListener('bizportal:profile-loaded', this.triggerChangeHandler)
  }

  optionChanged() {
    this.triggerChange()
  }

  triggerChange() {
    if (!this.selectorValue) return

    const checkedValue = this.element.querySelector('input[type="checkbox"]').checked
    if (checkedValue) {
      this.showSelector()
    } else {
      const showSelectors = this.selectorValue.replaceAll(" ", "").split(",")
      showSelectors.forEach((showSelector) => {
        if (showSelector.trim().length > 0) {
          let targetElement = document.querySelector(showSelector.trim())
          if (!targetElement) return

          targetElement.classList.add('d-none')
          targetElement.setAttribute("disabled", true)
          targetElement.querySelectorAll('input,select').forEach((targetInnerElement) => {
            targetInnerElement.setAttribute("disabled", true)
          })
        }
      })
    }
  }

  sumbitEform() {
    setTimeout(() => {
      this.triggerChange()
    }, 1000)
  }

  showSelector() {
    const showSelectors = this.selectorValue.replaceAll(" ", "").split(",")
    showSelectors.forEach((showSelector) => {
      if (showSelector.length > 0) {
        let targetElement = document.querySelector(showSelector.trim())
        if (targetElement) {
          targetElement.classList.remove('d-none')

          if (targetElement?.dataset?.controller == 'list-field') {
            targetElement.removeAttribute("disabled")
            targetElement.querySelectorAll('table input,select,textarea').forEach((targetInnerElement) => {
              targetInnerElement.removeAttribute("disabled")
            })
          } else {
            targetElement.removeAttribute("disabled")
            targetElement.querySelectorAll('input,select,textarea').forEach((targetInnerElement) => {
              targetInnerElement.removeAttribute("disabled")
            })
          }


          this.targetElements.push(targetElement)
        }
      }
    })
  }
}
