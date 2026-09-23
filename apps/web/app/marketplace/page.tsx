import Link from "next/link";
import { ArrowRight, BadgeCheck, Search, Store } from "lucide-react";
import { money, publicApi } from "../../lib/api";
import { PublicFooter, PublicHeader } from "../../components/public-header";

type Listing={
  id:string;slug:string;name:string;category:string;askingPriceMinor:string;
  annualRevenueMinor:string;recurringRevenuePct:number;organization:{name:string};
};
type ListingPage={items:Listing[];total:number;page:number;pages:number;pageSize:number};
export default async function Marketplace({searchParams}:{
  searchParams:Promise<{page?:string;q?:string}>;
}) {
  const {page="1",q=""}=await searchParams;
  const query=new URLSearchParams({page:String(Math.max(1,Number(page)||1))});
  if(q.trim()) query.set("q",q.trim().slice(0,80));
  const result=await publicApi<ListingPage>(`/listings?${query.toString()}`);
  const pageLink=(n:number)=>`/marketplace?${new URLSearchParams({page:String(n),...(q.trim()?{q:q.trim()}: {})}).toString()}`;
  return (
    <div className="public-shell">
      <PublicHeader/>
      <main className="public-section">
        <div className="page-head">
          <div><h1>Find your next business.</h1>
            <p>Explore sample Nigerian digital businesses, review their commercial profiles and start a private acquisition.</p></div>
          <Link href="/register?account=SELLER" className="button secondary">Sell a business <ArrowRight size={15}/></Link>
        </div>
        <form action="/marketplace" className="card card-pad" style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:28}}>
          <Search size={20} color="var(--muted)"/>
          <input name="q" defaultValue={q} className="input" style={{flex:"1 1 180px",minWidth:0}} placeholder="Search businesses or sectors" aria-label="Search businesses"/>
          <button className="button" type="submit">Search</button>
        </form>
        <div className="page-head"><div><h2 className="section-title">{result.total} illustrative businesses available</h2>
          <p>All transactions and prices are displayed in Naira.</p></div>
          <span className="muted">Page {result.page} of {Math.max(1,result.pages)}</span>
        </div>
        {result.items.length ? (
          <div className="market-grid">
            {result.items.map(item=>(
              <article className="card listing-card" key={item.id}>
                <div className="listing-art"><Store size={34}/><span>{item.category}</span></div>
                <div className="card-pad">
                  <h3 className="section-title">{item.name}</h3>
                  <p className="muted" style={{fontSize:13,marginTop:8}}>{item.organization.name}</p>
                  <div className="list" style={{marginTop:16}}>
                    <div className="list-row"><span className="muted">Asking price</span><strong>{money(item.askingPriceMinor)}</strong></div>
                    <div className="list-row"><span className="muted">Annual revenue</span><strong>{money(item.annualRevenueMinor)}</strong></div>
                    <div className="list-row"><span className="muted">Recurring revenue</span><strong>{item.recurringRevenuePct}%</strong></div>
                  </div>
                  <Link href={`/marketplace/${item.slug}`} className="button full" style={{marginTop:18}}>View business <ArrowRight size={15}/></Link>
                </div>
              </article>
            ))}
          </div>
        ):<div className="card empty"><h3>No businesses match that search.</h3><p>Try another sector or business name.</p><Link href="/marketplace" className="button">Clear search</Link></div>}
        <nav className="page-actions" aria-label="Marketplace pages" style={{justifyContent:"center",marginTop:30}}>
          {result.page>1&&<Link className="button secondary" href={pageLink(result.page-1)}>Previous</Link>}
          {Array.from({length:result.pages},(_,i)=>i+1).filter(n=>Math.abs(n-result.page)<=2).map(n=><Link className={n===result.page?"button":"button secondary"} key={n} href={pageLink(n)} aria-current={n===result.page?"page":undefined}>{n}</Link>)}
          {result.page<result.pages&&<Link className="button secondary" href={pageLink(result.page+1)}>Next</Link>}
        </nav>
      </main>
      <PublicFooter/>
    </div>
  );
}
