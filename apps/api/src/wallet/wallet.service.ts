import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { User, UserRole, WalletDirection, WalletTxType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { walletTopupSchema } from "@dealos/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { serialize } from "../common/serialize";
@Injectable()
export class WalletService {
  constructor(private readonly prisma:PrismaService){}
  async get(actor:User){
    if(!(actor.role === UserRole.BUYER || actor.role === UserRole.SELLER)) throw new ForbiddenException("Buyer or seller account required");
    await this.prisma.walletAccount.createMany({
      data:[{userId:actor.id}],skipDuplicates:true,
    });
    const wallet=await this.prisma.walletAccount.findUniqueOrThrow({where:{userId:actor.id}});
    return serialize(await this.prisma.walletAccount.findUniqueOrThrow({
      where:{id:wallet.id},include:{transactions:{orderBy:{createdAt:"desc"},take:30,include:{deal:{select:{ref:true,listing:{select:{name:true}}}}}}},
    }));
  }
  async topup(actor:User,body:unknown,idempotencyKey?:string){
    if(actor.role!==UserRole.BUYER) throw new ForbiddenException("Demo top-ups are available to buyers");
    if(!idempotencyKey || idempotencyKey.length>120) throw new ConflictException("Valid Idempotency-Key header required");
    if(process.env.DEALOS_DEMO_FINANCE_ENABLED==="false") throw new ForbiddenException("Simulated funding is disabled");
    const input=walletTopupSchema.parse(body);
    const amountMinor=BigInt(input.amountNaira)*100n;
    return serialize(await this.prisma.$transaction(async tx=>{
      // INSERT ... ON CONFLICT DO NOTHING is safe when separate requests
      // try to create the same wallet concurrently. Prisma upsert can race.
      await tx.walletAccount.createMany({
        data:[{userId:actor.id}],skipDuplicates:true,
      });
      const wallet=await tx.walletAccount.findUniqueOrThrow({where:{userId:actor.id}});
      // Serialize updates to one demo wallet. Two requests with the same key share the first result.
      await tx.$queryRaw`SELECT "id" FROM "WalletAccount" WHERE "id" = ${wallet.id} FOR UPDATE`;
      const prior=await tx.walletTransaction.findUnique({where:{walletId_idempotencyKey:{walletId:wallet.id,idempotencyKey}}});
      if(prior){
        if(prior.amountMinor!==amountMinor || prior.type!==WalletTxType.DEMO_TOPUP) throw new ConflictException("Idempotency key reused with a different amount");
        return prior;
      }
      const transaction=await tx.walletTransaction.create({data:{
        walletId:wallet.id,direction:WalletDirection.CREDIT,type:WalletTxType.DEMO_TOPUP,
        amountMinor,idempotencyKey,
      }});
      await tx.walletAccount.update({where:{id:wallet.id},data:{balanceMinor:{increment:amountMinor}}});
      await tx.auditEvent.create({data:{actorId:actor.id,resourceType:"DEMO_WALLET",resourceId:wallet.id,action:"DEMO_WALLET_FUNDED",metadata:{amountMinor:amountMinor.toString()},correlationId:randomUUID()}});
      return transaction;
    }));
  }
}
