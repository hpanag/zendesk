const ZendeskClient = require('../ZendeskClient');

/**
 * Streamlined Zendesk Reporting Service
 * Only uses APIs that actually work in the user's Zendesk instance
 * Provides concise summaries to avoid token limits
 */
class StreamlinedReportingService extends ZendeskClient {
  constructor() {
    super();
  }

  /**
   * Get working ticket data with summary
   */
  async getTicketSummary() {
    try {
      const tickets = await this.getTickets({ per_page: 100 });
      const ticketData = tickets.tickets || [];
      
      // Count by status
      const statusCounts = {};
      const priorityCounts = {};
      const typeCounts = {};
      
      ticketData.forEach(ticket => {
        statusCounts[ticket.status] = (statusCounts[ticket.status] || 0) + 1;
        priorityCounts[ticket.priority] = (priorityCounts[ticket.priority] || 0) + 1;
        typeCounts[ticket.type] = (typeCounts[ticket.type] || 0) + 1;
      });
      
      return {
        total: ticketData.length,
        statusCounts,
        priorityCounts,
        typeCounts,
        recentTickets: ticketData.slice(0, 5).map(t => ({
          id: t.id,
          subject: t.subject?.substring(0, 50) + '...',
          status: t.status,
          created: t.created_at,
          updated: t.updated_at
        }))
      };
    } catch (error) {
      console.error('Error fetching ticket summary:', error.message);
      return null;
    }
  }

  /**
   * Get agent and user summary
   */
  async getUserSummary() {
    try {
      const users = await this.getUsers({ per_page: 100 });
      const userData = users.users || [];
      
      const agents = userData.filter(u => u.role === 'agent');
      const endUsers = userData.filter(u => u.role === 'end-user');
      const activeAgents = agents.filter(u => u.active);
      
      return {
        totalUsers: userData.length,
        agents: agents.length,
        activeAgents: activeAgents.length,
        endUsers: endUsers.length,
        agentList: activeAgents.slice(0, 10).map(a => ({
          name: a.name,
          email: a.email,
          lastLogin: a.last_login_at
        }))
      };
    } catch (error) {
      console.error('Error fetching user summary:', error.message);
      return null;
    }
  }

  /**
   * Get organization summary
   */
  async getOrganizationSummary() {
    try {
      const orgs = await this.getOrganizations({ per_page: 50 });
      const orgData = orgs.organizations || [];
      
      return {
        totalOrganizations: orgData.length,
        organizations: orgData.slice(0, 5).map(o => ({
          name: o.name,
          id: o.id,
          userCount: o.organization_fields?.user_count || 0
        }))
      };
    } catch (error) {
      console.error('Error fetching organization summary:', error.message);
      return null;
    }
  }

  /**
   * Get satisfaction ratings summary
   */
  async getSatisfactionSummary() {
    try {
      const ratings = await this.getSatisfactionRatings({ per_page: 100 });
      const ratingData = ratings.satisfaction_ratings || [];
      
      const goodRatings = ratingData.filter(r => r.score === 'good').length;
      const badRatings = ratingData.filter(r => r.score === 'bad').length;
      const total = ratingData.length;
      
      return {
        totalRatings: total,
        goodRatings,
        badRatings,
        satisfactionRate: total > 0 ? (goodRatings / total * 100).toFixed(1) + '%' : 'N/A'
      };
    } catch (error) {
      console.error('Error fetching satisfaction summary:', error.message);
      return null;
    }
  }

  /**
   * Get system configuration summary
   */
  async getSystemSummary() {
    try {
      const [macros, views, triggers, automations, ticketFields, tags] = await Promise.allSettled([
        this.getMacros(),
        this.getViews(),
        this.getTriggers(),
        this.getAutomations(),
        this.getTicketFields(),
        this.getTags()
      ]);

      return {
        macros: macros.status === 'fulfilled' ? macros.value?.macros?.length || 0 : 0,
        views: views.status === 'fulfilled' ? views.value?.views?.length || 0 : 0,
        triggers: triggers.status === 'fulfilled' ? triggers.value?.triggers?.length || 0 : 0,
        automations: automations.status === 'fulfilled' ? automations.value?.automations?.length || 0 : 0,
        ticketFields: ticketFields.status === 'fulfilled' ? ticketFields.value?.ticket_fields?.length || 0 : 0,
        tags: tags.status === 'fulfilled' ? tags.value?.tags?.length || 0 : 0
      };
    } catch (error) {
      console.error('Error fetching system summary:', error.message);
      return null;
    }
  }

  /**
   * Get comprehensive but concise overview
   */
  async getComprehensiveOverview() {
    try {
      const [ticketSummary, userSummary, orgSummary, satisfactionSummary, systemSummary] = await Promise.allSettled([
        this.getTicketSummary(),
        this.getUserSummary(),
        this.getOrganizationSummary(),
        this.getSatisfactionSummary(),
        this.getSystemSummary()
      ]);

      return {
        tickets: ticketSummary.status === 'fulfilled' ? ticketSummary.value : null,
        users: userSummary.status === 'fulfilled' ? userSummary.value : null,
        organizations: orgSummary.status === 'fulfilled' ? orgSummary.value : null,
        satisfaction: satisfactionSummary.status === 'fulfilled' ? satisfactionSummary.value : null,
        system: systemSummary.status === 'fulfilled' ? systemSummary.value : null
      };
    } catch (error) {
      console.error('Error fetching comprehensive overview:', error.message);
      return null;
    }
  }

  /**
   * Format data for GPT (concise version)
   */
  formatForGPT(data, context = '') {
    if (!data) return null;

    const sections = [];

    if (data.tickets) {
      const t = data.tickets;
      sections.push(`Tickets (${t.total} total):
Status: ${Object.entries(t.statusCounts).map(([status, count]) => `${status}: ${count}`).join(', ')}
Priority: ${Object.entries(t.priorityCounts).map(([priority, count]) => `${priority}: ${count}`).join(', ')}
Types: ${Object.entries(t.typeCounts).map(([type, count]) => `${type}: ${count}`).join(', ')}`);
    }

    if (data.users) {
      const u = data.users;
      sections.push(`Users & Agents:
Total users: ${u.totalUsers}, Active agents: ${u.activeAgents}/${u.agents}, End users: ${u.endUsers}`);
    }

    if (data.organizations) {
      const o = data.organizations;
      sections.push(`Organizations: ${o.totalOrganizations} total`);
    }

    if (data.satisfaction) {
      const s = data.satisfaction;
      sections.push(`Customer Satisfaction:
${s.totalRatings} ratings, ${s.goodRatings} good, ${s.badRatings} bad (${s.satisfactionRate} satisfaction rate)`);
    }

    if (data.system) {
      const s = data.system;
      sections.push(`System Configuration:
${s.macros} macros, ${s.views} views, ${s.triggers} triggers, ${s.automations} automations, ${s.ticketFields} custom fields, ${s.tags} tags`);
    }

    return sections.join('\n\n');
  }
}

module.exports = StreamlinedReportingService;