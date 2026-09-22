import { randomBytes, scrypt } from "node:crypto";
import { PrismaClient, UserRole, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function required(name) {
  const value=process.env[name]?.trim();
  if(!value) throw new Error(`${name} must be configured`);
  return value;
}
function derive(password,salt) {
  return new Promise((resolve,reject)=>{
    scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(error,key)=>{
      if(error)reject(error);else resolve(key);
    });
  });
}
async function main() {
  if(process.env.DEALOS_BOOTSTRAP_REVIEWER!=="true") {
    throw new Error("Reviewer bootstrap is disabled. Explicitly set DEALOS_BOOTSTRAP_REVIEWER=true for this one-time operation.");
  }
  const connectionString=required("DATABASE_URL");
  const name=required("DEALOS_REVIEWER_NAME");
  const email=required("DEALOS_REVIEWER_EMAIL").toLowerCase();
  const password=process.env.DEALOS_REVIEWER_PASSWORD||"";
  if(name.length<2 || name.length>100) throw new Error("Reviewer name must contain 2 to 100 characters");
  if(email.length>254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("Set a valid reviewer email address");
  }
  if(password.length<12 || password.length>128) throw new Error("Reviewer password must contain 12 to 128 characters");
  const salt=randomBytes(16);
  const hash=await derive(password,salt);
  const passwordHash=["scrypt",32768,8,1,salt.toString("base64url"),hash.toString("base64url")].join("$");
  const prisma=new PrismaClient({adapter:new PrismaPg({connectionString})});
  try {
    const created=await prisma.$transaction(async tx=>{
      const existing=await tx.user.findFirst({where:{role:{in:[UserRole.ADVISOR,UserRole.ADMIN]}},select:{id:true}});
      if(existing) throw new Error("A reviewer already exists. Bootstrap is only available for the first reviewer.");
      const sameEmail=await tx.user.findUnique({where:{email},select:{id:true}});
      if(sameEmail) throw new Error("This email already belongs to an account. Existing accounts cannot be promoted by bootstrap.");
      return tx.user.create({
        data:{name,email,passwordHash,role:UserRole.ADVISOR},
        select:{id:true,email:true},
      });
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    process.stdout.write(`Reviewer account created: ${created.email}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error=>{
  process.stderr.write((error instanceof Error?error.message:"Reviewer creation failed")+"\n");
  process.exitCode=1;
});
