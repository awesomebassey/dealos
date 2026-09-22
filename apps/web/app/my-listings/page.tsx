import Link from "next/link";
import { currentUser,api,money,sentence } from "../../lib/api";
import { redirect } from "next/navigation";
type Own={id:string;slug:string;name:string;category:string;status:string;askingPriceMinor:string;createdAt:string};
export default async function MyListings(){
  const user=await currentUser();
  if(user.role!=="SELLER") redirect("/dashboard");
  const items=await api<Own[]>("/listings/mine");
  return <>
    <div className="page-head"><div><h1>My businesses</h1><p>Create a business listing, prepare its confidential documents and manage buyer interest.</p></div>
      <Link href="/my-listings/new" className="button">List a business</Link></div>
    <section className="card">{items.length?<div className="table-wrap"><table><thead><tr><th>Business</th><th>Sector</th><th>Asking price</th><th>Availability</th><th></th></tr></thead><tbody>
      {items.map(item=><tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.category}</td><td>{money(item.askingPriceMinor)}</td>
      <td><span className="status active">{sentence(item.status)}</span></td><td><Link className="button secondary" href={`/my-listings/${item.slug}`}>Manage</Link></td></tr>)}</tbody></table></div>:
      <div className="empty"><h3>List your first business</h3><p>Complete account verification, create a listing and prepare the documents buyers need.</p>
        <Link href="/my-listings/new" className="button">Create listing</Link></div>}</section>
  </>;
}
