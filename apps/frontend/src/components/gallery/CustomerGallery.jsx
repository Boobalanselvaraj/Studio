import React,{useState} from 'react';
import {MediaBrowser} from './MediaBrowser';
import {Button} from '../ui/button';
export function CustomerGallery({assets=[],galleryId,canDownload=true,canFavorite=true}) {
 const [favorites,setFavorites]=useState(()=>{try{return JSON.parse(localStorage.getItem('studioflow-favorites-'+galleryId))||[];}catch{return [];}});
 const [only,setOnly]=useState(false);
 const toggle=id=>setFavorites(previous=>{const next=previous.includes(id)?previous.filter(x=>x!==id):[...previous,id];localStorage.setItem('studioflow-favorites-'+galleryId,JSON.stringify(next));return next;});
 return <><div className="gallery-toolbar">{canDownload&&<a className="media-link" href={'/api/customer/albums/'+galleryId+'/download'}>Download album ZIP</a>}{canFavorite&&<Button variant="outline" onClick={()=>setOnly(!only)}>{only?'Show all':'Favorites ('+favorites.length+')'}</Button>}</div><MediaBrowser assets={only?assets.filter(a=>favorites.includes(a.id)):assets} canDownload={canDownload} selectedIds={favorites} onSelect={canFavorite?toggle:undefined}/></>;
}
