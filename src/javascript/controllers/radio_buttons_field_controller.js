import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    options: Array
  }

  optionChanged(e) {
    this.optionsValue.forEach((option) => {
      this.hideSelector(option)
    })

    const optionSelected = this.optionsValue.find((o) => o.value == e.target.value)
    if (optionSelected) {
      this.element.querySelector('input[type="hidden"]').value = optionSelected.value
      this.showSelector(optionSelected)
    }
  }

  triggerChange() {
    this.optionsValue.forEach((option) => {
      this.hideSelector(option)
    })
    const checkedValue = this.element.querySelector('input[type="hidden"]')?.value || this.element.querySelector('.form-check-input[checked]')?.value
    const optionSelected = this.optionsValue.find((o) => o.value == checkedValue)
    this.showSelector(optionSelected)
  }

  sumbitEform() {
    setTimeout(() => {
      this.triggerChange()
    }, 1000)
  }

  showSelector(optionSelected) {
    if (!optionSelected) return
    if (!optionSelected.show_selector) return

    const showSelectors = optionSelected.show_selector.replaceAll(" ", "").split(",")
    showSelectors.forEach((showSelector) => {

      const targetElement = $(showSelector.trim())

      if (targetElement) {
        targetElement.removeClass('d-none')

        if (targetElement.is(':input')) {
          targetElement.removeAttribute("disabled", "disabled")
          if (targetElement.hasClass('required')) {
            targetElement.setAttribute("required", "required")
          }
        } else {
          targetElement.find(':input:not(.force-disabled)').each((index, targetInnerElement) => {
            $(targetInnerElement).removeAttr("disabled", "disabled")
            if ($(targetInnerElement).hasClass('required')) {
              $(targetInnerElement).attr("required", 'required')
            }
          })
        }
      }
    })
  }

  hideSelector(optionSelected) {
    if (!optionSelected) return
    if (!optionSelected.show_selector) return

    const hideSelectors = optionSelected.show_selector.replaceAll(" ", "").split(",")

    hideSelectors.forEach((hideSelector) => {

      const targetElement = $(hideSelector.trim())

      if (targetElement && !targetElement.hasClass('d-none')) {
        targetElement.addClass('d-none')

        if (targetElement.is(':input')) {
          targetElement.attr("disabled", "true")
          if (targetElement.hasClass('required')) {
            targetElement.removeAttr("required")
          }
        } else {
          targetElement.find(':input').each((index, targetInnerElement) => {
            $(targetInnerElement).attr("disabled", "true")

            if ($(targetInnerElement).hasClass('required')) {
              $(targetInnerElement).removeAttr("required")
            }
          })
        }
      }
    })
  }
}
