const axios = require('axios');
require('dotenv').config();

class ZendeskClient {
  constructor() {
    this.subdomain = process.env.ZENDESK_SUBDOMAIN;
    this.email = process.env.ZENDESK_EMAIL;
    this.token = process.env.ZENDESK_API_TOKEN;
    
    if (!this.subdomain || !this.email || !this.token) {
      throw new Error('Missing required environment variables. Please check your .env file.');
    }
    
    this.baseURL = `https://${this.subdomain}.zendesk.com/api/v2`;
    this.auth = Buffer.from(`${this.email}/token:${this.token}`).toString('base64');
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  // Generic method to make API requests
  async makeRequest(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: endpoint,
        ...(data && { data })
      };
      
      const response = await this.client(config);
      return response.data;
    } catch (error) {
      console.error(`Error making ${method} request to ${endpoint}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Tickets
  async getTickets(options = {}) {
    const params = new URLSearchParams(options).toString();
    const endpoint = `/tickets.json${params ? `?${params}` : ''}`;
    return this.makeRequest('GET', endpoint);
  }

  async getTicket(ticketId) {
    return this.makeRequest('GET', `/tickets/${ticketId}.json`);
  }

  async createTicket(ticketData) {
    return this.makeRequest('POST', '/tickets.json', { ticket: ticketData });
  }

  async updateTicket(ticketId, ticketData) {
    return this.makeRequest('PUT', `/tickets/${ticketId}.json`, { ticket: ticketData });
  }

  async deleteTicket(ticketId) {
    return this.makeRequest('DELETE', `/tickets/${ticketId}.json`);
  }

  async getLastTenTickets() {
    const options = {
      per_page: 10,
      sort_by: 'created_at',
      sort_order: 'desc'
    };
    return this.getTickets(options);
  }

  // Users
  async getUsers(options = {}) {
    const params = new URLSearchParams(options).toString();
    const endpoint = `/users.json${params ? `?${params}` : ''}`;
    return this.makeRequest('GET', endpoint);
  }

  async getUser(userId) {
    return this.makeRequest('GET', `/users/${userId}.json`);
  }

  async createUser(userData) {
    return this.makeRequest('POST', '/users.json', { user: userData });
  }

  async updateUser(userId, userData) {
    return this.makeRequest('PUT', `/users/${userId}.json`, { user: userData });
  }

  // Organizations
  async getOrganizations(options = {}) {
    const params = new URLSearchParams(options).toString();
    const endpoint = `/organizations.json${params ? `?${params}` : ''}`;
    return this.makeRequest('GET', endpoint);
  }

  async getOrganization(orgId) {
    return this.makeRequest('GET', `/organizations/${orgId}.json`);
  }

  // Groups
  async getGroups() {
    return this.makeRequest('GET', '/groups.json');
  }

  async getGroup(groupId) {
    return this.makeRequest('GET', `/groups/${groupId}.json`);
  }

  // Search
  async search(query, options = {}) {
    const params = new URLSearchParams({ query, ...options }).toString();
    return this.makeRequest('GET', `/search.json?${params}`);
  }

  // Custom fields
  async getTicketFields() {
    return this.makeRequest('GET', '/ticket_fields.json');
  }

  async getUserFields() {
    return this.makeRequest('GET', '/user_fields.json');
  }

  // Macros
  async getMacros() {
    return this.makeRequest('GET', '/macros.json');
  }

  // Views
  async getViews() {
    return this.makeRequest('GET', '/views.json');
  }
}

module.exports = ZendeskClient;