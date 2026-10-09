import { Controller } from "@hotwired/stimulus"
import _ from "lodash";
$.fn.modal.Constructor.prototype.enforceFocus = function() {};
export default class extends Controller {
  static thaiAddressesPromise

  static targets = [
    'select'
  ]

  static values = {
    options: Array,
    endpointUrl: String,
    endpointTitleKey: String,
    endpointCustomTitleKey: String,
    endpointValueKey: String,
    provinceSelector: String,
    amphoeSelector: String,
    onchangeEndpointUrl: String,
    onchangeEndpointValueKey: String,
    onchangeEndpointTitleKey: String,
    onchangeToSelector: String,
    onchangeDelay: { type: Number, default: 300 },
    onchangeOtherParameterSelectorValue: String,
    onchangeOtherParameterSelectorKey: String,
    selected: String,
    lang: String,
    headers: String,
    multiple: Boolean,
    devmode: Boolean,
  }

  init = true
  headers = {}

  connect() {
    if (this.headersValue) {
      try {
        this.headers = JSON.parse(this.headersValue)
      } catch (e) {
        this.headers = {}
      }
    }
  }

  disconnect() {
    this.onchange?.cancel()
    if (this.hasSelectTarget && this.onchange) {
      $(this.selectTarget).off('change', this.onchange)
    }
  }

  selectTargetConnected() {
    this.initSelect2()
  }

  thaiAddresses() {
    this.constructor.thaiAddressesPromise ||= fetch('/data/thai-addresses.json')
      .then((response) => response.ok ? response.json() : Promise.reject(response.status))
    return this.constructor.thaiAddressesPromise
  }

  async initSelect2() {
    const vm = this
    if ($(this.element).parents('.modal').length) {
      $(this.selectTarget).select2({
        placeholder: '',
        dropdownParent: $(this.element),
        multiple: this.multipleValue,
        allowClear: true
      })
    } else {
      $(this.selectTarget).select2({
        placeholder: '',
        multiple: this.multipleValue,
        allowClear: true,
      })
    }

    if (vm.endpointUrlValue) {
      try {
        let items = []
        const endpointName = vm.endpointUrlValue.split('?', 1)[0].split('/').pop()
        if (['province.json', 'provinces.json'].includes(endpointName)) {
          const { provinces } = await vm.thaiAddresses()
          items = provinces.map((item) => {
            return {
              province: item.province_name_th,
            }
          })
        } else if (endpointName == 'amphoes.json') {
          items = []
        } else if (endpointName == 'tambons.json') {
          items = []
        } else if (vm.endpointUrlValue) {
          const response = await fetch(vm.endpointUrlValue, {headers: vm.headers});
          items = await response.json();
        }

        try {
          $(vm.selectTarget).empty()
          items.forEach((item) => {
            var newOption = new Option(item[vm.endpointTitleKeyValue], item[vm.endpointValueKeyValue]);
            $(vm.selectTarget).append(newOption)
          })
          $(vm.selectTarget).val(null).trigger('change')
        } catch(err){}
      } catch (err) {
      }
    }

    let i = 0
    if (vm.provinceSelectorValue) {
      i++
    }
    if (vm.amphoeSelectorValue) {
      i++
    }

    if (this.init && vm.onchangeEndpointUrlValue) {
      this.onchange = _.debounce(async (e) => {
        let items = []

        let value = undefined
        if (this.multipleValue) {
          value = $(this.selectTarget).val()?.join(',')
        } else {
          value = this.selectTarget.value
        }

        if (!value) return


        const localAddressField = ["province", "amphoe", "tambon"].includes(vm.endpointTitleKeyValue)
        const addresses = localAddressField ? await vm.thaiAddresses() : null

        if (vm.endpointTitleKeyValue == "amphoe" && $(vm.provinceSelectorValue).val() && value) {
          // console.log("load tambon", value)
          const endpointUrl = `${vm.onchangeEndpointUrlValue}?province=${$(vm.provinceSelectorValue).val()}&amphoe=${value}`
          // try {
          //   const response = await fetch(endpointUrl);
          //   items = await response.json();
          // } catch(error){}

          const province = addresses.provinces.find((item) => item.province_name_th == $(vm.provinceSelectorValue).val())
          if (!province) return

          if (this.multipleValue) {
            const districtCodes = addresses.districts.filter((item) => value.includes(item.district_name_th)).map((item) => item.district_code)
            items = addresses.subdistricts.filter((item) => item.province_code == province.province_code && districtCodes.includes(item.district_code))
          } else {
            const district = addresses.districts.find((item) => item.province_code == province.province_code && item.district_name_th == value)
            items = district ? addresses.subdistricts.filter((item) => item.province_code == province.province_code && item.district_code == district.district_code) : []
          }
          items = items.map((item) => {
            return {
              tambon: item.subdistrict_name_th,
            }
          })
        } else if (vm.endpointTitleKeyValue == "province" && value) {
          // console.log('load amphoe')

          if (this.multipleValue) {
            const provinceCodes = addresses.provinces.filter((item) => value.includes(item.province_name_th)).map((item) => item.province_code)
            items = addresses.districts.filter((item) => provinceCodes.includes(item.province_code))
          } else {
            const province = addresses.provinces.find((item) => item.province_name_th == value)
            items = province ? addresses.districts.filter((item) => item.province_code == province.province_code) : []
          }

          items = items.map((item) => {
            return {
              amphoe: item.district_name_th,
            }
          })
        } else if (vm.endpointTitleKeyValue == "tambon" && $(vm.provinceSelectorValue).val() && $(vm.amphoeSelectorValue).val() && value) {
          const province = addresses.provinces.find((item) => item.province_name_th == $(vm.provinceSelectorValue).val())
          const district = addresses.districts.find((item) => item.province_code == province?.province_code && item.district_name_th == $(vm.amphoeSelectorValue).val())
          const subdistrict = addresses.subdistricts.find((item) => item.province_code == province?.province_code && item.district_code == district?.district_code && item.subdistrict_name_th == value)
          items = subdistrict ? [{ postcode: subdistrict.postal_code }] : []
        } else if (value) {
          // console.log("load data", vm.onchangeEndpointUrlValue, vm.onchangeEndpointValueKey)
          if(vm.onchangeEndpointUrlValue.indexOf('?') != -1){
            var params_type = "&"
          } else {
            var params_type = "?"
          }

          let queryString = undefined

          const parameterSelectorValues = this.onchangeOtherParameterSelectorValueValue?.replaceAll(' ', '')?.split(",")?.filter((parameter) => !!parameter)
          const parameterSelectorKeys = this.onchangeOtherParameterSelectorKeyValue?.replaceAll(' ', '')?.split(",")?.filter((parameter) => !!parameter)
          const parameters = {}

          if (parameterSelectorValues.length > 0 && parameterSelectorKeys.length > 0) {
            parameterSelectorValues.forEach((selector, index) => {
              parameters[parameterSelectorKeys[index]] = $(selector).val()
            })

            if (Object.values(parameters).filter((parameter) => !!parameter).length == parameterSelectorValues.length) {
              queryString = new URLSearchParams(parameters).toString()
              const endpointUrl = `${vm.onchangeEndpointUrlValue}${params_type}${vm.endpointCustomTitleKeyValue || vm.endpointTitleKeyValue}=${value}&${queryString}`
              try {
                const response = await fetch(endpointUrl);
                items = await response.json();
              } catch(error){}
            }
          } else {
            const endpointUrl = `${vm.onchangeEndpointUrlValue}${params_type}${vm.endpointCustomTitleKeyValue || vm.endpointTitleKeyValue}=${value}`
            try {
              const response = await fetch(endpointUrl, {headers: vm.headers});
              items = await response.json();
            } catch(error){}
          }
        }

        const onchangeTarget = $(vm.onchangeToSelectorValue)
        if (onchangeTarget.is('input, textarea')) {
          onchangeTarget.val(items[0]?.[vm.onchangeEndpointValueKeyValue] || '').trigger('change')
        } else {
          onchangeTarget.empty()
          items.forEach((item) => {
            var newOption = new Option(item[vm.onchangeEndpointTitleKeyValue], item[vm.onchangeEndpointValueKeyValue], false, false);
            onchangeTarget.append(newOption)
          })
        }

      if (onchangeTarget.is('select') && vm.endpointTitleKeyValue == "tambon" && items.length == 1) {
        $(vm.onchangeToSelectorValue).val(items[0][vm.onchangeEndpointValueKeyValue]).trigger('change')
      } else if (onchangeTarget.is('select')) {
        const pendingValue = onchangeTarget
          .closest('[data-controller~="select-search-field"]')
          .attr('data-select-search-field-selected-value')

        if (pendingValue) {
          onchangeTarget
            .closest('[data-controller~="select-search-field"]')
            .removeAttr('data-select-search-field-selected-value')
          try {
            onchangeTarget.val(JSON.parse(pendingValue)).trigger('change')
          } catch {
            onchangeTarget.val(pendingValue).trigger('change')
          }
        } else {
          onchangeTarget.val(null).trigger('change')
        }
      }

        e.stopPropagation();
        e.preventDefault();
      }, vm.onchangeDelayValue)
      $(vm.selectTarget).on('change', this.onchange)

      this.init = false
    }

    if (i === 0) {
      setTimeout(() => {
        if (vm.selectedValue) {
          try {
            if (this.multipleValue) {
              $(vm.selectTarget).val(_.uniq(JSON.parse(vm.selectedValue))).trigger('change')
            } else {
              $(vm.selectTarget).val(vm.selectedValue).trigger('change')
            }
          } catch (e) {
          }
        }
      })
    }
  }
}
