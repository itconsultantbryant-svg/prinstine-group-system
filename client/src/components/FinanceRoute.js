import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../config/api';

const FinanceRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (user && !loading) {
      checkFinanceAccess();
    }
  }, [user, loading]);

  const checkFinanceAccess = async () => {
    try {
      // Admin always has access
      if (user?.role === 'Admin') {
        setHasAccess(true);
        setChecking(false);
        return;
      }

      // Check if user is Finance Department Head
      if (user?.role === 'DepartmentHead') {
        const response = await api.get('/departments');
        const userEmailLower = user.email.toLowerCase().trim();
        const financeDept = response.data.departments.find(d => 
          (d.manager_id === user.id || 
           (d.head_email && d.head_email.toLowerCase().trim() === userEmailLower)) &&
          d.name && d.name.toLowerCase().includes('finance')
        );
        if (financeDept) {
          setHasAccess(true);
          setChecking(false);
          return;
        }
      }

      // Check if user is Assistant Finance Officer (Staff in Finance department)
      if (user?.role === 'Staff') {
        const response = await api.get('/staff');
        const staffList = response.data.staff || [];
        const myStaff = staffList.find(s => s.user_id === user.id);
        if (myStaff && myStaff.department && myStaff.department.toLowerCase().includes('finance')) {
          setHasAccess(true);
          setChecking(false);
          return;
        }
      }

      setHasAccess(false);
      setChecking(false);
    } catch (error) {
      console.error('Error checking finance access:', error);
      setHasAccess(false);
      setChecking(false);
    }
  };

  if (loading || checking) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default FinanceRoute;

