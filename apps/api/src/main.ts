import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app=await NestFactory.create(AppModule,{cors:false});
  app.useBodyParser("json",{limit:"6mb"});
  app.enableCors({origin:process.env.CORS_ORIGIN??"http://localhost:3000",credentials:true});
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_PORT??4000));
}
bootstrap();
