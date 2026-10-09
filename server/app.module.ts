import { Module } from "@nestjs/common"
import { JuridController } from "./api/jurid/jurid.controller.js";
import { EformController } from "./eform.controller.js"
import { EformService } from "./eform.service.js"

@Module({
  controllers: [EformController,JuridController],
  providers: [EformService]
})
export class AppModule {}
