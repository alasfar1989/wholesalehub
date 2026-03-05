import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

class ApiService {
  constructor() {
    this.token = null;
  }

  async init() {
    try {
      this.token = await SecureStore.getItemAsync('token');
    } catch {}
  }

  async setToken(token) {
    this.token = token;
    if (token) {
      await SecureStore.setItemAsync('token', token);
    } else {
      await SecureStore.deleteItemAsync('token');
    }
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Auth
  signup(body) {
    return this.request('/auth/signup', { method: 'POST', body: JSON.stringify(body) });
  }

  login(body) {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  }

  // Users
  getMe() {
    return this.request('/users/me');
  }

  getUser(id) {
    return this.request(`/users/${id}`);
  }

  updateProfile(body) {
    return this.request('/users/me', { method: 'PUT', body: JSON.stringify(body) });
  }

  // Listings
  getListings(page = 1) {
    return this.request(`/listings?page=${page}`);
  }

  getFeatured() {
    return this.request('/listings/featured');
  }

  searchListings(params) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/listings/search?${query}`);
  }

  getListing(id) {
    return this.request(`/listings/${id}`);
  }

  getMyListings() {
    return this.request('/listings/mine');
  }

  createListing(body) {
    return this.request('/listings', { method: 'POST', body: JSON.stringify(body) });
  }

  updateListing(id, body) {
    return this.request(`/listings/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  deleteListing(id) {
    return this.request(`/listings/${id}`, { method: 'DELETE' });
  }

  // References
  getReferences(userId) {
    return this.request(`/references/${userId}`);
  }

  addReference(userId, body) {
    return this.request(`/references/${userId}`, { method: 'POST', body: JSON.stringify(body) });
  }

  deleteReference(id) {
    return this.request(`/references/${id}`, { method: 'DELETE' });
  }

  // Ratings
  getRatings(userId) {
    return this.request(`/ratings/${userId}`);
  }

  rateUser(body) {
    return this.request('/ratings', { method: 'POST', body: JSON.stringify(body) });
  }

  // Messages
  getConversations() {
    return this.request('/messages/conversations');
  }

  getMessages(userId, page = 1) {
    return this.request(`/messages/${userId}?page=${page}`);
  }

  sendMessage(body) {
    return this.request('/messages', { method: 'POST', body: JSON.stringify(body) });
  }

  // Admin
  getDashboard() {
    return this.request('/admin/dashboard');
  }

  getAdminUsers() {
    return this.request('/admin/users');
  }

  toggleSuspend(userId) {
    return this.request(`/admin/users/${userId}/suspend`, { method: 'PUT' });
  }

  getAdminListings() {
    return this.request('/admin/listings');
  }

  toggleFeatured(listingId) {
    return this.request(`/admin/listings/${listingId}/feature`, { method: 'PUT' });
  }

  adminDeleteListing(listingId) {
    return this.request(`/admin/listings/${listingId}`, { method: 'DELETE' });
  }
}

export default new ApiService();
