import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { isAcademyStaff, canApproveAcademy } from '../../utils/academyUtils';
import StudentForm from './StudentForm';
import CourseForm from './CourseForm';
import InstructorForm from './InstructorForm';
import CohortForm from './CohortForm';

const AcademyManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showInstructorForm, setShowInstructorForm] = useState(false);
  const [showCohortForm, setShowCohortForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [editingInstructor, setEditingInstructor] = useState(null);
  const [editingCohort, setEditingCohort] = useState(null);
  
  // Filter states for students
  const [studentFilters, setStudentFilters] = useState({
    cohort_id: '',
    period: '',
    start_date: '',
    end_date: '',
    status: '',
    search: ''
  });
  
  // Check if user is Academy staff (can add/edit/view)
  const userIsAcademyStaff = isAcademyStaff(user);
  // Check if user can approve (Admin only)
  const userCanApprove = canApproveAcademy(user);

  useEffect(() => {
    if (activeTab === 'courses') {
      fetchCourses();
    } else if (activeTab === 'students') {
      fetchStudents();
    } else if (activeTab === 'instructors') {
      fetchInstructors();
    } else if (activeTab === 'cohorts') {
      fetchCohorts();
    }
  }, [activeTab]);
  
  // Fetch students when filters change
  useEffect(() => {
    if (activeTab === 'students') {
      fetchStudents();
    }
  }, [studentFilters]);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/academy/courses');
      setCourses(response.data.courses);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (studentFilters.cohort_id) params.append('cohort_id', studentFilters.cohort_id);
      if (studentFilters.period) params.append('period', studentFilters.period);
      if (studentFilters.start_date) params.append('start_date', studentFilters.start_date);
      if (studentFilters.end_date) params.append('end_date', studentFilters.end_date);
      if (studentFilters.status) params.append('status', studentFilters.status);
      if (studentFilters.search) params.append('search', studentFilters.search);
      
      const response = await api.get(`/academy/students?${params.toString()}`);
      setStudents(response.data.students);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchCohorts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/academy/cohorts');
      setCohorts(response.data.cohorts || []);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
      setCohorts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstructors = async () => {
    try {
      setLoading(true);
      const response = await api.get('/academy/instructors');
      console.log('Instructors fetched:', response.data);
      setInstructors(response.data.instructors || []);
    } catch (error) {
      console.error('Error fetching instructors:', error);
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = () => {
    setEditingStudent(null);
    setShowStudentForm(true);
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setShowStudentForm(true);
  };

  const handleDeleteStudent = async (id) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await api.delete(`/academy/students/${id}`);
        fetchStudents();
      } catch (error) {
        alert(error.response?.data?.error || 'Error deleting student');
      }
    }
  };

  const handleAddCourse = () => {
    setEditingCourse(null);
    setShowCourseForm(true);
  };

  const handleAddInstructor = () => {
    setEditingInstructor(null);
    setShowInstructorForm(true);
  };
  
  const handleAddCohort = () => {
    setEditingCohort(null);
    setShowCohortForm(true);
  };
  
  const handleEditCohort = (cohort) => {
    setEditingCohort(cohort);
    setShowCohortForm(true);
  };
  
  const handleDeleteCohort = async (id) => {
    if (window.confirm('Are you sure you want to delete this cohort?')) {
      try {
        await api.delete(`/academy/cohorts/${id}`);
        fetchCohorts();
      } catch (error) {
        alert(error.response?.data?.error || 'Error deleting cohort');
      }
    }
  };
  
  const handleFilterChange = (name, value) => {
    setStudentFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const clearFilters = () => {
    setStudentFilters({
      cohort_id: '',
      period: '',
      start_date: '',
      end_date: '',
      status: '',
      search: ''
    });
  };

  const handleEditInstructor = async (instructor) => {
    try {
      const response = await api.get(`/academy/instructors/${instructor.id}`);
      setEditingInstructor(response.data.instructor);
      setShowInstructorForm(true);
    } catch (error) {
      console.error('Error fetching instructor details:', error);
      setEditingInstructor(instructor);
      setShowInstructorForm(true);
    }
  };

  const handleDeleteInstructor = async (id) => {
    if (window.confirm('Are you sure you want to delete this instructor?')) {
      try {
        await api.delete(`/academy/instructors/${id}`);
        fetchInstructors();
      } catch (error) {
        alert(error.response?.data?.error || 'Error deleting instructor');
      }
    }
  };

  const handleEditCourse = async (course) => {
    try {
      const response = await api.get(`/academy/courses/${course.id}`);
      setEditingCourse(response.data.course);
      setShowCourseForm(true);
    } catch (error) {
      console.error('Error fetching course details:', error);
      setEditingCourse(course);
      setShowCourseForm(true);
    }
  };

  const handleDeleteCourse = async (id) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      try {
        await api.delete(`/academy/courses/${id}`);
        fetchCourses();
      } catch (error) {
        alert(error.response?.data?.error || 'Error deleting course');
      }
    }
  };

  const handleApproveCourseFee = async (courseId, approved) => {
    try {
      await api.put(`/academy/courses/${courseId}/approve-fee`, { approved });
      fetchCourses();
      alert(`Course fee ${approved ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to process approval');
    }
  };

  const handleApproveInstructor = async (instructorId, approved) => {
    try {
      await api.put(`/academy/instructors/${instructorId}/approve`, { approved });
      fetchInstructors();
      alert(`Instructor ${approved ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to process approval');
    }
  };

  const handleApproveStudent = async (studentId, approved) => {
    try {
      await api.put(`/academy/students/${studentId}/approve`, { approved });
      fetchStudents();
      alert(`Student ${approved ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to process approval');
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <h1 className="h3 mb-0">Academy Management</h1>
          {(user?.role === 'Admin' || userIsAcademyStaff) && (
            <div>
              {activeTab === 'courses' && (
                <button className="btn btn-primary me-2" onClick={handleAddCourse}>
                  <i className="bi bi-plus-circle me-2"></i>Add Course
                </button>
              )}
              {activeTab === 'students' && (
                <button className="btn btn-primary me-2" onClick={handleAddStudent}>
                  <i className="bi bi-plus-circle me-2"></i>Add Student
                </button>
              )}
              {activeTab === 'instructors' && (
                <button className="btn btn-primary me-2" onClick={handleAddInstructor}>
                  <i className="bi bi-plus-circle me-2"></i>Add Instructor
                </button>
              )}
              {activeTab === 'cohorts' && (
                <button className="btn btn-primary" onClick={handleAddCohort}>
                  <i className="bi bi-plus-circle me-2"></i>Add Cohort
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ul className="nav nav-tabs mb-4">
        {(user?.role === 'Admin' || userIsAcademyStaff || user?.role === 'Instructor' || user?.role === 'Student') && (
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'courses' ? 'active' : ''}`}
              onClick={() => setActiveTab('courses')}
            >
              Courses
            </button>
          </li>
        )}
        {userIsAcademyStaff && (
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              Students
            </button>
          </li>
        )}
        {userIsAcademyStaff && (
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'instructors' ? 'active' : ''}`}
              onClick={() => setActiveTab('instructors')}
            >
              Instructors
            </button>
          </li>
        )}
        {userIsAcademyStaff && (
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'cohorts' ? 'active' : ''}`}
              onClick={() => setActiveTab('cohorts')}
            >
              Cohorts
            </button>
          </li>
        )}
      </ul>

      {((user?.role === 'Admin' || userIsAcademyStaff || user?.role === 'Instructor' || user?.role === 'Student')) && activeTab === 'courses' && (
        <div className="card">
          <div className="card-body">
            {courses.length === 0 ? (
              <div className="text-center text-muted">
                {userIsAcademyStaff ? 'No courses found. Click "Add Course" to create one.' : 'No courses found.'}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Title</th>
                      <th>Fee</th>
                      <th>Fee Approval</th>
                      <th>Mode</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course.id}>
                        <td><strong>{course.course_code}</strong></td>
                        <td>{course.title}</td>
                        <td>${parseFloat(course.course_fee || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>
                          {course.fee_approved === 1 ? (
                            <span className="badge bg-success">Approved</span>
                          ) : course.fee_approved === 2 ? (
                            <span className="badge bg-danger">Rejected</span>
                          ) : (
                            <span className="badge bg-warning">Pending</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge bg-${
                            course.mode === 'Online' ? 'primary' :
                            course.mode === 'In-person' ? 'success' : 'warning'
                          }`}>
                            {course.mode}
                          </span>
                        </td>
                        <td>
                          <span className={`badge bg-${
                            course.status === 'Active' ? 'success' : 'secondary'
                          }`}>
                            {course.status}
                          </span>
                        </td>
                        <td>
                          <Link to={`/academy/courses/view/${course.id}`} className="btn btn-sm btn-outline-info me-2">
                            <i className="bi bi-eye me-1"></i>View
                          </Link>
                          {userIsAcademyStaff && (
                            <>
                              <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEditCourse(course)}>
                                <i className="bi bi-pencil me-1"></i>Edit
                              </button>
                              {userCanApprove && course.fee_approved === 0 && (
                                <>
                                  <button 
                                    className="btn btn-sm btn-outline-success me-2" 
                                    onClick={() => handleApproveCourseFee(course.id, true)}
                                  >
                                    <i className="bi bi-check-circle me-1"></i>Approve Fee
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-outline-danger me-2" 
                                    onClick={() => handleApproveCourseFee(course.id, false)}
                                  >
                                    <i className="bi bi-x-circle me-1"></i>Reject Fee
                                  </button>
                                </>
                              )}
                              <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteCourse(course.id)}>
                                <i className="bi bi-trash me-1"></i>Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="card">
          <div className="card-body">
            {/* Filters */}
            <div className="row mb-3">
              <div className="col-md-2">
                <label className="form-label">Cohort</label>
                <select
                  className="form-select form-select-sm"
                  value={studentFilters.cohort_id}
                  onChange={(e) => handleFilterChange('cohort_id', e.target.value)}
                >
                  <option value="">All Cohorts</option>
                  {cohorts.filter(c => c.status === 'Active').map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Period</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="e.g., Q1 2024"
                  value={studentFilters.period}
                  onChange={(e) => handleFilterChange('period', e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={studentFilters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={studentFilters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">Status</label>
                <select
                  className="form-select form-select-sm"
                  value={studentFilters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Graduated">Graduated</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Dropped">Dropped</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Search</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Name, email, ID"
                  value={studentFilters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </div>
            </div>
            <div className="mb-3">
              <button className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>
                <i className="bi bi-x-circle me-1"></i>Clear Filters
              </button>
            </div>
            
            <div className="table-responsive">
              <table className="table table-hover">
                  <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Cohort</th>
                    <th>Period</th>
                    <th>Status</th>
                    <th>Approval Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center text-muted">
                        No students found. Click "Add Student" to create one.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.id}>
                        <td>{student.student_id}</td>
                        <td>{student.name}</td>
                        <td>{student.email}</td>
                        <td>{student.cohort_name || <span className="text-muted">-</span>}</td>
                        <td>{student.period || <span className="text-muted">-</span>}</td>
                        <td>
                          <span className={`badge bg-${
                            student.status === 'Active' ? 'success' : 'secondary'
                          }`}>
                            {student.status}
                          </span>
                        </td>
                        <td>
                          {student.approved === 1 ? (
                            <span className="badge bg-success">Approved</span>
                          ) : student.approved === 2 ? (
                            <span className="badge bg-danger">Rejected</span>
                          ) : (
                            <span className="badge bg-warning">Pending</span>
                          )}
                        </td>
                        <td>
                          <Link to={`/academy/students/view/${student.id}`} className="btn btn-sm btn-outline-info me-2">
                            <i className="bi bi-eye me-1"></i>View
                          </Link>
                          {userIsAcademyStaff && (
                            <>
                              <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEditStudent(student)}>
                                <i className="bi bi-pencil me-1"></i>Edit
                              </button>
                              {userCanApprove && student.approved === 0 && (
                                <>
                                  <button 
                                    className="btn btn-sm btn-outline-success me-2" 
                                    onClick={() => handleApproveStudent(student.id, true)}
                                  >
                                    <i className="bi bi-check-circle me-1"></i>Approve
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-outline-danger me-2" 
                                    onClick={() => handleApproveStudent(student.id, false)}
                                  >
                                    <i className="bi bi-x-circle me-1"></i>Reject
                                  </button>
                                </>
                              )}
                              <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteStudent(student.id)}>
                                <i className="bi bi-trash me-1"></i>Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showStudentForm && (
        <StudentForm
          student={editingStudent}
          onClose={() => {
            setShowStudentForm(false);
            setEditingStudent(null);
            fetchStudents();
          }}
        />
      )}

      {activeTab === 'instructors' && (
        <div className="card">
          <div className="card-body">
            {instructors.length === 0 ? (
              <div className="text-center text-muted">No instructors found. Click "Add Instructor" to create one.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Instructor ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Specialization</th>
                      <th>Courses Assigned</th>
                      <th>Approval Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instructors.map((instructor) => (
                      <tr key={instructor.id}>
                        <td><strong>{instructor.instructor_id}</strong></td>
                        <td>{instructor.name}</td>
                        <td>{instructor.email}</td>
                        <td>{instructor.specialization || 'N/A'}</td>
                        <td>
                          {instructor.courses_assigned ? (
                            JSON.parse(instructor.courses_assigned).length
                          ) : 0} course(s)
                        </td>
                        <td>
                          {instructor.approved === 1 ? (
                            <span className="badge bg-success">Approved</span>
                          ) : instructor.approved === 2 ? (
                            <span className="badge bg-danger">Rejected</span>
                          ) : (
                            <span className="badge bg-warning">Pending</span>
                          )}
                        </td>
                        <td>
                          <Link to={`/academy/instructors/view/${instructor.id}`} className="btn btn-sm btn-outline-info me-2">
                            <i className="bi bi-eye me-1"></i>View
                          </Link>
                          {userIsAcademyStaff && (
                            <>
                              <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEditInstructor(instructor)}>
                                <i className="bi bi-pencil me-1"></i>Edit
                              </button>
                              {userCanApprove && instructor.approved === 0 && (
                                <>
                                  <button 
                                    className="btn btn-sm btn-outline-success me-2" 
                                    onClick={() => handleApproveInstructor(instructor.id, true)}
                                  >
                                    <i className="bi bi-check-circle me-1"></i>Approve
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-outline-danger me-2" 
                                    onClick={() => handleApproveInstructor(instructor.id, false)}
                                  >
                                    <i className="bi bi-x-circle me-1"></i>Reject
                                  </button>
                                </>
                              )}
                              <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteInstructor(instructor.id)}>
                                <i className="bi bi-trash me-1"></i>Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showStudentForm && (
        <StudentForm
          student={editingStudent}
          onClose={() => {
            setShowStudentForm(false);
            setEditingStudent(null);
            fetchStudents();
          }}
        />
      )}

      {showCourseForm && (
        <CourseForm
          course={editingCourse}
          onClose={() => {
            setShowCourseForm(false);
            setEditingCourse(null);
            fetchCourses();
          }}
        />
      )}

      {showInstructorForm && (
        <InstructorForm
          instructor={editingInstructor}
          courses={courses}
          onClose={() => {
            setShowInstructorForm(false);
            setEditingInstructor(null);
            fetchInstructors();
          }}
        />
      )}

      {activeTab === 'cohorts' && (
        <div className="card">
          <div className="card-body">
            {cohorts.length === 0 ? (
              <div className="text-center text-muted">No cohorts found. Click "Add Cohort" to create one.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Period</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.map((cohort) => (
                      <tr key={cohort.id}>
                        <td><strong>{cohort.code}</strong></td>
                        <td>{cohort.name}</td>
                        <td>{cohort.period || <span className="text-muted">-</span>}</td>
                        <td>{cohort.start_date ? new Date(cohort.start_date).toLocaleDateString() : <span className="text-muted">-</span>}</td>
                        <td>{cohort.end_date ? new Date(cohort.end_date).toLocaleDateString() : <span className="text-muted">-</span>}</td>
                        <td>
                          <span className={`badge bg-${
                            cohort.status === 'Active' ? 'success' :
                            cohort.status === 'Completed' ? 'info' : 'secondary'
                          }`}>
                            {cohort.status}
                          </span>
                        </td>
                        <td>
                          {userIsAcademyStaff && (
                            <>
                              <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEditCohort(cohort)}>
                                <i className="bi bi-pencil me-1"></i>Edit
                              </button>
                              <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteCohort(cohort.id)}>
                                <i className="bi bi-trash me-1"></i>Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showCohortForm && (
        <CohortForm
          cohort={editingCohort}
          onClose={() => {
            setShowCohortForm(false);
            setEditingCohort(null);
            fetchCohorts();
          }}
        />
      )}
    </div>
  );
};

export default AcademyManagement;

