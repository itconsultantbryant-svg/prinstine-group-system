import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../config/api';
import { initSocket, disconnectSocket } from '../../config/socket';
import './TopBar.css';

const TopBar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    if (user) {
      // Initialize socket connection for real-time notifications
      const socket = initSocket(user.id);
      
      fetchUnreadCount();
      fetchNotifications();

      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      // Listen for real-time notifications via WebSocket
      if (socket) {
        const handleNotification = (notification) => {
          // Parse notification if it's a string
          let parsedNotification = notification;
          if (typeof notification === 'string') {
            try {
              parsedNotification = JSON.parse(notification);
            } catch (e) {
              // If parsing fails, create a proper notification object
              parsedNotification = {
                id: Date.now(),
                title: 'Notification',
                message: notification,
                type: 'info',
                is_read: 0,
                created_at: new Date().toISOString()
              };
            }
          }
          
          // Ensure notification has required fields
          if (!parsedNotification.id) {
            parsedNotification.id = parsedNotification.id || Date.now();
          }
          if (!parsedNotification.created_at) {
            parsedNotification.created_at = new Date().toISOString();
          }
          if (!parsedNotification.is_read) {
            parsedNotification.is_read = 0;
          }
          
          // Extract title and message properly
          const title = parsedNotification.title || 'Notification';
          const message = typeof parsedNotification.message === 'string' 
            ? parsedNotification.message 
            : JSON.stringify(parsedNotification.message);
          
          // Add new notification to the list
          setNotifications(prev => [{
            ...parsedNotification,
            title,
            message
          }, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show browser notification if permission granted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
              body: message,
              icon: '/logo192.png'
            });
          }
        };

        socket.on('notification', handleNotification);

        // Poll for notifications every 30 seconds as backup
        const interval = setInterval(() => {
          fetchUnreadCount();
          fetchNotifications();
        }, 30000);

        return () => {
          socket.off('notification', handleNotification);
          clearInterval(interval);
        };
      }
    }

    return () => {
      disconnectSocket();
    };
  }, [user]);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications?limit=10');
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      fetchUnreadCount();
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  if (!user) return null;

  return (
    <div className="topbar">
      <div className="topbar-content">
        <div className="topbar-left">
          <img 
            src="/prinstine-logo.png" 
            alt="Prinstine Group" 
            className="topbar-logo"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <h5 className="mb-0 topbar-title">Dashboard</h5>
        </div>
        
        <div className="topbar-right">
          {/* Notifications */}
          <div className="topbar-item">
            <button
              className="topbar-notification-btn"
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowProfileMenu(false);
              }}
            >
              <i className="bi bi-bell"></i>
              {unreadCount > 0 && (
                <span className="topbar-badge">{unreadCount}</span>
              )}
            </button>
            {showNotifications && (
              <div className="topbar-dropdown notification-dropdown">
                <div className="topbar-dropdown-header">
                  <h6 className="mb-0">Notifications</h6>
                  {unreadCount > 0 && (
                    <button className="btn btn-sm btn-link p-0" onClick={markAllAsRead}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="topbar-dropdown-body">
                  {notifications.length === 0 ? (
                    <div className="text-center text-muted p-3">No notifications</div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`topbar-dropdown-item ${!notification.is_read ? 'unread' : ''}`}
                        onClick={() => {
                          if (!notification.is_read) markAsRead(notification.id);
                          if (notification.link) navigate(notification.link);
                          setShowNotifications(false);
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <strong>{notification.title || 'Notification'}</strong>
                            <p className="mb-0 small text-muted">
                              {typeof notification.message === 'string' 
                                ? notification.message 
                                : (notification.message?.message || JSON.stringify(notification.message))}
                            </p>
                            <small className="text-muted">
                              {notification.created_at 
                                ? new Date(notification.created_at).toLocaleString()
                                : 'Just now'}
                            </small>
                          </div>
                          <span className={`badge bg-${
                            notification.type === 'success' ? 'success' :
                            notification.type === 'warning' ? 'warning' :
                            notification.type === 'error' ? 'danger' : 'info'
                          } ms-2`}>
                            {notification.type || 'info'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Menu */}
          <div className="topbar-item">
            <button
              className="topbar-profile-btn"
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifications(false);
              }}
            >
              {user.profile_image ? (
                <img src={user.profile_image} alt={user.name} className="topbar-avatar" />
              ) : (
                <i className="bi bi-person-circle"></i>
              )}
              <span className="ms-2">{user.name || 'User'}</span>
              <i className="bi bi-chevron-down ms-2"></i>
            </button>
            {showProfileMenu && (
              <div className="topbar-dropdown profile-dropdown">
                <Link
                  to="/profile"
                  className="topbar-dropdown-item"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <i className="bi bi-person me-2"></i>Profile
                </Link>
                <div className="topbar-dropdown-divider"></div>
                <button
                  className="topbar-dropdown-item text-danger"
                  onClick={handleLogout}
                >
                  <i className="bi bi-box-arrow-right me-2"></i>Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
