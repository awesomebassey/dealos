import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { serialize } from "../common/serialize";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma:PrismaService) {}

  async list(userId:string,pageInput?:string){
    const page=Math.min(1000,Math.max(1,Number(pageInput)||1));
    const take=20;
    const where={recipientId:userId};
    const [items,total,unread]=await this.prisma.$transaction([
      this.prisma.notification.findMany({where,orderBy:[{createdAt:"desc"},{id:"desc"}],
        skip:(page-1)*take,take,
        select:{id:true,title:true,description:true,href:true,readAt:true,createdAt:true}}),
      this.prisma.notification.count({where}),
      this.prisma.notification.count({where:{recipientId:userId,readAt:null}}),
    ]);
    return serialize({items,total,unread,page,pages:Math.ceil(total/take)});
  }

  async read(userId:string,id:string){
    const result=await this.prisma.notification.updateMany({
      where:{id,recipientId:userId,readAt:null},data:{readAt:new Date()},
    });
    return {ok:true,updated:result.count};
  }

  async readAll(userId:string){
    const result=await this.prisma.notification.updateMany({
      where:{recipientId:userId,readAt:null},data:{readAt:new Date()},
    });
    return {ok:true,updated:result.count};
  }
}
