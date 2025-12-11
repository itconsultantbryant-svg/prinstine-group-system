import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const Calendar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month'); // 'month', 'week', 'day'
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    fetchEvents();
    // Refresh events every 5 minutes
    const interval = setInterval(fetchEvents, 300000);
    return () => clearInterval(interval);
  }, [currentDate, view]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const startDate = new Date(currentDate);
      const endDate = new Date(currentDate);
      
      if (view === 'month') {
        startDate.setDate(1);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
      } else if (view === 'week') {
        const day = startDate.getDay();
        startDate.setDate(startDate.getDate() - day);
        endDate.setDate(startDate.getDate() + 6);
      }
      
      const response = await api.get('/meetings/calendar/events', {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      });
      
      setEvents(response.data.events || []);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add previous month's trailing days
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false
      });
    }
    
    // Add current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    
    // Add next month's leading days to fill the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    
    return days;
  };

  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => {
      const eventDate = new Date(event.start).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length > 0) {
      setSelectedEvent(dayEvents[0]);
      setShowEventModal(true);
    }
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateToToday = () => {
    setCurrentDate(new Date());
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <h2>Calendar</h2>
          <div className="btn-group">
            <button className="btn btn-outline-primary" onClick={() => navigate('/meetings')}>
              <i className="bi bi-calendar-event me-2"></i>Manage Meetings
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/meetings')}>
              <i className="bi bi-plus-circle me-2"></i>Create Meeting
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row align-items-center">
            <div className="col-md-4">
              <div className="btn-group">
                <button className="btn btn-outline-secondary" onClick={() => navigateMonth(-1)}>
                  <i className="bi bi-chevron-left"></i>
                </button>
                <button className="btn btn-outline-secondary" onClick={navigateToToday}>
                  Today
                </button>
                <button className="btn btn-outline-secondary" onClick={() => navigateMonth(1)}>
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
            <div className="col-md-4 text-center">
              <h4 className="mb-0">
                {months[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h4>
            </div>
            <div className="col-md-4 text-end">
              <div className="btn-group">
                <button 
                  className={`btn ${view === 'month' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setView('month')}
                >
                  Month
                </button>
                <button 
                  className={`btn ${view === 'week' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setView('week')}
                >
                  Week
                </button>
                <button 
                  className={`btn ${view === 'day' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setView('day')}
                >
                  Day
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-bordered mb-0" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    {weekDays.map(day => (
                      <th key={day} className="text-center" style={{ width: '14.28%' }}>
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, weekIndex) => (
                    <tr key={weekIndex}>
                      {days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => {
                        const dayEvents = getEventsForDate(day.date);
                        const isToday = day.date.toDateString() === new Date().toDateString();
                        
                        return (
                          <td
                            key={dayIndex}
                            className={`calendar-day ${!day.isCurrentMonth ? 'text-muted' : ''} ${isToday ? 'bg-light' : ''}`}
                            style={{ 
                              height: '120px', 
                              verticalAlign: 'top',
                              cursor: 'pointer',
                              position: 'relative'
                            }}
                            onClick={() => handleDateClick(day.date)}
                          >
                            <div className="d-flex justify-content-between align-items-start p-1">
                              <span className={`fw-bold ${isToday ? 'text-primary' : ''}`}>
                                {day.date.getDate()}
                              </span>
                              {isToday && <span className="badge bg-primary">Today</span>}
                            </div>
                            <div className="calendar-events" style={{ maxHeight: '80px', overflowY: 'auto' }}>
                              {dayEvents.slice(0, 3).map(event => (
                                <div
                                  key={event.id}
                                  className="badge text-truncate w-100 mb-1"
                                  style={{ 
                                    backgroundColor: event.color || '#007bff',
                                    cursor: 'pointer',
                                    fontSize: '0.7rem'
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEvent(event);
                                    setShowEventModal(true);
                                  }}
                                  title={event.title}
                                >
                                  {event.start_time || event.start.split('T')[1]?.substring(0, 5)} - {event.title}
                                </div>
                              ))}
                              {dayEvents.length > 3 && (
                                <small className="text-muted">+{dayEvents.length - 3} more</small>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {showEventModal && selectedEvent && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{selectedEvent.title}</h5>
                <button type="button" className="btn-close" onClick={() => {
                  setShowEventModal(false);
                  setSelectedEvent(null);
                }}></button>
              </div>
              <div className="modal-body">
                <p><strong>Date:</strong> {new Date(selectedEvent.start).toLocaleDateString()}</p>
                <p><strong>Time:</strong> {new Date(selectedEvent.start).toLocaleTimeString()} - {new Date(selectedEvent.end).toLocaleTimeString()}</p>
                <p><strong>Type:</strong> {selectedEvent.meeting_type === 'online' ? 'Online' : 'In-Person'}</p>
                {selectedEvent.meeting_type === 'online' && selectedEvent.meeting_link && (
                  <p>
                    <strong>Link:</strong>{' '}
                    <a href={selectedEvent.meeting_link} target="_blank" rel="noopener noreferrer">
                      {selectedEvent.meeting_link} <i className="bi bi-box-arrow-up-right"></i>
                    </a>
                  </p>
                )}
                {selectedEvent.meeting_type === 'in-person' && selectedEvent.meeting_location && (
                  <p><strong>Location:</strong> {selectedEvent.meeting_location}</p>
                )}
                {selectedEvent.description && (
                  <p><strong>Description:</strong> {selectedEvent.description}</p>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => {
                    navigate(`/meetings/${selectedEvent.id}`);
                    setShowEventModal(false);
                  }}
                >
                  View Details
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowEventModal(false);
                    setSelectedEvent(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;

