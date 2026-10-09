import { Controller } from "@hotwired/stimulus"

import Dropzone from "dropzone";
import moment from "moment";
import * as bootstrap from 'bootstrap'
import { currentFormCode } from '../../stores/biz_portal'

export default class extends Controller {
  static targets = [
    'input',
    'preview',
    'filename',
    'uploadedAt',
    'fileSize',
    'progress',
    'progressContainer',
    'formGroup',
    'zip',
    'png',
    'jpg',
    'pdf',
    'docx',
    'doc',
    'fileTemplate',
    'files',
    'thumbnail',
  ]

  static values = {
    name: String,
    label: String,
    endpoint: String,
    acceptFiles: String,
  }

  connect() {
    this.q = new URLSearchParams(window.location.search).get('q')
    this.formCode = currentFormCode()
    this.fileTemplate = this.fileTemplateTarget.innerHTML
    this.idCount = this.filesTarget.querySelectorAll('.file').length

    if (this.idCount > 0) {
      for (let i = 0; i < this.idCount; i++) {
        const dropzoneInput = this.filesTarget.querySelectorAll('.file')[i]
        this.initDropzone(dropzoneInput, `file-${i}`, i)
      }
    }
  }

  initDropzone(dropzoneInput, dropzoneId, index) {
    this.dropzone = new Dropzone(`#${dropzoneId}`, {
      url: `${this.endpointValue}/bizportal/api/file/upload?${new URLSearchParams({
        formCode: this.formCode,
        q: this.q
      })}`,
      maxFiles: 1,
      acceptedFiles: this.acceptFilesValue,
      maxFilesize: 50,
      disablePreviews: true,
      autoProcessQueue: !this.cropEnabledValue,
    })

    this.dropzone.on('addedfile', (file) => {
      this.fileUploadData = file
    })

    this.dropzone.on("sending", (file, xhr, formData) => {
      const remark = dropzoneInput.querySelector('.remark').value
      dropzoneInput.querySelector('.remark').setAttribute('value', remark)
      const data = {
        DocName: `${this.labelValue} ${remark}`,
        FileTypeCode: this.nameValue,
        Name: this.fileUploadData.name,
        FileReferenceId: this.fileUploadData.upload.uuid,
        FileUrl: "",
        Remark: remark
      }

      formData.append("fileMetadata", JSON.stringify(data))
    });

    this.dropzone.on('uploadprogress', (file) => {
      this.progressTargets[index].innerHTML = `${file.upload.progress}%`
      this.progressContainerTargets[index].classList.remove("d-none")
    })

    this.dropzone.on('success', (file, response) => {
      dropzoneInput.querySelector('.remark').setAttribute('readonly', 'true')

      this.file = response

      this.inputTargets[index].classList.add("d-none")
      this.previewTargets[index].classList.remove("d-none")

      this.filenameTargets[index].innerHTML = file.upload.filename
      this.filenameTargets[index].href = this.fileUrl(this.file.fileId, this.fileUploadData.type)
      this.fileSizeTargets[index].innerHTML = this.humanFileSize(file.size)
      this.uploadedAtTargets[index].innerHTML = this.toBuddhistYear(moment(), 'DD/MM/YYYY hh:mm:ss')
      this.thumbnailTargets[index].src = this.fileUrl(this.file.fileId, this.fileUploadData.type)

      this.croppingImageProcess = false

      const remark = dropzoneInput.querySelector('.remark').value

      this.formGroupTargets[index].append(this.createInputTag('FileTypeCode', `${this.nameValue}_${index}`))
      this.formGroupTargets[index].append(this.createInputTag('DocName', `${this.labelValue} ${remark}`))
      this.formGroupTargets[index].append(this.createInputTag('ContentType', this.fileUploadData.type))
      this.formGroupTargets[index].append(this.createInputTag('FileSize', this.fileUploadData.size))
      this.formGroupTargets[index].append(this.createInputTag('Name', this.fileUploadData.name))
      this.formGroupTargets[index].append(this.createInputTag('FileId', this.file.fileId))
      this.formGroupTargets[index].append(this.createInputTag('Id', this.nameValue))
      this.formGroupTargets[index].append(this.createInputTag('FileUrl', ""))
      this.formGroupTargets[index].append(this.createInputTag('UploadedAt', this.toBuddhistYear(moment(), 'DD/MM/YYYY hh:mm:ss')))
      this.formGroupTargets[index].append(this.createInputTag('Remark', remark))


      if (this.fileUploadData.type == "image/jpg" || this.fileUploadData.type == "image/jpeg") {
        this.jpgTargets[index].classList.remove('d-none')
      } else if (this.fileUploadData.type == "image/png") {
        this.pngTargets[index].classList.remove('d-none')
      } else if (this.fileUploadData.type == "application/pdf") {
        this.pdfTargets[index].classList.remove('d-none')
      } else if (this.fileUploadData.type == "application/zip") {
        this.zipTargets[index].classList.remove('d-none')
      } else if (this.fileUploadData.type == "application/msword") {
        this.docTargets[index].classList.remove('d-none')
      } else if (this.fileUploadData.type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        this.docxTargets[index].classList.remove('d-none')
      } else {
        console.log(this.fileUploadData.type)
      }

      dropzoneInput.setAttribute('disabled', true)

      setTimeout(() => {
        const silencerElement = document.getElementById('silencer')
        const draftSubmitButton = document.getElementById('draftSubmit')
        if (silencerElement && draftSubmitButton) {
          silencerElement.value = 1
          draftSubmitButton.click()
          silencerElement.value = null
        }
        document.dispatchEvent(new CustomEvent("dropzone-success"))
        document.dispatchEvent(new CustomEvent("uploadFileSuccess"))
      }, 100)
    })
  }

  removeFile({params: { index }}) {
    const dropzoneInput = this.filesTarget.querySelectorAll('.file')[index]

    const fileId = this.formGroupTargets[index].querySelector('input[name="ApplicationAttachments[][FileId]"]').value
    const contentType = this.formGroupTargets[index].querySelector('input[name="ApplicationAttachments[][ContentType]"]').value
    fetch(this.fileUrl(fileId, contentType), {
      method: 'DELETE',
    }).then(() => {
      this.formGroupTargets[index].innerHTML = ""
      this.formGroupTargets[index].append(this.createInputTag('FileTypeCode', this.nameValue))
      this.inputTargets[index].classList.remove("d-none")
      this.previewTargets[index].classList.add("d-none")
      this.progressContainerTargets[index].classList.add("d-none")
      this.jpgTargets[index].classList.add('d-none')
      this.pngTargets[index].classList.add('d-none')
      this.pdfTargets[index].classList.add('d-none')
      this.zipTargets[index].classList.add('d-none')

      dropzoneInput.removeAttribute('disabled')
      dropzoneInput.querySelector('.remark').removeAttribute('readonly')

      const silencerElement = document.getElementById('silencer')
      const draftSubmitButton = document.getElementById('draftSubmit')
      if (silencerElement && draftSubmitButton) {
        silencerElement.value = 1
        draftSubmitButton.click()
        silencerElement.value = null
      }
      document.dispatchEvent(new CustomEvent("removeFileSuccess"))
    })
  }

  fileUrl(fileId, contentType) {
    return `/api/eform/files/${encodeURIComponent(fileId)}?${new URLSearchParams({
      formCode: this.formCode,
      q: this.q,
      contentType: contentType || ""
    })}`
  }

  createInputTag(attribute, value) {
    const input = document.createElement("input");
    input.setAttribute("type", "hidden");
    input.setAttribute("name", `ApplicationAttachments[][${attribute}]`);
    input.setAttribute("value", value);

    return input
  }

  remarkChange(e) {
    $(e.target).attr('value', e.target.value)

    if (e.target.value.length > 0) {
      $(e.target).parents('.file').find('.file-hidden').removeAttr('disabled')
      $(e.target).parents('.file').find('.file-label').removeClass('disabled')
    } else {
      $(e.target).parents('.file').find('.file-hidden').attr('disabled',' true')
      $(e.target).parents('.file').find('.file-label').addClass('disabled')
    }
  }

  addFile() {
    this.filesTarget.insertAdjacentHTML('beforeend', this.fileTemplate)

    const dropzoneInput = this.filesTarget.lastElementChild
    dropzoneInput.querySelector('.file-hidden').setAttribute('id', `file-${this.idCount}`)
    dropzoneInput.querySelector('.file-label').setAttribute('for', `file-${this.idCount}`)
    dropzoneInput.querySelector('.remove-file').setAttribute('data-file-multiple-field-index-param', this.idCount)
    dropzoneInput.querySelector('.remove-row').setAttribute('data-file-multiple-field-index-param', this.idCount)

    this.initDropzone(dropzoneInput, `file-${this.idCount}`, this.idCount)

    this.idCount += 1
  }

  removeRow({ params: { index }}) {
    $(`#file-${index}`).parents('.file').remove()

    const silencerElement = document.getElementById('silencer')
    const draftSubmitButton = document.getElementById('draftSubmit')
    if (silencerElement && draftSubmitButton) {
      silencerElement.value = 1
      draftSubmitButton.click()
      silencerElement.value = null
    }
    document.dispatchEvent(new CustomEvent("removeFileSuccess"))
  }

  humanFileSize = (bytes, si = true, dp = 1) => {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
      return bytes + ' B';
    }

    const units = si
      ? ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
      : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10**dp;

    do {
      bytes /= thresh;
      ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

    return bytes.toFixed(dp) + ' ' + units[u];
  }

  toBuddhistYear = (moment, format) => {
    var christianYear = moment.format('YYYY')
    var buddhishYear = (parseInt(christianYear) + 543).toString()
    return moment
      .format(format.replace('YYYY', buddhishYear).replace('YY', buddhishYear.substring(2, 4)))
      .replace(christianYear, buddhishYear)
  }
}
