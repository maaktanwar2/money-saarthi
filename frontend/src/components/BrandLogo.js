// Brand Logo Component - Money Saarthi Golden Bull
import { cn } from '../lib/utils';

// Main Logo - Golden Bull with Arrows
export const BrandLogo = ({ size = 40, showText = false, className }) => (
  <div className={cn("flex items-center gap-3", className)}>
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      className="shrink-0"
    >
      <defs>
        {/* Golden Gradient */}
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4A574" />
          <stop offset="50%" stopColor="#C9956C" />
          <stop offset="100%" stopColor="#A67B5B" />
        </linearGradient>
        {/* Light Gold for highlights */}
        <linearGradient id="goldLight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8C99B" />
          <stop offset="100%" stopColor="#D4A574" />
        </linearGradient>
      </defs>
      
      {/* Bull Body - Stylized line art */}
      <g fill="none" stroke="url(#goldGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {/* Back and tail */}
        <path d="M15 55 Q10 50 12 45 Q15 42 20 45" />
        <path d="M20 45 Q25 40 35 42 Q45 44 50 50" />
        
        {/* Body curve */}
        <path d="M50 50 Q60 55 65 60 Q70 65 68 75" />
        
        {/* Front legs */}
        <path d="M45 60 Q43 70 42 80 Q41 85 43 88" />
        <path d="M55 62 Q53 72 52 82 Q51 87 53 90" />
        
        {/* Back legs */}
        <path d="M30 55 Q28 65 27 75 Q26 82 28 85" />
        <path d="M38 58 Q36 68 35 78 Q34 84 36 87" />
        
        {/* Chest */}
        <path d="M50 50 Q55 48 58 45 Q62 42 65 40" />
        
        {/* Neck and head */}
        <path d="M65 40 Q70 35 72 30 Q74 26 70 24" />
        <path d="M70 24 Q65 22 60 25 Q56 28 58 32" />
        
        {/* Snout */}
        <path d="M58 32 Q55 35 57 38" />
      </g>
      
      {/* Horns with arrows */}
      <g fill="none" stroke="url(#goldLight)" strokeWidth="2.5" strokeLinecap="round">
        {/* Left horn with arrow */}
        <path d="M68 24 Q62 15 58 8" />
        <path d="M58 8 L55 14 M58 8 L63 11" />
        
        {/* Right horn with arrow */}
        <path d="M72 22 Q78 12 82 5" />
        <path d="M82 5 L79 11 M82 5 L86 9" />
        
        {/* Middle arrow */}
        <path d="M70 20 Q72 10 75 3" />
        <path d="M75 3 L71 8 M75 3 L79 6" />
      </g>
      
      {/* Eye */}
      <circle cx="64" cy="28" r="2" fill="url(#goldGrad)" />
      
      {/* Ear */}
      <path d="M66 20 Q63 18 65 15 Q68 17 66 20" fill="none" stroke="url(#goldGrad)" strokeWidth="2" />
    </svg>
    
    {showText && (
      <div className="flex flex-col">
        <span className="text-lg font-bold tracking-tight" style={{ color: '#D4A574' }}>
          Money Saarthi
        </span>
        <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
          AI@Market Intelligence
        </span>
      </div>
    )}
  </div>
);

// Compact logo for header/sidebar
export const LogoIcon = ({ size = 32, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    className={cn("", className)}
  >
    <defs>
      <linearGradient id="goldGradIcon" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#D4A574" />
        <stop offset="50%" stopColor="#C9956C" />
        <stop offset="100%" stopColor="#A67B5B" />
      </linearGradient>
      <linearGradient id="goldLightIcon" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E8C99B" />
        <stop offset="100%" stopColor="#D4A574" />
      </linearGradient>
    </defs>
    
    {/* Simplified Bull */}
    <g fill="none" stroke="url(#goldGradIcon)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      {/* Body silhouette */}
      <path d="M20 70 Q15 60 20 50 Q30 40 45 45 Q55 48 60 55 Q65 62 62 75" />
      
      {/* Head */}
      <path d="M60 55 Q68 48 72 42 Q76 36 72 32 Q66 30 62 35 Q58 40 60 45" />
      
      {/* Legs */}
      <path d="M35 55 L33 80" />
      <path d="M50 58 L48 82" />
    </g>
    
    {/* Horns with arrows */}
    <g fill="none" stroke="url(#goldLightIcon)" strokeWidth="3" strokeLinecap="round">
      <path d="M68 32 Q60 18 55 10" />
      <path d="M55 10 L52 18 M55 10 L62 14" />
      
      <path d="M74 30 Q80 15 85 8" />
      <path d="M85 8 L80 15 M85 8 L90 13" />
    </g>
    
    {/* Eye */}
    <circle cx="66" cy="38" r="3" fill="url(#goldGradIcon)" />
  </svg>
);

// Text-only logo
export const LogoText = ({ className }) => (
  <div className={cn("flex flex-col", className)}>
    <span className="text-xl font-bold tracking-tight" style={{ color: '#D4A574' }}>
      Money Saarthi
    </span>
    <span className="text-xs text-muted-foreground tracking-wider">
      AI@Market Intelligence
    </span>
  </div>
);

// Full horizontal logo with bull + text
export const LogoFull = ({ size = 36, className }) => (
  <div className={cn("flex items-center gap-3", className)}>
    <LogoIcon size={size} />
    <LogoText />
  </div>
);

export default BrandLogo;
