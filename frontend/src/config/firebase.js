// Firebase Configuration for Money Saarthi
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

// Firebase configuration - Money Saarthi Production Config
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBVtHFIVjF2n5KGOtFag9ps11KP7-i_y-A",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "moneysaarthi-3bf1c.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "moneysaarthi-3bf1c",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "moneysaarthi-3bf1c.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "694832111270",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:694832111270:web:8941bf7993d3ed03c25e67",
  measurementId: "G-3HYNBJE90L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Apple Auth Provider
const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return {
      success: true,
      user: {
        id: user.uid,
        email: user.email,
        name: user.displayName || user.email?.split('@')[0],
        avatar: user.photoURL,
        provider: 'google',
        emailVerified: user.emailVerified
      }
    };
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    
    // Handle specific errors
    if (error.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Sign-in was cancelled' };
    }
    if (error.code === 'auth/popup-blocked') {
      // Try redirect method if popup is blocked
      try {
        await signInWithRedirect(auth, googleProvider);
        return { success: true, redirect: true };
      } catch (redirectError) {
        return { success: false, error: 'Popup blocked. Please allow popups for this site.' };
      }
    }
    return { success: false, error: error.message };
  }
};

// Sign in with Apple
export const signInWithApple = async () => {
  try {
    const result = await signInWithPopup(auth, appleProvider);
    const user = result.user;
    
    // Get Apple-specific credential
    const credential = OAuthProvider.credentialFromResult(result);
    
    return {
      success: true,
      user: {
        id: user.uid,
        email: user.email,
        name: user.displayName || user.email?.split('@')[0] || 'Apple User',
        avatar: user.photoURL || `https://ui-avatars.com/api/?name=A&background=000&color=fff`,
        provider: 'apple',
        emailVerified: user.emailVerified
      }
    };
  } catch (error) {
    console.error('Apple Sign-In Error:', error);
    
    if (error.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Sign-in was cancelled' };
    }
    if (error.code === 'auth/popup-blocked') {
      try {
        await signInWithRedirect(auth, appleProvider);
        return { success: true, redirect: true };
      } catch (redirectError) {
        return { success: false, error: 'Popup blocked. Please allow popups for this site.' };
      }
    }
    return { success: false, error: error.message };
  }
};

// Sign out
export const firebaseSignOut = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Check redirect result (for when popup is blocked)
export const checkRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const user = result.user;
      const providerId = result.providerId;
      return {
        success: true,
        user: {
          id: user.uid,
          email: user.email,
          name: user.displayName || user.email?.split('@')[0],
          avatar: user.photoURL,
          provider: providerId === 'apple.com' ? 'apple' : 'google',
          emailVerified: user.emailVerified
        }
      };
    }
    return null;
  } catch (error) {
    console.error('Redirect Result Error:', error);
    return { success: false, error: error.message };
  }
};

// Auth state observer
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export { auth };
export default app;
