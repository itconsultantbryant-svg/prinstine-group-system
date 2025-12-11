import React, { createContext, useState, useEffect } from 'react';
import api from '../config/api';
import { initSocket, disconnectSocket } from '../config/socket';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (isMounted) {
          setUser(parsedUser);
        }
        
        // Verify token is still valid with timeout
        const timeoutId = setTimeout(() => {
          if (isMounted) {
            console.warn('Auth check timeout - proceeding with cached user');
            setLoading(false);
          }
        }, 3000); // 3 second timeout

        api.get('/auth/me')
          .then(response => {
            clearTimeout(timeoutId);
            if (isMounted && response.data?.user) {
              const userData = response.data.user;
              setUser(userData);
              localStorage.setItem('user', JSON.stringify(userData));
              // Initialize WebSocket connection
              try {
                initSocket(userData.id);
              } catch (socketError) {
                console.warn('Socket initialization failed:', socketError);
              }
              setLoading(false);
            } else if (isMounted) {
              setLoading(false);
            }
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            console.warn('Auth verification failed:', error.message);
            // Token invalid, clear storage
            if (isMounted) {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              setUser(null);
              disconnectSocket();
              setLoading(false);
            }
          });
      } catch (error) {
        console.error('Error parsing user data:', error);
        if (isMounted) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setLoading(false);
          disconnectSocket();
        }
      }
    } else {
      setLoading(false);
    }

    // Cleanup on unmount
    return () => {
      isMounted = false;
      disconnectSocket();
    };
  }, []);

  const login = async (email, password) => {
    try {
      console.log('=== LOGIN ATTEMPT START ===');
      console.log('Email:', email);
      console.log('API Base URL:', api.defaults.baseURL);
      console.log('Axios timeout:', api.defaults.timeout, 'ms');
      console.log('Full URL will be:', `${api.defaults.baseURL}/auth/login`);
      
      const startTime = Date.now();
      console.log('Sending login request at:', new Date().toISOString());
      
      // Use axios directly - it already has a 60 second timeout configured
      const response = await api.post('/auth/login', { email, password });
      
      const endTime = Date.now();
      console.log('Response received in:', endTime - startTime, 'ms');
      
      console.log('Login response received:', response.status);
      console.log('Response data:', response.data);
      
      if (!response.data) {
        console.error('Empty response from server');
        return {
          success: false,
          error: 'Empty response from server. Please try again.'
        };
      }
      
      const { token, user } = response.data;
      
      if (!token || !user) {
        console.error('Invalid response from server:', response.data);
        return {
          success: false,
          error: 'Invalid response from server. Please try again.'
        };
      }
      
      console.log('Storing token and user data...');
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      
      // Initialize WebSocket connection asynchronously (don't block login)
      try {
        initSocket(user.id);
        console.log('WebSocket initialized');
      } catch (socketError) {
        console.warn('WebSocket initialization failed (non-critical):', socketError);
        // Don't fail login if socket fails
      }
      
      console.log('Login successful for user:', user.email);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      let errorMessage = 'Login failed';
      
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error') || error.message?.includes('NetworkError')) {
        errorMessage = 'Cannot connect to server. Please make sure the backend server is running on port 3006.';
      } else if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
        errorMessage = 'Request timed out. The server may be slow or not responding. Please try again.';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check your internet connection and ensure the server is running.';
      } else if (error.response?.status === 400) {
        // Handle validation errors
        const validationErrors = error.response.data?.errors;
        if (validationErrors && Array.isArray(validationErrors) && validationErrors.length > 0) {
          errorMessage = validationErrors.map(e => e.msg || e.message).join(', ');
        } else {
          errorMessage = error.response.data?.error || 'Invalid request. Please check your input.';
        }
      } else if (error.response?.status === 401) {
        errorMessage = error.response.data?.error || 'Invalid email or password';
      } else if (error.response?.status === 403) {
        const errorData = error.response.data?.error || '';
        if (errorData.includes('Login access restricted')) {
          errorMessage = errorData;
        } else {
          errorMessage = errorData || 'Account is deactivated';
        }
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    disconnectSocket();
    window.location.href = '/login';
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

