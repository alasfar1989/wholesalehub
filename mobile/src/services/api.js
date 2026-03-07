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

  searchUsers(q) {
    return this.request(`/users/search?q=${encodeURIComponent(q)}`);
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

  getPendingRatings() {
    return this.request('/ratings/pending');
  }

  approveRating(id) {
    return this.request(`/ratings/${id}/approve`, { method: 'PUT' });
  }

  rejectRating(id) {
    return this.request(`/ratings/${id}/reject`, { method: 'PUT' });
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

  // Escrow
  initiateEscrow(body) {
    return this.request('/escrow/initiate', { method: 'POST', body: JSON.stringify(body) });
  }

  getMyEscrows() {
    return this.request('/escrow/my/all');
  }

  getEscrow(id) {
    return this.request(`/escrow/${id}`);
  }

  confirmEscrow(id) {
    return this.request(`/escrow/${id}/confirm`, { method: 'POST' });
  }

  uploadWireProof(id, wireProofUrl) {
    return this.request(`/escrow/${id}/upload-proof`, { method: 'POST', body: JSON.stringify({ wire_proof_url: wireProofUrl }) });
  }

  verifyPayment(id, wireInstructions) {
    return this.request(`/escrow/${id}/payment-received`, { method: 'POST', body: JSON.stringify({ wire_instructions: wireInstructions }) });
  }

  shipEscrow(id, trackingNumber) {
    return this.request(`/escrow/${id}/ship`, { method: 'POST', body: JSON.stringify({ tracking_number: trackingNumber }) });
  }

  confirmReceipt(id) {
    return this.request(`/escrow/${id}/confirm-receipt`, { method: 'POST' });
  }

  releasePayment(id) {
    return this.request(`/escrow/${id}/release-payment`, { method: 'POST' });
  }

  disputeEscrow(id, reason) {
    return this.request(`/escrow/${id}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) });
  }

  cancelEscrow(id) {
    return this.request(`/escrow/${id}/cancel`, { method: 'POST' });
  }

  getAdminEscrows(status) {
    const query = status ? `?status=${status}` : '';
    return this.request(`/escrow/admin/all${query}`);
  }
}

export default new ApiService();
