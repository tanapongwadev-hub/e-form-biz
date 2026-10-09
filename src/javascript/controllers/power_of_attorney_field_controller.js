import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "select",
    "container"
  ];

  static values = {
    userType: String
  }

  // Enum values matching applicant_type in the model
  static enumValues = {
    self_applicant: "self_applicant",                // ผู้ขอดำเนินการเอง
    authorized_individual: "authorized_individual",  // ผู้ได้รับมอบอำนาจจากบุคคลธรรมดา
    authorized_entity: "authorized_entity",          // ผู้ได้รับมอบอำนาจจากนิติบุคคล
    entity_signatory: "entity_signatory"             // ผู้มีอำนาจลงนามผูกพันนิติบุคคล
  };

  connect() {
    // Only auto-render by select in dev mode (when selectTarget exists)
    if (this.hasSelectTarget) {
      this.renderTemplate(this.selectTarget.value);
    } else  if (this.userTypeValue) {
      this.renderTemplate(this.userTypeValue);
    } else {
      this.renderTemplate("self_applicant");
    }
  }

  changeTemplate(event) {
    const value = event.target.value;
    this.renderTemplate(value);
  }

  renderTemplate(templateName) {
    const template = document.getElementById(`${templateName}_template`);
    if (template && this.hasContainerTarget) {
      this.containerTarget.innerHTML = template.innerHTML;
    }
  }
}
