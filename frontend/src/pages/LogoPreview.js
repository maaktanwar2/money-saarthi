// Logo Preview Page - Temporary page to preview all logo options
import { 
  Logo3DChart, 
  Logo3DHexBull, 
  Logo3DCompass, 
  Logo3DCoins, 
  Logo3DMonogram,
  Logo3DShield,
  LOGO_OPTIONS 
} from '../components/Logo';

const LogoPreview = () => {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-center mb-2">Money Saarthi Logo Options</h1>
      <p className="text-muted-foreground text-center mb-12">Choose your favorite 3D logo design</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {LOGO_OPTIONS.map(({ id, name, Component, description }) => (
          <div 
            key={id}
            className="bg-card border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-primary/50 transition-all cursor-pointer hover:scale-105"
          >
            <div className="text-sm text-muted-foreground">Option {id}</div>
            
            {/* Large Preview */}
            <div className="bg-gradient-to-br from-white/5 to-white/0 p-6 rounded-2xl">
              <Component size={120} />
            </div>
            
            <h3 className="text-xl font-bold">{name}</h3>
            <p className="text-sm text-muted-foreground text-center">{description}</p>
            
            {/* Size Variants */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10 w-full justify-center">
              <div className="flex flex-col items-center gap-1">
                <Component size={24} />
                <span className="text-xs text-muted-foreground">24px</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Component size={40} />
                <span className="text-xs text-muted-foreground">40px</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Component size={60} />
                <span className="text-xs text-muted-foreground">60px</span>
              </div>
            </div>
            
            {/* With Text */}
            <div className="flex items-center gap-3 mt-2 bg-background/50 px-4 py-2 rounded-lg">
              <Component size={32} />
              <span className="font-bold text-lg">Money Saarthi</span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Dark/Light comparison */}
      <div className="mt-12 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-center mb-6">Header Preview</h2>
        <div className="bg-card border border-white/10 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo3DMonogram size={36} />
            <span className="font-bold text-xl">Money Saarthi</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>Scanners</span>
            <span>Strategies</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoPreview;
