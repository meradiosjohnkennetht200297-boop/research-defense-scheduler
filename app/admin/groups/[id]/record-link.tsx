'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function RecordOptionsLink(){
 const pathname=usePathname()
 if(!/^\/admin\/groups\/[^/]+$/.test(pathname))return null
 return <div className="container" style={{paddingBottom:'28px'}}><div className="card" style={{padding:'14px 16px',boxShadow:'none',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',flexWrap:'wrap'}}><div><strong>Record options</strong><div style={{color:'var(--muted)',fontSize:'.78rem',marginTop:'3px'}}>Cancel, retain, or safely remove an accidental submission.</div></div><Link className="button button-secondary button-small" href={`${pathname}/record`}>Open Record Options</Link></div></div>
}
