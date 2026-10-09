import assert from "node:assert/strict"
import test from "node:test"
import { readdirSync, readFileSync } from "node:fs"
import {
  applicationSummary,
  buildApplicationPayload,
  entriesToObject,
  formSummary,
  listFieldSummary,
  normalizeDraftData,
  profileToFormData
} from "../src/javascript/components/form_data.js"
import { createEformApi } from "../src/stores/biz_portal.js"

test("Rails-style form names become BizPortal JSON", () => {
  assert.deepEqual(entriesToObject([
    ["Applicant[FirstName]", "Ada"],
    ["ApplicationAttachments[][Name]", "one.pdf"],
    ["ApplicationAttachments[][FileId]", "1"],
    ["ApplicationAttachments[][Name]", "two.pdf"],
    ["ApplicationAttachments[][FileId]", "2"],
    ["Tags[]", "a"],
    ["Tags[]", "b"]
  ]), {
    Applicant: { FirstName: "Ada" },
    ApplicationAttachments: [
      { Name: "one.pdf", FileId: "1" },
      { Name: "two.pdf", FileId: "2" }
    ],
    Tags: ["a", "b"]
  })
})

test("BizPortal profile becomes Rails-style applicant defaults", () => {
  assert.deepEqual(profileToFormData({
    email: "ada@example.com",
    identityId: "1234567890123",
    identityName: "Ada Lovelace"
  }, "Citizen"), {
    Applicant: {
      CitizenId: "1234567890123",
      Email: "ada@example.com",
      FirstName: "Ada",
      LastName: "Lovelace"
    }
  })
})

test("Juristic profile becomes Rails-style applicant defaults", () => {
  const applicant = profileToFormData({
    addresses: [{
      address_no: "99",
      building: "Biz Tower",
      district: "บางรัก",
      floor_no: "8",
      moo: "2",
      post_code: "10500",
      province: "กรุงเทพมหานคร",
      road: "สีลม",
      room_no: "801",
      soi: "3",
      sub_district: "สีลม",
      village_name: "Biz Village"
    }],
    email: "company@example.com",
    identityId: "0105555000000",
    identityName: "บริษัท ตัวอย่าง จำกัด",
    juristicInformation: {
      committees: [{ committee_id: "1", first_name: "สมชาย", last_name: "ใจดี/", sequence: 1, title: "นาย" }],
      juristic_name_en: "Example Co., Ltd.",
      juristic_type: "บริษัทจำกัด",
      register_capital: 1000000,
      register_date: "2020-01-02",
      standard_text: "ประกอบกิจการทดสอบ"
    }
  }, "Juristic").Applicant

  assert.equal(applicant.JuristicId, "0105555000000")
  assert.equal(applicant.Name, "บริษัท ตัวอย่าง จำกัด")
  assert.equal(applicant.NameEn, "Example Co., Ltd.")
  assert.equal(applicant.Address.PostCode, "10500")
  assert.deepEqual(applicant.Committees, [{
    CommitteeID: "1",
    FirstName: "สมชาย",
    LastName: "ใจดี",
    Order: 1,
    Title: "นาย"
  }])
})

test("Juristic profile accepts BizPortal juristicNameEN", () => {
  const applicant = profileToFormData({
    identityType: 2,
    juristicInformation: { juristicNameEN: "BIZA ENTERPRISE CO., LTD." }
  }, "Juristic").Applicant

  assert.equal(applicant.NameEn, "BIZA ENTERPRISE CO., LTD.")
})

test("standalone export switches citizen and juristic fieldsets from bootstrap identity", () => {
  const controller = readFileSync(new URL("../src/javascript/controllers/eform_controller.js", import.meta.url), "utf8")
  const exportTemplate = readFileSync(new URL("../../app/views/admin/forms/export.html.erb", import.meta.url), "utf8")

  assert.match(controller, /this\.applyIdentityType\(\)/)
  assert.match(controller, /data-eform-identity-types/)
  assert.match(exportTemplate, /data-eform-identity-types="Citizen"/)
  assert.match(exportTemplate, /data-eform-identity-types="Juristic"/)
  assert.match(exportTemplate, /user_type: :entity_signatory/)
  assert.match(exportTemplate, /id="acceptTermOfService"/)
  assert.match(exportTemplate, /for="acceptTermOfService"/)
  assert.doesNotMatch(exportTemplate, /accept-term-of-service/)
})

test("legacy Rails draft address keys fill standalone copy-address fields", () => {
  assert.deepEqual(normalizeDraftData({
    ContactAddress: {
      AddressNo: { " ": "99" },
      District: "บางรัก",
      Province: "กรุงเทพมหานคร"
    }
  }), {
    ContactAddress: {
      AddressNo: { " ": "99" },
      District: "บางรัก",
      Province: "กรุงเทพมหานคร",
      address_2: "99",
      amphoe_2: "บางรัก",
      province_2: "กรุงเทพมหานคร"
    }
  })
})

test("draft hydration keeps the Rails fax contact instead of email contacts", () => {
  assert.deepEqual(normalizeDraftData({
    Applicant: {
      Address: {
        Contacts: [
          { ContactType: "Email", ContactDetail: "ada@example.com" },
          { ContactType: "Fax", ContactDetail: "02-123-4567" }
        ]
      }
    }
  }).Applicant.Address.Contacts, [
    { ContactType: "Fax", ContactDetail: "02-123-4567" }
  ])
})

test("application summary follows the Rails review modal fields", () => {
  const summary = applicationSummary({
    Applicant: {
      WriteDate: "30 กรกฎาคม 2569",
      WriteAt: "Biz Portal",
      IdentityTypeTitle: "บุคคลธรรมดา",
      Title: "นาย",
      FirstName: "ธีรภัทร",
      LastName: "จันทร์คต",
      CitizenId: "1529900780969",
      Email: "test@example.com",
      Address: {
        AddressNo: "99",
        Province: "กรุงเทพมหานคร",
        Contacts: [{ ContactType: "Fax", ContactDetail: "02-123-4567" }]
      }
    },
    ApplicationAttachments: [{ FileTypeCode: "EquipmentList", Name: "equipment.docx" }]
  })

  assert.deepEqual(summary.map(({ title }) => title), [
    "ข้อมูลบุคคลผู้ขออนุญาต",
    "ข้อมูลที่อยู่ตามบัตรประชาชน",
    "รายละเอียดเครื่องมือที่จะขอรับบริการ"
  ])
  assert.deepEqual(summary[0].items[3], ["ชื่อ-นามสกุล", "นายธีรภัทร จันทร์คต"])
  assert.deepEqual(summary[1].items.at(-1), ["โทรสาร", "02-123-4567"])
  assert.deepEqual(summary[2].items[0], ["แบบฟอร์มรายการเครื่องมือส่งสอบเทียบ", "equipment.docx"])
})

test("frontend keeps q inside the NestJS API boundary", async () => {
  const originalFetch = globalThis.fetch
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return new Response(JSON.stringify({ status: 0 }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })
  }

  try {
    const api = createEformApi("encrypted-q", "A-BA001")
    assert.deepEqual(await api.submit("123456", { applicationId: 999 }), { status: 0 })
    assert.equal(request.url, "/api/eform/submit")
    assert.deepEqual(JSON.parse(request.options.body), {
      formCode: "A-BA001",
      q: "encrypted-q",
      otp: "123456",
      payload: { applicationId: 999 }
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("form JavaScript waits for bootstrap and reuses its response", () => {
  const main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8")
  const controller = readFileSync(new URL("../src/javascript/controllers/eform_controller.js", import.meta.url), "utf8")

  assert.ok(main.indexOf("await createEformApi(q, currentFormCode()).bootstrap()") < main.indexOf('await import("./javascript/application.js")'))
  assert.match(main, /start\(\)\.catch/)
  assert.match(controller, /const bootstrapData = window\.eformBootstrapData \|\| await this\.api\.bootstrap\(\)/)
  assert.match(controller, /CustomEvent\('eform:ready'\)/)
  assert.doesNotMatch(controller, /getElementById\('JurLocation\[New\]\[Branch_Code\]'\)[\s\S]{0,300}\.value/)
})

test("standalone preserves exported defaults and honors skipped validation", () => {
  const controller = readFileSync(new URL("../src/javascript/controllers/eform_controller.js", import.meta.url), "utf8")

  assert.match(controller, /validateForm\(\) \{\s*if \(this\.config\.skipValidation\) return true/)
  assert.match(controller, /clearEditableForm\(\) \{\s*this\.form\.reset\(\)/)
})

test("TFAC forms keep their legacy submit hook and skip built-in validation", () => {
  const exportTemplate = readFileSync(new URL("../../app/views/admin/forms/export.html.erb", import.meta.url), "utf8")
  const jsField = readFileSync(new URL("../../app/views/fields/_js_field.html.erb", import.meta.url), "utf8")
  const jsFileField = readFileSync(new URL("../../app/views/fields/_js_file_field.html.erb", import.meta.url), "utf8")

  assert.match(exportTemplate, /skipValidation: @form\.is_skip_validation/)
  assert.match(exportTemplate, /type="submit" name="commit" value="ส่งคำร้อง"/)
  for (const partial of [jsField, jsFileField]) assert.match(partial, /document\.addEventListener\("eform:ready"/)

  for (const file of readdirSync(new URL("../forms", import.meta.url)).filter((name) => /^tfac-68-001-[1-5]\.html$/.test(name))) {
    const html = readFileSync(new URL(`../forms/${file}`, import.meta.url), "utf8")

    assert.match(html, /window\.eformConfig = \{[^}]*"skipValidation":true/)
    assert.match(html, /document\.addEventListener\("eform:ready"/)
    assert.match(html, /<input class="btn btn-success text-white w-100" type="submit" name="commit" value="ส่งคำร้อง">/)
  }
})

test("standalone dispatches required legacy form lifecycle events without rerunning forms on errors", () => {
  const eformController = readFileSync(new URL("../src/javascript/controllers/eform_controller.js", import.meta.url), "utf8")
  const fileController = readFileSync(new URL("../src/javascript/controllers/file_field_controller.js", import.meta.url), "utf8")
  const multipleFileController = readFileSync(new URL("../src/javascript/controllers/file_multiple_field_controller.js", import.meta.url), "utf8")

  for (const eventName of ["afterReflex", "refreshTokenSilencer"]) {
    assert.match(eformController, new RegExp(`CustomEvent\\(['\"]${eventName}['\"]\\)`))
  }
  assert.doesNotMatch(eformController, /CustomEvent\\(['\"]formError['\"]\\)/)
  for (const controller of [fileController, multipleFileController]) {
    assert.match(controller, /CustomEvent\(["']uploadFileSuccess["']\)/)
    assert.match(controller, /CustomEvent\(["']removeFileSuccess["']\)/)
  }
})

test("standalone export renders juristic committees after profile hydration", () => {
  const controller = readFileSync(new URL("../src/javascript/controllers/eform_controller.js", import.meta.url), "utf8")
  const partial = readFileSync(new URL("../../app/views/fields/_basic_information_field.html.erb", import.meta.url), "utf8")
  const html = readFileSync(new URL("../forms/tfac-68-001-1.html", import.meta.url), "utf8")

  assert.match(partial, /data-eform-committee-list/)
  assert.match(html, /data-eform-committee-list/)
  assert.match(controller, /this\.renderCommittees\(profileData, data\)/)
  assert.match(controller, /Applicant\[Committees\]\[\]\[\$\{name\}\]/)
})

test("file fields use standalone icons without stale Rails asset requests", () => {
  const fileController = readFileSync(new URL("../src/javascript/controllers/file_field_controller.js", import.meta.url), "utf8")
  assert.doesNotMatch(fileController, /ensureRemoveButton/)

  for (const file of readdirSync(new URL("../forms", import.meta.url)).filter((file) => file.endsWith(".html"))) {
    const html = readFileSync(new URL(`../forms/${file}`, import.meta.url), "utf8")
    assert.doesNotMatch(html, /src="\/assets\/(?:zip|png|jpg|pdf|docx?)-/)
  }
})

test("address hydration waits for province and district options", () => {
  const eformController = readFileSync(new URL("../src/javascript/controllers/eform_controller.js", import.meta.url), "utf8")
  const selectSearchController = readFileSync(new URL("../src/javascript/controllers/select_search_field_controller.js", import.meta.url), "utf8")

  assert.match(eformController, /waitsForAddressParent \|\| !optionsAreReady/)
  assert.doesNotMatch(eformController, /new CustomEvent\(input\.id\)/)
  assert.match(selectSearchController, /if \(i === 0\)/)
  assert.doesNotMatch(selectSearchController, /emitListenerKey|emitFireKey/)
})

test("Thai address endpoints accept locale-prefixed paths", () => {
  const controller = readFileSync(new URL("../src/javascript/controllers/select_search_field_controller.js", import.meta.url), "utf8")

  assert.match(controller, /split\('\?', 1\)\[0\]\.split\('\/'\)\.pop\(\)/)
  assert.match(controller, /\['province\.json', 'provinces\.json'\]\.includes\(endpointName\)/)
  assert.match(controller, /endpointName == 'amphoes\.json'/)
  assert.match(controller, /endpointName == 'tambons\.json'/)
})

test("forms may omit a service number", () => {
  const eformController = readFileSync(new URL("../src/javascript/controllers/eform_controller.js", import.meta.url), "utf8")

  assert.doesNotMatch(eformController, /const required = \[[^\]]*'serviceNo'/)
})

test("successful submission always redirects", () => {
  const eformController = readFileSync(new URL("../src/javascript/controllers/eform_controller.js", import.meta.url), "utf8")

  assert.match(eformController, /new URL\(this\.config\.callbackUrl \|\| '\/', window\.location\.origin\)/)
  assert.match(eformController, /window\.location\.assign\(redirectUrl\)/)
})

test("standalone A-BA001 uses the same file type code as Rails", () => {
  const fileController = readFileSync(new URL("../src/javascript/controllers/file_field_controller.js", import.meta.url), "utf8")
  const selectSearchController = readFileSync(new URL("../src/javascript/controllers/select_search_field_controller.js", import.meta.url), "utf8")
  assert.match(fileController, /this\.showContentTypeIcon\(contentType\)/)
  assert.match(selectSearchController, /onchangeDelay: \{ type: Number, default: 300 \}/)
  assert.match(selectSearchController, /this\.onchange = _\.debounce/)
  assert.match(selectSearchController, /data-select-search-field-selected-value/)
  assert.match(selectSearchController, /onchangeTarget\.val\(pendingValue\)\.trigger\('change'\)/)

  for (const path of ["forms/A-BA001.html"]) {
    const html = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
    assert.match(html, /data-file-field-name-value="EquipmentList"/)
    assert.match(html, /id="EquipmentList"/)
    assert.match(html, /name="Applicant\[WriteDate\]"/)
    assert.match(html, /name="FirstName"/)
    assert.match(html, /name="Applicant\[FirstName\]"/)
    assert.match(html, /name="Applicant\[Email\]"/)
    assert.match(html, /อัปโหลดเอกสาร/)
    assert.match(html, /data-file-field-accept-files-value="\.docx"/)
    assert.match(html, /<i class="bi bi-trash"><\/i>/)
    assert.match(html, /id="dataSummaryModal"/)
    assert.match(html, /data-action="click->eform#previewJson"/)
    assert.match(html, /data-action="click->eform#confirmSubmit"/)
    assert.match(html, /data-file-field-target="preview"/)
    assert.doesNotMatch(html, /CalibrationDocument/)
    assert.doesNotMatch(html, /value="021234567"|value="0001234567"/)
  }
})

test("homepage is the custom 404 page", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8")
  assert.match(html, /<title>ไม่พบหน้าที่ค้นหา \| BizPortal<\/title>/)
  assert.match(html, /class="code" aria-hidden="true">404/)
  assert.match(html, /<h1 id="error-title">ไม่พบหน้าที่คุณค้นหา<\/h1>/)
  assert.doesNotMatch(html, /data-controller="eform"/)
})

test("application payload matches Rails ApplicationRequestDataBuilder for A-BA001", () => {
  const payload = buildApplicationPayload({
    Applicant: {
      Title: "อื่นๆ",
      TitleOther: "ดร.",
      FirstName: "Ada",
      LastName: "Lovelace",
      CitizenId: "ignored",
      Email: "ada@example.com",
      Telephone: "02 123 4567",
      MobilePhone: "081 234 5678",
      Address: {
        AddressNo: "99",
        VillageNo: "",
        Village: "",
        Soi: "",
        Road: "",
        Province: "กรุงเทพมหานคร",
        District: "บางรัก",
        SubDistrict: "บางรัก",
        PostCode: "10500",
        Contacts: [{ ContactType: "Fax", ContactDetail: "" }]
      }
    },
    ApplicationAttachments: [{
      Name: "equipment.docx",
      FileId: "file-1",
      ContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      FileUrl: "/file/1",
      FileSize: "123",
      DocName: "equipment.docx",
      Remark: "drop-me",
      FileTypeCode: "EquipmentList",
      UploadedAt: "2026-07-30T10:00:00+07:00",
      Id: "not-submitted"
    }]
  }, {
    applicationId: 734,
    attachmentAdditionalFields: {
      EquipmentList: { test: "1", Document_Type_ID: 2 }
    },
    formName: "ขอรับบริการทดสอบสอบเทียบเครื่องมือมาตรฐาน",
    identityId: "1234567890123",
    identityType: "Citizen",
    userId: "user-1"
  }, "123456", {
    provinces: [{ province_code: 10, province_name_th: "กรุงเทพมหานคร" }],
    districts: [{ province_code: 10, district_code: 1004, district_name_th: "บางรัก" }],
    subdistricts: [{
      province_code: 10,
      district_code: 1004,
      subdistrict_code: 100404,
      subdistrict_name_th: "บางรัก",
      postal_code: 10500
    }]
  }, new Date("2026-07-30T03:04:05Z"))

  assert.deepEqual(payload, {
    otp: "123456",
    identityId: "1234567890123",
    identityType: 1,
    applicationId: 734,
    suppliesId: null,
    suppliesType: "Unknown",
    provinceID: 10,
    amphurID: 1004,
    tumbolID: 100404,
    province: "กรุงเทพมหานคร",
    amphur: "บางรัก",
    tumbol: "บางรัก",
    data: {
      Id: "user-1",
      Applicant: {
        Title: "ดร.",
        FirstName: "Ada",
        LastName: "Lovelace",
        CitizenId: "1234567890123",
        Email: "ada@example.com",
        Telephone: "021234567",
        MobilePhone: "0812345678",
        Address: {
          AddressNo: "99",
          VillageNo: "",
          Village: "",
          Soi: "",
          Road: "",
          Province: "กรุงเทพมหานคร",
          District: "บางรัก",
          SubDistrict: "บางรัก",
          PostCode: "10500",
          Contacts: [
            { ContactType: "Fax", ContactDetail: "" },
            { ContactType: "Telephone", ContactDetail: "021234567" },
            { ContactType: "Mobile", ContactDetail: "0812345678" }
          ],
          GeoCode: "10040400"
        },
        ContactAddress: {
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
        },
        IdentityType: "Citizen"
      },
      ApplicationAttachments: [{
        Name: "equipment.docx",
        FileId: "file-1",
        ContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        FileUrl: "/file/1",
        FileSize: "123",
        DocName: "equipment.docx",
        Remark: "drop-me",
        FileTypeCode: "EquipmentList",
        UploadedAt: "2026-07-30T10:00:00+07:00",
        Document_Type_ID: 2,
        test: "1"
      }],
      Address: {
        Province: "กรุงเทพมหานคร",
        District: "บางรัก",
        SubDistrict: "บางรัก",
        PostCode: "10500",
        GeoCode: 100404
      },
      AdditionalInfo: null,
      SubmitDate: "2026-07-30T10:04:05+07:00",
      ApplicationNo: "CJ640101001",
      AppData: {
        ContactAddress: { AddressNo: {} },
        Title: "ขอรับบริการทดสอบสอบเทียบเครื่องมือมาตรฐาน",
        FirstName: "ขอรับบริการทดสอบสอบเทียบเครื่องมือมาตรฐาน",
        LastName: "ขอรับบริการทดสอบสอบเทียบเครื่องมือมาตรฐาน",
        CanSigned: "",
        Nationality: ""
      },
      IdentityType: "Citizen"
    },
    dataDescription: {
      "ข้อมูลบุคคลผู้ขออนุญาต": {
        "วัน/เดือน/ปีที่ยื่นคำขอ": "30/กรกฎาคม/2569",
        "เขียนที่": "Biz Portal",
        "ขออนุญาตในฐานะบุคคลธรรมดาหรือนิติบุคคล": "บุคคลธรรมดา",
        "คำนำหน้า": "ดร.",
        "ชื่อ": "Ada",
        "นามสกุล": "Lovelace",
        "เลขประจำตัวประชาชน 13 หลัก": "1234567890123",
        "โทรศัพท์": "021234567",
        "อีเมล (ที่ใช้สำหรับติดต่อ)": "ada@example.com"
      },
      "ข้อมูลที่อยู่ตามบัตรประชาชน": {
        "เลขที่": "99",
        "ตำบล/แขวง": "บางรัก",
        "อำเภอ/เขต": "บางรัก",
        "จังหวัด": "กรุงเทพมหานคร",
        "รหัสไปรษณีย์": "10500",
        "โทรศัพท์": "021234567",
        "โทรศัพท์มือถือ": "0812345678",
        "แฟกซ์": ""
      }
    }
  })
})

test("submit saves draft before showing the data summary", () => {
  const controller = readFileSync(new URL("../src/javascript/controllers/eform_controller.js", import.meta.url), "utf8")
  assert.match(controller, /if \(!await this\.saveDraft\(true, true\)\) return[\s\S]*this\.renderDataSummary\(\)/)
})

test("disabled draft feature skips draft hydration and saving", () => {
  const controller = readFileSync(new URL("../src/javascript/controllers/eform_controller.js", import.meta.url), "utf8")

  assert.match(controller, /draftFeature === false \? undefined : bootstrap\.draft/)
  assert.match(controller, /draftFeature === false \|\| !this\.config\?\.draftId/)
})

test("submit shows inline client validation before saving", () => {
  const controller = readFileSync(new URL("../src/javascript/controllers/eform_controller.js", import.meta.url), "utf8")

  assert.match(controller, /if \(!this\.validateForm\(\)\)[\s\S]*return[\s\S]*#acceptTermOfService[\s\S]*Swal\.fire/)
  assert.match(controller, /field\.id !== 'acceptTermOfService'/)
  assert.match(controller, /!this\.ignoredValidationField\(field\)/)
  assert.match(controller, /\[style\*="display: none"\]/)
  assert.match(controller, /querySelector\('\.is-invalid'\)\?\.scrollIntoView/)
  assert.doesNotMatch(controller, /CustomEvent\('sendApplicationRequest'\)/)
  assert.match(controller, /data-eform-validation-error/)
  assert.match(controller, /data-eform-file-validation-error/)
  assert.match(controller, /ApplicationAttachments\[\]\[FileId\]/)
  assert.match(controller, /(?:upload|remove)FileSuccess/)
  assert.match(controller, /addEventListener\('input', this\.validateFieldOnChange\)/)
  assert.doesNotMatch(controller, /reportValidity\(\)/)
})

test("SweetAlert results follow API response statuses", () => {
  const eformController = readFileSync(new URL("../src/javascript/controllers/eform_controller.js", import.meta.url), "utf8")
  const notificationController = readFileSync(new URL("../src/javascript/controllers/notification_controller.js", import.meta.url), "utf8")

  assert.match(eformController, /response\.status !== undefined && response\.status !== 0/)
  assert.match(notificationController, /case 'request-number-not-found':[\s\S]*?break\s+case 'error':/)
})

test("form summary includes disabled fields and every attachment", () => {
  const label = (textContent) => ({ textContent })
  const field = ({ name, value, type = "text", label: text, listItem = false, disabled = false }) => ({
    name,
    value,
    type,
    disabled,
    checked: true,
    tagName: "INPUT",
    labels: text ? [label(text)] : [],
    closest(selector) {
      return selector === "tr.item" && listItem ? {} : null
    }
  })
  const fields = [
    field({ name: "Applicant[FirstName]", value: "Ada", label: "ชื่อ *", disabled: true }),
    field({ name: "Manager[][Name]", value: "Manager One", type: "hidden", listItem: true }),
    field({ name: "Manager[][Name]", value: "", label: "ชื่อผู้จัดการ" })
  ]
  const fileField = { dataset: { fileFieldNameValue: "License", fileFieldLabelValue: "ใบอนุญาต" } }
  const form = {
    querySelectorAll(selector) {
      if (selector === "input[name], select[name], textarea[name]") return fields
      if (selector.startsWith("input[name]")) return [...fields, fileField]
      return [fileField]
    }
  }

  assert.deepEqual(formSummary(form, {
    ApplicationAttachments: [
      { FileTypeCode: "License", Name: "license.pdf" },
      { FileTypeCode: "License_2", Name: "license-back.pdf" }
    ]
  }), [
    ["ชื่อ", "Ada", 0],
    ["ใบอนุญาต", "license.pdf, license-back.pdf", 3]
  ])
})

test("list field summary preserves visible columns and rows as a table", () => {
  const cell = (textContent) => ({ textContent })
  const listField = {
    dataset: { listFieldNameValue: "Manager" },
    closest() { return null },
    querySelector(selector) {
      return selector.startsWith("h1") ? cell("รายนามกรรมการ") : null
    },
    querySelectorAll(selector) {
      if (selector.includes("header")) {
        return [cell("คำนำหน้า"), cell("ชื่อ"), cell(""), cell("")]
      }
      return [{ children: [cell("นาย"), cell("สมชาย"), cell("แก้ไข"), cell("ลบ")] }]
    }
  }
  const beforeList = {}
  const form = {
    querySelectorAll(selector) {
      return selector === '[data-controller~="list-field"]' ? [listField] : [beforeList, listField]
    }
  }

  assert.deepEqual(listFieldSummary(form), [{
    title: "รายนามกรรมการ",
    headers: ["คำนำหน้า", "ชื่อ"],
    rows: [["นาย", "สมชาย"]],
    order: 1
  }])
})
