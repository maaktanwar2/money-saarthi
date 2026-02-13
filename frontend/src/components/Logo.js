// Logo Component - Money Saarthi Brand Logos
import { cn } from '../lib/utils';

// Option 1: Modern 3D Gradient MS with Chart
export const Logo3DChart = ({ size = 40, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    className={cn("", className)}
  >
    <defs>
      <linearGradient id="grad3d1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8B5CF6" />
        <stop offset="50%" stopColor="#6366F1" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
      <linearGradient id="grad3d2" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#34D399" />
      </linearGradient>
      <filter id="shadow3d" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000" floodOpacity="0.3"/>
      </filter>
    </defs>
    {/* 3D Base Shape */}
    <rect x="10" y="15" width="80" height="70" rx="16" fill="url(#grad3d1)" filter="url(#shadow3d)"/>
    {/* Inner glow */}
    <rect x="15" y="20" width="70" height="60" rx="12" fill="rgba(255,255,255,0.1)"/>
    {/* MS Letters */}
    <text x="50" y="58" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontSize="32" fontWeight="900" fill="white">
      MS
    </text>
    {/* Chart Line */}
    <path d="M20 70 L35 55 L50 62 L65 45 L80 35" stroke="url(#grad3d2)" strokeWidth="4" strokeLinecap="round" fill="none"/>
    {/* Arrow head */}
    <polygon points="80,35 72,38 75,45" fill="#34D399"/>
  </svg>
);

// Option 2: 3D Hexagon with Bull
export const Logo3DHexBull = ({ size = 40, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    className={cn("", className)}
  >
    <defs>
      <linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <linearGradient id="hexGrad2" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#1E293B" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
      <filter id="hexShadow">
        <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.4"/>
      </filter>
    </defs>
    {/* 3D Hexagon */}
    <polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" fill="url(#hexGrad2)" filter="url(#hexShadow)"/>
    <polygon points="50,12 82,31 82,69 50,88 18,69 18,31" fill="url(#hexGrad)" opacity="0.9"/>
    {/* Bull Horns */}
    <path d="M30 45 Q25 30 35 25" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none"/>
    <path d="M70 45 Q75 30 65 25" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none"/>
    {/* Bull Face simplified */}
    <ellipse cx="50" cy="55" rx="18" ry="15" fill="white"/>
    <circle cx="42" cy="52" r="3" fill="#1E293B"/>
    <circle cx="58" cy="52" r="3" fill="#1E293B"/>
    {/* Nostrils */}
    <ellipse cx="45" cy="62" rx="2" ry="1.5" fill="#1E293B"/>
    <ellipse cx="55" cy="62" rx="2" ry="1.5" fill="#1E293B"/>
  </svg>
);

// Option 3: 3D Compass/Guide Style
export const Logo3DCompass = ({ size = 40, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    className={cn("", className)}
  >
    <defs>
      <linearGradient id="compassGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0EA5E9" />
        <stop offset="100%" stopColor="#0284C7" />
      </linearGradient>
      <linearGradient id="compassGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <linearGradient id="compassGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FCD34D" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
      <filter id="compassShadow">
        <feDropShadow dx="1" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.25"/>
      </filter>
    </defs>
    {/* Outer ring */}
    <circle cx="50" cy="50" r="45" fill="url(#compassGrad1)" filter="url(#compassShadow)"/>
    <circle cx="50" cy="50" r="40" fill="#0F172A"/>
    {/* Inner compass markings */}
    <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
    {/* Cardinal directions */}
    <text x="50" y="22" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.6)" fontWeight="bold">N</text>
    <text x="50" y="84" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.6)" fontWeight="bold">S</text>
    <text x="18" y="53" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.6)" fontWeight="bold">W</text>
    <text x="82" y="53" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.6)" fontWeight="bold">E</text>
    {/* Compass needle pointing up-right (growth) */}
    <polygon points="50,50 65,25 50,35" fill="url(#compassGrad2)"/>
    <polygon points="50,50 35,75 50,65" fill="#64748B"/>
    {/* Center */}
    <circle cx="50" cy="50" r="8" fill="url(#compassGold)"/>
    <text x="50" y="54" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1E293B">₹</text>
  </svg>
);

// Option 4: 3D Stacked Coins with Growth Arrow
export const Logo3DCoins = ({ size = 40, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    className={cn("", className)}
  >
    <defs>
      <linearGradient id="coinGold1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FCD34D" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
      <linearGradient id="coinGold2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <linearGradient id="arrowGreen" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#34D399" />
      </linearGradient>
      <filter id="coinShadow">
        <feDropShadow dx="2" dy="3" stdDeviation="2" floodColor="#000" floodOpacity="0.3"/>
      </filter>
    </defs>
    {/* Background circle */}
    <circle cx="50" cy="50" r="45" fill="#1E293B" filter="url(#coinShadow)"/>
    {/* Coin stack */}
    <ellipse cx="35" cy="75" rx="20" ry="6" fill="url(#coinGold2)"/>
    <ellipse cx="35" cy="72" rx="20" ry="6" fill="url(#coinGold1)"/>
    <ellipse cx="35" cy="65" rx="20" ry="6" fill="url(#coinGold2)"/>
    <ellipse cx="35" cy="62" rx="20" ry="6" fill="url(#coinGold1)"/>
    <ellipse cx="35" cy="55" rx="20" ry="6" fill="url(#coinGold2)"/>
    <ellipse cx="35" cy="52" rx="20" ry="6" fill="url(#coinGold1)"/>
    {/* Rupee symbol on top coin */}
    <text x="35" y="56" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#92400E">₹</text>
    {/* Growth arrow */}
    <path d="M55 70 L65 50 L75 55 L85 25" stroke="url(#arrowGreen)" strokeWidth="5" strokeLinecap="round" fill="none"/>
    <polygon points="85,25 78,32 88,35" fill="#34D399"/>
  </svg>
);

// Option 5: Premium MS Monogram 3D
export const Logo3DMonogram = ({ size = 40, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    className={cn("", className)}
  >
    <defs>
      <linearGradient id="monoGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8B5CF6" />
        <stop offset="50%" stopColor="#A855F7" />
        <stop offset="100%" stopColor="#D946EF" />
      </linearGradient>
      <linearGradient id="monoGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#06B6D4" />
        <stop offset="100%" stopColor="#0EA5E9" />
      </linearGradient>
      <filter id="monoGlow">
        <feGaussianBlur stdDeviation="2" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="monoShadow">
        <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#8B5CF6" floodOpacity="0.5"/>
      </filter>
    </defs>
    {/* Background */}
    <circle cx="50" cy="50" r="45" fill="#0F172A" filter="url(#monoShadow)"/>
    {/* Glowing ring */}
    <circle cx="50" cy="50" r="42" fill="none" stroke="url(#monoGrad1)" strokeWidth="2" opacity="0.5"/>
    {/* M letter - 3D effect */}
    <path d="M25 70 L25 35 L38 55 L50 35 L50 70" 
          stroke="url(#monoGrad1)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#monoGlow)"/>
    {/* S letter - 3D effect */}
    <path d="M55 38 Q75 30 75 45 Q75 55 55 55 Q55 55 55 55 Q35 55 55 70 Q75 75 75 65" 
          stroke="url(#monoGrad2)" strokeWidth="6" strokeLinecap="round" fill="none" filter="url(#monoGlow)"/>
    {/* Accent dots */}
    <circle cx="25" cy="30" r="3" fill="#34D399"/>
    <circle cx="75" cy="75" r="3" fill="#F59E0B"/>
  </svg>
);

// Option 6: Shield with Chart (Trust + Growth)
export const Logo3DShield = ({ size = 40, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    className={cn("", className)}
  >
    <defs>
      <linearGradient id="shieldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E40AF" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
      <linearGradient id="shieldGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <filter id="shieldShadow">
        <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#1E40AF" floodOpacity="0.4"/>
      </filter>
    </defs>
    {/* Shield shape */}
    <path d="M50 5 L90 20 L90 50 Q90 80 50 95 Q10 80 10 50 L10 20 Z" 
          fill="url(#shieldGrad1)" filter="url(#shieldShadow)"/>
    {/* Inner shield */}
    <path d="M50 12 L82 25 L82 50 Q82 75 50 88 Q18 75 18 50 L18 25 Z" 
          fill="#0F172A"/>
    {/* Chart bars */}
    <rect x="25" y="60" width="10" height="20" rx="2" fill="url(#shieldGrad2)" opacity="0.6"/>
    <rect x="40" y="50" width="10" height="30" rx="2" fill="url(#shieldGrad2)" opacity="0.8"/>
    <rect x="55" y="35" width="10" height="45" rx="2" fill="url(#shieldGrad2)"/>
    {/* Checkmark */}
    <path d="M35 45 L45 55 L65 30" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

// Export all logos with names
export const LOGO_OPTIONS = [
  { id: 1, name: '3D Chart', Component: Logo3DChart, description: 'Modern gradient with growth chart' },
  { id: 2, name: '3D Bull Hex', Component: Logo3DHexBull, description: 'Gold hexagon with bull face' },
  { id: 3, name: '3D Compass', Component: Logo3DCompass, description: 'Compass guide with rupee center' },
  { id: 4, name: '3D Coins', Component: Logo3DCoins, description: 'Stacked coins with growth arrow' },
  { id: 5, name: '3D Monogram', Component: Logo3DMonogram, description: 'Premium MS letters with glow' },
  { id: 6, name: '3D Shield', Component: Logo3DShield, description: 'Shield with chart bars' },
];

// Default export - use Logo3DMonogram as primary
export default Logo3DMonogram;
