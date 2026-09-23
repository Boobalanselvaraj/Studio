import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Aperture, ArrowUpRight } from 'lucide-react';
import { photos } from '../data/workspace';
import { Photo } from '../components/workspace/shared';
export function AuthLayout() {
 return <div className="auth-shell"><section className="auth-story"><Photo src={photos.wedding} alt="Sunlit wedding photography"/><div className="auth-shade"/><Link to="/studio/dashboard" className="wordmark"><Aperture size={29}/>studioflow.</Link><div className="auth-quote"><span>MORE CREATIVITY. LESS ADMIN.</span><h1>Behind every<br/>beautiful moment,<br/><em>a studio in flow.</em></h1><p>Your shoots, your team, and every frame in between.<br/>Thoughtfully brought together.</p></div><div className="auth-story-footer"><span>THE WORKSPACE FOR PHOTOGRAPHERS</span><Aperture size={23}/></div></section><section className="auth-form-side"><div className="auth-form-content"><Outlet/></div><p className="auth-footer">A little more time for what you love.</p></section></div>;
}
