// Theme Provider - Context for theme management
import { createContext, useContext, useEffect, useState } from 'react';
import { storage } from '../lib/utils';

const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children, defaultTheme = 'dark' }) => {
  const [theme, setTheme] = useState(() => {
    return storage.get('theme', defaultTheme);
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    
    storage.set('theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
