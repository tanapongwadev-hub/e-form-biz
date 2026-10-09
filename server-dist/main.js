import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { join } from "node:path";
import { AppModule } from "./app.module.js";
import { resolveFormFile } from "./form_path.js";
const app = await NestFactory.create(AppModule);
const dist = join(process.cwd(), "dist");
app.useStaticAssets(dist, { index: false });
app.use((request, response, next) => {
    if (request.method !== "GET" || request.path.startsWith("/api/") || request.path.startsWith("/bizportal/"))
        return next();
    const formFile = resolveFormFile(request.path, join(dist, "forms"));
    if (formFile)
        return response.sendFile(formFile);
    response.status(404).sendFile(join(dist, "index.html"));
});
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT || 3000), process.env.HOST || "127.0.0.1");
