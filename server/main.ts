import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { NestExpressApplication } from "@nestjs/platform-express"
import type { NextFunction, Request, Response } from "express"
import { join } from "node:path"
import { AppModule } from "./app.module.js"
import { resolveFormFile } from "./form_path.js"

const app = await NestFactory.create<NestExpressApplication>(AppModule)
const dist = join(process.cwd(), "dist")
app.useStaticAssets(dist, { index: false })
app.use((request: Request, response: Response, next: NextFunction) => {
  if (request.method !== "GET" || request.path.startsWith("/api/") || request.path.startsWith("/bizportal/")) return next()
  const formFile = resolveFormFile(request.path, join(dist, "forms"))
  if (formFile) return response.sendFile(formFile)
  response.status(404).sendFile(join(dist, "index.html"))
})
app.enableShutdownHooks()
await app.listen(Number(process.env.PORT || 3000), process.env.HOST || "127.0.0.1")
