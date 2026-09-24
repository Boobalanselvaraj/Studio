import React, { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '../ui/button';
export const mediaUrl = a => a.url || a.thumbnailUrl || `/api/studio/folders/assets/${a.id}/view`;
export function MediaViewer({assets=[], selected, onClose, canDownload=true}) {
 const index=assets.findIndex(a=>a.id===selected?.id);
 const [current,setCurrent]=useState(selected);
 const [zoom,setZoom]=useState(false);
 useEffect(()=>{setCurrent(selected);setZoom(false);},[selected]);
 const position=assets.findIndex(a=>a.id===current?.id);
 const move=delta=>{if(assets.length){setCurrent(assets[(position+delta+assets.length)%assets.length]);setZoom(false);}};
 if(!selected || !current)return null;
 const video=current.mime_type?.startsWith('video/');
 return <Dialog.Root open onOpenChange={open=>!open&&onClose()}><Dialog.Portal><Dialog.Overlay className="media-overlay"/><Dialog.Content className="media-viewer" onKeyDown={e=>{if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);}} aria-describedby={undefined}>
 <header><Dialog.Title>{current.filename}</Dialog.Title><div className="flex gap-2"><Button type="button" variant="outline" onClick={()=>setZoom(!zoom)}>{zoom?'Fit':'Zoom'}</Button>{canDownload&&<a className="media-link" href={`${mediaUrl(current)}${mediaUrl(current).includes('?')?'&':'?'}download=true`}>Download</a>}<Dialog.Close className="media-link" aria-label="Close viewer">Close</Dialog.Close></div></header>
 <div className={`media-stage ${zoom?'is-zoomed':''}`}>{video?<video key={current.id} src={mediaUrl(current)} controls autoPlay/>:<img src={mediaUrl(current)} alt={current.filename} onError={e=>{e.currentTarget.alt='Preview unavailable for this file format. Use Download to view the original.';}}/>}</div>
 <footer><Button type="button" variant="outline" disabled={assets.length<2} onClick={()=>move(-1)}>Previous</Button><span>{position+1} / {assets.length} · {current.mime_type || 'File'} · {(Number(current.file_size_bytes||0)/1048576).toFixed(1)} MB</span><Button type="button" variant="outline" disabled={assets.length<2} onClick={()=>move(1)}>Next</Button></footer>
 </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function MediaBrowser({assets=[],onCover,onRemove,onRename,onSelect,selectedIds=[],children,canDownload=true}) {
 const [query,setQuery]=useState('');const [mode,setMode]=useState('masonry');const [page,setPage]=useState(1);const [selected,setSelected]=useState(null);
 const filtered=useMemo(()=>assets.filter(a=>a?.filename?.toLowerCase().includes(query.toLowerCase())),[assets,query]);
 const pages=Math.max(1,Math.ceil(filtered.length/60));const currentPage=Math.min(page,pages);
 useEffect(()=>setPage(1),[query]);
 const visible=filtered.slice((currentPage-1)*60,currentPage*60);
 return <section className="media-browser"><div className="media-toolbar"><input aria-label="Search files" className="search-input" placeholder="Search filenames…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="flex flex-wrap gap-2">{['masonry','grid','large','list'].map(v=><Button type="button" key={v} variant={mode===v?'primary':'outline'} onClick={()=>setMode(v)} aria-pressed={mode===v}>{v==='masonry'?'Mixed grid':v==='large'?'Large grid':v[0].toUpperCase()+v.slice(1)}</Button>)}</div></div>{children}
 <p className="text-sm text-muted my-3">{filtered.length.toLocaleString()} files · Page {currentPage} of {pages} · Up to 60 per page</p>
 <div className={`media-items media-${mode}`}>{visible.map((a,i)=><article key={a.id} className="media-item"><button type="button" className="media-preview" onClick={()=>setSelected(a)} aria-label={`View ${a.filename}`}>{a.mime_type?.startsWith('video/')?<video src={mediaUrl(a)} preload="none"/>:<img src={mediaUrl(a)} alt={a.filename} loading="lazy"/>}</button><div className="media-caption"><strong title={a.filename}>{a.filename}</strong><div className="flex flex-wrap items-center gap-3">{onSelect&&<label className="flex items-center gap-2"><input type="checkbox" checked={selectedIds.includes(a.id)} onChange={()=>onSelect(a.id)}/>Select</label>}{onCover&&<button type="button" onClick={()=>onCover(a.id)}>Set cover</button>}{onRename&&<button type="button" onClick={()=>onRename(a)}>Rename</button>}{onRemove&&<button type="button" className="text-red-500" onClick={()=>onRemove(a.id)}>Remove</button>}</div></div></article>)}</div>
 {!filtered.length&&<p className="p-8 text-center text-muted">No files found.</p>}<div className="media-pagination"><Button type="button" variant="outline" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>Previous</Button><label>Page <input aria-label="Page number" type="number" min={1} max={pages} value={currentPage} onChange={e=>setPage(Math.max(1,Math.min(pages,Number(e.target.value)||1)))}/></label><Button type="button" variant="outline" disabled={currentPage>=pages} onClick={()=>setPage(currentPage+1)}>Next</Button></div>
 <MediaViewer canDownload={canDownload} assets={filtered} selected={selected} onClose={()=>setSelected(null)}/></section>;
}
