/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  safelist: [
    {
      pattern: /^(bg|text|border)-(emerald|blue|purple|green|red|amber|cyan|slate|gray|yellow|violet|orange|indigo)-(300|400|500|600)\/(5|10|20|40)$/,
    },
    {
      pattern: /^(bg|text|border)-(emerald|blue|purple|green|red|amber|cyan|slate|gray|yellow|violet|orange|indigo)-(300|400|500|600)$/,
    },
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'var(--radius-sm)',
  			xl: 'var(--radius-xl)',
  			'2xl': '1rem',
  			'3xl': '1.5rem',
  		},
  		colors: {
  			background: {
  				DEFAULT: 'hsl(var(--background))',
  				secondary: 'hsl(var(--background-secondary))',
  				tertiary: 'hsl(var(--background-tertiary))',
  			},
  			foreground: {
  				DEFAULT: 'hsl(var(--foreground))',
  				secondary: 'hsl(var(--foreground-secondary))',
  				muted: 'hsl(var(--foreground-muted))',
  				faint: 'hsl(var(--foreground-faint))',
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))',
  				hover: 'hsl(var(--card-hover))',
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))',
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  				hover: 'hsl(var(--primary-hover))',
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))',
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))',
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))',
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))',
  			},
  			border: {
  				DEFAULT: 'hsl(var(--border))',
  				hover: 'hsl(var(--border-hover))',
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			surface: {
  				'1': 'hsl(var(--surface-1))',
  				'2': 'hsl(var(--surface-2))',
  				'3': 'hsl(var(--surface-3))',
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))',
  				'6': 'hsl(var(--chart-6))',
  			},
  			bullish: {
  				DEFAULT: 'hsl(var(--bullish))',
  				muted: 'hsl(var(--bullish-muted))',
  			},
  			bearish: {
  				DEFAULT: 'hsl(var(--bearish))',
  				muted: 'hsl(var(--bearish-muted))',
  			},
  			neutral: {
  				DEFAULT: 'hsl(var(--neutral))',
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  			},
  			info: {
  				DEFAULT: 'hsl(var(--info))',
  			},
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
  			display: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  		},
  		fontSize: {
  			'2xs': ['0.65rem', { lineHeight: '0.85rem' }],
  		},
  		boxShadow: {
  			glow: '0 0 15px -3px hsl(160 84% 39% / 0.3)',
  			'glow-green': '0 0 15px -3px hsl(142 71% 45% / 0.3)',
  			'glow-red': '0 0 15px -3px hsl(0 72% 51% / 0.3)',
  			glass: '0 8px 32px rgba(0, 0, 0, 0.3)',
  			'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.2)',
  			elevated: '0 20px 40px -10px rgba(0, 0, 0, 0.5)',
  			'card-hover': '0 8px 25px -5px rgba(0, 0, 0, 0.3)',
  		},
  		backdropBlur: {
  			xs: '2px',
  			glass: '20px',
  		},
  		spacing: {
  			'header': 'var(--header-height)',
  			'sidebar': 'var(--sidebar-width)',
  			'sidebar-sm': 'var(--sidebar-collapsed)',
  			'bottom-nav': 'var(--bottom-nav-height)',
  		},
  		maxWidth: {
  			'content': 'var(--content-max-width)',
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
  				from: { opacity: '0', transform: 'translateY(8px)' },
  				to: { opacity: '1', transform: 'translateY(0)' }
  			},
  			slideDown: {
  				from: { opacity: '0', transform: 'translateY(-8px)' },
  				to: { opacity: '1', transform: 'translateY(0)' }
  			},
  			shimmer: {
  				from: { backgroundPosition: '200% 0' },
  				to: { backgroundPosition: '-200% 0' }
  			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  			'fade-in': 'fadeIn 0.25s ease-out',
  			'slide-up': 'slideUp 0.3s ease-out',
  			'slide-down': 'slideDown 0.3s ease-out',
  			shimmer: 'shimmer 1.8s infinite linear',
  		}
  	}
  },
  plugins: [
    require("tailwindcss-animate"),
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        },
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          '&::-webkit-scrollbar': { width: '5px', height: '5px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'hsl(var(--border))',
            borderRadius: '4px'
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'hsl(var(--foreground-muted))'
          }
        },
        '.ios-touch': {
          transition: 'transform 0.12s cubic-bezier(0.22, 1, 0.36, 1)',
          '-webkit-user-select': 'none',
          userSelect: 'none',
          '&:active': { transform: 'scale(0.97)' }
        },
        '.no-tap-highlight': {
          '-webkit-tap-highlight-color': 'transparent',
        },
      })
    }
  ],
};