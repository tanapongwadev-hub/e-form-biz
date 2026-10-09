import assert from "node:assert/strict"
import { createCipheriv } from "node:crypto"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { IncomingMessage } from "node:http"
import { Socket } from "node:net"
import { join } from "node:path"
import { tmpdir } from "node:os"
import test, { after } from "node:test"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "../server/app.module.js"
import { EformController } from "../server/eform.controller.js"
import { decryptQ, EformService } from "../server/eform.service.js"

const config = {
  applicationId: "734",
  applicationKey: "application-key",
  callbackUrl: "https://callback.test/complete",
  serviceNo: "service-no",
  upstreamUrl: "https://bizportal.test",
  version: "1",
  qSecretKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  qSecretIv: "0123456789abcdef0123456789abcdef"
}
const formCode = "A-BA001"
const configDirectory = mkdtempSync(join(tmpdir(), "eform-standalone-config-"))
let configSequence = 0

after(() => {
  rmSync(configDirectory, { force: true, recursive: true })
})

Object.assign(process.env, {
  BIZPORTAL_URL: config.upstreamUrl,
  DISCORD_WEBHOOK_URL: "https://discord.test/api/webhooks/1/token",
  Q_SECRET_KEY: config.qSecretKey,
  Q_SECRET_IV: config.qSecretIv,
  FORM_CALLBACK_URL: config.callbackUrl
})

const defaultForm = {
  applicationId: config.applicationId,
  applicationKey: config.applicationKey,
  formCode,
  serviceNo: config.serviceNo,
  version: config.version
}

const serviceFor = (forms = [defaultForm]) => {
  const file = join(configDirectory, `${++configSequence}.json`)
  writeFileSync(file, JSON.stringify(forms))
  process.env.FORM_CONFIG_FILE = file
  return new EformService()
}

const freshService = () => serviceFor()

process.env.FORM_CONFIG_FILE = join(configDirectory, "default.json")
writeFileSync(process.env.FORM_CONFIG_FILE, JSON.stringify([defaultForm]))

const encryptQ = (query: string) => {
  const cipher = createCipheriv(
    "aes-256-cbc",
    Buffer.from(config.qSecretKey, "hex"),
    Buffer.from(config.qSecretIv, "hex")
  )
  return Buffer.concat([cipher.update(query), cipher.final()]).toString("base64")
}

const q = encryptQ(
  "identityid=1234567890123&identitytype=Citizen&token=q-token&draftId=draft-1&AppKey=ignored-q-app-key"
)

test("NestJS ignores AppKey from q", () => {
  assert.deepEqual(decryptQ(q), {
    draftId: "draft-1",
    identityId: "1234567890123",
    identityType: "Citizen",
    token: "q-token"
  })
})

test("NestJS injects EformService through the app module", async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false })
  try {
    assert.ok(app.get(EformController))
    assert.ok(app.get(EformService))
  } finally {
    await app.close()
  }
})

test("in-memory auth store carries bootstrap through draft, OTP, and create", async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ body?: any; headers: Headers; path: string }> = []

  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(String(url)).pathname
    const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body
    const headers = new Headers(options.headers)
    calls.push({ body, headers, path })

    const data = path.endsWith("/Authenication/Login")
      ? {
          expiration: Math.floor(Date.now() / 1000) + 600,
          refreshToken: "refresh-token",
          token: "access-token",
          userId: "user-1"
        }
      : path.includes("/Profile/")
        ? { data: { Applicant: { FirstName: "Ada" } } }
        : path.includes("/Draft/")
          ? { data: { data: { FormValue: "draft" } } }
          : path.endsWith("/VerifyOTP")
            ? { status: 0, data: { isValid: true } }
            : path.endsWith("/ApplicationRequest/Create")
              ? { status: 0, data: { requestId: "request-1" } }
              : { status: 0, data: { ref: "OTP1" } }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })
  }

  try {
    const service = freshService()
    const bootstrap = await service.bootstrap(formCode, q)
    assert.equal(bootstrap.config.callbackUrl, config.callbackUrl)
    assert.equal(bootstrap.config.identityId, "1234567890123")
    assert.equal(bootstrap.config.userId, "user-1")
    assert.equal(bootstrap.draft.data.data.FormValue, "draft")
    assert.equal(calls[0].body.applicationKey, "application-key")

    await service.createDraft(formCode, q, { data: { FormValue: "draft-submit" } })
    const draft = calls.find((call) => call.path.endsWith("/DataProvider/Draft"))
    assert.ok(draft)
    assert.equal(draft.body.data.FormValue, "draft-submit")
    assert.match(draft.body.data.cat, /^[0-9a-f]{4}access-token[0-9a-f]{4}$/)
    assert.equal(draft.headers.get("x-version"), "1")
    assert.equal(draft.headers.get("x-serviceno"), "service-no")

    const response = await service.submit(formCode, q, "123456", {
      applicationId: 999,
      data: { AppData: { ok: true } }
    })
    assert.equal(response.data.requestId, "request-1")

    const create = calls.find((call) => call.path.endsWith("/ApplicationRequest/Create"))
    assert.ok(create)
    assert.equal(create.body.applicationId, 734)
    assert.equal(create.body.identityId, "1234567890123")
    assert.equal(create.body.otp, "123456")
    assert.equal(create.body.data.AppData.ok, true)
    assert.match(create.body.data.AppData.cat, /^[0-9a-f]{4}access-token[0-9a-f]{4}$/)
    assert.equal(create.headers.get("authorization"), "Bearer access-token")
    assert.equal(create.headers.get("x-version"), "1")
    assert.equal(create.headers.get("x-serviceno"), "service-no")
    assert.equal(calls.filter((call) => call.path.endsWith("/Authenication/Login")).length, 1)

    const verifyIndex = calls.findIndex((call) => call.path.endsWith("/VerifyOTP"))
    const createIndex = calls.findIndex((call) => call.path.endsWith("/ApplicationRequest/Create"))
    assert.ok(verifyIndex >= 0 && createIndex > verifyIndex)

    const discord = calls.find((call) => call.path === "/api/webhooks/1/token")
    assert.ok(discord?.body instanceof FormData)
    assert.deepEqual(JSON.parse(String(discord.body.get("payload_json"))), {
      allowed_mentions: { parse: [] },
      attachments: [
        { id: 0, filename: "payload.json" },
        { id: 1, filename: "response.json" }
      ],
      content: "ส่งคำขอสำเร็จ\nแบบฟอร์ม: A-BA001\nเลขคำขอ: request-1"
    })
    assert.deepEqual(JSON.parse(await (discord.body.get("files[0]") as Blob).text()), create.body)
    assert.deepEqual(JSON.parse(await (discord.body.get("files[1]") as Blob).text()), response)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("expired in-memory auth refreshes before loading profile", async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ headers: Headers; path: string }> = []

  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(String(url)).pathname
    calls.push({ headers: new Headers(options.headers), path })

    const data = path.endsWith("/Authenication/Login")
      ? {
          expiration: Math.floor(Date.now() / 1000) - 60,
          refreshToken: "stored-refresh-token",
          token: "expired-token",
          userId: "user-1"
        }
      : path.endsWith("/Authenication/Refresh")
        ? {
            expiration: Math.floor(Date.now() / 1000) + 600,
            refreshToken: "new-refresh-token",
            token: "new-access-token",
            userId: "user-1"
          }
        : path.includes("/Draft/")
          ? { data: { data: {} } }
          : { data: {} }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })
  }

  try {
    const service = freshService()
    await service.bootstrap(formCode, q)
    calls.length = 0

    await service.bootstrap(formCode, q)
    assert.equal(calls[0].path, "/bizportal/api/Authenication/Refresh")
    assert.ok(!calls.some((call) => call.path.endsWith("/Authenication/Login")))
    assert.ok(
      calls
        .filter((call) => call.path.includes("/Profile/") || call.path.includes("/Draft/"))
        .every((call) => call.headers.get("authorization") === "Bearer new-access-token")
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("file upload authorizes q before streaming multipart data", async () => {
  const originalFetch = globalThis.fetch
  let loginCalls = 0
  const request = new IncomingMessage(new Socket())
  request.headers = { "content-type": "multipart/form-data; boundary=test" }
  request.push("multipart-body")
  request.push(null)

  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(String(url)).pathname
    if (path.endsWith("/Authenication/Login")) {
      loginCalls += 1
      return new Response(JSON.stringify({
        expiration: Math.floor(Date.now() / 1000) + 600,
        refreshToken: "refresh-token",
        token: "access-token",
        userId: "user-1"
      }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      })
    }

    assert.equal(path, "/bizportal/api/file/upload")
    assert.equal(options.body, request)
    assert.equal((options as RequestInit & { duplex?: string }).duplex, "half")
    assert.equal(new Headers(options.headers).get("content-type"), "multipart/form-data; boundary=test")
    return new Response(JSON.stringify({ fileId: "file-1" }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })
  }

  try {
    const response = await freshService().upload(formCode, q, request)
    assert.equal(loginCalls, 1)
    assert.deepEqual(await response.json(), { fileId: "file-1" })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("in-memory auth sessions reset between EformService instances", async () => {
  const originalFetch = globalThis.fetch
  let loginCalls = 0
  let refreshCalls = 0

  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(String(url)).pathname
    const headers = new Headers(options.headers)
    const data = path.endsWith("/Authenication/Login")
      ? (loginCalls += 1, {
          expiration: Math.floor(Date.now() / 1000) - 60,
          refreshToken: "persisted-refresh-token",
          token: "expired-access-token",
          userId: "user-1"
        })
      : path.endsWith("/Authenication/Refresh")
        ? (refreshCalls += 1, {
            expiration: Math.floor(Date.now() / 1000) + 600,
            refreshToken: "new-refresh-token",
            token: "new-access-token",
            userId: "user-1"
          })
        : { data: {} }

    if (path.includes("/Profile/") && refreshCalls) {
      assert.equal(headers.get("authorization"), "Bearer new-access-token")
    }
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })
  }

  try {
    await freshService().bootstrap(formCode, q)
    await freshService().bootstrap(formCode, q)
    assert.equal(loginCalls, 2)
    assert.equal(refreshCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("JSON form configs keep credentials and auth sessions separate per form", async () => {
  const originalFetch = globalThis.fetch
  const loginKeys: string[] = []
  const calls: Array<{ authorization: string | null; path: string; serviceNo: string | null }> = []

  const service = serviceFor([defaultForm, {
    applicationId: "812",
    applicationKey: "application-key-b",
    formCode: "A-BA002",
    serviceNo: "service-b",
    version: "3"
  }])

  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(String(url)).pathname
    const headers = new Headers(options.headers)
    calls.push({
      authorization: headers.get("authorization"),
      path,
      serviceNo: headers.get("x-serviceno")
    })
    if (path.endsWith("/Authenication/Login")) {
      const applicationKey = JSON.parse(String(options.body)).applicationKey
      loginKeys.push(applicationKey)
      return new Response(JSON.stringify({
        expiration: Math.floor(Date.now() / 1000) + 600,
        refreshToken: `refresh-${applicationKey}`,
        token: `access-${applicationKey}`,
        userId: "user-1"
      }), { headers: { "Content-Type": "application/json" }, status: 200 })
    }
    return new Response(JSON.stringify({ data: {} }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })
  }

  try {
    const bootstrapA = await service.bootstrap("A-BA001", q)
    const bootstrapB = await service.bootstrap("A-BA002", q)

    assert.equal(bootstrapA.config.applicationId, 734)
    assert.equal(bootstrapB.config.applicationId, 812)
    assert.deepEqual(loginKeys, ["application-key", "application-key-b"])
    assert.ok(calls.some((call) =>
      call.authorization === "Bearer access-application-key" && call.serviceNo === "service-no"
    ))
    assert.ok(calls.some((call) =>
      call.authorization === "Bearer access-application-key-b" && call.serviceNo === "service-b"
    ))
  } finally {
    globalThis.fetch = originalFetch
  }
})
