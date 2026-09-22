import { Module } from "@nestjs/common";
import { DiligenceController } from "./diligence.controller";
import { DiligenceService } from "./diligence.service";

@Module({ controllers: [DiligenceController], providers: [DiligenceService] })
export class DiligenceModule {}
