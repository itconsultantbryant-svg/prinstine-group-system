import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NotFound = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'Staff':
        return '/staff-dashboard';
      case 'DepartmentHead':
        return '/department-dashboard';
      case 'Admin':
      default:
        return '/dashboard';
    }
  };

  return (
    <div className="container-fluid d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
      <div className="text-center">
        <div className="mb-4">
          <i className="bi bi-exclamation-triangle text-warning" style={{ fontSize: '5rem' }}></i>
        </div>
        <h1 className="display-1 fw-bold">404</h1>
        <h2 className="mb-3">Page Not Found</h2>
        <p className="text-muted mb-4">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="d-flex gap-2 justify-content-center">
          <button 
            className="btn btn-primary" 
            onClick={() => navigate(-1)}
          >
            <i className="bi bi-arrow-left me-2"></i>Go Back
          </button>
          <Link 
            to={getDashboardPath()} 
            className="btn btn-outline-primary"
          >
            <i className="bi bi-house-door me-2"></i>Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

