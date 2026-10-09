import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
  }

  copyAddress(e) {
    if (e.target.checked) {
      // Copy from Target
      const address = $('#form_preview .basic_information_field input[name="Applicant[Address][AddressNo]"]')
      const moo = $('#form_preview .basic_information_field input[name="Applicant[Address][VillageNo]"]')
      const soi = $('#form_preview .basic_information_field input[name="Applicant[Address][Soi]"]')
      const village = $('#form_preview .basic_information_field input[name="Applicant[Address][Village]"]')
      // const building = $('#form_preview .basic_information_field input[name="Applicant[Address][BuildingName]"]')
      // const room_no = $('#form_preview .basic_information_field input[name="Applicant[Address][RoomNo]"]')
      // const floor = $('#form_preview .basic_information_field input[name="Applicant[Address][FloorNo]"]')
      const road = $('#form_preview .basic_information_field input[name="Applicant[Address][Road]"]')
      const province = $('#form_preview .basic_information_field select[name="Applicant[Address][Province]"]')
      const amphoe = $('#form_preview .basic_information_field select[name="Applicant[Address][District]"]')
      const tambon = $('#form_preview .basic_information_field select[name="Applicant[Address][SubDistrict]"]')
      const postalcode = $('#form_preview .basic_information_field input[name="Applicant[Address][PostCode]"]')
      const phoneNumber = $('#form_preview .basic_information_field input[name="Applicant[Telephone]"]')
      const mobilePhone = $('#form_preview .basic_information_field input[name="Applicant[MobilePhone]"]')
      const fax = $('#form_preview .basic_information_field input[name="Applicant[Address][Contacts][][ContactDetail]"]')

      // Copy From Target
      const copyToAddress = $(this.element).find('input[name="ContactAddress[address_2]"]')
      const copyToMoo = $(this.element).find('input[name="ContactAddress[moo_2]"]')
      const copyToSoi = $(this.element).find('input[name="ContactAddress[soi_2]"]')
      const copyToVillage = $(this.element).find('input[name="ContactAddress[village_2]"]')
      // const copyToBuildingName = $(this.element).find('input[name="ContactAddress[building_name_2]"]')
      // const copyToRoomNo = $(this.element).find('input[name="ContactAddress[room_no_2]"]')
      // const copyToFloorNo = $(this.element).find('input[name="ContactAddress[floor_no_2]"]')
      const copyToRoad = $(this.element).find('input[name="ContactAddress[road_2]"]')
      const copyToProvince = $(this.element).find('select[name="ContactAddress[province_2]"]')
      const copyToAmphoe = $(this.element).find('select[name="ContactAddress[amphoe_2]"]')
      const copyToTambon = $(this.element).find('select[name="ContactAddress[tambon_2]"]')
      const copyToPostCode = $(this.element).find('input[name="ContactAddress[postalcode_2]"]')
      const copyToTelephone = $(this.element).find('input[name="ContactAddress[phone_number_2]"]')
      const copyToMobilePhone = $(this.element).find('input[name="ContactAddress[mobile_phone_2]"]')
      const copyToFax = $(this.element).find('input[name="ContactAddress[fax_2]"]')

      copyToAddress?.val(address?.val())
      copyToMoo?.val(moo?.val())
      copyToSoi?.val(soi?.val())
      copyToVillage?.val(village?.val())
      // copyToBuildingName?.val(building?.val())
      // copyToRoomNo?.val(room_no?.val())
      // copyToFloorNo?.val(floor?.val())
      copyToRoad?.val(road?.val())
      copyToProvince?.val(province?.val()).trigger('change')
      setTimeout(() => {
        copyToAmphoe?.val(amphoe?.val()).trigger('change')
      }, 500)

      setTimeout(() => {
        copyToTambon?.val(tambon?.val()).trigger('change')
      }, 1000)

      copyToPostCode?.val(postalcode?.val())
      copyToTelephone?.val(phoneNumber?.val())
      copyToMobilePhone?.val(mobilePhone?.val())
      copyToFax?.val(fax?.val())
    } else {
      const inputElements = this.element.querySelectorAll('input:not([type="search"]),select,textarea')
      Array.from(inputElements).forEach(inputElement => {
        inputElement.value = null
      })

      $('select[name="ContactAddress[province_2]"]').val(null).trigger('change')
      $('select[name="ContactAddress[amphoe_2]"]').val(null).trigger('change')
      $('select[name="ContactAddress[tambon_2]"]').val(null).trigger('change')
    }
  }
}
