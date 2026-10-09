import assert from "node:assert/strict"
import test from "node:test"
import { installApiLoading } from "../src/javascript/components/api_loading.js"

test("API loading covers concurrent fetch and XMLHttpRequest calls", async () => {
  const body = {
    attributes: new Set(),
    children: [],
    append(element) { this.children.push(element) },
    setAttribute(name) { this.attributes.add(name) },
    removeAttribute(name) { this.attributes.delete(name) }
  }
  const document = {
    body,
    createElement: () => ({ hidden: true, setAttribute() {} })
  }
  const fetchResolvers = []
  class XMLHttpRequest extends EventTarget {
    send() {}
  }
  const window = {
    fetch: () => new Promise((resolve) => fetchResolvers.push(resolve)),
    XMLHttpRequest
  }

  installApiLoading(window, document)

  const first = window.fetch("/first")
  const second = window.fetch("/second")
  const overlay = body.children[0]
  assert.equal(overlay.hidden, false)
  assert.equal(body.attributes.has("aria-busy"), true)

  fetchResolvers.shift()()
  await first
  assert.equal(overlay.hidden, false)

  fetchResolvers.shift()()
  await second
  assert.equal(overlay.hidden, true)

  const xhr = new window.XMLHttpRequest()
  xhr.send()
  assert.equal(overlay.hidden, false)
  xhr.dispatchEvent(new Event("loadend"))
  assert.equal(overlay.hidden, true)
})
