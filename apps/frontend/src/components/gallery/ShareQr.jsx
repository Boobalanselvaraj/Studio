import React,{useEffect,useState} from 'react';
import QRCode from 'qrcode';
import {Button} from '../ui/button';
export function ShareQr({url,title='Photo gallery'}) {
 const [png,setPng]=useState('');const [error,setError]=useState('');
 useEffect(()=>{let active=true;setPng('');setError('');if(url)QRCode.toDataURL(url,{width:1024,margin:4,errorCorrectionLevel:'M'}).then(data=>{if(active)setPng(data);}).catch(()=>{if(active)setError('Could not generate QR code');});return()=>{active=false;};},[url]);
 const print=()=>{const w=window.open('','_blank','width=700,height=800');if(!w){setError('Allow popups to print the QR code.');return;}w.document.title=title;const h=w.document.createElement('h1');h.textContent=title;const img=w.document.createElement('img');img.src=png;img.style.width='320px';const p=w.document.createElement('p');p.textContent=url;p.style.overflowWrap='anywhere';w.document.body.append(h,img,p);img.onload=()=>{w.focus();w.print();};};
 if(!url)return null;
 return <div className="share-qr">{error&&<p role="alert">{error}</p>}{png&&<><img src={png} alt={`QR code for ${title}`} width="180" height="180"/><p className="text-xs text-muted">Scan to open this gallery. The QR code uses the same access and expiry as the link.</p><div className="flex flex-wrap justify-center gap-2"><a className="media-link" href={png} download="gallery-qr.png">Download QR</a><Button type="button" variant="outline" onClick={print}>Print QR</Button></div></>}</div>;
}
