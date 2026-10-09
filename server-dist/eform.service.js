var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { BadGatewayException, BadRequestException, HttpException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { IncomingMessage } from "node:http";
import { resolve } from "node:path";
const env = (name, legacyName) => process.env[name] || (legacyName ? process.env[legacyName] : undefined);
export const loadConfig = () => {
    const config = {
        callbackUrl: env("FORM_CALLBACK_URL"),
        qSecretIv: env("Q_SECRET_IV"),
        qSecretKey: env("Q_SECRET_KEY"),
        upstreamUrl: env("BIZPORTAL_URL", "VITE_BIZPORTAL_API_URL")?.replace(/\/$/, "")
    };
    const missing = Object.entries(config)
        .filter(([key, value]) => key !== "callbackUrl" && (value === undefined || value === ""))
        .map(([key]) => key);
    if (missing.length)
        throw new Error(`Missing environment: ${missing.join(", ")}`);
    if (!/^[0-9a-f]{64}$/i.test(config.qSecretKey))
        throw new Error("Q_SECRET_KEY must be 64 hex characters");
    if (!/^[0-9a-f]{32}$/i.test(config.qSecretIv))
        throw new Error("Q_SECRET_IV must be 32 hex characters");
    return config;
};
export const decryptQ = (q, config = loadConfig()) => {
    if (!q)
        throw new BadRequestException("Missing q");
    try {
        const normalized = (q.includes("%") ? decodeURIComponent(q) : q).replaceAll(" ", "+");
        const decipher = createDecipheriv("aes-256-cbc", Buffer.from(config.qSecretKey, "hex"), Buffer.from(config.qSecretIv, "hex"));
        const query = Buffer.concat([decipher.update(Buffer.from(normalized, "base64")), decipher.final()]).toString();
        const data = Object.fromEntries(query.split("&").map((part) => {
            const index = part.indexOf("=");
            return index < 0 ? [part, true] : [part.slice(0, index), part.slice(index + 1)];
        }));
        const result = {
            draftId: data.draftId || data.draft_id,
            identityId: data.identityid || data.identityId || data.identity_id,
            identityType: data.identitytype || data.identityType || data.identity_type,
            token: data.token
        };
        if (!result.identityId || !["Citizen", "Juristic"].includes(String(result.identityType)) || !result.token) {
            throw new Error("Invalid q payload");
        }
        return result;
    }
    catch (error) {
        if (error instanceof BadRequestException)
            throw error;
        throw new BadRequestException("Invalid q");
    }
};
let EformService = class EformService {
    config = loadConfig();
    discordWebhookUrl = env("DISCORD_WEBHOOK_URL");
    authSessions = new Map();
    formConfigs = this.loadFormConfigs();
    async bootstrap(formCode, q) {
        const form = this.formConfig(formCode);
        const { auth, session } = await this.authorize(form, q);
        const token = auth.token;
        const profilePath = session.identityType === "Citizen"
            ? `/bizportal/api/DataProvider/Profile/${encodeURIComponent(session.identityId)}`
            : `/bizportal/api/DataProvider/JuristicProfile/${encodeURIComponent(session.identityId)}`;
        const [profile, draft] = await Promise.all([
            this.json(profilePath, { token }),
            session.draftId
                ? this.json(`/bizportal/api/DataProvider/Draft/${encodeURIComponent(session.draftId)}`, {
                    token,
                    serviceNo: form.serviceNo,
                    serviceVersion: form.version
                })
                : null
        ]);
        return {
            config: {
                applicationId: form.applicationId,
                callbackUrl: this.config.callbackUrl,
                draftId: session.draftId,
                formCode: form.formCode,
                identityId: session.identityId,
                identityType: session.identityType,
                serviceNo: form.serviceNo,
                userId: auth.userId,
                version: form.version
            },
            draft,
            profile
        };
    }
    async createDraft(formCode, q, payload) {
        if (!payload || typeof payload !== "object")
            throw new BadRequestException("Missing payload");
        const form = this.formConfig(formCode);
        const { auth, session } = await this.authorize(form, q);
        return this.json("/bizportal/api/DataProvider/Draft", {
            body: {
                ...payload,
                applicationId: form.applicationId,
                identityId: session.identityId,
                data: {
                    ...payload.data,
                    cat: this.cat(auth.token)
                }
            },
            method: "POST",
            serviceNo: form.serviceNo,
            serviceVersion: form.version,
            token: auth.token
        });
    }
    async sendOtp(formCode, q) {
        const form = this.formConfig(formCode);
        const { auth, session } = await this.authorize(form, q);
        return this.json("/bizportal/api/SMS/OTP", {
            body: { identityId: session.identityId, type: 0 },
            method: "POST",
            token: auth.token
        });
    }
    async submit(formCode, q, otp, payload) {
        if (!otp)
            throw new BadRequestException("Missing otp");
        if (!payload || typeof payload !== "object")
            throw new BadRequestException("Missing payload");
        const form = this.formConfig(formCode);
        const { auth, session } = await this.authorize(form, q);
        const verification = await this.json("/bizportal/api/SMS/VerifyOTP", {
            body: { identityId: session.identityId, otp },
            method: "POST",
            token: auth.token
        });
        if (verification?.status !== 0 || !verification?.data?.isValid) {
            throw new BadRequestException(verification?.message || "รหัส OTP ของท่านไม่ถูกต้อง");
        }
        const body = {
            ...payload,
            applicationId: form.applicationId,
            identityId: session.identityId,
            identityType: session.identityType === "Citizen" ? 1 : 2,
            otp,
            data: {
                ...payload.data,
                AppData: {
                    ...payload.data?.AppData,
                    cat: this.cat(auth.token)
                }
            }
        };
        console.log("Create application payload:", body);
        const response = await this.json("/bizportal/api/ApplicationRequest/Create", {
            body,
            method: "POST",
            serviceNo: form.serviceNo,
            serviceVersion: form.version,
            token: auth.token
        });
        if (response?.status === 0) {
            await this.notifyDiscord(`ส่งคำขอสำเร็จ\nแบบฟอร์ม: ${form.formCode}\nเลขคำขอ: ${response.data?.requestId || "-"}`, body, response);
        }
        return response;
    }
    async upload(formCode, q, request) {
        await this.authorize(this.formConfig(formCode), q);
        return this.raw("/bizportal/api/file/upload", {
            body: request,
            contentType: request.headers["content-type"],
            method: "POST"
        });
    }
    async download(formCode, q, fileId, contentType) {
        const { auth } = await this.authorize(this.formConfig(formCode), q);
        const params = new URLSearchParams({ fileId });
        if (contentType)
            params.set("contentType", contentType);
        return this.raw(`/bizportal/api/File/Download?${params}`, { token: auth.token });
    }
    async deleteFile(formCode, q, fileId) {
        const { auth } = await this.authorize(this.formConfig(formCode), q);
        return this.json(`/bizportal/api/File/Delete?${new URLSearchParams({ fileId })}`, {
            method: "DELETE",
            token: auth.token
        });
    }
    async authorize(form, q) {
        const session = decryptQ(q, this.config);
        const key = this.authKey(JSON.stringify([
            form.formCode,
            session.identityId,
            session.identityType,
            session.token,
            session.draftId
        ]));
        const stored = this.authSessions.get(key);
        if (stored?.accessToken && stored.expiresAt && stored.expiresAt.getTime() > Date.now() + 30_000) {
            return { auth: { ...stored, token: stored.accessToken }, session };
        }
        if (stored?.refreshToken && stored.userId) {
            try {
                const refreshed = await this.refresh(stored.userId, stored.refreshToken);
                const auth = this.authFromResponse(refreshed);
                this.authSessions.set(key, auth);
                return { auth, session };
            }
            catch (error) {
                if (!(error instanceof UnauthorizedException))
                    throw error;
            }
        }
        const auth = this.authFromResponse(await this.login(form.applicationKey, session.token));
        this.authSessions.set(key, auth);
        return { auth, session };
    }
    formConfig(formCode) {
        const normalized = String(formCode || "").trim().toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(normalized)) {
            throw new BadRequestException("Invalid formCode");
        }
        const form = this.formConfigs.get(normalized);
        if (!form)
            throw new NotFoundException(`Unknown formCode: ${normalized}`);
        return form;
    }
    loadFormConfigs() {
        const file = resolve(env("FORM_CONFIG_FILE") || "form-configs.json");
        const values = JSON.parse(readFileSync(file, "utf8"));
        if (!Array.isArray(values) || values.length === 0)
            throw new Error(`Form config must be a non-empty array: ${file}`);
        return new Map(values.map((value, index) => {
            if (!value || typeof value !== "object" || Array.isArray(value))
                throw new Error(`Invalid form config: ${file}[${index}]`);
            const raw = value;
            const formCode = String(raw.formCode || "").trim().toUpperCase();
            const applicationId = Number(raw.applicationId);
            const applicationKey = typeof raw.applicationKey === "string" ? raw.applicationKey : "";
            const serviceNo = String(raw.serviceNo ?? "");
            const version = String(raw.version ?? "");
            if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(formCode)
                || raw.applicationId === null
                || raw.applicationId === ""
                || !Number.isFinite(applicationId)
                || !applicationKey
                || !version) {
                throw new Error(`Invalid form config: ${file}[${index}]`);
            }
            const config = { applicationId, applicationKey, formCode, serviceNo, version };
            return [formCode, config];
        }));
    }
    authKey(value) {
        return createHash("sha256").update(value).digest("hex");
    }
    login(applicationKey, token) {
        return this.json("/bizportal/api/Authenication/Login", {
            body: { applicationKey, token },
            contentType: "application/json-patch+json",
            method: "POST"
        });
    }
    refresh(userId, refreshToken) {
        return this.json("/bizportal/api/Authenication/Refresh", {
            body: { refreshToken, userId },
            contentType: "application/json-patch+json",
            method: "POST"
        });
    }
    authFromResponse(response) {
        const expiration = Number(response?.expiration);
        if (!response?.token || !Number.isFinite(expiration)) {
            throw new UnauthorizedException(response?.message || "Unauthorized");
        }
        return {
            accessToken: response.token,
            expiresAt: new Date(expiration * 1000),
            refreshToken: response.refreshToken,
            token: response.token,
            userId: response.userId
        };
    }
    cat(token) {
        return `${randomBytes(2).toString("hex")}${token}${randomBytes(2).toString("hex")}`;
    }
    async json(path, options = {}) {
        const response = await this.raw(path, options);
        const text = await response.text();
        if (!text)
            return {};
        try {
            return JSON.parse(text);
        }
        catch {
            throw new BadGatewayException("BizPortal returned invalid JSON");
        }
    }
    async notifyDiscord(content, payload, responseBody) {
        if (!this.discordWebhookUrl)
            return;
        try {
            const body = new FormData();
            body.append("payload_json", JSON.stringify({
                allowed_mentions: { parse: [] },
                attachments: [
                    { id: 0, filename: "payload.json" },
                    { id: 1, filename: "response.json" }
                ],
                content
            }));
            body.append("files[0]", new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "payload.json");
            body.append("files[1]", new Blob([JSON.stringify(responseBody, null, 2)], { type: "application/json" }), "response.json");
            const response = await fetch(this.discordWebhookUrl, {
                body,
                method: "POST"
            });
            if (!response.ok)
                console.error(`Discord webhook HTTP ${response.status}`);
        }
        catch (error) {
            console.error("Discord webhook failed:", error);
        }
    }
    async raw(path, options = {}) {
        const headers = new Headers();
        if (options.contentType)
            headers.set("Content-Type", options.contentType);
        else if (options.body && !(options.body instanceof IncomingMessage))
            headers.set("Content-Type", "application/json");
        if (options.token)
            headers.set("Authorization", `Bearer ${options.token}`);
        if (options.serviceVersion) {
            headers.set("x-version", options.serviceVersion);
            headers.set("x-serviceno", options.serviceNo || "");
        }
        try {
            const response = await fetch(`${this.config.upstreamUrl}${path}`, {
                body: options.body instanceof IncomingMessage ? options.body : options.body ? JSON.stringify(options.body) : undefined,
                duplex: options.body instanceof IncomingMessage ? "half" : undefined,
                headers,
                method: options.method || "GET"
            });
            if (!response.ok) {
                const body = await response.text();
                let message = body;
                try {
                    const json = JSON.parse(body);
                    message = json.message || json.errorMessage || json.title || body;
                }
                catch { }
                if (response.status === 401)
                    throw new UnauthorizedException(message || "Unauthorized");
                throw new BadGatewayException(message || `BizPortal HTTP ${response.status}`);
            }
            return response;
        }
        catch (error) {
            if (error instanceof HttpException)
                throw error;
            throw new ServiceUnavailableException("ไม่สามารถเชื่อมต่อ BizPortal ได้ กรุณาลองใหม่อีกครั้ง");
        }
    }
};
EformService = __decorate([
    Injectable()
], EformService);
export { EformService };
