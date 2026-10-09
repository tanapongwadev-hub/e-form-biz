import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    'select'
  ]

  static values = {
    options: Array,
    optionEndpoint: String,
    url: String,
    selected: String
  }

  optionChanged(e) {
    this.optionsValue.forEach((option) => {
      this.hideSelector(option)
    })

    const optionSelected = this.optionsValue.find((o) => o.value == e.target.value)

    this.showSelector(optionSelected)
  }

  triggerChange() {
    this.optionsValue.forEach((option) => {
      this.hideSelector(option)
    })

    const checkedValue = $(this.selectTarget).val()
    const optionSelected = this.optionsValue.find((o) => o.value == checkedValue)
    this.showSelector(optionSelected)
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
          targetElement.find(':input').each((index, targetInnerElement) => {
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
        targetElement.val(null)

        if (targetElement.is(':input')) {
          targetElement.attr("disabled", "true")
          if (targetElement.hasClass('required')) {
            targetElement.removeAttr("required")
          }
        } else {
          targetElement.find(':input').each((index, targetInnerElement) => {
            $(targetInnerElement).attr("disabled", "true")
            $(targetInnerElement).val(null)

            if ($(targetInnerElement).hasClass('required')) {
              $(targetInnerElement).removeAttr("required")
            }
          })
        }
      }
    })
  }
}
