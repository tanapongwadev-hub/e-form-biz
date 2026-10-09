import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Req, Res } from "@nestjs/common"
import type { Request, Response } from "express"
import { EformService } from "./eform.service.js"

@Controller()
export class EformController {
  constructor(@Inject(EformService) private readonly eform: EformService) {}

  @Get("api/health")
  health() {
    return { ok: true }
  }

  @Post("api/eform/bootstrap")
  bootstrap(@Body("formCode") formCode: string, @Body("q") q: string) {
    return this.eform.bootstrap(formCode, q)
  }

  @Post("api/eform/draft")
  createDraft(
    @Body("formCode") formCode: string,
    @Body("q") q: string,
    @Body("payload") payload: Record<string, any>
  ) {
    return this.eform.createDraft(formCode, q, payload)
  }

  @Post("api/eform/send-otp")
  sendOtp(@Body("formCode") formCode: string, @Body("q") q: string) {
    return this.eform.sendOtp(formCode, q)
  }

  @Post("api/eform/submit")
  submit(
    @Body("formCode") formCode: string,
    @Body("q") q: string,
    @Body("otp") otp: string,
    @Body("payload") payload: Record<string, any>
  ) {
    return this.eform.submit(formCode, q, otp, payload)
  }

  @Post("bizportal/api/file/upload")
  async upload(
    @Query("formCode") formCode: string,
    @Query("q") q: string,
    @Req() request: Request,
    @Res() response: Response
  ) {
    const upstream = await this.eform.upload(formCode, q, request)
    response.status(upstream.status)
    upstream.headers.forEach((value, key) => response.setHeader(key, value))
    response.send(Buffer.from(await upstream.arrayBuffer()))
  }

  @Get("api/eform/files/:id")
  async download(
    @Param("id") id: string,
    @Query("formCode") formCode: string,
    @Query("q") q: string,
    @Query("contentType") contentType: string | undefined,
    @Res() response: Response
  ) {
    const upstream = await this.eform.download(formCode, q, id, contentType)
    response.status(upstream.status)
    response.setHeader("Content-Type", upstream.headers.get("content-type") || contentType || "application/octet-stream")
    response.send(Buffer.from(await upstream.arrayBuffer()))
  }

  @Delete("api/eform/files/:id")
  deleteFile(@Param("id") id: string, @Query("formCode") formCode: string, @Query("q") q: string) {
    return this.eform.deleteFile(formCode, q, id)
  }
}
