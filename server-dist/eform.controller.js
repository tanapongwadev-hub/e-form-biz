var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Req, Res } from "@nestjs/common";
import { EformService } from "./eform.service.js";
let EformController = class EformController {
    eform;
    constructor(eform) {
        this.eform = eform;
    }
    health() {
        return { ok: true };
    }
    bootstrap(formCode, q) {
        return this.eform.bootstrap(formCode, q);
    }
    createDraft(formCode, q, payload) {
        return this.eform.createDraft(formCode, q, payload);
    }
    sendOtp(formCode, q) {
        return this.eform.sendOtp(formCode, q);
    }
    submit(formCode, q, otp, payload) {
        return this.eform.submit(formCode, q, otp, payload);
    }
    async upload(formCode, q, request, response) {
        const upstream = await this.eform.upload(formCode, q, request);
        response.status(upstream.status);
        upstream.headers.forEach((value, key) => response.setHeader(key, value));
        response.send(Buffer.from(await upstream.arrayBuffer()));
    }
    async download(id, formCode, q, contentType, response) {
        const upstream = await this.eform.download(formCode, q, id, contentType);
        response.status(upstream.status);
        response.setHeader("Content-Type", upstream.headers.get("content-type") || contentType || "application/octet-stream");
        response.send(Buffer.from(await upstream.arrayBuffer()));
    }
    deleteFile(id, formCode, q) {
        return this.eform.deleteFile(formCode, q, id);
    }
};
__decorate([
    Get("api/health"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EformController.prototype, "health", null);
__decorate([
    Post("api/eform/bootstrap"),
    __param(0, Body("formCode")),
    __param(1, Body("q")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], EformController.prototype, "bootstrap", null);
__decorate([
    Post("api/eform/draft"),
    __param(0, Body("formCode")),
    __param(1, Body("q")),
    __param(2, Body("payload")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], EformController.prototype, "createDraft", null);
__decorate([
    Post("api/eform/send-otp"),
    __param(0, Body("formCode")),
    __param(1, Body("q")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], EformController.prototype, "sendOtp", null);
__decorate([
    Post("api/eform/submit"),
    __param(0, Body("formCode")),
    __param(1, Body("q")),
    __param(2, Body("otp")),
    __param(3, Body("payload")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], EformController.prototype, "submit", null);
__decorate([
    Post("bizportal/api/file/upload"),
    __param(0, Query("formCode")),
    __param(1, Query("q")),
    __param(2, Req()),
    __param(3, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], EformController.prototype, "upload", null);
__decorate([
    Get("api/eform/files/:id"),
    __param(0, Param("id")),
    __param(1, Query("formCode")),
    __param(2, Query("q")),
    __param(3, Query("contentType")),
    __param(4, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], EformController.prototype, "download", null);
__decorate([
    Delete("api/eform/files/:id"),
    __param(0, Param("id")),
    __param(1, Query("formCode")),
    __param(2, Query("q")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], EformController.prototype, "deleteFile", null);
EformController = __decorate([
    Controller(),
    __param(0, Inject(EformService)),
    __metadata("design:paramtypes", [EformService])
], EformController);
export { EformController };
