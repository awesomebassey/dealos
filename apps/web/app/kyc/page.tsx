import Link from "next/link";
import { Fingerprint, ArrowRight, Store } from "lucide-react";
import { api,currentUser,sentence } from "../../lib/api";
import { redirect } from "next/navigation";
type Evidence={id:string;category:string;status:string};
type Account={status:string;identityVerified:boolean;evidence:Evidence[]};
type Own={id:string;slug:string;name:string;status:string;
 verification?:{status:string;businessVerified:boolean;revenueVerified:boolean}|null};
export default async function Verification(){
 const user=await currentUser();
 if(user.role!=="BUYER"&&user.role!=="SELLER")redirect("/dashboard");
 const [account,listings]=await Promise.all([
   api<Account>("/kyc/me"),
   user.role==="SELLER"?api<Own[]>("/listings/mine"):Promise.resolve([]),
 ]);
 const pending=account.evidence.some(e=>e.category==="IDENTITY"&&e.status==="SUBMITTED");
 return <>
  <div className="page-head"><div><h1>Verification</h1>
    <p>Manage your identity and the records required for each business you sell.</p></div></div>
  <div className="grid three">
    <Link href="/kyc/identity" className="card card-pad" style={{display:"block"}}>
      <div className="feature-icon"><Fingerprint size={21}/></div>
      <h2 className="section-title" style={{marginTop:17}}>Personal identity</h2>
      <p className="muted">Review your account identity status and submitted documents.</p>
      <div className="list-row"><span className={`status ${account.identityVerified?"success":""}`}>
        {account.identityVerified?"Approved":pending?"In review":"Start verification"}</span><ArrowRight size={17}/></div>
    </Link>
    {user.role==="SELLER"&&<Link href="/my-listings/new" className="card card-pad" style={{display:"block"}}>
      <div className="feature-icon"><Store size={21}/></div>
      <h2 className="section-title" style={{marginTop:17}}>Verify another business</h2>
      <p className="muted">Each new listing has its own registration and revenue review.</p>
      <div className="list-row"><span className="text-link">Create business</span><ArrowRight size={17}/></div>
    </Link>}
  </div>
  {user.role==="SELLER"&&<section className="card" style={{marginTop:22}}>
    <div className="section-head"><h2 className="section-title">Your business reviews</h2><span className="muted">{listings.length} businesses</span></div>
    {listings.length?<div className="table-wrap"><table><thead><tr><th>Business</th><th>Registration</th><th>Revenue</th><th></th></tr></thead>
      <tbody>{listings.map(item=><tr key={item.id}><td><strong>{item.name}</strong></td>
       <td>{item.verification?.businessVerified?"Approved":"Pending"}</td>
       <td>{item.verification?.revenueVerified?"Approved":"Pending"}</td>
       <td><Link href={`/my-listings/${item.slug}/verification`} className="button secondary">Review business</Link></td>
      </tr>)}</tbody></table></div>:
      <div className="empty"><p>Your business reviews will appear after you create a listing.</p></div>}
  </section>}
 </>;
}
