import { Controller } from "@hotwired/stimulus"
import _ from 'lodash'
import swal from 'sweetalert2'

export default class extends Controller {
  static targets = [
    'emptyStage',
    'items',
    'header',
    'closeButton',
    'addButton',
  ]

  static values = {
    name: String,
    min: String,
    max: String,
  }

  editElement = null

  connect() {
    this.modalElement = document.getElementById(`${this.nameValue}Modal`)

    this.inputElements = this.modalElement.querySelectorAll('input:not([type="hidden"]),select,textarea')

    this.modalElement.addEventListener('show.bs.modal', event => {
      Array.from(this.inputElements).forEach(inputElement => {
        if (!$(inputElement).parents('.container').hasClass('d-none')) {
          inputElement.removeAttribute('disabled')
        }
      })
      this.modalElement.querySelector('input[data-datepicker-target="hidden"]')?.removeAttribute('disabled')
    })

    this.modalElement.addEventListener('shown.bs.modal', () => {
      document.dispatchEvent(new CustomEvent('modal:open'))
    })

    this.modalElement.addEventListener('hide.bs.modal', event => {
      document.dispatchEvent(new CustomEvent('modal:close'))
      this.clearForm()
    })

    this.clearForm()
    this.checkEmptyStage()
  }

  addItem() {
    if (!this.editElement && this.maxItems && this.itemCount >= this.maxItems) {
      swal.fire({
        title: 'ไม่สามารถเพิ่มรายการได้',
        text: `เพิ่มได้สูงสุด ${this.maxItems} รายการ`,
        icon: 'warning',
        confirmButtonText: 'ตกลง'
      })
      return
    }

    let obj = {}
    let isInvalid = false

    const newItemElement = document.createElement("tr");
    newItemElement.classList.add('item')

    Array.from(this.inputElements).forEach(inputElement => {
      if (!inputElement.disabled && !$(inputElement).parents('.container').hasClass('d-none')) {
        inputElement.classList.remove("is-invalid")
        $(inputElement).parents(".form-group").find('.invalid-feedback').remove()

        var label = $(inputElement).parents(".form-group").find('label').text().replace("*", "").trim()
        if ($(inputElement).attr("type") == "radio" && $(inputElement).parents(".form-group").hasClass("required") && $(inputElement).parents('fieldset').find('input[type="radio"]:checked').length == 0) {
          // Check required radio buttons
          $(inputElement).parents('fieldset').find('input[type="radio"]').addClass("is-invalid")
          $(inputElement).parents(".form-group").append(`<div class='invalid-feedback'>กรุณากรอก ${label}</div>`)
          isInvalid = true
        } else if ($(inputElement).parents(".form-group").hasClass("required") && inputElement.value.length == 0) {
          // Check required fields
          inputElement.classList.add("is-invalid")
          $(inputElement).parents(".form-group").append(`<div class='invalid-feedback'>กรุณากรอก ${label}</div>`)
          isInvalid = true
        } else if ($(inputElement).hasClass("email") && inputElement.value.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputElement.value)) {
          // Check email type
          inputElement.classList.add("is-invalid")
          $(inputElement).parents(".form-group").append(`<div class='invalid-feedback'>รูปแบบอีเมลไม่ถูกต้อง</div>`)
          isInvalid = true
        } else if ($(inputElement).attr("minlength")) {
          // check minlength
          const minlength = +$(inputElement).attr("minlength")
          if (inputElement.value.length > 0 && inputElement.value.length < minlength) {
            inputElement.classList.add("is-invalid")
            $(inputElement).parents(".form-group").append(`<div class='invalid-feedback'>กรุณากรอก ${label} อย่างน้อย ${minlength} ตัวอักษร</div>`)
            isInvalid = true
          }
        } else if ($(inputElement).attr("maxlength")) {
          // check maxlength
          const maxlength = +$(inputElement).attr("maxlength")
          if (inputElement.value.length > maxlength) {
            inputElement.classList.add("is-invalid")
            $(inputElement).parents(".form-group").append(`<div class='invalid-feedback'>กรุณากรอก ${label} ไม่เกิน ${maxlength} ตัวอักษร</div>`)
            isInvalid = true
          }
        } else if ($(inputElement).attr("pattern")) {
          const pattern = $(inputElement).attr("pattern")
          if (!new RegExp(pattern).test(inputElement.value)) {
            inputElement.classList.add("is-invalid")
            $(inputElement).parents(".form-group").append(`<div class='invalid-feedback'>กรุณากรอก ${label} ตามรูปแบบ ${pattern}</div>`)
            isInvalid = true
          }
        }
      }
    })

    if (!isInvalid) {

      let locations = []
      let googleMapUrl = null
      const inputElements = this.modalElement.querySelectorAll('input[type="text"],input[type="number"],input[type="email"],select,textarea,input[type="radio"]:checked,input[type="checkbox"],input.url')

      const nameElements = Array.from(inputElements).map(inputElement => inputElement.name)
      Array.from(inputElements).forEach((inputElement, index) => {
        if (_.filter(nameElements, (name) => name === inputElement.name).length > 1) {
          const firstIndex = +_.indexOf(nameElements, inputElement.name)
          const lastIndex = +_.lastIndexOf(nameElements, inputElement.name)

          if ($(Array.from(inputElements)[lastIndex]).val().length > 0) {
            if (lastIndex !== index) return
          } else if ($(Array.from(inputElements)[firstIndex]).val().length > 0) {
            if (firstIndex !== index) return
          }
        }

        if (inputElement.name.includes('[lat]')) {
          locations.push($(inputElement).val())
          obj[inputElement.name] = $(inputElement).val()
          return
        } else if (inputElement.name.includes('[lng]')) {
          locations.push($(inputElement).val())
          obj[inputElement.name] = $(inputElement).val()
          return
        } else if (inputElement.name.includes('[url]')) {
          googleMapUrl = $(inputElement).val()
        }

        if ($(inputElement).is('input[type="checkbox"]')) {
          if ($(inputElement).is(':checked')) {
            obj[inputElement.name] = $(inputElement).val()
          } else {
            obj[inputElement.name] = ""
          }

        } else {
          obj[inputElement.name] = $(inputElement).val()
        }

        const dateFormatRegex = new RegExp('\\d{2}\/\\d{2}\/\\\d{4}', 'g');
        const contentElement = document.createElement("td");
        if (inputElement.name.includes('[url]')) { // Location Field
          contentElement.innerHTML = locations.join(', ')
        } else if ($(inputElement).is('select')) {
          if (Array.isArray($(inputElement).val())) {
            contentElement.innerHTML = $(inputElement).val().join(', ')
          } else {
            contentElement.innerHTML = $(inputElement).find('option:selected').text()
          }
        } else if ($(inputElement).is('input[type="radio"]')) {
          const id = $(inputElement).attr('id')
          contentElement.innerHTML = $(`label[for="${id}"]`).text()
        } else if ($(inputElement).is('input[type="checkbox"]')) {
          if ($(inputElement).is(':checked')) {
            const id = $(inputElement).attr('id')
            contentElement.innerHTML = $(`label[for="${id}"]`).text()
          } else {
            contentElement.innerHTML = "-"
          }
        } else {
          contentElement.innerHTML = $(inputElement).val()
        }

        if (inputElement.name.includes('[url]')) { // Location Field
          contentElement.append(this.createInputTag(inputElement.name.replace("[url]", "[lat]"), locations[0]))
          contentElement.append(this.createInputTag(inputElement.name.replace("[url]", "[lng]"), locations[1]))
          contentElement.append(this.createInputTag(inputElement.name, googleMapUrl))

          locations = []
          googleMapUrl = null
        } else if (Array.isArray($(inputElement).val())) {
          $(inputElement).val().forEach((val) => {
            contentElement.append(this.createInputTag(inputElement.name.replace("[]", ""), val, true))
          })
        } else if ($(inputElement).is('input[type="checkbox"]')) {
          if ($(inputElement).is(':checked')) {
            contentElement.append(this.createInputTag(inputElement.name, $(inputElement).val()))
          } else {
            contentElement.append(this.createInputTag(inputElement.name, ""))
          }
        } else if (dateFormatRegex.test($(inputElement).val())) {
          const dateSplitted = $(inputElement).val().split("/")
          const date = `${+dateSplitted[2] - 543}-${dateSplitted[1]}-${dateSplitted[0]}`
          contentElement.append(this.createInputTag(inputElement.name, date))
        } else {
          contentElement.append(this.createInputTag(inputElement.name, $(inputElement).val()))
        }

        newItemElement.append(contentElement)
      })

      const editButtonElement = document.createElement("td");
      editButtonElement.innerHTML = `<button type="button" class="btn btn-primary text-white" data-list-field-dataset-param='${JSON.stringify(obj)}' data-bs-toggle="modal" data-bs-target="#${this.nameValue}Modal" data-action="click->list-field#editItem">แก้ไขข้อมูล</button>`
      newItemElement.append(editButtonElement)

      const hiddenElements = this.modalElement.querySelectorAll('input.hidden[type="hidden"]:not(.lat):not(.lng):not(.url)')
      Array.from(hiddenElements).forEach(hiddenElement => {
        obj[hiddenElement.name] = $(hiddenElement).val()

        newItemElement.append(this.createInputTag(hiddenElement.name, $(hiddenElement).val()))
      })

      const deleteButtonElement = document.createElement("td");
      deleteButtonElement.innerHTML = "<button type='button' class='btn btn-danger remove-item' data-action='click->list-field#removeItem'>ลบรายการ</button>"
      newItemElement.append(deleteButtonElement)

      if (this.editElement) {
        this.editElement.replaceWith(newItemElement)
      } else {
        this.itemsTarget.append(newItemElement)
      }

      $(this.closeButtonTarget).trigger('click')
      this.checkEmptyStage()
      this.clearForm()
    }
  }

  removeItem(e) {
    swal.fire({
      title: 'ยืนยันการลบรายการ',
      text: 'ต้องการลบรายการนี้หรือไม่?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก'
    }).then((result) => {
      if (result.isConfirmed) {
        setTimeout(() => {
          e.target.closest('.item').remove()

          this.checkEmptyStage()
        }, 100)
      }
    })
  }

  editItem({ target, params: { dataset, formType } }) {
    this.editElement = target.closest('.item')

    let loadingCount = 0
    const selectInputs = []
    Object.keys(dataset).forEach((key, index) => {
      if (dataset[key] && dataset[key]['lng'] && dataset[key]['lat']) {
        $(this.element).find(`input.lat`).val(dataset[key]['lat'])
        $(this.element).find(`input.lng`).val(dataset[key]['lng'])
        $(this.element).find(`input.url`).val(dataset[key]['url'])

      } else if ($(this.element).find(`:input:not([type="search"]):not([type="hidden"])[name="${key}"]`).hasClass('select2-hidden-accessible') && $(this.element).find(`:input:not([type="search"]):not([type="hidden"])[name="${key}"]`).attr('multiple')) {
        setTimeout(() => {
          if (Array.isArray(dataset[key])) {
            $(this.element).find(`:input:not([type="search"]):not([type="hidden"])[name="${key}"]`).val(dataset[key])
            $(this.element).find(`:input:not([type="search"]):not([type="hidden"])[name="${key}"]`).trigger('change')
          } else {
            $(this.element).find(`:input:not([type="search"]):not([type="hidden"])[name="${key}"]`).val(dataset[key].split(","))
            $(this.element).find(`:input:not([type="search"]):not([type="hidden"])[name="${key}"]`).trigger('change')
          }
        }, 1000 * loadingCount)
        loadingCount++
      } else if ($(this.element).find(`input.radio_buttons[name="${key}"]`).length) {
        if ($(this.element).find(`input.radio_buttons[value="${dataset[key]}"]`).length) {
          $(this.element).find(`input.radio_buttons[value="${dataset[key]}"]`).trigger('click')
        }
      } else if ($(this.element).find(`:input:not([type="search"]):not([type="hidden"])[name="${key}"]`).hasClass('select2-hidden-accessible')) {
        const selectInput = $(this.element).find(`:input:not([type="search"]):not([type="hidden"])[name="${key}"]`)

        const addressKey = _.some(['province', 'amphur', 'tambon', 'district', 'sub_district'], (addressKey) => key.toLocaleLowerCase().includes(addressKey))
        if (addressKey) {
          selectInputs.push({
            key: key.toLocaleLowerCase(),
            input: selectInput,
            value: dataset[key]
          })
        } else {
          setTimeout(() => {
            selectInput.val(dataset[key])
            selectInput.trigger('change')
          }, 1000 * loadingCount)
          loadingCount++
        }
      } else if ($(this.element).find(`input[type="checkbox"][name="${key}"]`).hasClass('boolean')) {
        $(this.element).find(`input[type="checkbox"][name="${key}"]`).prop("checked", dataset[key]);
      } else {
        $(this.element).find(`:input:not([type="search"]):not([type="hidden"])[name="${key}"]`).val(dataset[key])
      }
    });

    if (formType && formType === 'new') {
      this.clearRadio()
    } else {
      this.element.querySelector('button.confirm.add').classList.add('d-none')
      this.element.querySelector('button.confirm.edit').classList.remove('d-none')
    }

    if (selectInputs.length > 0) {
      // Fill and Trigger change order by province, amphur, tambon
      ['province', 'amphur', 'tambon'].forEach(key => {
        const selectInput = selectInputs.find(selectInput => selectInput.key.includes(key))
        if (selectInput) {
          setTimeout(() => {
            selectInput.input.val(selectInput.value)
            selectInput.input.trigger('change')
          }, 1000 * loadingCount)
          loadingCount++
        }
      })
    }
  }

  checkEmptyStage() {
    if (this.element.querySelector('.item')) {
      this.emptyStageTarget.classList.add('d-none')
      this.headerTarget.classList.remove('d-none')
    } else {
      this.emptyStageTarget.classList.remove('d-none')
      this.headerTarget.classList.add('d-none')
    }

    this.updateAddButton()
  }

  clearForm() {
    const inputElements = this.modalElement.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]),select,textarea,input.lat,input.lng,input.url')

    Array.from(inputElements).forEach(inputElement => {
      inputElement.classList.remove("is-invalid")
      inputElement.value = null
      inputElement.setAttribute('disabled', true)

      $(inputElement).trigger('change')
    })

    const radioElements = this.modalElement.querySelectorAll('input[type="radio"]')
    Array.from(radioElements).forEach(radioElement => {
      $(`#${radioElement.id}`).prop("checked", false)
    })

    Array.from(this.modalElement.querySelectorAll('input.radio_buttons-first[type="radio"]')).forEach(radioElement => {
      $(radioElement).trigger('click')
    })

    this.modalElement.querySelector('input[data-datepicker-target="hidden"]')?.setAttribute('disabled', true)

    this.editElement = null
    this.element.querySelector('button.confirm.add').classList.remove('d-none')
    this.element.querySelector('button.confirm.edit').classList.add('d-none')
  }

  clearRadio() {
    const radioElements = this.modalElement.querySelectorAll('input[type="radio"]')
    Array.from(radioElements).forEach(radioElement => {
      $(`#${radioElement.id}`).prop("checked", false)

      const targetSelectors = $(`#${radioElement.id}`).data('show-selector')
      console.log(targetSelectors)
      const hideSelectors = targetSelectors.split(",")
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
    })
  }

  createInputTag(attribute, value, isArray = false) {
    const input = document.createElement("input");
    input.setAttribute("type", "hidden");
    if (isArray) {
      input.setAttribute("name", `${this.nameValue}[][${attribute}][]`);
    } else {
      input.setAttribute("name", `${this.nameValue}[][${attribute}]`);
    }

    if (/\d{2}\/\d{2}\/\d{4}/g.exec(value)) {
      const dateSplitted = value.split("/")
      input.setAttribute("value", `${dateSplitted[2]}/${dateSplitted[1]}/${dateSplitted[0]}`);
    } else {
      input.setAttribute("value", value);
    }

    return input
  }

  updateAddButton() {
    if (!this.hasAddButtonTarget || !this.maxItems) return

    const maxReached = this.itemCount >= this.maxItems
    this.addButtonTarget.disabled = maxReached
    this.addButtonTarget.classList.toggle('disabled', maxReached)
  }

  get itemCount() {
    return this.itemsTarget.querySelectorAll('.item').length
  }

  get maxItems() {
    return this.maxValue ? Number(this.maxValue) : null
  }
}


// document.addEventListener('cable-ready:after-morph', () => {
//   let data = {ApplicationAttachments: []}
//   try {
//     if ($("#js_data").text()) {
//       data = JSON.parse($("#js_data").text())
//     }
//   } catch(error) {
//     console.log(error)
//   }
//   console.log(data)

//   const carDocs = data.ApplicationAttachments.filter((attachment) => attachment.FileTypeCode.startsWith('CarDocs'))
//   carDocs.forEach((doc, index) => {
//     let template = $("template#file-field-template")[0].innerHTML

//     template = template.replaceAll("[CUSTOM_CLASS]", `car_docs ${doc.FileTypeCode}`)

//     template = template.replaceAll("[NAME]", doc.FileTypeCode)
//     template = template.replaceAll("[LABEL]", doc.DocName)
//     template = template.replaceAll("[REMARK]", doc.DocName)
//     template = template.replaceAll("[FILE_NAME]", doc.Name)
//     template = template.replaceAll("[FIELD_ID]", doc.FileId)
//     template = template.replaceAll("[FILE_SIZE]", doc.FileSize)
//     template = template.replaceAll("[UPLOADED_AT]", doc.UploadedAt)
//     template = template.replaceAll("[CONTENT_TYPE]", doc.ContentType)

//     template = template.replaceAll("[DocName_Value]", doc.DocName)
//     template = template.replaceAll("[ContentType_Value]", doc.ContentType)
//     template = template.replaceAll("[FileSize_Value]", doc.FileSize)
//     template = template.replaceAll("[Name_Value]", doc.Name)
//     template = template.replaceAll("[FileId_Value]", doc.FileId)
//     template = template.replaceAll("[Id_Value]", doc.Id)
//     template = template.replaceAll("[FileUrl_Value]", doc.FileUrl)
//     template = template.replaceAll("[UploadedAt_Value]", doc.UploadedAt)
//     template = template.replaceAll("[FileTypeCode_Value]", doc.FileTypeCode)
//     template = template.replaceAll("[Remark_Value]", doc.Remark)

//     $("#OtherImageZone").append(template)

//     if (doc.ContentType == "image/jpg" || doc.ContentType == "image/jpeg") {
//       $("#OtherImageZone .file-field:last .jpg").removeClass('d-none')
//     } else if (doc.ContentType == "application/pdf") {
//       $("#OtherImageZone .file-field:last .pdf").removeClass('d-none')
//     } else if (doc.ContentType == "image/png") {
//       $("#OtherImageZone .file-field:last .png").removeClass('d-none')
//     } else if (doc.ContentType == "application/zip") {
//       $("#OtherImageZone .file-field:last .zip").removeClass('d-none')
//     } else if (doc.ContentType == "application/msword") {
//       $("#OtherImageZone .file-field:last .doc").removeClass('d-none')
//     } else if (doc.ContentType == "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
//       $("#OtherImageZone .file-field:last .docx").removeClass('d-none')
//     }

//     $("#OtherImageZone .items:last").addClass("d-none")
//     $("#OtherImageZone .preview:last").removeClass("d-none")
//   })
// })

// $("div[data-controller='list-field'] button.confirm.add").on('click', () => {
//   setTimeout(() => {
//     const text = $('.list-data tbody tr:last input[name="NonScheduledBus[][LicensePlateNumber]"]').val()

//     count = $('.car_docs').length
//     let template = null

//     template = $("template#file-field-template")[0].innerHTML
//     template = template.replaceAll("[CUSTOM_CLASS]", `car_docs OtherDocs2_${count}`)
//     template = template.replaceAll("[NAME]", `OtherDocs2_${count}`)
//     template = template.replaceAll("[LABEL]", `รูปด้านหน้า ${text}`)
//     template = template.replaceAll("[REMARK]", `รูปด้านหน้า ${text}`)
//     $("#OtherImageZone").append(template)


//     template = $("template#file-field-template")[0].innerHTML
//     template = template.replaceAll("[CUSTOM_CLASS]", `car_docs OtherDocs2_${count + 1}`)
//     template = template.replaceAll("[NAME]", `OtherDocs2_${count + 1}`)
//     template = template.replaceAll("[LABEL]", `รูปด้านหลัง ${text}`)
//     template = template.replaceAll("[REMARK]", `รูปด้านหลัง ${text}`)
//     $("#OtherImageZone").append(template)
//   }, 100)
// })

// $(document).on("click", (event) => {
//   if ($(event.target).hasClass("remove-item")) {
//     const index = $("button.remove-item").index($(event.target))

//     $(`.OtherDocs2_${index}`).remove()
//     $(`.OtherDocs2_${index + 1}`).remove()
//   }
// });
