import { Module } from "@nestjs/common";
import { ListingVerificationController } from "./listing-verification.controller";
import { ListingVerificationService } from "./listing-verification.service";
@Module({controllers:[ListingVerificationController],providers:[ListingVerificationService]})
export class ListingVerificationModule {}
