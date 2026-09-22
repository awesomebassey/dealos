import { ServiceUnavailableException } from "@nestjs/common";

function mailConfig(){
  const apiKey=process.env.RESEND_API_KEY?.trim();
  const from=process.env.AUTH_FROM_EMAIL?.trim();
  const publicUrl=process.env.AUTH_PUBLIC_URL?.trim();
  if(!apiKey || !from || !publicUrl){
    throw new ServiceUnavailableException("Password recovery email is not configured");
  }
  let origin:URL;
  try{origin=new URL(publicUrl);}catch{
    throw new ServiceUnavailableException("Password recovery URL is invalid");
  }
  if(process.env.NODE_ENV==="production" && origin.protocol!=="https:"){
    throw new ServiceUnavailableException("Password recovery requires an HTTPS public URL");
  }
  if(!["https:","http:"].includes(origin.protocol)){
    throw new ServiceUnavailableException("Password recovery URL is invalid");
  }
  return {apiKey,from,origin};
}

export function assertPasswordRecoveryAvailable(){
  if(process.env.NODE_ENV==="production")mailConfig();
}

export async function deliverResetLink(email:string,token:string){
  const {apiKey,from,origin}=mailConfig();
  const url=new URL("/reset-password",origin);
  url.searchParams.set("token",token);
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      from,to:[email],subject:"Reset your DealOS password",
      text:`A password reset was requested for your DealOS account.\\n\\nOpen this link within 30 minutes:\\n${url.toString()}\\n\\nIf you did not request this, you can ignore this message.`,
    }),
    signal:AbortSignal.timeout(10_000),
  });
  if(!response.ok)throw new ServiceUnavailableException("Unable to send password recovery email");
}
