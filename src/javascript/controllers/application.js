import { Application } from "@hotwired/stimulus"
import Rails from '@rails/ujs';
import jquery from 'jquery'

const application = Application.start()
Rails.start();

// Configure Stimulus development experience
application.debug = false

window.Stimulus  = application

window.jQuery = jquery
window.$ = jquery

export { application }
