import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// Enhanced Components
import EnhancedGoalCards from './components/EnhancedGoalCards';
import ActivityFeed, { NotificationBadge } from './components/ActivityFeed';
import EnhancedProgressModal from './components/EnhancedProgressModal';
import ClickableAnalyticsDashboard from './components/ClickableAnalyticsDashboard';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${API}/auth/register`, userData);
      const { access_token, user: newUser } = response.data;
      
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(newUser);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Forgot Password Modal
const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post(`${API}/auth/forgot-password`, { email });
      setMessage(response.data.message);
      
      // Handle demo mode - check for demo_reset_url or demo_reset_token
      if (response.data.demo_mode) {
        if (response.data.demo_reset_url) {
          // Extract token from URL
          const urlParams = new URLSearchParams(response.data.demo_reset_url.split('?')[1]);
          const token = urlParams.get('token');
          if (token) {
            setResetToken(token);
            setShowResetForm(true);
          }
        } else if (response.data.demo_reset_token) {
          // Legacy support for direct token
          setResetToken(response.data.demo_reset_token);
          setShowResetForm(true);
        }
        
        // Show demo instructions
        if (response.data.demo_instructions) {
          setMessage(response.data.message + '\n\n' + 'Demo Mode: ' + response.data.demo_instructions);
        }
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post(`${API}/auth/reset-password`, {
        token: resetToken,
        new_password: newPassword
      });
      setMessage('Password reset successfully! You can now login with your new password.');
      setShowResetForm(false);
      
      // Close modal after delay
      setTimeout(() => {
        onClose();
        resetForm();
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setNewPassword('');
    setResetToken('');
    setMessage('');
    setError('');
    setShowResetForm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {showResetForm ? 'Reset Password' : 'Forgot Password'}
            </h2>
            <button
              onClick={() => { onClose(); resetForm(); }}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {!showResetForm ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email address"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {message && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
                <strong>Demo Mode:</strong> Reset token: {resetToken}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your new password"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {message && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// Login Component
const LoginForm = ({ onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { login } = React.useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to Goal Spark 2.0</p>
          <p className="text-sm text-blue-600 mt-2">Please use your work email address</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <button
              onClick={onToggle}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign up
            </button>
          </p>
          <p className="text-gray-600 mt-2">
            <button
              onClick={() => setShowForgotPassword(true)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Forgot your password?
            </button>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
};

// Registration Component
const RegistrationForm = ({ onToggle }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    job_title: '',
    manager_id: ''
  });
  const [managers, setManagers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = React.useContext(AuthContext);

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    try {
      const response = await axios.get(`${API}/managers`);
      setManagers(response.data);
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Convert "none" to null for manager_id to indicate admin role
    const submitData = {
      ...formData,
      manager_id: formData.manager_id === "none" ? null : formData.manager_id || null
    };

    const result = await register(submitData);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join Your Team</h1>
          <p className="text-gray-600">Create your Goal Spark 2.0 account</p>
          <p className="text-sm text-blue-600 mt-2">Use your work email address to register</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
            <input
              type="text"
              name="job_title"
              value={formData.job_title}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Your Manager</label>
            <select
              name="manager_id"
              value={formData.manager_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Choose your direct manager</option>
              <option value="none" className="font-semibold text-blue-600">
                I do not have a Manager - I am the Manager
              </option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.first_name} {manager.last_name} - {manager.job_title}
                </option>
              ))}
            </select>
            {formData.manager_id === "none" && (
              <p className="mt-1 text-sm text-blue-600">
                ✓ You will be registered as a Manager with admin privileges
              </p>
            )}
            {formData.manager_id && formData.manager_id !== "none" && (
              <p className="mt-1 text-sm text-green-600">
                ✓ You will be registered as an Employee under the selected manager
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <button
              onClick={onToggle}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// Simple Chart Components (using CSS for visual representation)
const BarChart = ({ data, title }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center">
            <div className="w-20 text-sm text-gray-600 text-right mr-3">
              {item.label}
            </div>
            <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
              <div 
                className="bg-blue-500 h-6 rounded-full transition-all duration-500"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              ></div>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LineChart = ({ data, title }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((item.value / maxValue) * 80);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="relative">
        <svg className="w-full h-40" viewBox="0 0 100 100">
          <polyline
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
            points={points}
          />
          {data.map((item, index) => {
            const x = (index / (data.length - 1)) * 100;
            const y = 100 - ((item.value / maxValue) * 80);
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="3"
                fill="#3B82F6"
              />
            );
          })}
        </svg>
        <div className="flex justify-between mt-2 text-xs text-gray-600">
          {data.map((item, index) => (
            <span key={index}>{item.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

const PieChart = ({ data, title }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulativePercentage = 0;

  const colors = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="flex items-center justify-center">
        <svg className="w-32 h-32" viewBox="0 0 42 42">
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#E5E7EB" strokeWidth="3"/>
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const strokeDasharray = `${percentage} ${100 - percentage}`;
            const strokeDashoffset = -cumulativePercentage;
            cumulativePercentage += percentage;
            
            return (
              <circle
                key={index}
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                stroke={colors[index % colors.length]}
                strokeWidth="3"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 21 21)"
              />
            );
          })}
        </svg>
        <div className="ml-6 space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center text-sm">
              <div 
                className="w-3 h-3 rounded mr-2" 
                style={{ backgroundColor: colors[index % colors.length] }}
              ></div>
              <span className="text-gray-600">{item.label}: {item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Analytics Dashboard Component
const AnalyticsDashboard = ({ onBack }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDemoDataButton, setShowDemoDataButton] = useState(true); // Always show initially

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      const response = await axios.get(`${API}/analytics/dashboard`);
      setAnalyticsData(response.data);
      
      console.log('Analytics data received:', response.data);
      
      // Show analytics if we have ANY data (even if minimal)
      if (response.data && response.data.team_overview) {
        const hasData = response.data.team_overview.total_employees > 0 || 
                       response.data.employee_performance?.length > 0 ||
                       response.data.performance_trends?.length > 0;
        
        if (hasData) {
          console.log('Has analytics data, hiding demo button');
          setShowDemoDataButton(false);
        } else {
          console.log('No meaningful analytics data, showing demo button');
          setShowDemoDataButton(true);
        }
      } else {
        setShowDemoDataButton(true);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setAnalyticsData({ 
        team_overview: { total_employees: 0, total_goals: 0, active_goals: 0, completed_goals: 0, completion_rate: 0, avg_progress: 0 }, 
        performance_trends: [], 
        goal_completion_stats: { total: 0, on_track: 0, at_risk: 0, off_track: 0, on_track_percentage: 0, at_risk_percentage: 0, off_track_percentage: 0 }, 
        employee_performance: [], 
        status_distribution: { on_track: 0, at_risk: 0, off_track: 0 }, 
        recent_activities: [] 
      });
      setShowDemoDataButton(true);
    } finally {
      setLoading(false);
    }
  };

  const generateDemoData = async () => {
    console.log('Generate Demo Data button clicked');
    setLoading(true);
    
    try {
      console.log('Calling demo data API...');
      const response = await axios.post(`${API}/demo/generate-data`);
      console.log('Demo data response:', response.data);
      
      // Force hide the demo button and refresh data
      setShowDemoDataButton(false);
      await fetchAnalyticsData();
      
      // Show success message (optional)
      alert(`Demo data generated successfully! ${response.data.message}`);
      
    } catch (error) {
      console.error('Error generating demo data:', error);
      alert('Error generating demo data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (showDemoDataButton) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={onBack}
                  className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                >
                  <span>←</span>
                  <span>Back to Dashboard</span>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
                  <p className="text-sm text-gray-600">Performance insights and reporting</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data Available</h3>
            <p className="text-gray-600 mb-6">
              Generate demo data to see the powerful analytics capabilities of the Goal Spark 2.0 system.
            </p>
            <button
              onClick={generateDemoData}
              disabled={loading}
              className={`px-6 py-3 rounded-lg font-medium transition duration-200 ${
                loading 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Generating Demo Data...' : 'Generate Demo Data'}
            </button>
            <div className="mt-4 text-sm text-gray-500">
              This will create 3 test employees with 4 months of realistic goal tracking history
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { team_overview, performance_trends, goal_completion_stats, employee_performance, status_distribution, recent_activities } = analyticsData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
              >
                <span>←</span>
                <span>Back to Dashboard</span>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
                <p className="text-sm text-gray-600">Performance insights and reporting</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM9 9a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{team_overview.total_employees}</p>
                <p className="text-gray-600">Team Members</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{team_overview.completion_rate}%</p>
                <p className="text-gray-600">Completion Rate</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{team_overview.active_goals}</p>
                <p className="text-gray-600">Active Goals</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{team_overview.avg_progress}%</p>
                <p className="text-gray-600">Avg Progress</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Performance Trends */}
          <LineChart
            title="Performance Trends (4 Months)"
            data={performance_trends.map(trend => ({
              label: trend.month.split(' ')[0].slice(0, 3),
              value: trend.completion_rate
            }))}
          />

          {/* Status Distribution */}
          <PieChart
            title="Goal Status Distribution"
            data={[
              { label: 'On Track', value: status_distribution.on_track },
              { label: 'At Risk', value: status_distribution.at_risk },
              { label: 'Off Track', value: status_distribution.off_track }
            ]}
          />
        </div>

        {/* Employee Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <BarChart
            title="Employee Performance Scores"
            data={employee_performance.map(emp => ({
              label: emp.name.split(' ').slice(-1)[0], // Last name
              value: emp.performance_score
            }))}
          />

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Performance Details</h3>
            <div className="space-y-4">
              {employee_performance.map((employee, index) => (
                <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{employee.name}</h4>
                      <p className="text-sm text-gray-600">{employee.role}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      employee.performance_score >= 80 ? 'bg-green-100 text-green-800' :
                      employee.performance_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {employee.performance_score.toFixed(0)} Score
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Goals:</span> {employee.total_goals}
                    </div>
                    <div>
                      <span className="text-gray-600">Completed:</span> {employee.completed_goals}
                    </div>
                    <div>
                      <span className="text-gray-600">Progress:</span> {employee.avg_progress}%
                    </div>
                  </div>
                  <div className="flex space-x-4 mt-2 text-xs">
                    <span className="text-green-600">🟢 {employee.status_distribution.on_track}</span>
                    <span className="text-yellow-600">🟡 {employee.status_distribution.at_risk}</span>
                    <span className="text-red-600">🔴 {employee.status_distribution.off_track}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {recent_activities.map((activity, index) => (
              <div key={index} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {activity.employee_name} updated "{activity.goal_title}"
                    </p>
                    <p className="text-sm text-gray-600">
                      Progress: {activity.progress_value} / {activity.target_value} {activity.unit}
                    </p>
                    {activity.comment && (
                      <p className="text-sm text-gray-500 italic mt-1">"{activity.comment}"</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      activity.status === 'on_track' ? 'bg-green-100 text-green-800' :
                      activity.status === 'at_risk' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {activity.status === 'on_track' ? '🟢 On Track' :
                       activity.status === 'at_risk' ? '🟡 At Risk' : '🔴 Off Track'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

// Continue with rest of components...
// [The rest of the components remain the same - TeamPage, GoalCreationModal, ProgressUpdateModal, Dashboard]

// Employee Invitation Modal
const EmployeeInviteModal = ({ isOpen, onClose, onEmployeeInvited }) => {
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    job_title: '',
    custom_role: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`${API}/team/invite`, formData);
      setSuccess(`Employee invited successfully! Temporary password: ${response.data.temp_password}`);
      onEmployeeInvited();
      
      // Reset form after delay
      setTimeout(() => {
        onClose();
        setFormData({ email: '', first_name: '', last_name: '', job_title: '', custom_role: '' });
        setSuccess('');
      }, 3000);
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to invite employee');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Invite Employee</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="employee@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
              <input
                type="text"
                name="job_title"
                value={formData.job_title}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Sales Representative"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Role</label>
              <input
                type="text"
                name="custom_role"
                value={formData.custom_role}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Sales Rep, Support Specialist"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
              >
                {loading ? 'Inviting...' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Team Management Component
const TeamPage = ({ onBack }) => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [editingMember, setEditingMember] = useState(null);
  const [editData, setEditData] = useState({ job_title: '', custom_role: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [customRoleFilter, setCustomRoleFilter] = useState('all');

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  useEffect(() => {
    // Apply filters whenever search term, role filter, or team members change
    applyFilters();
  }, [searchTerm, roleFilter, customRoleFilter, teamMembers]);

  const fetchTeamMembers = async () => {
    try {
      const response = await axios.get(`${API}/team`);
      setTeamMembers(response.data);
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = teamMembers;

    // Search filter (name, email, job title)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(member =>
        `${member.first_name} ${member.last_name}`.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        member.job_title.toLowerCase().includes(term) ||
        (member.custom_role && member.custom_role.toLowerCase().includes(term))
      );
    }

    // Role filter (admin/employee)
    if (roleFilter !== 'all') {
      filtered = filtered.filter(member => member.role === roleFilter);
    }

    // Custom role filter
    if (customRoleFilter !== 'all') {
      filtered = filtered.filter(member => 
        member.custom_role === customRoleFilter || 
        (customRoleFilter === 'none' && !member.custom_role)
      );
    }

    setFilteredMembers(filtered);
  };

  const handleEmployeeInvited = () => {
    fetchTeamMembers();
  };

  const handleEdit = (member) => {
    setEditingMember(member.id);
    setEditData({
      job_title: member.job_title,
      custom_role: member.custom_role || member.job_title
    });
  };

  const handleSave = async (memberId) => {
    setSaving(true);
    try {
      await axios.put(`${API}/team/${memberId}`, editData);
      await fetchTeamMembers();
      setEditingMember(null);
    } catch (error) {
      console.error('Error updating team member:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingMember(null);
    setEditData({ job_title: '', custom_role: '' });
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading team...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
              >
                <span>←</span>
                <span>Back to Dashboard</span>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
                <p className="text-sm text-gray-600">Manage your team members and roles</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter Team Members</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search by name, email, or job title..."
              />
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles</option>
                <option value="admin">Managers</option>
                <option value="employee">Employees</option>
              </select>
            </div>

            {/* Custom Role Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Role</label>
              <select
                value={customRoleFilter}
                onChange={(e) => setCustomRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Custom Roles</option>
                {Array.from(new Set(teamMembers.map(m => m.custom_role || m.job_title))).map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Results Summary */}
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredMembers.length} of {teamMembers.length} team members
            {searchTerm && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                Search: "{searchTerm}"
              </span>
            )}
            {roleFilter !== 'all' && (
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                Role: {roleFilter === 'admin' ? 'Managers' : 'Employees'}
              </span>
            )}
            {customRoleFilter !== 'all' && (
              <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                Custom Role: {customRoleFilter}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Team Roster</h2>
              <p className="text-sm text-gray-600 mt-1">
                Showing {filteredMembers.length} of {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center space-x-2"
            >
              <span>+</span>
              <span>Invite Employee</span>
            </button>
          </div>

          {teamMembers.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM9 9a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No team members yet</h3>
              <p className="text-gray-600">
                Team members will appear here when they register and select you as their manager.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Custom Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teamMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-medium">
                              {member.first_name[0]}{member.last_name[0]}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {member.first_name} {member.last_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          member.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {member.role === 'admin' ? 'Manager' : 'Employee'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingMember === member.id ? (
                          <input
                            type="text"
                            value={editData.job_title}
                            onChange={(e) => setEditData({...editData, job_title: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div className="text-sm text-gray-900">{member.job_title}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingMember === member.id ? (
                          <input
                            type="text"
                            value={editData.custom_role}
                            onChange={(e) => setEditData({...editData, custom_role: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Sales Rep, Developer, etc."
                          />
                        ) : (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {member.custom_role || member.job_title}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {editingMember === member.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSave(member.id)}
                              disabled={saving}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancel}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(member)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Role Summary */}
        {teamMembers.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from(new Set(teamMembers.map(m => m.custom_role || m.job_title))).map(role => {
                const count = teamMembers.filter(m => (m.custom_role || m.job_title) === role).length;
                return (
                  <div key={role} className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{count}</div>
                    <div className="text-sm text-gray-600">{role}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Employee Invite Modal */}
      <EmployeeInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onEmployeeInvited={handleEmployeeInvited}
      />
    </div>
  );
};

// Enhanced Goal Creation Modal
const GoalCreationModal = ({ isOpen, onClose, onGoalCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goal_type: 'target',
    target_value: '',
    comparison: 'greater_than',
    unit: '',
    cycle_type: 'monthly',
    start_date: '',
    end_date: '',
    assigned_to: [],
    assignment_type: 'individual',
    role_assignment: ''
  });
  const [teamMembers, setTeamMembers] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers();
      fetchCustomRoles();
      // Set default dates
      const now = new Date();
      const startDate = new Date(now);
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 1); // Default to 1 month

      setFormData(prev => ({
        ...prev,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      }));
    }
  }, [isOpen]);

  const fetchTeamMembers = async () => {
    try {
      const response = await axios.get(`${API}/users/team`);
      setTeamMembers(response.data);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const fetchCustomRoles = async () => {
    try {
      const response = await axios.get(`${API}/roles`);
      setCustomRoles(response.data);
    } catch (error) {
      console.error('Error fetching custom roles:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let goalData = {
        title: formData.title,
        description: formData.description,
        goal_type: formData.goal_type,
        target_value: parseFloat(formData.target_value),
        unit: formData.unit,
        cycle_type: formData.cycle_type,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        assigned_to: []
      };

      // Handle assignment type
      if (formData.assignment_type === 'role' && formData.role_assignment) {
        // Use the role-based assignment endpoint
        const response = await axios.post(`${API}/goals/assign-by-role?role_name=${encodeURIComponent(formData.role_assignment)}`, goalData);
        console.log('Role-based goal created:', response.data);
      } else if (formData.assignment_type === 'individual') {
        // Use individual assignment
        goalData.assigned_to = formData.assigned_to;
        goalData.comparison = formData.comparison;
        const response = await axios.post(`${API}/goals`, goalData);
        console.log('Individual goal created:', response.data);
      }

      onGoalCreated();
      onClose();
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        goal_type: 'target',
        target_value: '',
        unit: '',
        cycle_type: 'monthly',
        start_date: '',
        end_date: '',
        assigned_to: [],
        assignment_type: 'individual',
        role_assignment: ''
      });
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to create goal');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'assigned_to' && type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        assigned_to: checked 
          ? [...prev.assigned_to, value]
          : prev.assigned_to.filter(id => id !== value)
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Create New Goal</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Q1 Sales Target"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the goal and success criteria..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Type</label>
                <select
                  name="goal_type"
                  value={formData.goal_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="target">Target (Count)</option>
                  <option value="percentage">Percentage</option>
                  <option value="revenue">Revenue ($)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cycle</label>
                <select
                  name="cycle_type"
                  value={formData.cycle_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Value
                  </label>
                  <input
                    type="number"
                    name="target_value"
                    value={formData.target_value}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Goal Logic
                  </label>
                  <select
                    name="comparison"
                    value={formData.comparison}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="greater_than">Greater Than (≥)</option>
                    <option value="less_than">Less Than (≤)</option>
                    <option value="equal_to">Equal To (=)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="calls, $, %, units..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Assignment Type */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">Assignment Type</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="assignment_type"
                    value="individual"
                    checked={formData.assignment_type === 'individual'}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  Assign to specific team members
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="assignment_type"
                    value="role"
                    checked={formData.assignment_type === 'role'}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  Assign to everyone with a specific role
                </label>
              </div>
            </div>

            {/* Individual Assignment */}
            {formData.assignment_type === 'individual' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Team Members</label>
                {teamMembers.length === 0 ? (
                  <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                    No team members available. Team members need to register first.
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                    {teamMembers.map((member) => (
                      <label key={member.id} className="flex items-center">
                        <input
                          type="checkbox"
                          name="assigned_to"
                          value={member.id}
                          checked={formData.assigned_to.includes(member.id)}
                          onChange={handleChange}
                          className="mr-2"
                        />
                        <span>{member.first_name} {member.last_name} - {member.custom_role || member.job_title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Role Assignment */}
            {formData.assignment_type === 'role' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Role</label>
                {customRoles.length === 0 ? (
                  <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                    No custom roles available. Set up roles in the Team page first.
                  </div>
                ) : (
                  <select
                    name="role_assignment"
                    value={formData.role_assignment}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={formData.assignment_type === 'role'}
                  >
                    <option value="">Choose a role...</option>
                    {customRoles.map((roleData) => (
                      <option key={roleData.role} value={roleData.role}>
                        {roleData.role} ({roleData.count} member{roleData.count !== 1 ? 's' : ''})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || (formData.assignment_type === 'individual' && formData.assigned_to.length === 0) || (formData.assignment_type === 'role' && !formData.role_assignment)}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Goal'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Progress Update Modal (same as before, unchanged)
const ProgressUpdateModal = ({ isOpen, onClose, goal, onProgressUpdated }) => {
  const [formData, setFormData] = useState({
    new_value: '',
    status: 'on_track',
    comment: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && goal) {
      setFormData(prev => ({
        ...prev,
        new_value: goal.current_value.toString()
      }));
    }
  }, [isOpen, goal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post(`${API}/goals/${goal.id}/progress`, {
        goal_id: goal.id,
        new_value: parseFloat(formData.new_value),
        status: formData.status,
        comment: formData.comment || null
      });

      onProgressUpdated();
      onClose();
      setFormData({ new_value: '', status: 'on_track', comment: '' });
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to update progress');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const calculateProgress = () => {
    if (!goal || !formData.new_value) return 0;
    return Math.min((parseFloat(formData.new_value) / goal.target_value) * 100, 100);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'on_track': return 'bg-green-100 text-green-800 border-green-200';
      case 'at_risk': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'off_track': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'on_track': return '🟢 On Track';
      case 'at_risk': return '🟡 At Risk';
      case 'off_track': return '🔴 Off Track';
      default: return status;
    }
  };

  if (!isOpen || !goal) return null;

  const progress = calculateProgress();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Update Progress</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-lg text-gray-900 mb-2">{goal.title}</h3>
            <p className="text-gray-600 text-sm">{goal.description}</p>
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">
                Current: {goal.current_value} / {goal.target_value} {goal.unit}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Progress Value
              </label>
              <input
                type="number"
                name="new_value"
                value={formData.new_value}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
                required
              />
              {formData.new_value && (
                <div className="mt-2">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{progress.toFixed(1)}% complete</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <div className="space-y-2">
                {['on_track', 'at_risk', 'off_track'].map((status) => (
                  <label key={status} className="flex items-center">
                    <input
                      type="radio"
                      name="status"
                      value={status}
                      checked={formData.status === status}
                      onChange={handleChange}
                      className="mr-3"
                    />
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(status)}`}>
                      {getStatusText(status)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {(formData.status === 'at_risk' || formData.status === 'off_track') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comment <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="comment"
                  value={formData.comment}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Please explain why this goal is at risk or off track..."
                  required={formData.status !== 'on_track'}
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Progress'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Enhanced Dashboard Component
const Dashboard = () => {
  const { user, logout } = React.useContext(AuthContext);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showTeamPage, setShowTeamPage] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);

  useEffect(() => {
    fetchGoals();
    
    // Set up auto-refresh every 30 seconds for real-time updates
    const interval = setInterval(() => {
      fetchGoals();
    }, 30000);
    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, []);

  const fetchGoals = async () => {
    try {
      const response = await axios.get(`${API}/goals`);
      setGoals(response.data);
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoalCreated = () => {
    fetchGoals();
  };

  const handleProgressUpdated = () => {
    fetchGoals();
    setSelectedGoal(null);
  };

  const openProgressModal = (goal) => {
    setSelectedGoal(goal);
    setShowProgressModal(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'on_track': return 'bg-green-100 text-green-800 border-green-200';
      case 'at_risk': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'off_track': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'on_track': return '🟢 On Track';
      case 'at_risk': return '🟡 At Risk';
      case 'off_track': return '🔴 Off Track';
      default: return status;
    }
  };

  const getProgressBarColor = (status, progress) => {
    if (progress >= 100) return 'bg-green-500';
    switch (status) {
      case 'on_track': return 'bg-green-500';
      case 'at_risk': return 'bg-yellow-500';
      case 'off_track': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  const calculateProgress = (current, target) => {
    return Math.min((current / target) * 100, 100);
  };

  const getGoalsByStatus = () => {
    const onTrack = goals.filter(g => g.status === 'on_track');
    const atRisk = goals.filter(g => g.status === 'at_risk');
    const offTrack = goals.filter(g => g.status === 'off_track');
    
    return { onTrack, atRisk, offTrack };
  };

  if (showAnalytics) {
    return <ClickableAnalyticsDashboard onBack={() => setShowAnalytics(false)} />;
  }

  if (showTeamPage) {
    return <TeamPage onBack={() => setShowTeamPage(false)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your goals...</p>
        </div>
      </div>
    );
  }

  const { onTrack, atRisk, offTrack } = getGoalsByStatus();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Goal Spark 2.0</h1>
              <p className="text-sm text-gray-600">Welcome back, {user.first_name}!</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                user.role === 'admin' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {user.role === 'admin' ? 'Manager' : 'Employee'}
              </span>
              {user.role === 'admin' && (
                <>
                  <button
                    onClick={() => setShowAnalytics(true)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition duration-200 flex items-center space-x-2 relative"
                  >
                    <span>📊</span>
                    <span>Enhanced Analytics</span>
                    <NotificationBadge />
                  </button>
                  <button
                    onClick={() => setShowTeamPage(true)}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition duration-200 flex items-center space-x-2"
                  >
                    <span>👥</span>
                    <span>Team</span>
                  </button>
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center space-x-2"
                  >
                    <span>+</span>
                    <span>Create Goal</span>
                  </button>
                </>
              )}
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        {goals.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-gray-900">{goals.length}</div>
              <div className="text-gray-600">Total Goals</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-green-600">{onTrack.length}</div>
              <div className="text-gray-600">🟢 On Track</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-yellow-600">{atRisk.length}</div>
              <div className="text-gray-600">🟡 At Risk</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-red-600">{offTrack.length}</div>
              <div className="text-gray-600">🔴 Off Track</div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {user.role === 'admin' ? 'Team Goals Overview' : 'Your Active Goals'}
            </h2>
            <div className="text-sm text-gray-500">
              Auto-refreshes every 30 seconds
            </div>
          </div>

          {goals.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No goals yet</h3>
              <p className="text-gray-600">
                {user.role === 'admin' 
                  ? 'Start by creating goals for your team members.' 
                  : 'Your manager will assign goals to you soon.'}
              </p>
              {user.role === 'admin' && (
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-200 mr-2"
                  >
                    Create Your First Goal
                  </button>
                  <button
                    onClick={() => setShowTeamPage(true)}
                    className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition duration-200"
                  >
                    Manage Team
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {goals.map((goal) => {
                const progress = calculateProgress(goal.current_value, goal.target_value);
                const daysLeft = Math.ceil((new Date(goal.end_date) - new Date()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={goal.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow duration-200">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-semibold text-gray-900 text-lg">{goal.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(goal.status)}`}>
                        {getStatusText(goal.status)}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-4">{goal.description}</p>
                    
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{goal.current_value} / {goal.target_value} {goal.unit}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full transition-all duration-300 ${getProgressBarColor(goal.status, progress)}`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{progress.toFixed(1)}% complete</span>
                        <span>{daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}</span>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-4">
                      <p><strong>Cycle:</strong> {goal.cycle_type}</p>
                      <p><strong>Due:</strong> {new Date(goal.end_date).toLocaleDateString()}</p>
                    </div>
                    
                    {user.role === 'employee' && (
                      <button 
                        onClick={() => openProgressModal(goal)}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200"
                      >
                        Update Progress
                      </button>
                    )}

                    {user.role === 'admin' && (
                      <div className="text-xs text-gray-500">
                        Assigned to {goal.assigned_to?.length || 0} team member(s)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Goal Creation Modal */}
      <GoalCreationModal
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        onGoalCreated={handleGoalCreated}
      />

      {/* Enhanced Progress Update Modal */}
      <EnhancedProgressModal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        goal={selectedGoal}
        onProgressUpdated={handleProgressUpdated}
      />
    </div>
  );
};

// Main App Component
const App = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <AuthProvider>
      <AuthContext.Consumer>
        {({ user, loading }) => {
          if (loading) {
            return (
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading...</p>
                </div>
              </div>
            );
          }

          if (!user) {
            return isLogin ? (
              <LoginForm onToggle={() => setIsLogin(false)} />
            ) : (
              <RegistrationForm onToggle={() => setIsLogin(true)} />
            );
          }

          return <Dashboard />;
        }}
      </AuthContext.Consumer>
    </AuthProvider>
  );
};

export default App;
