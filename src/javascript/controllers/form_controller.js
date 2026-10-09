import NestedForm from 'stimulus-rails-nested-form'
import { Turbo, cable } from "@hotwired/turbo-rails"

export default class extends NestedForm {
  static values = {
    slug: String
  }

  async connect() {
    super.connect()

    this.subscription = await cable.subscribeTo(this.formChannel, {
      received: this.dispatchMessageEvent.bind(this)
    })
  }

  get formChannel() {
    const channel = "FormChannel"
    const slug = this.slugValue

    return { channel, slug }
  }

  dispatchMessageEvent(data) {
    Turbo.renderStreamMessage(data)
  }

  disconnect() {
    if (this.subscription) this.subscription.unsubscribe()
  }
}
