import assert from "node:assert/strict"
import test from "node:test"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { resolveFormFile } from "../server/form_path.js"

const forms = join(dirname(fileURLToPath(import.meta.url)), "..", "forms")

test("extensionless form paths resolve only when the form exists", () => {
  assert.equal(resolveFormFile("/forms/A-BA001/", forms), join(forms, "A-BA001.html"))
  assert.equal(resolveFormFile("/forms/tfac-68-001-1", forms), join(forms, "tfac-68-001-1.html"))
  assert.equal(resolveFormFile("/forms/not-found/", forms), undefined)
  assert.equal(resolveFormFile("/forms/../index", forms), undefined)
})
