import { spawn } from "node:child_process"

const children = ["dev:api", "dev:web"].map((script) =>
  spawn("yarn", [script], { stdio: "inherit", env: process.env })
)

const exits = children.map((child) =>
  new Promise((resolve) => child.once("exit", (exitCode) => resolve([exitCode ?? 1, "SIGTERM"])))
)
const signal = new Promise((resolve) => {
  process.once("SIGINT", () => resolve([130, "SIGINT"]))
  process.once("SIGTERM", () => resolve([143, "SIGTERM"]))
})

const [code, shutdownSignal] = await Promise.race([...exits, signal])
children.forEach((child) => {
  if (child.exitCode === null) child.kill(shutdownSignal)
})
await Promise.all(exits)
process.exit(code)
