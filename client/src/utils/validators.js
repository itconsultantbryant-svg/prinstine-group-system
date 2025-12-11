// Form validation utilities

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePassword = (password) => {
  // At least 8 characters, one uppercase, one lowercase, one number
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return re.test(password);
};

export const validatePhone = (phone) => {
  // Basic phone validation (allows various formats)
  const re = /^[\d\s\-\+\(\)]+$/;
  return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

export const validateRequired = (value) => {
  return value !== null && value !== undefined && value.toString().trim() !== '';
};

export const validateNumber = (value, min = null, max = null) => {
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  if (min !== null && num < min) return false;
  if (max !== null && num > max) return false;
  return true;
};

export const validateDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

export const validateDateRange = (startDate, endDate) => {
  if (!validateDate(startDate) || !validateDate(endDate)) return false;
  return new Date(startDate) <= new Date(endDate);
};

export const getValidationError = (field, value, rules) => {
  if (rules.required && !validateRequired(value)) {
    return `${field} is required`;
  }
  if (value && rules.email && !validateEmail(value)) {
    return `${field} must be a valid email address`;
  }
  if (value && rules.password && !validatePassword(value)) {
    return `${field} must be at least 8 characters with uppercase, lowercase, and number`;
  }
  if (value && rules.phone && !validatePhone(value)) {
    return `${field} must be a valid phone number`;
  }
  if (value && rules.number && !validateNumber(value, rules.min, rules.max)) {
    return `${field} must be a valid number${rules.min !== null ? ` (min: ${rules.min})` : ''}${rules.max !== null ? ` (max: ${rules.max})` : ''}`;
  }
  if (value && rules.date && !validateDate(value)) {
    return `${field} must be a valid date`;
  }
  if (rules.dateRange && !validateDateRange(rules.startDate, rules.endDate)) {
    return 'End date must be after start date';
  }
  return null;
};

