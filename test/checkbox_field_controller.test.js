import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("checkbox selectors sync when controllers connect", () => {
  for (const path of [
    "../src/javascript/controllers/checkbox_field_controller.js",
    "../../app/javascript/controllers/checkbox_field_controller.js"
  ]) {
    const controller = readFileSync(new URL(path, import.meta.url), "utf8")
    const connect = controller.match(/connect\(\) \{([\s\S]*?)\n  \}\n\n  disconnect\(\)/)?.[1]

    assert.ok(connect)
    assert.match(connect, /this\.triggerChange\(\)/)
  }
})

test("standalone checkbox selectors resync after form hydration", () => {
  const controller = readFileSync(
    new URL("../src/javascript/controllers/checkbox_field_controller.js", import.meta.url),
    "utf8"
  )

  assert.match(controller, /document\.addEventListener\('bizportal:profile-loaded'/)
})
