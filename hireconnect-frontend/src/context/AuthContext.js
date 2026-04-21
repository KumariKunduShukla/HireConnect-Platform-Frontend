import React, { createContext, useContext, useState, useEffect } from 'react';


const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('hc_token'));

  useEffect(() => {
    const stored = localStorage.getItem('hc_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored user:', e);
      }
    }
  }, []);

  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('hc_token', jwtToken);
    localStorage.setItem('hc_user', JSON.stringify(userData));
    return userData;
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('hc_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('hc_token');
    localStorage.removeItem('hc_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
