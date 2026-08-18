'use client'

import { useState } from 'react'

export default function StudentAccessKeyControl({ groupId, publicCode, hasAccessKey }: { groupId: string; publicCode: string; hasAccessKey: boolean }) {
  const [working,setWorking]=useState(false),[accessKey,setAccessKey]=useState(''),[error,setError]=useState(''),[copied,setCopied]=useState(false)
  async function generate(){if(hasAccessKey&&!window.confirm('Reset the student Access Key? The previous key will stop working immediately.'))return;setWorking(true);setError('');setAccessKey('');try{const response=await fetch(`/api/admin/groups/${groupId}/access-key`,{method:'POST'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to generate an Access Key.');setAccessKey(result.accessKey);setCopied(false)}catch(caught){setError(caught instanceof Error?caught.message:'Unable to generate an Access Key.')}finally{setWorking(false)}}
  async function copy(){if(!accessKey)return;try{await navigator.clipboard.writeText(`Research ID: ${publicCode}\nAccess Key: ${accessKey}`);setCopied(true)}catch{setCopied(false)}}
  return <div className="workspace-access-key"><div><strong>Student continuation access</strong><small>{hasAccessKey?'An Access Key is active for this Research ID.':'No Access Key has been issued for this record yet.'}</small></div>{accessKey?<div className="workspace-access-key-result"><span>New Access Key · shown once</span><b>{accessKey}</b><button className="button button-secondary button-small" onClick={copy} type="button">{copied?'Copied ✓':'Copy ID + Key'}</button><small>Give this to the research group. It will not be displayed again after leaving this page.</small></div>:null}{error?<p className="workspace-access-error">{error}</p>:null}<button className="button button-secondary button-small" disabled={working} onClick={generate} type="button">{working?'Working…':hasAccessKey?'Reset Access Key':'Generate Access Key'}</button></div>
}
