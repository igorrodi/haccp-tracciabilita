import PocketBase from 'pocketbase';

const getPocketBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return "http://localhost:8090";
  }
  return window.location.origin;
};

export const pb = new PocketBase(getPocketBaseUrl());
pb.autoCancellation(false);

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

export const isAdmin = () => {
  if (!pb.authStore.isValid) return false;
  const user = pb.authStore.model;
  return (user as any)?.role === 'admin';
};

// Login
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

// Register — used only for first-time setup and admin-invited users
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

    // Auto-login only if not already authenticated (first-time setup)
    if (!pb.authStore.isValid) {
      await pb.collection('users').authWithPassword(email, password);
    }

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

// Check if first-time setup is needed (no admin account yet)
// Uses custom PocketBase hook that bypasses API rules
export const checkFirstTimeSetup = async (): Promise<boolean> => {
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  let endpoint = '/api/setup-check';
  if (isLocalDev) {
    try {
      endpoint = new URL('/api/setup-check', pb.baseURL).toString();
    } catch {
      endpoint = 'http://localhost:8090/api/setup-check';
    }
  }

  try {
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      return data.needsSetup === true;
    }
    // If endpoint doesn't exist (old PocketBase without hook), fallback
    console.warn('setup-check endpoint not available, falling back');
    return false;
  } catch (error) {
    console.warn('checkFirstTimeSetup error:', error);
    return false;
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
