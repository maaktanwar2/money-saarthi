/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			'2xl': '1rem',
  			'3xl': '1.5rem',
  			'4xl': '2rem'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			// Custom Trading Colors
  			bullish: {
  				DEFAULT: '#10b981',
  				light: '#34d399',
  				dark: '#059669',
  				muted: 'rgba(16, 185, 129, 0.15)'
  			},
  			bearish: {
  				DEFAULT: '#ef4444',
  				light: '#f87171',
  				dark: '#dc2626',
  				muted: 'rgba(239, 68, 68, 0.15)'
  			},
  			neutral: {
  				DEFAULT: '#6366f1',
  				light: '#818cf8',
  				dark: '#4f46e5',
  				muted: 'rgba(99, 102, 241, 0.15)'
  			}
  		},
  		fontFamily: {
  			sans: [
  				'SF Pro Display',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Inter',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: ['SF Mono', 'JetBrains Mono', 'Fira Code', 'monospace']
  		},
  		boxShadow: {
  			glow: '0 0 20px rgba(99, 102, 241, 0.4)',
  			'glow-green': '0 0 20px rgba(16, 185, 129, 0.4)',
  			'glow-red': '0 0 20px rgba(239, 68, 68, 0.4)',
  			glass: '0 8px 32px rgba(0, 0, 0, 0.4)',
  			'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.3)',
  			elevated: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
  		},
  		backdropBlur: {
  			xs: '2px',
  			glass: '20px'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			},
  			fadeIn: {
  				from: { opacity: '0' },
  				to: { opacity: '1' }
  			},
  			slideUp: {
  				from: { opacity: '0', transform: 'translateY(10px)' },
  				to: { opacity: '1', transform: 'translateY(0)' }
  			},
  			slideDown: {
  				from: { opacity: '0', transform: 'translateY(-10px)' },
  				to: { opacity: '1', transform: 'translateY(0)' }
  			},
  			shimmer: {
  				from: { backgroundPosition: '200% 0' },
  				to: { backgroundPosition: '-200% 0' }
  			},
  			float: {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'50%': { transform: 'translateY(-10px)' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  			'fade-in': 'fadeIn 0.3s ease-out',
  			'slide-up': 'slideUp 0.3s ease-out',
  			'slide-down': 'slideDown 0.3s ease-out',
  			shimmer: 'shimmer 2s infinite linear',
  			float: 'float 3s ease-in-out infinite'
  		}
  	}
  },
  plugins: [
    require("tailwindcss-animate"),
    function({ addUtilities }) {
      addUtilities({
        '.glass': {
          background: 'rgba(17, 17, 27, 0.7)',
          backdropFilter: 'blur(20px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        },
        '.glass-card': {
          background: 'rgba(23, 23, 33, 0.6)',
          backdropFilter: 'blur(16px) saturate(150%)',
          '-webkit-backdrop-filter': 'blur(16px) saturate(150%)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        },
        '.glass-surface': {
          background: 'rgba(30, 30, 40, 0.5)',
          backdropFilter: 'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        },
        '.text-gradient': {
          background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          backgroundClip: 'text'
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        },
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          '&::-webkit-scrollbar': { width: '6px', height: '6px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(99, 102, 241, 0.3)',
            borderRadius: '3px'
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(99, 102, 241, 0.5)'
          }
        },
        '.ios-touch': {
          transition: 'transform 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
          '-webkit-user-select': 'none',
          userSelect: 'none',
          '&:active': { transform: 'scale(0.97)' }
        }
      })
    }
  ],
};