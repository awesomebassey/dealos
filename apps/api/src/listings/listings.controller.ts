import { Controller, Get, Param } from "@nestjs/common";
import { ListingsService } from "./listings.service";

@Controller("listings")
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  list() {
    return this.listings.list();
  }

  @Get(":slug")
  get(@Param("slug") slug: string) {
    return this.listings.get(slug);
  }
}
