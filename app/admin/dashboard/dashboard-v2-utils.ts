export function one<T>(value:T|T[]|null|undefined):T|null{return !value?null:Array.isArray(value)?value[0]??null:value}
export function stamp(date:string,time:string){return new Date(`${date}T${String(time).slice(0,8)}+08:00`).getTime()}
export function defenseLabel(v:string|null){return v==='title'?'Title Defense':v==='proposal'?'Proposal Defense':v==='final'?'Final Defense':'Defense type not recorded'}
export function dateLabel(v:string){const[y,m,d]=v.split('-').map(Number);return new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)))}
export function timeLabel(v:string){const[h0,m='00']=v.split(':');let h=Number(h0);const ap=h>=12?'PM':'AM';h%=12;if(!h)h=12;return `${h}:${m} ${ap}`}
export function endedLabel(d:string,t:string){return new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Manila'}).format(new Date(`${d}T${String(t).slice(0,8)}+08:00`))}
export function todayKey(){const p=new Intl.DateTimeFormat('en-US',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Manila'}).formatToParts(new Date());const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}`}
