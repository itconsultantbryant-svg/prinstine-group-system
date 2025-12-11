import React, { useEffect } from 'react';

const Toast = ({ message, type = 'info', onClose, duration = 5000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const bgColor = {
    success: 'bg-success',
    error: 'bg-danger',
    warning: 'bg-warning',
    info: 'bg-info'
  }[type] || 'bg-info';

  return (
    <div
      className={`toast show position-fixed top-0 end-0 m-3 ${bgColor} text-white`}
      role="alert"
      style={{ zIndex: 9999, minWidth: '300px' }}
    >
      <div className="toast-header">
        <strong className="me-auto">
          {type === 'success' && <i className="bi bi-check-circle me-2"></i>}
          {type === 'error' && <i className="bi bi-x-circle me-2"></i>}
          {type === 'warning' && <i className="bi bi-exclamation-triangle me-2"></i>}
          {type === 'info' && <i className="bi bi-info-circle me-2"></i>}
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </strong>
        <button
          type="button"
          className="btn-close"
          onClick={onClose}
        ></button>
      </div>
      <div className="toast-body">
        {message}
      </div>
    </div>
  );
};

export default Toast;

