import PocketBase from 'pocketbase';

// Dynamically determine PocketBase URL based on current location
const getPocketBaseUrl = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Development: direct connection to PocketBase
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return "http://localhost:8090";
  }
  
  // Production: PocketBase SDK auto-adds /api to requests
  // Caddy proxies /api/* directly to PocketBase at 127.0.0.1:8090
  // So we just use the origin URL (no /api suffix needed)
  return `${protocol}//${hostname}`;
};

export const pb = new PocketBase(getPocketBaseUrl());

// Disable auto-cancellation for better UX
pb.autoCancellation(false);

// Types
export interface PBUser {
  id: string;
  email: string;
  name?: string;
  role?: 'admin' | 'user';
  created: string;
  updated: string;
}

// Auth helpers
export const isAuthenticated = () => pb.authStore.isValid;
export const currentUser = () => pb.authStore.model as unknown as PBUser | null;

// Check if user is admin
export const isAdmin = () => {
  const user = pb.authStore.model;
  return (user as any)?.role === 'admin';
};

// Login with email/password
export const login = async (email: string, password: string) => {
  try {
    const authData = await pb.collection('users').authWithPassword(email, password);
    return { data: authData, error: null };
  } catch (error: any) {
    let errorMessage = 'Errore di login';
    if (error.message?.includes('Failed to authenticate')) {
      errorMessage = 'Email o password non corretti';
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { data: null, error: errorMessage };
  }
};

// Register new user
export const register = async (
  email: string, 
  password: string, 
  passwordConfirm: string,
  name?: string,
  role: 'admin' | 'user' = 'user'
) => {
  try {
    const user = await pb.collection('users').create({
      email,
      password,
      passwordConfirm,
      name: name || '',
      role,
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

// Check if this is first time setup (no admin exists)
export const checkFirstTimeSetup = async (): Promise<boolean> => {
  try {
    const admins = await pb.collection('users').getList(1, 1, {
      filter: 'role = "admin"'
    });
    return admins.totalItems === 0;
  } catch (error) {
    // If users collection doesn't exist, it's first time
    return true;
  }
};

// Get all users (admin only)
export const getAllUsers = async () => {
  try {
    const users = await pb.collection('users').getFullList<PBUser>({
      sort: '-created',
    });
    return { data: users, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
};

// Update user role (admin only)
export const updateUserRole = async (userId: string, role: 'admin' | 'user') => {
  try {
    const user = await pb.collection('users').update(userId, { role });
    return { data: user, error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
};

// Delete user (admin only)
export const deleteUser = async (userId: string) => {
  try {
    await pb.collection('users').delete(userId);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};
