import { Controller } from "@hotwired/stimulus"
import _ from "lodash";
$.fn.modal.Constructor.prototype.enforceFocus = function() {};
export default class extends Controller {
  static targets = [
    'select'
  ]

  static values = {
    selected: Array,
  }

  init = true

  connect() {
    this.emitFireKey = $(this.onchangeToSelectorValue).attr('id')
    this.emitListenerKey = this.selectTarget.id
  }

  selectTargetConnected() {
    this.initSelect2()
  }

  async initSelect2() {
    $(this.selectTarget).select2({
      data: this.selectedValue,
      dropdownParent: $('#tags'),
      tags: true,
      multiple: true
    })

    $(this.selectTarget).val(this.selectedValue).trigger("change");
  }
}
