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

  sendOtp(phone) {
    return this.request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) });
  }

  verifyOtp(phone, code) {
    return this.request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, code }) });
  }

  resetPassword(phone, code, new_password) {
    return this.request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ phone, code, new_password }) });
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

  async uploadAvatar(uri) {
    const name = uri.split('/').pop();
    const ext = name.split('.').pop() || 'jpg';
    const formData = new FormData();
    formData.append('avatar', { uri, name: `avatar.${ext}`, type: `image/${ext === 'png' ? 'png' : 'jpeg'}` });
    const response = await fetch(`${API_URL}/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Upload failed');
    return data;
  }

  updatePushToken(push_token) {
    return this.request('/users/me/push-token', { method: 'PUT', body: JSON.stringify({ push_token }) });
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

  getFeaturedSlots() {
    return this.request('/listings/featured-slots');
  }

  featureListing(id) {
    return this.request(`/listings/${id}/feature`, { method: 'POST' });
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

  async uploadListingPhotos(listingId, photoUris) {
    const formData = new FormData();
    photoUris.forEach((uri, i) => {
      const name = uri.split('/').pop();
      const ext = name.split('.').pop() || 'jpg';
      formData.append('photos', { uri, name: `photo_${i}.${ext}`, type: `image/${ext === 'png' ? 'png' : 'jpeg'}` });
    });
    const response = await fetch(`${API_URL}/listings/${listingId}/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Upload failed');
    return data;
  }

  deleteListingPhoto(listingId, photoId) {
    return this.request(`/listings/${listingId}/photos/${photoId}`, { method: 'DELETE' });
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

  getPendingUsers() {
    return this.request('/admin/pending-users');
  }

  approveUser(userId) {
    return this.request(`/admin/users/${userId}/approve`, { method: 'PUT' });
  }

  rejectUser(userId) {
    return this.request(`/admin/users/${userId}/reject`, { method: 'PUT' });
  }

  deleteUser(userId) {
    return this.request(`/admin/users/${userId}`, { method: 'DELETE' });
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

  confirmEscrow(id, sellerPayoutMethod) {
    return this.request(`/escrow/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ seller_payout_method: sellerPayoutMethod }),
    });
  }

  uploadWireProof(id, wireProofUrl) {
    return this.request(`/escrow/${id}/upload-proof`, { method: 'POST', body: JSON.stringify({ wire_proof_url: wireProofUrl }) });
  }

  verifyPayment(id, wireInstructions) {
    return this.request(`/escrow/${id}/payment-received`, { method: 'POST', body: JSON.stringify({ wire_instructions: wireInstructions }) });
  }

  async uploadShippingPhoto(escrowId, uri) {
    const name = uri.split('/').pop();
    const ext = name.split('.').pop() || 'jpg';
    const formData = new FormData();
    formData.append('photo', { uri, name: `shipping.${ext}`, type: `image/${ext === 'png' ? 'png' : 'jpeg'}` });
    const response = await fetch(`${API_URL}/escrow/${escrowId}/shipping-photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Upload failed');
    return data;
  }

  shipEscrow(id, trackingNumber) {
    return this.request(`/escrow/${id}/ship`, { method: 'POST', body: JSON.stringify({ tracking_number: trackingNumber }) });
  }

  async uploadDeliveryPhoto(escrowId, uri) {
    const name = uri.split('/').pop();
    const ext = name.split('.').pop() || 'jpg';
    const formData = new FormData();
    formData.append('photo', { uri, name: `delivery.${ext}`, type: `image/${ext === 'png' ? 'png' : 'jpeg'}` });
    const response = await fetch(`${API_URL}/escrow/${escrowId}/delivery-photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Upload failed');
    return data;
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

  updateWireInstructions(id, wire_instructions) {
    return this.request(`/escrow/${id}/wire-instructions`, { method: 'PUT', body: JSON.stringify({ wire_instructions }) });
  }

  resolveDispute(id, resolution) {
    return this.request(`/escrow/${id}/resolve-dispute`, { method: 'POST', body: JSON.stringify({ resolution }) });
  }

  // Deals
  createDeal(body) {
    return this.request('/deals', { method: 'POST', body: JSON.stringify(body) });
  }

  getPendingReviews() {
    return this.request('/deals/pending-reviews');
  }

  rateDeal(dealId, body) {
    return this.request(`/deals/${dealId}/rate`, { method: 'POST', body: JSON.stringify(body) });
  }

  getAdminEscrows(status) {
    const query = status ? `?status=${status}` : '';
    return this.request(`/escrow/admin/all${query}`);
  }
}

export default new ApiService();
