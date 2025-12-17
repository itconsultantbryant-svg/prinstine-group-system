import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import { isAcademyStaff, canApproveAcademy } from '../../utils/academyUtils';
import StudentForm from './StudentForm';
import CourseForm from './CourseForm';
import InstructorForm from './InstructorForm';

const AcademyManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showInstructorForm, setShowInstructorForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [editingInstructor, setEditingInstructor] = useState(null);
  
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
    }
  }, [activeTab]);

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
      const response = await api.get('/academy/students');
      setStudents(response.data.students);
    } catch (error) {
      console.error('Error fetching students:', error);
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
          <div>
            {activeTab === 'courses' && userIsAcademyStaff && (
              <button className="btn btn-primary me-2" onClick={handleAddCourse}>
                <i className="bi bi-plus-circle me-2"></i>Add Course
              </button>
            )}
            {activeTab === 'students' && userIsAcademyStaff && (
              <button className="btn btn-primary me-2" onClick={handleAddStudent}>
                <i className="bi bi-plus-circle me-2"></i>Add Student
              </button>
            )}
            {activeTab === 'instructors' && userIsAcademyStaff && (
              <button className="btn btn-primary" onClick={handleAddInstructor}>
                <i className="bi bi-plus-circle me-2"></i>Add Instructor
              </button>
            )}
          </div>
        </div>
      </div>

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'courses' ? 'active' : ''}`}
            onClick={() => setActiveTab('courses')}
          >
            Courses
          </button>
        </li>
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
      </ul>

      {activeTab === 'courses' && (
        <div className="card">
          <div className="card-body">
            {courses.length === 0 ? (
              <div className="text-center text-muted">No courses found. Click "Add Course" to create one.</div>
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
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Approval Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted">
                        No students found. Click "Add Student" to create one.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.id}>
                        <td>{student.student_id}</td>
                        <td>{student.name}</td>
                        <td>{student.email}</td>
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
    </div>
  );
};

export default AcademyManagement;

