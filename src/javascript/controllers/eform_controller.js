import { Controller } from '@hotwired/stimulus'
import * as bootstrap from "bootstrap"
import Swal from 'sweetalert2/dist/sweetalert2'
import { createEformApi, currentFormCode } from '../../stores/biz_portal'
import {
  buildApplicationPayload,
  entriesToObject,
  formSummary,
  listFieldSummary,
  normalizeDraftData,
  profileToFormData
} from '../components/form_data'

export default class extends Controller {
  static targets = [
    'otpMessage',
    'acceptTermOfService',
    'dataSummary',
    'form',
    'title',
    'firstName',
    'lastName',
    'canSigned',
    'nationality',
    'nationalityText',
    'canSignedText',
    'nationalityInput',
    'canSignedInput',
  ]

  static values = {
    autoSaveDraft: Boolean,
  }

  async connect() {
    this.submit = this.submit.bind(this)
    this.validateFieldOnChange = this.validateFieldOnChange.bind(this)
    this.validateFileFieldsOnChange = this.validateFileFieldsOnChange.bind(this)
    this.form = this.hasFormTarget ? this.formTarget : this.element
    this.form.addEventListener('submit', this.submit)
    this.form.addEventListener('input', this.validateFieldOnChange)
    this.form.addEventListener('change', this.validateFieldOnChange)
    document.addEventListener('uploadFileSuccess', this.validateFileFieldsOnChange)
    document.addEventListener('removeFileSuccess', this.validateFileFieldsOnChange)

    const committeeModal = this.element.querySelector('#committeeModal')
    if (committeeModal) this.committeeModal = new bootstrap.Modal(committeeModal)
    const dataSummaryModal = this.element.querySelector('#dataSummaryModal')
    if (dataSummaryModal) this.dataSummaryModal = new bootstrap.Modal(dataSummaryModal)

    try {
      this.q = new URLSearchParams(window.location.search).get('q')
      this.api = createEformApi(this.q, currentFormCode())
      const bootstrapData = window.eformBootstrapData || await this.api.bootstrap()
      const jsonApiFromSAPA = bootstrapData.config.returnJurDataApi

      this.config = { ...window.eformConfig, ...bootstrapData.config }
      this.validateConfig()
      this.applyIdentityType()
      const profileData = bootstrapData.profile?.data || {}
      const draftData = this.config.draftFeature === false ? undefined : bootstrapData.draft?.data?.data
      const data = normalizeDraftData(draftData)
      this.hydratedNames = new Set()
      this.clearEditableForm()
      this.applyFormData(data)
      this.applyProfileData(profileData, data)
      // ponytail: one delayed pass covers child Stimulus controllers that initialize after bootstrap.
      this.hydrationTimer = setTimeout(() => {
        this.applyFormData(data)
        this.applyProfileData(profileData, data)
        this.renderCommittees(profileData, data)
      }, 150)
      this.selectCleanupTimer = setTimeout(() => {
        this.clearUnfilledSelects()
        document.dispatchEvent(new CustomEvent('afterReflex'))
      }, 1200)


      // // // // New Added // // // // //
      window.jsonApiSAPA = jsonApiFromSAPA;
      console.log( " window.jsonApi ==== " , window.jsonApiSAPA);
      //this.start1();
      // // // // New Added // // // // //
 

      document.dispatchEvent(new CustomEvent('bizportal:profile-loaded', {
        detail: { data, profile: bootstrapData.profile, draft: bootstrapData.draft }
      }))
      document.dispatchEvent(new CustomEvent('eform:ready'))
    } catch (error) {
      this.showError(error)
      return
    }
    if (this.config.draftFeature !== false && this.autoSaveDraftValue && this.config.draftId) {
      this.autoSaveTimer = setInterval(() => this.saveDraft(true), 300000)
    }
  }

  submitDraft() {
    Swal.fire({
      title: 'ยืนยันการบันทึกร่างคำร้อง',
      text: 'ต้องการบันทึกข้อมูลปัจจุบันไว้เป็นร่างหรือไม่?',
      showConfirmButton: true,
      confirmButtonText: 'บันทึกร่าง',
      showDenyButton: true,
      denyButtonText: 'ยกเลิก',
    }).then(({ isConfirmed }) => {
      if (!isConfirmed) return

      this.saveDraft()
    })
  }

  validateConfig() {
    const required = ['applicationId', 'formCode', 'identityId', 'identityType', 'userId', 'version']
    const missing = required.filter((key) => this.config[key] === undefined || this.config[key] === null || this.config[key] === '')
    if (missing.length) throw new Error(`Missing window.eformConfig: ${missing.join(', ')}`)
    if (!['Citizen', 'Juristic'].includes(this.config.identityType)) throw new Error('identityType must be Citizen or Juristic')
    if (!Number.isFinite(Number(this.config.applicationId))) throw new Error('applicationId must be a number')
  }

  applyIdentityType() {
    this.form.querySelectorAll('[data-eform-identity-types]').forEach((field) => {
      const enabled = field.dataset.eformIdentityTypes.split(/\s+/).includes(this.config.identityType)
      field.classList.toggle('d-none', !enabled)
      field.disabled = !enabled
    })
  }

  formData() {
    const data = entriesToObject(new FormData(this.form).entries())
    if (!this.profileApplicant) return data

    const applicant = data.Applicant || {}
    data.Applicant = {
      ...this.profileApplicant,
      ...applicant,
      Address: {
        ...(this.profileApplicant.Address || {}),
        ...(applicant.Address || {})
      }
    }
    return data
  }

  draftPayload() {
    const data = this.formData()
    data.Applicant ||= {}
    const identityKey = this.config.identityType === 'Citizen' ? 'CitizenId' : 'JuristicId'
    data.Applicant[identityKey] ||= this.config.identityId

    return {
      draftId: this.config.draftId,
      identityId: this.config.identityId,
      applicationId: Number(this.config.applicationId),
      data: { DraftAt: new Date().toISOString(), ...data }
    }
  }

  async applicationPayload(otp) {
    this.thaiAddressesPromise ||= fetch('/data/thai-addresses.json').then((response) => {
      if (!response.ok) throw new Error('ไม่สามารถโหลดข้อมูลที่อยู่สำหรับส่งคำร้องได้')
      return response.json()
    })
    return buildApplicationPayload(
      this.formData(),
      { ...this.config, formName: document.title },
      otp,
      await this.thaiAddressesPromise
    )
  }

  async saveDraft(silent = false, reportError = !silent) {
    if (this.config?.draftFeature === false || !this.config?.draftId) return true

    try {
      const response = await this.api.createDraft(this.draftPayload())
      if (response.status !== undefined && response.status !== 0) {
        throw new Error(response.errorMessage || response.message || 'ไม่สามารถบันทึกร่างคำร้องได้')
      }
      if (!silent) await Swal.fire({
        title: 'บันทึกร่างคำร้องสำเร็จ',
        text: response.message,
        icon: 'success',
        confirmButtonText: 'ตกลง'
      })
      if (silent) document.dispatchEvent(new CustomEvent('refreshTokenSilencer'))
      return true
    } catch (error) {
      if (reportError) this.showError(error, false)
      return false
    }
  }

  async submit(event) {
    event.preventDefault()
    if (event.submitter?.value === 'บันทึกร่าง') return this.saveDraft()
    if (!this.validateForm()) {
      this.form.querySelector('.is-invalid')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const terms = this.form.querySelector('#acceptTermOfService')
    if (terms && !this.validateField(terms)) {
      await Swal.fire({
        title: 'กรุณายอมรับเงื่อนไขการให้บริการ',
        icon: 'warning',
        confirmButtonText: 'ตกลง'
      })
      terms.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    if (!await this.saveDraft(true, true)) return

    this.renderDataSummary()
    if (this.dataSummaryModal) this.dataSummaryModal.show()
    else await this.requestOtp()
  }

  validateForm() {
    if (this.config.skipValidation) return true

    this.validationStarted = true
    return [
      ...this.validationFields().map((field) => this.validateField(field)),
      ...this.fileValidationFields().map((field) => this.validateFileField(field)),
    ].every(Boolean)
  }

  validateFieldOnChange(event) {
    if (this.validationStarted) this.validateField(event.target)
  }

  validateFileFieldsOnChange() {
    if (this.validationStarted) this.fileValidationFields().forEach((field) => this.validateFileField(field))
  }

  validateField(field) {
    if (!field?.matches?.('input, select, textarea')) return true

    const group = field.closest('.form-group, fieldset') || field.parentElement
    const relatedFields = this.relatedValidationFields(field)
    relatedFields.forEach((input) => {
      input.classList.remove('is-invalid')
      input.removeAttribute('aria-invalid')
    })
    group?.querySelector('[data-eform-validation-error]')?.remove()

    if (this.ignoredValidationField(field)) return true

    const missing = this.requiredValidationField(field) && this.emptyValidationField(field, relatedFields)
    const invalid = missing || !field.checkValidity()
    if (!invalid) return true

    relatedFields.forEach((input) => {
      input.classList.add('is-invalid')
      input.setAttribute('aria-invalid', 'true')
    })
    const feedback = document.createElement('div')
    feedback.className = 'invalid-feedback d-block'
    feedback.dataset.eformValidationError = ''
    feedback.setAttribute('role', 'alert')
    feedback.textContent = this.validationMessage(field, missing)
    group?.append(feedback)
    return false
  }

  validationFields() {
    return Array.from(this.form.elements).filter((field) =>
      field.id !== 'acceptTermOfService' &&
      !this.ignoredValidationField(field) &&
      field.matches?.('input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea')
    )
  }

  fileValidationFields() {
    return Array.from(this.form.querySelectorAll('[data-controller~="file-field"]'))
  }

  validateFileField(field) {
    field.classList.remove('is-invalid')
    field.removeAttribute('aria-invalid')
    field.querySelector('[data-eform-file-validation-error]')?.remove()

    const ignored = field.closest('.d-none, [hidden]') !== null
    const required = field.querySelector('abbr[title="required"]') !== null
    const uploaded = field.querySelector('input[name="ApplicationAttachments[][FileId]"]')?.value
    if (ignored || !required || uploaded) return true

    field.classList.add('is-invalid')
    field.setAttribute('aria-invalid', 'true')
    const feedback = document.createElement('div')
    feedback.className = 'invalid-feedback d-block mt-2'
    feedback.dataset.eformFileValidationError = ''
    feedback.setAttribute('role', 'alert')
    feedback.textContent = `กรุณาแนบ ${field.dataset.fileFieldLabelValue || 'เอกสาร'}`
    field.querySelector('[data-file-field-target="input"]')?.insertAdjacentElement('afterend', feedback)
    return false
  }

  relatedValidationFields(field) {
    if (!field.name || !['checkbox', 'radio'].includes(field.type)) return [field]
    return this.validationFields().filter((candidate) => candidate.type === field.type && candidate.name === field.name)
  }

  ignoredValidationField(field) {
    return field.disabled || field.closest('.d-none, [hidden], [style*="display: none"], [style*="display:none"]') !== null
  }

  requiredValidationField(field) {
    return field.required || field.getAttribute('aria-required') === 'true' ||
      field.classList.contains('required') || field.closest('.form-group.required, fieldset.required') !== null
  }

  emptyValidationField(field, relatedFields) {
    if (['checkbox', 'radio'].includes(field.type)) return !relatedFields.some((input) => input.checked)
    if (field.tagName === 'SELECT' && field.multiple) return field.selectedOptions.length === 0
    if (field.type === 'file') return field.files.length === 0
    return field.value.trim() === ''
  }

  validationMessage(field, missing) {
    const label = field.closest('.form-group, fieldset')?.querySelector('label')?.textContent.replace('*', '').trim() || 'ข้อมูลช่องนี้'
    if (missing) return `กรุณากรอก ${label}`
    if (field.validity.typeMismatch) return `รูปแบบ${label}ไม่ถูกต้อง`
    if (field.validity.tooShort) return `${label}ต้องมีอย่างน้อย ${field.minLength} ตัวอักษร`
    if (field.validity.tooLong) return `${label}ต้องไม่เกิน ${field.maxLength} ตัวอักษร`
    return `กรุณากรอก ${label} ให้ถูกต้อง`
  }

  async previewJson() {
    try {
      const preview = document.createElement('pre')
      preview.className = 'bg-light border rounded p-3 text-start overflow-auto'
      preview.style.maxHeight = '60vh'
      preview.textContent = JSON.stringify(await this.applicationPayload('<OTP>'), null, 2)

      await Swal.fire({
        title: 'Preview JSON',
        html: preview,
        width: '80vw',
        confirmButtonText: 'ปิด'
      })
    } catch (error) {
      this.showError(error)
    }
  }

  async confirmSubmit() {
    this.dataSummaryModal?.hide()
    await this.requestOtp()
  }

  async requestOtp() {
    try {
      const otpResponse = await this.api.sendOtp()
      if (otpResponse.status !== 0) throw new Error(otpResponse.message || 'ไม่สามารถส่งรหัส OTP ได้')
      const { value: otp } = await Swal.fire({
        title: 'ยืนยันการยื่นคำร้อง',
        text: `กรอกรหัส OTP ที่ส่งไปยัง ${this.maskPhoneNumber(otpResponse.data?.mobileNumber || '')} (${otpResponse.data?.ref || '-'})`,
        input: 'text',
        inputAttributes: { inputmode: 'numeric', autocomplete: 'one-time-code' },
        showCancelButton: true,
        confirmButtonText: 'ยื่นคำร้อง',
        cancelButtonText: 'ยกเลิก',
        inputValidator: (value) => value ? undefined : 'กรุณากรอกรหัส OTP'
      })
      if (!otp) return

      const response = await this.api.submit(otp, await this.applicationPayload(otp))
      if (response.status !== 0) throw new Error(response.errorMessage || response.message)

      await Swal.fire({
        title: 'ยื่นคำร้องสำเร็จ',
        text: response.message,
        icon: 'success',
        confirmButtonText: 'ตกลง'
      })
      const redirectUrl = new URL(this.config.callbackUrl || '/', window.location.origin)
      redirectUrl.searchParams.set('requestId', response.data.requestId)
      window.location.assign(redirectUrl)
    } catch (error) {
      this.showError(error, false)
    }
  }

  renderDataSummary() {
    const data = this.formData()
    const items = formSummary(this.form, data)
    const heading = document.createElement('p')
    heading.className = 'fw-bolder'
    heading.textContent = 'ข้อมูลในแบบฟอร์ม'
    const itemNodes = items.map(([label, value, order]) => {
      const row = document.createElement('p')
      row.className = 'ms-3'
      row.append(`${label}: `)
      const text = document.createElement('span')
      text.className = 'ms-2'
      text.textContent = value
      row.append(text)
      return { order, nodes: [row] }
    })

    const tableNodes = listFieldSummary(this.form).map(({ title, headers, rows, order }) => {
      const heading = document.createElement('p')
      heading.className = 'fw-bolder'
      heading.textContent = title

      const wrapper = document.createElement('div')
      wrapper.className = 'table-responsive'
      const table = document.createElement('table')
      table.className = 'table table-bordered'
      const headerRow = document.createElement('tr')
      headers.forEach((label) => {
        const header = document.createElement('th')
        header.scope = 'col'
        header.textContent = label
        headerRow.append(header)
      })
      const body = document.createElement('tbody')
      rows.forEach((values) => {
        const row = document.createElement('tr')
        values.forEach((value) => {
          const cell = document.createElement('td')
          cell.textContent = value || '-'
          row.append(cell)
        })
        body.append(row)
      })
      const head = document.createElement('thead')
      head.append(headerRow)
      table.append(head, body)
      wrapper.append(table)

      return { order, nodes: [heading, wrapper] }
    })

    const nodes = [...itemNodes, ...tableNodes]
      .sort((left, right) => left.order - right.order)
      .flatMap(({ nodes }) => nodes)

    if (!nodes.length) {
      const empty = document.createElement('p')
      empty.className = 'ms-3'
      empty.textContent = 'ข้อมูล: -'
      nodes.push(empty)
    }

    this.dataSummaryTarget.replaceChildren(heading, ...nodes)
  }

  clearEditableForm() {
    this.form.reset()
  }

  applyFormData(data, prefix = '', predicate) {
    if (!data || typeof data !== 'object') return

    Object.entries(data).forEach(([key, value]) => {
      const name = prefix ? `${prefix}[${key}]` : key

      if (Array.isArray(value)) {
        if (value.every((item) => item === null || typeof item !== 'object')) {
          this.setNamedValue(`${name}[]`, value, predicate)
        } else {
          value.forEach((item) => this.applyFormData(item, `${name}[]`, predicate))
        }
      } else if (value && typeof value === 'object') {
        this.applyFormData(value, name, predicate)
      } else {
        this.setNamedValue(name, value, predicate)
      }
    })
  }

  applyProfileData(profile, draftData) {
    const applicant = profileToFormData(profile, this.config.identityType).Applicant
    const idKey = this.config.identityType === 'Juristic' ? 'JuristicId' : 'CitizenId'
    const profileDefaults = { ...applicant }

    this.profileApplicant = applicant
    if (Object.hasOwn(draftData?.Applicant || {}, 'Email')) delete profileDefaults.Email
    if (Object.hasOwn(draftData?.Applicant || {}, 'BirthDate')) delete profileDefaults.BirthDate
    this.applyFormData({ Applicant: profileDefaults }, '', () => true)

    this.setNamedValue('FirstName', applicant.FirstName, (input) => input.disabled)
    this.setNamedValue('LastName', applicant.LastName, (input) => input.disabled)
    this.setNamedValue(idKey, applicant[idKey], (input) => input.disabled)
    this.setNamedValue('Applicant[FirstName]', applicant.FirstName)
    this.setNamedValue('Applicant[LastName]', applicant.LastName)
    this.setNamedValue(`Applicant[${idKey}]`, applicant[idKey])
    this.setNamedValue('Applicant[WriteDate]', new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date()), () => true)
    this.setNamedValue(
      'Applicant[IdentityTypeTitle]',
      this.config.identityType === 'Juristic' ? 'นิติบุคคล' : 'บุคคลธรรมดา',
      () => true
    )

    if (!Object.hasOwn(draftData?.Applicant || {}, 'Email')) {
      this.setNamedValue('Applicant[Email]', applicant.Email)
    }
    if (!Object.hasOwn(draftData?.Applicant || {}, 'BirthDate') && applicant.BirthDate) {
      this.setNamedValue('Applicant[BirthDate]', applicant.BirthDate, () => true)
    }
    if (this.config.identityType === 'Juristic' && !Object.hasOwn(draftData?.Applicant || {}, 'Name')) {
      this.setNamedValue('Applicant[Name]', profile.identityName || profile.identity_name)
    }
    if (this.config.identityType === 'Juristic') {
      const registerDate = applicant.RegisterDate
        ? new Intl.DateTimeFormat('th-TH-u-nu-latn', { day: 'numeric', month: 'long', timeZone: 'Asia/Bangkok', year: 'numeric' }).format(new Date(applicant.RegisterDate))
        : ''
      this.setNamedValue('RegisterDate', registerDate, () => true)
    }
  }

  renderCommittees(profile, draftData) {
    const container = this.form.querySelector('[data-eform-committee-list]')
    if (!container || container.children.length) return

    const committees = profileToFormData(profile, 'Juristic').Applicant.Committees || []
    const draftCommittees = Array.isArray(draftData?.Applicant?.Committees) ? draftData.Applicant.Committees : []

    committees.forEach((committee, index) => {
      const draft = draftCommittees.find((item) => String(item.CommitteeID) === String(committee.CommitteeID))
        || draftCommittees[index]
        || {}
      const values = {
        Order: committee.Order,
        CommitteeID: committee.CommitteeID,
        IDCardNumber: draft.IDCardNumber,
        Title: committee.Title,
        FirstName: committee.FirstName,
        LastName: committee.LastName,
        TitleEN: draft.TitleEN,
        FirstNameEN: draft.FirstNameEN,
        MiddleNameEN: draft.MiddleNameEN,
        LastNameEN: draft.LastNameEN,
        IDCardExpiryDate: draft.IDCardExpiryDate,
        IDCardIssueBy: draft.IDCardIssueBy,
        Position: draft.Position,
        Telephone: draft.Telephone,
        Email: draft.Email,
        Age: draft.Age || '45',
        'Address][GeoCode': draft.Address?.GeoCode || '10370200',
        'ContactAddress][GeoCode': draft.ContactAddress?.GeoCode || '10370200',
        Nationality: draft.Nationality ?? committee.Nationality ?? '',
        CanSigned: draft.CanSigned ?? true
      }
      const card = document.createElement('div')
      card.className = 'row border border-dark rounded mx-0 mb-3'
      const body = document.createElement('div')
      body.className = 'col-md-12'

      Object.entries(values).forEach(([name, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = `Applicant[Committees][][${name}]`
        input.value = value ?? ''
        body.append(input)
      })

      const heading = document.createElement('h5')
      heading.className = 'text-primary'
      heading.textContent = `ลำดับของกรรมการ ${committee.Order}`
      const name = document.createElement('p')
      name.textContent = [committee.Title, committee.FirstName, committee.LastName].filter(Boolean).join(' ')
      const signing = document.createElement('p')
      signing.className = values.CanSigned === false || values.CanSigned === 'false' ? '' : 'text-primary'
      signing.textContent = signing.className ? 'ลงนามการขออนุญาตในครั้งนี้' : 'ไม่ได้ลงนามการขออนุญาตในครั้งนี้'
      const nationality = document.createElement('p')
      nationality.append('สัญชาติ: ', String(values.Nationality || ''))
      const citizenId = document.createElement('p')
      citizenId.append('เลขประจำตัวประชาชน 13 หลัก: ', String(committee.CommitteeID || ''))

      body.append(heading, name, signing, nationality, citizenId)
      card.append(body)
      container.append(card)
    })
  }

  setNamedValue(name, value, predicate = (input) => !input.disabled) {
    if (value === undefined || value === null) return

    const inputs = this.form.querySelectorAll(`[name="${CSS.escape(name)}"]`)
    const values = Array.isArray(value) ? value.map(String) : [String(value)]
    if (inputs.length) this.hydratedNames?.add(name)

    inputs.forEach((input) => {
      if (!predicate(input)) return

      if (input.type === 'checkbox' || input.type === 'radio') {
        input.checked = typeof value === 'boolean' ? value : values.includes(String(input.value))
        return
      }

      input.value = Array.isArray(value) ? values : value
      if (input.tagName !== 'SELECT') return

      const selectController = input.closest('[data-controller~="select-search-field"]')
      if (selectController) {
        selectController.setAttribute(
          'data-select-search-field-selected-value',
          Array.isArray(value) ? JSON.stringify(value) : String(value)
        )
        const waitsForAddressParent =
          selectController.hasAttribute('data-select-search-field-province-selector-value') ||
          selectController.hasAttribute('data-select-search-field-amphoe-selector-value')
        const optionsAreReady = values.every((selectedValue) =>
          Array.from(input.options).some((option) => option.value === selectedValue)
        )

        if (waitsForAddressParent || !optionsAreReady) return
        selectController.removeAttribute('data-select-search-field-selected-value')
      }
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  clearUnfilledSelects() {
    this.form.querySelectorAll('select[name]').forEach((input) => {
      if (this.hydratedNames?.has(input.name)) return
      if (window.jQuery) window.jQuery(input).val(null).trigger('change')
      else input.selectedIndex = -1
    })
  }

  showError(error, dispatchEvent = true) {
    Swal.fire({
      title: 'ดำเนินการไม่สำเร็จ',
      text: error?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      icon: 'error',
      confirmButtonText: 'ตกลง'
    })
    if (dispatchEvent) {
      document.dispatchEvent(new CustomEvent('formError'))
    }
  }

  openCommitteeModal({ params: { committee } }) {
    this.titleTarget.value = committee.title
    this.firstNameTarget.value = committee.first_name
    this.lastNameTarget.value = committee.last_name
    this.committeeModal.toggle()
  }

  submitCommittee() {
    this.canSignedTargets.forEach((e) => {
      if (e.checked) {
        // console.log(e.value)
        if (e.value == 'true') {
          this.canSignedTextTarget.innerHTML = '<p class="text-primary">ลงนามการขออนุญาตในครั้งนี้</p>'
        } else {
          this.canSignedTextTarget.innerHTML = '<p>ไม่ได้ลงนามการขออนุญาตในครั้งนี้</p>'
        }
        this.canSignedInputTarget.value = e.value
      }
    })

    this.nationalityTargets.forEach((e) => {
      if (e.checked) {
        this.nationalityTextTarget.innerHTML = e.value
        this.nationalityInputTarget.value = e.value
      }
    })

    this.committeeModal.hide()
  }

  initMap() {
    const locationFields = document.querySelectorAll('.location-field')

    Array.from(locationFields).forEach(locationField => {
      const mapElement = locationField.querySelector(".map")

      const center = { lat: 13.736717, lng: 100.523186 }
      const map = new google.maps.Map(mapElement, {
        center: center,
        zoom: 8,
      });

      const marker = new google.maps.Marker({
        map,
        anchorPoint: new google.maps.Point(0, -29),
      });

      const defaultBounds = {
        north: center.lat + 0.1,
        south: center.lat - 0.1,
        east: center.lng + 0.1,
        west: center.lng - 0.1,
      };
      const options = {
        bounds: defaultBounds,
        componentRestrictions: { country: "th" },
        fields: ["address_components", "geometry", "icon", "name"],
        strictBounds: false,
        types: ["establishment"],
      };
      const pacInput = mapElement.previousElementSibling
      const autocomplete = new google.maps.places.Autocomplete(pacInput, options);

      map.addListener('click', (e) => {
        map.setCenter(e.latLng);
        marker.setPosition(e.latLng);
        map.setZoom(10);
      })

      const lat = locationField.querySelector('.lat')
      const lng = locationField.querySelector('.lng')
      const confirmButton = locationField.querySelector('.confirm')
      confirmButton.addEventListener('click', (e) => {
        const position = marker.getPosition()
        lat.value = position.lat()
        lng.value = position.lng()
      })

      autocomplete.bindTo("bounds", map);
      autocomplete.addListener("place_changed", () => {
        marker.setVisible(false);

        const place = autocomplete.getPlace();

        if (!place.geometry || !place.geometry.location) {
          // User entered the name of a Place that was not suggested and
          // pressed the Enter key, or the Place Details request failed.
          window.alert("No details available for input: '" + place.name + "'");
          return;
        }

        // If the place has a geometry, then present it on a map.
        if (place.geometry.viewport) {
          map.fitBounds(place.geometry.viewport);
        } else {
          map.setCenter(place.geometry.location);
          map.setZoom(10);
        }

        marker.setPosition(place.geometry.location);
        marker.setVisible(true);
      });
    })
  }

  maskPhoneNumber(phoneNumber) {
    // Convert the phone number to a string in case it's input as a number
    const phoneStr = phoneNumber.toString();

    // Check if the phone number length is less than 4
    if (phoneStr.length < 4) {
      return phoneStr || '-';
    }
    const lastFourDigits = phoneStr.slice(-4);
    const masked = 'x'.repeat(phoneStr.length - 4);
    const phoneNumberMasked = masked + lastFourDigits;

    const zip = phoneNumberMasked.substring(0, 2);
    const middle = phoneNumberMasked.substring(2, 6);
    const last = phoneNumberMasked.substring(6, 10);

    if (phoneNumberMasked.length > 6) { return `${zip}-${middle}-${last}`; }
    else if (phoneNumberMasked.length > 2) { return `${zip}-${middle}`; }
    else if (phoneNumberMasked.length > 0) { return `${zip}`; }
  }

  disconnect() {
    this.form.removeEventListener('submit', this.submit)
    this.form.removeEventListener('input', this.validateFieldOnChange)
    this.form.removeEventListener('change', this.validateFieldOnChange)
    document.removeEventListener('uploadFileSuccess', this.validateFileFieldsOnChange)
    document.removeEventListener('removeFileSuccess', this.validateFileFieldsOnChange)
    clearInterval(this.autoSaveTimer)
    clearTimeout(this.hydrationTimer)
    clearTimeout(this.selectCleanupTimer)
  }


//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
/*
  submitFormData(btnSubmitData) {
    $(btnSubmitData).attr("type", "submit");
    $(btnSubmitData).off("click");
    $(btnSubmitData).click();
    this.start1()
    setTimeout(() => {

    }, 1800);
}
///// 002 ///// ///// 002 ///// ///// 002 ///// ///// 002 /////
///// 002 ///// ///// 002 ///// ///// 002 ///// ///// 002 /////

  start1() {


    var btnSubmitData = $('input[type="submit"][name="commit"][value="ส่งคำร้อง"]');
    if (btnSubmitData) {
        $(btnSubmitData).attr("type", "button");
        $(btnSubmitData).on("click", function () {
            ///// check validate /////

            let isCompleted = true;
            let checkFocus = true; // ให้ focus ที่ละตัว โดยทำจากบนสุดก่อน
            const myForm = document.getElementsByClassName("simple_form");



            let headerTitle = document.getElementById('HeadOffice[Title0]').value
            if (headerTitle) {
                $('input[name="HeadOffice[Title]"]').val(headerTitle)
                setTimeout(() => {
                    const container = document.getElementById('desc-HeadOffice[Title0]');
                    if (container) {
                        const span = container.querySelector('span');
                        if (span && span.textContent.trim() === '-') {
                            span.textContent = 'นาย';
                        }
                    }
                }, 1000);
            }


            if ($('#ServiceType_Check').is(':checked')) {
                const containerNewData = document.getElementById("ServiceType[NewData]-container");
                const legendNewData = containerNewData.querySelector("legend");
                if ($('input[name="ServiceType[NewData]"]:checked').length === 0) {
                    $('input[name="ServiceType[NewData]"]').attr('tabindex', '40'); legendNewData.classList.add("text-danger");
                    if (checkFocus) { $('input[name="ServiceType[NewData]"]').focus(); checkFocus = false; isCompleted = false; }
                } else {
                    legendNewData.classList.remove("text-danger");
                }
            }

            ['Applicant[Mobile]', 'Applicant[Email]', 'Applicant[Telephone]', 'JurLocation[Old][Mobile]', 'JurLocation[Old][Email]', 'JurLocation[New][Email]', 'JurLocation[New][Mobile]',
                'JurLocation[Address_Receipt]', 'JurLocation[New][Branch_Code]', 'JurLocation[New][PostCode]', 'JurLocation[Address_Branch]', 'ServiceType[NewData]',
                'HeadOffice[Title0]', 'HeadOffice[Name]', 'HeadOffice[Lastname]', 'HeadOffice[CitizenId]', 'HeadOffice[NumberAccount]', 'HeadOffice[WorkingTime]',
                'HeadOffice[ChangedBy]', 'Beyond[Lastdata][AmountPartner]', 'Beyond[Lastdata][AmountSeniorManager]', 'Beyond[Lastdata][AmountManager]',
                'Beyond[Lastdata][AmountSenior]', 'Beyond[Lastdata][AmountJunior]', 'Beyond[Lastdata][AmountOther]', 'Beyond[Editdata][AmountPartner]',
                'Beyond[Editdata][AmountSeniorManager]', 'Beyond[Editdata][AmountManager]', 'Beyond[Editdata][AmountSenior]', 'Beyond[Editdata][AmountJunior]',
                'Beyond[Editdata][AmountOther]', 'OtherNeed[Detail]'].forEach(objName => {

                    const objInput = document.getElementsByName(objName)[0];
                    if ($.trim($(objInput).val()) == "" && $(objInput).is(':visible')) {
                        $(objInput).attr('tabindex', '40'); $(objInput).siblings('label').addClass("text-danger");
                        $(objInput).parent().find('label').addClass("text-danger");
                        if (checkFocus) { objInput.focus(); checkFocus = false; isCompleted = false; }
                    } else {
                        $(objInput).parent().find('label').removeClass("text-danger");
                    }
                })

            const $visibleRadios = $("input[name='IssueBook[Choice]']:visible");
            if ($visibleRadios.length > 0) {
                const $checkedVisible = $visibleRadios.filter(":checked");
                if ($checkedVisible.length > 0) {
                    const $radio1 = $("#radio_button_24230");
                    $("label[for='" + $radio1.attr("id") + "']").removeClass("text-danger");
                    const $radio2 = $("#radio_button_24231");
                    $("label[for='" + $radio2.attr("id") + "']").removeClass("text-danger");
                } else {
                    const $radio1 = $("#radio_button_24230");
                    $("label[for='" + $radio1.attr("id") + "']").addClass("text-danger");
                    const $radio2 = $("#radio_button_24231");
                    $("label[for='" + $radio2.attr("id") + "']").addClass("text-danger");
                    if (checkFocus) { $radio1.focus(); checkFocus = false; isCompleted = false; }
                }

            } else {
                console.log("ไม่มี radio ที่แสดงอยู่เลย");
            }




            const objInputET = $('#Examiner_TotalAmount');
            if (!objInputET) return;

            const $objET = $(objInputET);
            const valET = parseInt($objET.val()) || 0;

            if (valET === 0 && $objET.is(':visible')) {
                $objET.attr('tabindex', '40');
                $objET.siblings('label').addClass("text-danger");
                $objET.parent().find('label').addClass("text-danger");

                if (checkFocus) {
                    objInputET.focus();
                    checkFocus = false;
                    isCompleted = false;
                }
            } else {
                $objET.parent().find('label').removeClass("text-danger");
            }


            const objInputAT = $('#Accountant_TotalAmount');
            if (!objInputAT) return;

            const $objAT = $(objInputAT);
            const valAT = parseInt($objAT.val()) || 0;

            if (valAT === 0 && $objAT.is(':visible')) {
                $objAT.attr('tabindex', '40');
                $objAT.siblings('label').addClass("text-danger");
                $objAT.parent().find('label').addClass("text-danger");

                if (checkFocus) {
                    objInputAT.focus();
                    checkFocus = false;
                    isCompleted = false;
                }
            } else {
                $objAT.parent().find('label').removeClass("text-danger");
            }



            const radAddress_Receipt = document.querySelector('input[name="JurLocation[Address_Receipt]"]:checked');
            if (!radAddress_Receipt && $('input[name="JurLocation[Address_Receipt]"]').is(':visible')) {
                $('input[name="JurLocation[Address_Receipt]"]').attr('tabindex', '40'); $('input[name="JurLocation[Address_Receipt]"]').siblings('label').addClass("text-danger");
                $('input[name="JurLocation[Address_Receipt]"]').parent().find('legend').addClass("text-danger");
                $('input[name="JurLocation[Address_Receipt]"]').parent().find('label').addClass("text-danger");
                if (checkFocus) { $('input[name="JurLocation[Address_Receipt]"]')[1].focus(); checkFocus = false; isCompleted = false; }
            } else {
                $('input[name="JurLocation[Address_Receipt]"]').parent().find('legend').removeClass("text-danger");
                $('input[name="JurLocation[Address_Receipt]"]').parent().find('label').removeClass("text-danger");
            }

            ///////////////////////////////////////////
            if ($('#Manager_Check').is(':checked')) {
                /// check บัตรประชาชนซ้ำ
                const valuesIDCard = [];
                const seenIDCard = new Set();
                let hasDuplicateIDCard = false;
                if (isCompleted) {
                    const objContainer = document.querySelector('#Manager');
                    objContainer.querySelectorAll('tr.item').forEach((row, index) => {
                        const val = row.querySelector("input[name='Manager[][Manager_CitizenId]']").value;
                        if (val != "") {
                            console.log("Manager_CitizenID = ", val);
                            valuesIDCard.push(val);
                            if (seenIDCard.has(val) && hasDuplicateIDCard == false) {
                                hasDuplicateIDCard = true;
                                isCompleted = false;
                                checkFocus = false;
                                alert(_alert_citizen_id);
                                $('#Manager').focus();
                            }
                            seenIDCard.add(val);
                        }
                    });
                }
                ////////////////////////////////////////////
                /// check เลขผู้สอบ
                const valuesLicense = [];
                const seenLicense = new Set();
                let hasDuplicateLicense = false;
                if (isCompleted) {
                    const objContainer = document.querySelector('#Manager');
                    objContainer.querySelectorAll('tr.item').forEach((row, index) => {
                        const val = row.querySelector("input[name='Manager[][Manager_License]']").value;
                        if (val != "") {
                            console.log("Manager_License = ", val);
                            valuesLicense.push(val);
                            if (seenLicense.has(val) && hasDuplicateLicense == false) {
                                hasDuplicateLicense = true;
                                isCompleted = false;
                                checkFocus = false;
                                alert(_alert_license_id);
                                $('#Manager').focus();
                            }
                            seenLicense.add(val);
                        }
                    });
                }
                const manager = document.getElementById('Manager');
                manager.removeAttribute('disabled');
                manager
                    .querySelectorAll('[disabled]')
                    .forEach(el => el.disabled = false);
            } else { //if( $('#Manager_Check').is(':checked') ){
                const manager = document.getElementById('Manager');
                manager.setAttribute('disabled', 'true');
                manager
                    .querySelectorAll('[disabled]')
                    .forEach(el => el.disabled = true);
            }
            ////////////////////////////////////////////
            if ($('#Accountant_Check').is(':checked')) {
                /// check รายนามผู้ทำบัญชีที่รับผิดชอบในฐานะผู้ทำบัญชีของนิติบุคคล
                const valuesAccount = [];
                const seenAccount = new Set();
                let hasDuplicateAccount = false;
                if (isCompleted) {
                    const objContainer = document.querySelector('#Accountant');
                    objContainer.querySelectorAll('tr.item').forEach((row, index) => {

                        const val = row.querySelector("input[name='Accountant[][Accountant_CitizenId]']").value;
                        if (val != "") {
                            console.log("Accountant_CitizenId = ", val);
                            valuesAccount.push(val);
                            if (seenAccount.has(val) && hasDuplicateAccount == false) {
                                hasDuplicateAccount = true;
                                isCompleted = false;
                                checkFocus = false;
                                alert(_alert_account_citizen_id);
                                $('#Accountant').focus();
                            }
                            seenAccount.add(val);
                        }
                    });
                }
                const manager = document.getElementById('Accountant');
                manager.removeAttribute('disabled');
                manager
                    .querySelectorAll('[disabled]')
                    .forEach(el => el.disabled = false);
            } else { //if( $('#Accountant_Check').is(':checked') ){
                const manager = document.getElementById('Accountant');
                manager.setAttribute('disabled', 'true');
                manager
                    .querySelectorAll('[disabled]')
                    .forEach(el => el.disabled = true);
            }

            ////////////////////////////////////////////
            if ($('#Examiner_Check').is(':checked')) {
                /// check รายนามผู้ทำบัญชีที่รับผิดชอบในฐานะผู้สอบบัญชี เลขบัตร
                const valuesExaminer = [];
                const seenExaminer = new Set();
                let hasDuplicateExaminer = false;
                if (isCompleted) {
                    const objContainer = document.querySelector('#Examiner');
                    objContainer.querySelectorAll('tr.item').forEach((row, index) => {
                        console.log("loop = ", row);
                        const val = row.querySelector("input[name='Examiner[][Examiner_CitizenId]']").value;
                        if (val != "") {

                            valuesExaminer.push(val);
                            if (seenExaminer.has(val) && hasDuplicateExaminer == false) {
                                hasDuplicateExaminer = true;
                                isCompleted = false;
                                checkFocus = false;
                                alert(_alert_examiner_citizen_id);
                                $('#Examiner').focus();
                            }
                            seenExaminer.add(val);
                        }
                    });
                }

                ////////////////////////////////////////////
                /// check รายนามผู้ทำบัญชีที่รับผิดชอบในฐานะผู้สอบบัญชี เลขบัตร
                const valuesExaminer2 = [];
                const seenExaminer2 = new Set();
                let hasDuplicateExaminer2 = false;
                if (isCompleted) {
                    const objContainer = document.querySelector('#Examiner');
                    objContainer.querySelectorAll('tr.item').forEach((row, index) => {
                        console.log("loop = ", row);
                        const val = row.querySelector("input[name='Examiner[][Examiner_License]']").value;
                        if (val != "") {

                            valuesExaminer2.push(val);
                            if (seenExaminer2.has(val) && hasDuplicateExaminer2 == false) {
                                hasDuplicateExaminer2 = true;
                                isCompleted = false;
                                checkFocus = false;
                                alert(_alert_examiner_license_id);
                                $('#Examiner').focus();
                            }
                            seenExaminer2.add(val);
                        }
                    });
                }
                const manager = document.getElementById('Examiner');
                manager.removeAttribute('disabled');
                manager
                    .querySelectorAll('[disabled]')
                    .forEach(el => el.disabled = false);
            } else {
                const manager = document.getElementById('Examiner');
                manager.setAttribute('disabled', 'true');
                manager
                    .querySelectorAll('[disabled]')
                    .forEach(el => el.disabled = true);

            }

            ////////////////////////////////////////////
            const targetDivAccountant = document.querySelector('#Accountant div div div table tbody tr td [name="Accountant[][Accountant_CitizenId]"]');
            if (typeof $(targetDivAccountant).val() === 'undefined' && $(targetDivAccountant).is(':visible')) {
                $('#Accountant').attr('tabindex', '40');
                $('#Accountant').parent().find('h2').addClass("text-danger");
                if (checkFocus) { $('#Accountant').focus(); checkFocus = false; isCompleted = false; }
            } else {
                $('#Accountant').parent().find('h2').removeClass("text-danger");
            }

            const targetDivExaminer = document.querySelector('#Examiner div div div table tbody tr td [name="Examiner[][Examiner_CitizenId]"]');
            if (typeof $(targetDivExaminer).val() === 'undefined' && $(targetDivExaminer).is(':visible')) {
                $('#Examiner').attr('tabindex', '40');
                $('#Examiner').parent().find('h2').addClass("text-danger");
                if (checkFocus) { $('#Examiner').focus(); checkFocus = false; isCompleted = false; }
            } else {
                $('#Examiner').parent().find('h2').removeClass("text-danger");
            }



            let conIdCardNation = $('#conIdCardNation');
            if ($.trim($(conIdCardNation).val()) == "" && $(conIdCardNation).is(':visible')) {
                $(conIdCardNation).attr('tabindex', '40'); $(conIdCardNation).siblings('label').addClass("text-danger");
                $(conIdCardNation).parent().find('label').addClass("text-danger");
                if (checkFocus) { conIdCardNation.focus(); checkFocus = false; isCompleted = false; }
            } else {
                $(conIdCardNation).parent().find('label').removeClass("text-danger");
            }

            let conAudit = $('#conAudit');
            if ($.trim($(conAudit).val()) == "" && $(conAudit).is(':visible')) {
                $(conAudit).attr('tabindex', '40'); $(conAudit).siblings('label').addClass("text-danger");
                $(conAudit).parent().find('label').addClass("text-danger");
                if (checkFocus) { conAudit.focus(); checkFocus = false; isCompleted = false; }
            } else {
                $(conAudit).parent().find('label').removeClass("text-danger");
            }

            let conNumber = $('#conNumber');
            if ($.trim($(conNumber).val()) == "" && $(conNumber).is(':visible')) {
                $(conNumber).attr('tabindex', '40'); $(conNumber).siblings('label').addClass("text-danger");
                $(conNumber).parent().find('label').addClass("text-danger");
                if (checkFocus) { conNumber.focus(); checkFocus = false; isCompleted = false; }
            } else {
                $(conNumber).parent().find('label').removeClass("text-danger");
            }


            const ApplicantEmail = document.getElementsByName("Applicant[Email]");
            const ApplicantEmail0 = ApplicantEmail[0];
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (ApplicantEmail0) {
                if (!emailRegex.test(ApplicantEmail0.value)) {
                    $(ApplicantEmail0).attr('tabindex', '40'); $(ApplicantEmail0).siblings('label').addClass("text-danger");
                    $(ApplicantEmail0).parent().find('label').addClass("text-danger");
                    if (checkFocus) { ApplicantEmail0.focus(); checkFocus = false; isCompleted = false; }
                }
            } else {
                $(ApplicantEmail0).parent().find('label').removeClass("text-danger");
            }

            const JurLocationNewEmail = document.getElementsByName("JurLocation[New][Email]");
            const JurLocationNewEmail0 = JurLocationNewEmail[0];
            if (JurLocationNewEmail0 && $(JurLocationNewEmail0).is(':visible')) {
                if (!emailRegex.test(JurLocationNewEmail0.value)) {
                    $(JurLocationNewEmail0).attr('tabindex', '40'); $(JurLocationNewEmail0).siblings('label').addClass("text-danger");
                    $(JurLocationNewEmail0).parent().find('label').addClass("text-danger");
                    if (checkFocus) { JurLocationNewEmail0.focus(); checkFocus = false; isCompleted = false; }
                }
            } else {
                $(JurLocationNewEmail0).parent().find('label').removeClass("text-danger");
            }

            const JurLocationOldEmail = document.getElementsByName("JurLocation[Old][Email]");
            const JurLocationOldEmail0 = JurLocationOldEmail[0];
            if (JurLocationOldEmail0 && $(JurLocationOldEmail0).is(':visible')) {
                if (!emailRegex.test(JurLocationOldEmail0.value)) {
                    $(JurLocationOldEmail0).attr('tabindex', '40'); $(JurLocationOldEmail0).siblings('label').addClass("text-danger");
                    $(JurLocationOldEmail0).parent().find('label').addClass("text-danger");
                    if (checkFocus) { JurLocationOldEmail0.focus(); checkFocus = false; isCompleted = false; }
                }
            } else {
                $(JurLocationOldEmail0).parent().find('label').removeClass("text-danger");
            }



            if (!$('#confirm_1').is(':checked')) {
                $('#confirm_1').attr('tabindex', '40'); $('#confirm_1').siblings('label').addClass("text-danger");
                $('#confirm_1').parent().find('label').addClass("text-danger");
                if (checkFocus) { $('#confirm_1').focus(); checkFocus = false; isCompleted = false; }
            } else {
                $('#confirm_1').parent().find('label').removeClass("text-danger");
            }


            var upload3 = $('[data-file-field-name-value="file_applicant_3_month"]');
            if (upload3 && $(upload3).is(':visible')) {
                var aaa = upload3.find('[data-file-field-target="preview"]')
                var a = upload3.find('p')
                if (aaa.hasClass('d-none')) {
                    console.log(a.html())
                    a.attr('tabindex', '40');
                    a.addClass("text-danger");
                    if (checkFocus) {
                        a.focus();
                        checkFocus = false;
                    }
                    isCompleted = false;
                } else {
                    a.removeClass("text-danger");
                }
            }


            var upload4 = $('[data-file-field-name-value="image_authorization_id_card"]');
            if (upload4 && $(upload4).is(':visible')) {
                var aaa = upload4.find('[data-file-field-target="preview"]')
                var a = upload4.find('p')
                if (aaa.hasClass('d-none')) {
                    console.log(a.html())
                    a.attr('tabindex', '40');
                    a.addClass("text-danger");
                    if (checkFocus) {
                        a.focus();
                        checkFocus = false;
                    }
                    isCompleted = false;
                } else {
                    a.removeClass("text-danger");
                }
            }



            if (!$('#acceptTermOfService').is(':checked')) {
                if (checkFocus) {
                    $('#acceptTermOfService').focus()
                    alert("กรุณาคลิกยอมรับเงื่อนไขการให้บริการ");
                }
                isCompleted = false;
            }

            /////////////////////////
            //alert("click submit");
            //isCompleted = false;

            ////////////////////////////////
            ///// final check validate /////
            if (isCompleted) {
                console.log("completed");
                this.submitFormData(btnSubmitData)
            }
            ///// final check validate /////
            ////////////////////////////////
        })
    }

}
*/

}
