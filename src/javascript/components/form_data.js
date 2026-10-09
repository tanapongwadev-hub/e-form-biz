const SKIPPED_FORM_FIELDS = new Set([
  'acceptTermOfService',
  'authenticity_token',
  'commit',
  'copy_address',
  'otp',
  'q',
  'search_terms',
  'silencer'
])
const ATTACHMENT_FIELDS = [
  'Name',
  'FileId',
  'ContentType',
  'FileUrl',
  'FileSize',
  'DocName',
  'Remark',
  'FileTypeCode',
  'UploadedAt',
  'Document_Type_ID'
]
// ponytail: remove this fallback after all existing standalone forms are re-exported with attachmentAdditionalFields.
const LEGACY_ATTACHMENT_ADDITIONAL_FIELDS = {
  EquipmentList: { test: '1' }
}

const firstPresent = (...values) => values.find((value) => value !== undefined && value !== null)

export const profileToFormData = (profile = {}, identityType = 'Citizen') => {
  const identityName = String(firstPresent(profile.identityName, profile.identity_name, '')).trim()
  const [firstName = '', ...lastNameParts] = identityName.split(/\s+/).filter(Boolean)
  const lastName = lastNameParts.join(' ')
  const identityId = firstPresent(profile.identityId, profile.identity_id, '')
  const citizenInformation = firstPresent(profile.citizenInformation, profile.citizen_information, {})

  if (identityType === 'Juristic' || identityType === 2) {
    const juristicInformation = firstPresent(profile.juristicInformation, profile.juristic_information, {})
    const address = firstPresent(profile.addresses, [])[0] || {}
    const profileCommittees = firstPresent(juristicInformation.committees, [])
    const committees = (Array.isArray(profileCommittees) ? profileCommittees : []).map((committee) => {
      const result = {
        Order: firstPresent(committee.sequence, committee.order),
        CommitteeID: firstPresent(committee.committeeId, committee.committee_id),
        Title: committee.title,
        FirstName: firstPresent(committee.firstName, committee.first_name),
        LastName: String(firstPresent(committee.lastName, committee.last_name, '')).replaceAll('/', '')
      }
      const nationality = firstPresent(committee.nationality, committee.Nationality)
      if (nationality !== undefined && nationality !== null) result.Nationality = nationality
      return result
    })

    return {
      Applicant: {
        Address: {
          AddressNo: firstPresent(address.addressNo, address.address_no),
          BuildingName: address.building,
          District: address.district,
          FloorNo: firstPresent(address.floorNo, address.floor_no),
          PostCode: firstPresent(address.postCode, address.post_code),
          Province: address.province,
          Road: address.road,
          RoomNo: firstPresent(address.roomNo, address.room_no),
          Soi: address.soi,
          SubDistrict: firstPresent(address.subDistrict, address.sub_district),
          Village: firstPresent(address.villageName, address.village_name),
          VillageNo: firstPresent(address.villageNo, address.moo)
        },
        Committees: committees,
        Email: profile.email,
        JuristicId: identityId,
        JuristicType: firstPresent(juristicInformation.juristicType, juristicInformation.juristic_type),
        Name: identityName,
        NameEn: firstPresent(
          juristicInformation.juristicNameEN,
          juristicInformation.juristicNameEn,
          juristicInformation.juristic_name_en
        ),
        Objective: firstPresent(juristicInformation.standardText, juristicInformation.standard_text),
        RegisterCapital: firstPresent(juristicInformation.registerCapital, juristicInformation.register_capital),
        RegisterDate: firstPresent(juristicInformation.registerDate, juristicInformation.register_date)
      }
    }
  }

  const applicant = {
    FirstName: firstName,
    LastName: lastName
  }

  if (profile.email !== undefined && profile.email !== null) applicant.Email = profile.email
  if (citizenInformation.birthDate || citizenInformation.birth_date) {
    applicant.BirthDate = citizenInformation.birthDate || citizenInformation.birth_date
  }
  applicant[identityType === 'Juristic' ? 'JuristicId' : 'CitizenId'] = identityId

  return { Applicant: applicant }
}

const CONTACT_ADDRESS_ALIASES = {
  AddressNo: 'address_2',
  District: 'amphoe_2',
  MobilePhone: 'mobile_phone_2',
  PostCode: 'postalcode_2',
  Province: 'province_2',
  Road: 'road_2',
  Soi: 'soi_2',
  SubDistrict: 'tambon_2',
  Telephone: 'phone_number_2',
  Village: 'village_2',
  VillageNo: 'moo_2'
}

const unwrapRailsValue = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0].trim() === '' ? value[keys[0]] : value
}

export const normalizeDraftData = (data = {}) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}

  const normalized = { ...data }
  if (data.ContactAddress && typeof data.ContactAddress === 'object') {
    normalized.ContactAddress = { ...data.ContactAddress }
    Object.entries(CONTACT_ADDRESS_ALIASES).forEach(([railsKey, fieldKey]) => {
      if (!Object.hasOwn(normalized.ContactAddress, fieldKey) && Object.hasOwn(data.ContactAddress, railsKey)) {
        normalized.ContactAddress[fieldKey] = unwrapRailsValue(data.ContactAddress[railsKey])
      }
    })
  }

  const contacts = data.Applicant?.Address?.Contacts
  if (Array.isArray(contacts)) {
    normalized.Applicant = {
      ...data.Applicant,
      Address: {
        ...data.Applicant.Address,
        Contacts: contacts.filter((contact) => String(contact?.ContactType).toLowerCase() === 'fax')
      }
    }
  }

  return normalized
}

const stripSpaces = (value) => typeof value === 'string' ? value.replaceAll(' ', '') : value

const bangkokParts = (date, locale = 'en-CA') => Object.fromEntries(
  new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Bangkok',
    year: 'numeric'
  }).formatToParts(date).map(({ type, value }) => [type, value])
)

const submitDate = (date) => {
  const value = bangkokParts(date)
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}+07:00`
}

const thaiDate = (date) => {
  const value = Object.fromEntries(
    new Intl.DateTimeFormat('th-TH-u-nu-latn', {
      day: '2-digit',
      month: 'long',
      timeZone: 'Asia/Bangkok',
      year: 'numeric'
    }).formatToParts(date).map(({ type, value: part }) => [type, part])
  )
  return `${value.day}/${value.month}/${value.year}`
}

const presentEntries = (value) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '')
)

export const buildApplicationPayload = (formData, config, otp, addresses, now = new Date()) => {
  const remainingData = { ...formData }
  const sourceApplicant = remainingData.Applicant || {}
  const sourceAddress = sourceApplicant.Address || {}
  const contactAddress = sourceApplicant.ContactAddress || {
    AddressNo: null,
    VillageNo: null,
    Village: null,
    Soi: null,
    Road: null,
    SubDistrict: null,
    District: null,
    Province: null,
    PostCode: null,
    Telephone: null,
    MobilePhone: null,
    Fax: null,
    Contacts: []
  }
  const contacts = Array.isArray(sourceAddress.Contacts)
    ? sourceAddress.Contacts.map((contact) => ({ ...contact }))
    : []
  const applicant = {
    ...sourceApplicant,
    Address: { ...sourceAddress, Contacts: contacts },
    ContactAddress: contactAddress,
    [config.identityType === 'Citizen' ? 'CitizenId' : 'JuristicId']: config.identityId,
    IdentityType: config.identityType
  }

  delete remainingData.Applicant

  if (applicant.Title === 'อื่นๆ') {
    applicant.Title = applicant.TitleOther
    delete applicant.TitleOther
  }

  applicant.Telephone = stripSpaces(applicant.Telephone)
  applicant.MobilePhone = stripSpaces(applicant.MobilePhone)
  if (applicant.Telephone) contacts.push({ ContactType: 'Telephone', ContactDetail: applicant.Telephone })
  if (applicant.MobilePhone) contacts.push({ ContactType: 'Mobile', ContactDetail: applicant.MobilePhone })

  const province = addresses.provinces.find((item) => item.province_name_th === sourceAddress.Province)
  const district = addresses.districts.find((item) =>
    item.province_code === province?.province_code && item.district_name_th === sourceAddress.District
  )
  const subdistrict = addresses.subdistricts.find((item) =>
    item.province_code === province?.province_code &&
    item.district_code === district?.district_code &&
    item.subdistrict_name_th === sourceAddress.SubDistrict
  )

  if (subdistrict) applicant.Address.GeoCode = `${subdistrict.subdistrict_code}00`

  const attachments = (Array.isArray(remainingData.ApplicationAttachments)
    ? remainingData.ApplicationAttachments
    : []
  ).filter((attachment) => attachment?.Name).map((attachment) => {
    const permitted = Object.fromEntries(
      ATTACHMENT_FIELDS.filter((key) => Object.hasOwn(attachment, key)).map((key) => [key, attachment[key]])
    )
    const fileType = String(permitted.FileTypeCode || '').replace(/_\d+$/, '')
    const additionalFields = config.attachmentAdditionalFields ?? LEGACY_ATTACHMENT_ADDITIONAL_FIELDS
    return {
      ...permitted,
      Document_Type_ID: permitted.Document_Type_ID || 1,
      ...(additionalFields[fileType] || {})
    }
  })

  delete remainingData.ApplicationAttachments

  const fax = contacts.find((contact) => contact.ContactType === 'Fax')?.ContactDetail
  const appData = config.formName ? {
    ContactAddress: { AddressNo: {} },
    Title: config.formName,
    FirstName: config.formName,
    LastName: config.formName,
    CanSigned: '',
    Nationality: '',
    ...remainingData
  } : remainingData
  const description = {
    'ข้อมูลบุคคลผู้ขออนุญาต': presentEntries({
      'วัน/เดือน/ปีที่ยื่นคำขอ': thaiDate(now),
      'เขียนที่': 'Biz Portal',
      'ขออนุญาตในฐานะบุคคลธรรมดาหรือนิติบุคคล': config.identityType === 'Citizen' ? 'บุคคลธรรมดา' : 'นิติบุคคล',
      'คำนำหน้า': applicant.Title,
      'ชื่อ': applicant.FirstName,
      'นามสกุล': applicant.LastName,
      'อายุ (ปี)': applicant.Age,
      'เลขประจำตัวประชาชน 13 หลัก': config.identityType === 'Citizen' ? config.identityId : undefined,
      'โทรศัพท์': applicant.Telephone,
      'อีเมล (ที่ใช้สำหรับติดต่อ)': applicant.Email
    })
  }

  if (config.identityType === 'Citizen') {
    description['ข้อมูลที่อยู่ตามบัตรประชาชน'] = presentEntries({
      'เลขที่': sourceAddress.AddressNo,
      'หมู่': sourceAddress.VillageNo,
      'หมู่บ้าน': sourceAddress.Village,
      'ตรอก/ซอย': sourceAddress.Soi,
      'ถนน': sourceAddress.Road,
      'ตำบล/แขวง': sourceAddress.SubDistrict,
      'อำเภอ/เขต': sourceAddress.District,
      'จังหวัด': sourceAddress.Province,
      'รหัสไปรษณีย์': sourceAddress.PostCode,
      'โทรศัพท์': applicant.Telephone,
      'โทรศัพท์มือถือ': applicant.MobilePhone
    })
    if (contacts.some((contact) => contact.ContactType === 'Fax')) {
      description['ข้อมูลที่อยู่ตามบัตรประชาชน']['แฟกซ์'] = fax ?? ''
    }
  }

  return {
    otp,
    identityId: config.identityId,
    identityType: config.identityType === 'Citizen' ? 1 : 2,
    applicationId: Number(config.applicationId),
    suppliesId: null,
    suppliesType: "Unknown",
    provinceID: province?.province_code || null,
    amphurID: district?.district_code || null,
    tumbolID: subdistrict?.subdistrict_code || null,
    province: province?.province_name_th || null,
    amphur: district?.district_name_th || null,
    tumbol: subdistrict?.subdistrict_name_th || null,
    data: {
      Id: config.userId,
      Applicant: applicant,
      ApplicationAttachments: attachments,
      Address: {
        Province: province?.province_name_th || null,
        District: district?.district_name_th || null,
        SubDistrict: subdistrict?.subdistrict_name_th || null,
        PostCode: subdistrict?.postal_code?.toString() || null,
        GeoCode: subdistrict?.subdistrict_code || null
      },
      AdditionalInfo: null,
      SubmitDate: submitDate(now),
      ApplicationNo: 'CJ640101001',
      [config.appDataKey || 'AppData']: appData,
      IdentityType: config.identityType
    },
    dataDescription: description
  }
}

const summaryValue = (value) => {
  const text = String(value ?? '').trim()
  return text || '-'
}

export const applicationSummary = (data = {}) => {
  const applicant = data.Applicant || {}
  const address = applicant.Address || {}
  const fax = Array.isArray(address.Contacts)
    ? address.Contacts.find((contact) => contact?.ContactType === 'Fax')?.ContactDetail
    : undefined
  const attachment = (data.ApplicationAttachments || []).find((file) => file?.FileTypeCode === 'EquipmentList')

  return [
    {
      title: 'ข้อมูลบุคคลผู้ขออนุญาต',
      items: [
        ['วัน/เดือน/ปี/ที่ยื่นคำขอ', applicant.WriteDate],
        ['เขียนที่', applicant.WriteAt],
        ['ขออนุญาตในฐานะบุคคลธรรมดาหรือนิติบุคคล', applicant.IdentityTypeTitle],
        ['ชื่อ-นามสกุล', `${applicant.Title || ''}${applicant.FirstName || ''} ${applicant.LastName || ''}`],
        ['เลขประจำตัวประชาชน 13 หลัก', applicant.CitizenId],
        ['อีเมล (ที่ใช้สำหรับติดต่อ)', applicant.Email]
      ]
    },
    {
      title: 'ข้อมูลที่อยู่ตามบัตรประชาชน',
      items: [
        ['เลขที่', address.AddressNo],
        ['หมู่ที่', address.VillageNo],
        ['หมู่บ้าน', address.Village],
        ['ตรอก/ซอย', address.Soi],
        ['ถนน', address.Road],
        ['จังหวัด', address.Province],
        ['อำเภอ/เขต', address.District],
        ['ตำบล/แขวง', address.SubDistrict],
        ['รหัสไปรษณีย์', address.PostCode],
        ['โทรศัพท์', applicant.Telephone],
        ['โทรศัพท์มือถือ', applicant.MobilePhone],
        ['โทรสาร', fax]
      ]
    },
    {
      title: 'รายละเอียดเครื่องมือที่จะขอรับบริการ',
      items: [['แบบฟอร์มรายการเครื่องมือส่งสอบเทียบ', attachment?.Name]]
    }
  ].map((section) => ({
    ...section,
    items: section.items.map(([label, value]) => [label, summaryValue(value)])
  }))
}

const summaryLabel = (element) => String(element?.textContent || '')
  .replaceAll('*', '')
  .replace(/\s+/g, ' ')
  .trim()

const fieldSummaryLabel = (field) => {
  const type = (field.type || '').toLowerCase()
  const groupLabel = summaryLabel(field.closest?.('.form-group')?.querySelector?.('label'))
  const legend = summaryLabel(field.closest?.('fieldset')?.querySelector?.('legend'))

  return ['checkbox', 'radio'].includes(type)
    ? legend || groupLabel || summaryLabel(field.labels?.[0])
    : groupLabel || summaryLabel(field.labels?.[0]) || legend
}

const summaryOrder = (form) => new Map(Array.from(form?.querySelectorAll?.(
  'input[name], select[name], textarea[name], [data-controller~="file-field"], [data-controller~="list-field"]'
) || []).map((element, index) => [element, index]))

export const formSummary = (form, data = {}) => {
  const fields = Array.from(form?.querySelectorAll?.('input[name], select[name], textarea[name]') || [])
  const orderByElement = summaryOrder(form)
  const labelsByName = new Map()

  fields.forEach((field) => {
    if ((field.type || '').toLowerCase() !== 'hidden') {
      const label = fieldSummaryLabel(field)
      if (label && !labelsByName.has(field.name)) labelsByName.set(field.name, label)
    }
  })

  const items = new Map()
  const addItem = (key, label, value, element) => {
    const text = String(value ?? '').trim()
    if (!label || !text) return
    if (!items.has(key)) items.set(key, { label, values: new Set(), order: orderByElement.get(element) ?? Infinity })
    items.get(key).values.add(text)
  }

  fields.forEach((field) => {
    const type = (field.type || '').toLowerCase()

    if (!field.name || SKIPPED_FORM_FIELDS.has(field.name.trim())) return
    if (['button', 'file', 'reset', 'submit'].includes(type)) return
    if (type === 'hidden') return
    if (field.closest?.('.d-none, [hidden], [style*="display: none"], [style*="display:none"]')) return
    if (field.closest?.('.modal')) return
    if (['checkbox', 'radio'].includes(type) && !field.checked) return

    const label = labelsByName.get(field.name) || fieldSummaryLabel(field)
    const value = field.tagName === 'SELECT'
      ? Array.from(field.selectedOptions || []).map((option) => summaryLabel(option) || option.value).filter(Boolean).join(', ')
      : ['checkbox', 'radio'].includes(type) ? summaryLabel(field.labels?.[0]) || field.value : field.value

    addItem(field.name, label, value, field)
  })

  const attachments = Array.isArray(data.ApplicationAttachments) ? data.ApplicationAttachments : []
  Array.from(form?.querySelectorAll?.('[data-controller~="file-field"][data-file-field-name-value]') || []).forEach((field) => {
    const type = field.dataset.fileFieldNameValue
    const names = attachments
      .filter((attachment) => String(attachment?.FileTypeCode || '').replace(/_\d+$/, '') === type)
      .map((attachment) => attachment?.Name)
      .filter(Boolean)

    names.forEach((name) => addItem(`attachment:${type}`, field.dataset.fileFieldLabelValue || type, name, field))
  })

  return Array.from(items.values(), ({ label, values, order }) => [label, Array.from(values).join(', '), order])
}

export const listFieldSummary = (form) => {
  const orderByElement = summaryOrder(form)

  return Array.from(form?.querySelectorAll?.('[data-controller~="list-field"]') || []).flatMap((field) => {
  if (field.closest?.('.d-none, [hidden], [style*="display: none"], [style*="display:none"]')) return []

  const columns = Array.from(field.querySelectorAll('[data-list-field-target="header"] th'))
    .map((header, index) => ({ index, label: summaryLabel(header) }))
    .filter(({ label }) => label)
  const rows = Array.from(field.querySelectorAll('[data-list-field-target="items"] > tr.item'))
    .map((row) => columns.map(({ index }) => summaryLabel(row.children[index])))

  if (!columns.length || !rows.length) return []

  return [{
    title: summaryLabel(field.querySelector('h1, h2, h3, h4, h5, h6')) || field.dataset.listFieldNameValue,
    headers: columns.map(({ label }) => label),
    rows,
    order: orderByElement.get(field) ?? Infinity
  }]
  })
}

const nameParts = (name) => [...name.matchAll(/(^[^[]+)|\[([^\]]*)\]/g)].map((match) => match[1] ?? match[2])

const assignValue = (target, parts, value) => {
  const [part, ...rest] = parts

  if (!rest.length) {
    if (part === '') target.push(value)
    else target[part] = value
    return
  }

  if (part === '') {
    const nextPart = rest[0]
    let child = target.at(-1)
    if (!child || typeof child !== 'object' || (nextPart && Object.hasOwn(child, nextPart))) {
      child = nextPart === '' ? [] : {}
      target.push(child)
    }
    assignValue(child, rest, value)
    return
  }

  target[part] ||= rest[0] === '' ? [] : {}
  assignValue(target[part], rest, value)
}

export const entriesToObject = (entries) => {
  const result = {}
  for (const [name, value] of entries) {
    if (!name || SKIPPED_FORM_FIELDS.has(name)) continue
    assignValue(result, nameParts(name), value)
  }
  return result
}
