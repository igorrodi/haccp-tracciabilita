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

// Check if this is first time setup (no users at all)
export const checkFirstTimeSetup = async (): Promise<boolean> => {
  try {
    const users = await pb.collection('users').getList(1, 1);
    return users.totalItems === 0;
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
