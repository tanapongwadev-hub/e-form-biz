import { Datepicker } from 'stimulus-datepicker'
import IsoDate from './iso_date'
import moment from "moment"
export default class extends Datepicker {

  static values = {
    date:           String,
    min:            String,
    max:            String,
    format:         {type: String, default: '%-d %B %Y'},
    firstDayOfWeek: {type: Number, default: 1},
    dayNameLength:  {type: Number, default: 2},
    allowWeekends:  {type: Boolean, default: true},
    monthJump:      {type: String, default: 'dayOfMonth'},
    disallow:       Array,
    text:           Object
  }

  connect() {
    if (!this.hasHiddenTarget) this.addHiddenInput()

    this.addInputAction()
    this.addToggleAction()
    this.setToggleAriaLabel()

    this.buddhistYear = 543

    const currentYear = new Date().getFullYear()

    const dateFormat1 = /\d{4}-\d{2}-\d{2}/;
    const dateFormat2 = /\d{2}\/\d{2}\/\d{4}/;
    if (dateFormat1.test(this.inputTarget.value)) {
      const date = moment(this.inputTarget.value, "YYYY-MM-DD")
      let inputYear = date.year()
      while (inputYear > currentYear) {
        inputYear -= this.buddhistYear
      }
      this.dateValue = `${inputYear}-${date.format("MM-DD")}`
    } else if (dateFormat2.test(this.inputTarget.value)) {
      const date = moment(this.inputTarget.value, "DD/MM/YYYY")
      let inputYear = date.year()
      while (inputYear > currentYear) {
        inputYear -= this.buddhistYear
      }
      this.dateValue = `${inputYear}-${date.format("MM-DD")}`
    }

    this.inputTarget.classList.add('bg-white')

    if ((this.element.parentElement) && (this.element.parentElement.parentElement) && (this.element.parentElement.parentElement.classList.contains("d-none"))) {
      this.element.querySelectorAll("input").forEach((targetInnerElement) => {
        targetInnerElement.setAttribute("disabled", true);
      });
    }
  }

  yearOptions(selected) {
    const years = []
    const extent = 100

    for (let y = selected - extent; y <= selected + extent; y++) years.push(y)

    return years
      .map(year => `<option ${year == selected ? 'selected' : ''} value="${year}">${year + this.buddhistYear}</option>`)
      .join('')
  }

  toggle(event) {
    event.preventDefault()
    event.stopPropagation()
    if (event.type == 'keydown' && ![' ', 'Enter'].includes(event.key)) return
    this.hasCalendarTarget ? this.close(true) : this.open(true)
  }

  addToggleAction() {
    if (!this.hasToggleTarget) return

    let action = 'click->datepicker#toggle'
    if (!(this.toggleTarget instanceof HTMLButtonElement)) action += ' keydown->datepicker#toggle'

    this.addAction(this.toggleTarget, action)
  }

  addAction(element, action) {
    if (element.dataset.action == "click->datepicker#toggle keydown->datepicker#toggle") {
      return
    }

    if (('action') in element.dataset) {
      element.dataset.action += ` ${action}`
    } else {
      element.dataset.action = action
    }
  }

  localisedMonth(month, monthFormat) {
    // Use the middle of the month to avoid timezone edge cases
    return new Date(`2022-${month}-15`).toLocaleString('th', {month: monthFormat})
  }

  monthNames(format) {
    const formatter = new Intl.DateTimeFormat('th', {month: format})
    return ['01','02','03','04','05','06','07','08','09','10','11','12'].map(mm =>
      // Use the middle of the month to avoid timezone edge cases
      formatter.format(new Date(`2022-${mm}-15`))
    )
  }

  addHiddenInput() {
    this.inputTarget.insertAdjacentHTML('afterend', `
      <input type="hidden"
             name="${this.inputTarget.getAttribute('name')}"
             disabled="true"
             data-datepicker-target="hidden"/>
    `)
  }

  dayNames(format) {
    const formatter = new Intl.DateTimeFormat('th', {weekday: "short"})
    const names = []
    // Ensure date in month is two digits. 2022-04-10 is a Sunday
    for (let i = this.firstDayOfWeekValue + 10, n = i + 7; i < n; i++) {
      names.push(formatter.format(new Date(`2022-04-${i}T00:00:00+00:00`)))
    }
    return names
  }

  format(str) {
    if (!IsoDate.isValidStr(str)) return ''

    const [yyyy, mm, dd] = str.split('-')

    return this.formatValue
      .replace('%d',  dd)
      .replace('%-d', +dd)
      .replace('%m',  this.zeroPad(mm))
      .replace('%-m', +mm)
      .replace('%B',  this.localisedMonth(mm, 'long'))
      .replace('%b',  this.localisedMonth(mm, 'short'))
      .replace('%Y',  +yyyy + this.buddhistYear)
      .replace('%y',  (+yyyy + this.buddhistYear) % 100)
  }
}
