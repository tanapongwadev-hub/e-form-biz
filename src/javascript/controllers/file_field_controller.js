import { Controller } from "@hotwired/stimulus"
import Cropper from 'cropperjs';
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
    'cropperImage',
    'cropperModal',
    'cropperPreviewModal',
    'cropperPreviewImage',
    'formGroup',
    'zip',
    'png',
    'jpg',
    'pdf',
    'docx',
    'doc',
    'thumbnail',
    'error',
  ]

  static values = {
    name: String,
    label: String,
    cropEnabled: Boolean,
    endpoint: String,
    aspectRatio: Number,
    acceptFiles: String
  }

  croppingImageProcess = true

  connect() {
    this.q = new URLSearchParams(window.location.search).get('q')
    this.formCode = currentFormCode()
    this.restoreFile = this.restoreFile.bind(this)
    document.addEventListener('bizportal:profile-loaded', this.restoreFile)
    this.cropperModal = new bootstrap.Modal(this.cropperModalTarget)
    this.cropperPreviewModal = new bootstrap.Modal(this.cropperPreviewModalTarget)
    this.dropzoneInput = document.getElementById(this.nameValue)

    this.cropperModalTarget.addEventListener('hidden.bs.modal', event => {
      this.dropzone?.removeAllFiles()
    })

    this.cropperPreviewModalTarget.addEventListener('hidden.bs.modal', event => {
      this.dropzone?.removeAllFiles()
    })

    if (this.dropzoneInput.disabled) {
      this.dropzoneInput.setAttribute('disabled', true)
    } else {
      this.initDropzone()
    }
  }

  disconnect() {
    document.removeEventListener('bizportal:profile-loaded', this.restoreFile)
    this.dropzone?.destroy()
    this.dropzone = undefined
  }

  removeAllFile() {
    this.dropzone?.removeAllFiles()
  }

  changeExtensionToMimeType(extension) {
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/*';
      case 'png':
        return 'image/png';
      case 'pdf':
        return 'application/pdf';
      case 'zip':
        return 'application/zip';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default:
        return 'application/octet-stream'; // Default MIME type for unknown extensions
    }
  }


  initDropzone() {
    const acceptFilesMimeTypes = this.acceptFilesValue.split(',').map(ext => ext.trim().slice(1)).map(ext => this.changeExtensionToMimeType(ext))
    try {
      this.dropzone = new Dropzone(`#${this.nameValue}`, {
        url: `${this.endpointValue}/bizportal/api/file/upload?${new URLSearchParams({
          formCode: this.formCode,
          q: this.q
        })}`,
        maxFiles: 1,
        acceptedFiles: acceptFilesMimeTypes.join(','),
        maxFilesize: 50,
        disablePreviews: true,
        autoProcessQueue: !this.cropEnabledValue,
      })

      this.dropzone.on('addedfile', (file) => {
        // console.log('addedfile')
        this.fileUploadData = file
        if (this.cropper) {
          this.cropper.destroy()
        }
      })

      this.dropzone.on('removedfile', (file) => {
        // console.log('removedfile')
      })

      this.dropzone.on('thumbnail', (file) => {
        if (this.cropEnabledValue && this.croppingImageProcess) {
          this.cropperModal = new bootstrap.Modal(this.cropperModalTarget)

          this.cropperImageTarget.src = file.dataURL
          this.cropperModal.show()
          this.cropper = new Cropper(this.cropperImageTarget, {
            aspectRatio: this.aspectRatioValue,
            minContainerWidth: 766,
            minContainerHeight: 1040,
          });
        }
      })

      this.dropzone.on("sending", (file, xhr, formData) => {
        const data = {
          DocName: this.labelValue,
          FileTypeCode: this.nameValue,
          Name: this.fileUploadData.name,
          FileReferenceId: this.fileUploadData.upload.uuid,
          FileUrl: "",
          Remark: this.element.querySelector('.remark')?.value || "",
        }

        formData.append("fileMetadata", JSON.stringify(data))
      });

      this.dropzone.on('uploadprogress', (file) => {
        this.progressTarget.innerHTML = `${file.upload.progress}%`
        this.progressContainerTarget.classList.remove("d-none")
      })

      this.dropzone.on('error', (_file, message) => {
        if (!this.hasErrorTarget) return
        this.errorTarget.textContent = typeof message === 'string' ? message : 'อัปโหลดเอกสารไม่สำเร็จ'
        this.errorTarget.classList.remove('d-none')
      })

      this.dropzone.on('complete', () => {
        this.progressContainerTarget.classList.add('d-none')
      })

      this.dropzone.on('success', (file, response) => {
        this.file = response

        this.inputTarget.classList.add("d-none")
        this.previewTarget.classList.remove("d-none")
        this.previewTarget.hidden = false
        this.progressContainerTarget.classList.add("d-none")
        if (this.hasErrorTarget) this.errorTarget.classList.add('d-none')

        this.filenameTarget.textContent = file.upload.filename
        this.filenameTarget.href = this.fileUrl(this.file.fileId, this.fileUploadData.type)
        this.fileSizeTarget.innerHTML = this.humanFileSize(file.size)
        this.uploadedAtTarget.innerHTML = this.toBuddhistYear(moment(), 'DD/MM/YYYY HH:mm:ss')
        if (this.fileUploadData.type.startsWith('image/')) {
          this.thumbnailTarget.src = this.fileUrl(this.file.fileId, this.fileUploadData.type)
          this.thumbnailTarget.classList.remove('d-none')
        }
        this.croppingImageProcess = false

        this.formGroupTarget.innerHTML = ""
        this.formGroupTarget.append(this.createInputTag('FileTypeCode', this.nameValue))
        this.formGroupTarget.append(this.createInputTag('DocName', this.labelValue))
        this.formGroupTarget.append(this.createInputTag('ContentType', this.fileUploadData.type))
        this.formGroupTarget.append(this.createInputTag('FileSize', this.fileUploadData.size))
        this.formGroupTarget.append(this.createInputTag('Name', this.fileUploadData.name))
        this.formGroupTarget.append(this.createInputTag('FileId', this.file.fileId))
        this.formGroupTarget.append(this.createInputTag('Id', this.nameValue))
        this.formGroupTarget.append(this.createInputTag('FileUrl', ""))
        this.formGroupTarget.append(this.createInputTag('UploadedAt', this.toBuddhistYear(moment(), 'DD/MM/YYYY hh:mm:ss')))
        this.formGroupTarget.append(this.createInputTag('Remark', this.element.querySelector('.remark')?.value || ""))

        this.showContentTypeIcon(this.fileUploadData.type)

        this.dropzoneInput.setAttribute('disabled', true)

        const silencerElement = document.getElementById('silencer')
        const draftSubmitButton = document.getElementById('draftSubmit')
        if (silencerElement && draftSubmitButton) {
          silencerElement.value = 1
          draftSubmitButton.click()
          silencerElement.value = null
        }

        document.dispatchEvent(new CustomEvent("dropzone-success"))
        document.dispatchEvent(new CustomEvent("uploadFileSuccess"))
      })

    } catch (error) {
      if (!this.hasErrorTarget) return
      this.errorTarget.textContent = error.message || 'ไม่สามารถเริ่มอัปโหลดเอกสารได้'
      this.errorTarget.classList.remove('d-none')
    }
  }

  async removeFile() {
    const fileId = this.formGroupTarget.querySelector('input[name="ApplicationAttachments[][FileId]"]')?.value
    const contentType = this.formGroupTarget.querySelector('input[name="ApplicationAttachments[][ContentType]"]')?.value
    if (!fileId) return

    try {
      const response = await fetch(this.fileUrl(fileId, contentType), { method: 'DELETE' })
      if (!response.ok) throw new Error('ลบเอกสารไม่สำเร็จ')

      this.formGroupTarget.innerHTML = ""
      this.formGroupTarget.append(this.createInputTag('FileTypeCode', this.nameValue))
      this.inputTarget.classList.remove("d-none")
      this.previewTarget.classList.add("d-none")
      this.progressContainerTarget.classList.add("d-none")
      this.jpgTarget.classList.add('d-none')
      this.pngTarget.classList.add('d-none')
      this.pdfTarget.classList.add('d-none')
      this.zipTarget.classList.add('d-none')
      this.docTarget.classList.add('d-none')
      this.docxTarget.classList.add('d-none')
      this.dropzoneInput.removeAttribute('disabled')
      this.thumbnailTarget.src = `//:0`
      this.thumbnailTarget.classList.add('d-none')

      const silencerElement = document.getElementById('silencer')
      const draftSubmitButton = document.getElementById('draftSubmit')
      if (silencerElement && draftSubmitButton) {
        silencerElement.value = 1
        draftSubmitButton.click()
        silencerElement.value = null
      }

      // console.log("this.dropzone.removeAllFiles()")
      this.dropzone?.removeAllFiles()
      document.dispatchEvent(new CustomEvent("removeFileSuccess"))
    } catch (error) {
      if (!this.hasErrorTarget) return
      this.errorTarget.textContent = error.message || 'ลบเอกสารไม่สำเร็จ'
      this.errorTarget.classList.remove('d-none')
    }
  }

  restoreFile({ detail: { data } }) {
    const attachments = data?.ApplicationAttachments
    if (!Array.isArray(attachments)) return

    const file = attachments.find((attachment) =>
      attachment.FileTypeCode === this.nameValue || attachment.Id === this.nameValue
    )
    if (!file?.FileId) return

    const contentType = file.ContentType || 'application/octet-stream'
    this.inputTarget.classList.add('d-none')
    this.previewTarget.classList.remove('d-none')
    this.previewTarget.hidden = false
    this.filenameTarget.textContent = file.Name || this.labelValue
    this.filenameTarget.href = this.fileUrl(file.FileId, contentType)
    this.fileSizeTarget.textContent = this.humanFileSize(Number(file.FileSize) || 0)
    this.uploadedAtTarget.textContent = file.UploadedAt || ''
    this.formGroupTarget.innerHTML = ''
    Object.entries(file).forEach(([attribute, value]) => {
      this.formGroupTarget.append(this.createInputTag(attribute, value ?? ''))
    })
    this.dropzoneInput.setAttribute('disabled', true)
    this.showContentTypeIcon(contentType)

    if (contentType.startsWith('image/')) {
      this.thumbnailTarget.src = this.fileUrl(file.FileId, contentType)
      this.thumbnailTarget.classList.remove('d-none')
    }
  }

  showContentTypeIcon(contentType) {
    if (contentType === 'image/jpg' || contentType === 'image/jpeg') this.jpgTarget.classList.remove('d-none')
    else if (contentType === 'image/png') this.pngTarget.classList.remove('d-none')
    else if (contentType === 'application/pdf') this.pdfTarget.classList.remove('d-none')
    else if (contentType === 'application/zip') this.zipTarget.classList.remove('d-none')
    else if (contentType === 'application/msword') this.docTarget.classList.remove('d-none')
    else if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') this.docxTarget.classList.remove('d-none')
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

  getCroppedData() {
    this.cropper.getCroppedCanvas().toBlob((blob) => {
      this.cropperPreviewImageTarget.src = URL.createObjectURL(blob)

      this.croppedFile = new File([blob], this.fileUploadData.name, blob);

      this.cropperModal.hide()
      this.cropperPreviewModal.show()
      this.cropper.destroy()
    })
  }

  uploadCroppedImage() {
    this.croppingImageProcess = false
    this.dropzone.addFile(this.croppedFile)

    this.dropzone.processQueue()

    this.cropperPreviewModal.hide()
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
