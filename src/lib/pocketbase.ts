import PocketBase from 'pocketbase';

// Dynamically determine PocketBase URL based on current location
const getPocketBaseUrl = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // If accessing via localhost, use localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return "http://localhost:8090";
  }
  
  // If accessing via HTTPS (reverse proxy), use /api path
  if (protocol === 'https:') {
    return `${protocol}//${hostname}/api`;
  }
  
  // Otherwise use hostname with PocketBase port
  return `http://${hostname}:8090`;
};

export const pb = new PocketBase(getPocketBaseUrl());

// Disable auto-cancellation for better UX
pb.autoCancellation(false);

// Auth helpers
export const isAuthenticated = () => pb.authStore.isValid;
export const currentUser = () => pb.authStore.model;

// Login with email/password
export const login = async (email: string, password: string) => {
  try {
    const authData = await pb.collection('users').authWithPassword(email, password);
    return { data: authData, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || 'Errore di login' };
  }
};

// Register new user
export const register = async (email: string, password: string, passwordConfirm: string) => {
  try {
    // Create user
    const user = await pb.collection('users').create({
      email,
      password,
      passwordConfirm,
      emailVisibility: true,
    });
    
    // Auto-login after registration
    await pb.collection('users').authWithPassword(email, password);
    
    return { data: user, error: null };
  } catch (error: any) {
    let errorMessage = 'Errore durante la registrazione';
    if (error.data?.data?.email?.message) {
      errorMessage = error.data.data.email.message;
    } else if (error.data?.data?.password?.message) {
      errorMessage = error.data.data.password.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { data: null, error: errorMessage };
  }
};

// Logout
export const logout = () => {
  pb.authStore.clear();
};

// Subscribe to auth changes
export const onAuthChange = (callback: (isValid: boolean, model: any) => void) => {
  return pb.authStore.onChange((token, model) => {
    callback(pb.authStore.isValid, model);
  });
};
