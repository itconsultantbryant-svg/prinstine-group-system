import React, { useState, useEffect } from 'react';
import api from '../../config/api';

const CourseForm = ({ course, onClose }) => {
  const [formData, setFormData] = useState({
    course_code: '',
    title: '',
    description: '',
    mode: 'Online',
    start_date: '',
    end_date: '',
    max_students: '',
    status: 'Active',
    course_fee: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (course) {
      setFormData({
        course_code: course.course_code || '',
        title: course.title || '',
        description: course.description || '',
        mode: course.mode || 'Online',
        start_date: course.start_date ? course.start_date.split('T')[0] : '',
        end_date: course.end_date ? course.end_date.split('T')[0] : '',
        max_students: course.max_students || '',
        status: course.status || 'Active',
        course_fee: course.course_fee || ''
      });
    }
  }, [course]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        course_code: formData.course_code,
        title: formData.title,
        description: formData.description,
        mode: formData.mode,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        max_students: formData.max_students ? parseInt(formData.max_students) : null,
        status: formData.status,
        course_fee: formData.course_fee ? parseFloat(formData.course_fee) : 0
      };

      if (course) {
        await api.put(`/academy/courses/${course.id}`, payload);
      } else {
        await api.post('/academy/courses', payload);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{course ? 'Edit Course' : 'Add Course'}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Course Code *</label>
                  <input type="text" className="form-control" name="course_code" value={formData.course_code} onChange={handleChange} required disabled={!!course} />
                  {course && <small className="form-text text-muted">Course code cannot be changed</small>}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Title *</label>
                  <input type="text" className="form-control" name="title" value={formData.title} onChange={handleChange} required />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea className="form-control" name="description" value={formData.description} onChange={handleChange} rows="3" />
              </div>

              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">Mode *</label>
                  <select className="form-select" name="mode" value={formData.mode} onChange={handleChange} required>
                    <option value="Online">Online</option>
                    <option value="In-person">In-person</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Start Date</label>
                  <input type="date" className="form-control" name="start_date" value={formData.start_date} onChange={handleChange} />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">End Date</label>
                  <input type="date" className="form-control" name="end_date" value={formData.end_date} onChange={handleChange} />
                </div>
              </div>

              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">Course Fee *</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-control" 
                      name="course_fee" 
                      value={formData.course_fee} 
                      onChange={handleChange} 
                      min="0"
                      required
                    />
                  </div>
                  <small className="form-text text-muted">Course fee requires admin approval</small>
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Max Students</label>
                  <input type="number" className="form-control" name="max_students" value={formData.max_students} onChange={handleChange} min="1" />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Status</label>
                  <select className="form-select" name="status" value={formData.status} onChange={handleChange}>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : course ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CourseForm;

