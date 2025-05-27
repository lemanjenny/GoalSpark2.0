import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Activity Item Component
const ActivityItem = ({ activity }) => {
  const getActivityIcon = (type) => {
    switch (type) {
      case 'goal_created': return '🎯';
      case 'progress_updated': return '📈';
      case 'status_changed': return '🔄';
      default: return '📝';
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'goal_created': return 'bg-blue-50 border-blue-200';
      case 'progress_updated': return 'bg-green-50 border-green-200';
      case 'status_changed': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <div className={`p-4 rounded-lg border ${getActivityColor(activity.type)} mb-3 transition-all hover:shadow-sm`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 text-lg">
          {getActivityIcon(activity.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {activity.title}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {activity.description}
              </p>
              {activity.goal_title && (
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  Goal: {activity.goal_title}
                </p>
              )}
            </div>
            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
              {formatTimeAgo(activity.timestamp)}
            </span>
          </div>
          
          {/* Additional Metadata */}
          {activity.metadata && (
            <div className="mt-2 flex flex-wrap gap-2">
              {activity.metadata.progress_percentage !== undefined && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {Math.round(activity.metadata.progress_percentage)}% complete
                </span>
              )}
              {activity.metadata.has_comment && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  💬 Comment added
                </span>
              )}
              {activity.metadata.previous_status && activity.metadata.new_status && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                  {activity.metadata.previous_status} → {activity.metadata.new_status}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Activity Feed Component
const ActivityFeed = ({ limit = 10, activityType = null, className = "", showHeader = true }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchActivities();
    fetchUnreadCount();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchActivities();
      fetchUnreadCount();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [limit, activityType, refreshTrigger]);

  const fetchActivities = async () => {
    try {
      let url = `${API}/activities?limit=${limit}`;
      if (activityType) {
        url += `&activity_type=${activityType}`;
      }
      
      const response = await axios.get(url);
      setActivities(response.data);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API}/activities/unread-count`);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading && activities.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow ${className}`}>
        {showHeader && (
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
          </div>
        )}
        <div className="p-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-start space-x-3 mb-4 animate-pulse">
              <div className="w-6 h-6 bg-gray-200 rounded"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {showHeader && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50 flex items-center space-x-1"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      )}
      
      <div className="p-6">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-10 0h10m-9 0h8m-7 12h6m-3 0v-6m-3 6h6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No activities yet</h3>
            <p className="text-gray-600">
              Activities will appear here when team members create goals and update progress.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Notification Badge Component
export const NotificationBadge = () => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API}/activities/unread-count`);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  if (unreadCount === 0) return null;

  return (
    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium min-w-[20px] text-center">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
};

export default ActivityFeed;