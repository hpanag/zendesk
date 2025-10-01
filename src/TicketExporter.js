const ZendeskClient = require('./ZendeskClient');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

class TicketExporter {
  constructor() {
    this.zendesk = new ZendeskClient();
    this.allTickets = [];
    this.allUsers = {};
    this.allOrganizations = {};
    this.allGroups = {};
  }

  async fetchLastThousandTickets() {
    console.log('🎫 Fetching last 1000 tickets...');
    let page = 1;
    let totalFetched = 0;
    const maxTickets = 1000;

    while (totalFetched < maxTickets) {
      try {
        console.log(`Fetching page ${page}...`);
        const perPage = Math.min(100, maxTickets - totalFetched);
        
        const response = await this.zendesk.getTickets({
          page: page,
          per_page: perPage,
          sort_by: 'created_at',
          sort_order: 'desc'
        });

        if (response.tickets && response.tickets.length > 0) {
          this.allTickets.push(...response.tickets);
          totalFetched += response.tickets.length;
          console.log(`Fetched ${response.tickets.length} tickets (Total: ${totalFetched})`);
          
          // Stop if we've reached 1000 or if there are no more pages
          if (totalFetched >= maxTickets || !response.next_page) {
            break;
          }
          
          page++;
          
          // Add a small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          break;
        }
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error.message);
        break;
      }
    }

    console.log(`✅ Total tickets fetched: ${this.allTickets.length}`);
    return this.allTickets;
  }

  async fetchSupportingData() {
    console.log('👥 Fetching users...');
    try {
      const usersResponse = await this.zendesk.getUsers();
      if (usersResponse.users) {
        usersResponse.users.forEach(user => {
          this.allUsers[user.id] = user;
        });
        console.log(`✅ Fetched ${usersResponse.users.length} users`);
      }
    } catch (error) {
      console.error('Error fetching users:', error.message);
    }

    console.log('🏢 Fetching organizations...');
    try {
      const orgsResponse = await this.zendesk.getOrganizations();
      if (orgsResponse.organizations) {
        orgsResponse.organizations.forEach(org => {
          this.allOrganizations[org.id] = org;
        });
        console.log(`✅ Fetched ${orgsResponse.organizations.length} organizations`);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error.message);
    }

    console.log('👥 Fetching groups...');
    try {
      const groupsResponse = await this.zendesk.getGroups();
      if (groupsResponse.groups) {
        groupsResponse.groups.forEach(group => {
          this.allGroups[group.id] = group;
        });
        console.log(`✅ Fetched ${groupsResponse.groups.length} groups`);
      }
    } catch (error) {
      console.error('Error fetching groups:', error.message);
    }
  }

  // Helper function to truncate text for Excel compatibility
  truncateText(text, maxLength = 32000) {
    if (!text) return '';
    const str = String(text);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  formatTicketData() {
    console.log('📊 Formatting ticket data...');
    
    return this.allTickets.map(ticket => {
      const requester = this.allUsers[ticket.requester_id] || {};
      const assignee = this.allUsers[ticket.assignee_id] || {};
      const submitter = this.allUsers[ticket.submitter_id] || {};
      const organization = this.allOrganizations[ticket.organization_id] || {};
      const group = this.allGroups[ticket.group_id] || {};

      // Extract the first comment (description) from the ticket
      let description = '';
      if (ticket.description) {
        description = ticket.description;
      } else if (ticket.comments && ticket.comments.length > 0) {
        description = ticket.comments[0].body || '';
      }

      return {
        // Primary Fields (as requested)
        'Ticket ID': ticket.id,
        'Date Created': new Date(ticket.created_at).toLocaleString(),
        'Subject': this.truncateText(ticket.subject || ''),
        'Description/Body': this.truncateText(description),
        
        // Status and Priority
        'Status': ticket.status || '',
        'Priority': ticket.priority || '',
        'Type': ticket.type || '',
        
        // Dates
        'Updated At': new Date(ticket.updated_at).toLocaleString(),
        'Due At': ticket.due_at ? new Date(ticket.due_at).toLocaleString() : '',
        
        // People
        'Requester Name': this.truncateText(requester.name || ''),
        'Requester Email': requester.email || '',
        'Assignee Name': this.truncateText(assignee.name || ''),
        'Assignee Email': assignee.email || '',
        'Submitter Name': this.truncateText(submitter.name || ''),
        'Submitter Email': submitter.email || '',
        
        // Organization and Group
        'Organization Name': this.truncateText(organization.name || ''),
        'Group Name': this.truncateText(group.name || ''),
        
        // Additional Fields
        'External ID': this.truncateText(ticket.external_id || ''),
        'Via Channel': ticket.via?.channel || '',
        'Via Source From': ticket.via?.source?.from?.address || '',
        'Via Source To': ticket.via?.source?.to?.address || '',
        'Satisfaction Rating': ticket.satisfaction_rating?.score || '',
        'Satisfaction Comment': this.truncateText(ticket.satisfaction_rating?.comment || ''),
        'Public': ticket.is_public || false,
        'Has Incidents': ticket.has_incidents || false,
        'Forum Topic ID': ticket.forum_topic_id || '',
        'Problem ID': ticket.problem_id || '',
        'Collaborator IDs': this.truncateText(ticket.collaborator_ids ? ticket.collaborator_ids.join(', ') : ''),
        'Follower IDs': this.truncateText(ticket.follower_ids ? ticket.follower_ids.join(', ') : ''),
        'Email CC IDs': this.truncateText(ticket.email_cc_ids ? ticket.email_cc_ids.join(', ') : ''),
        'Tags': this.truncateText(ticket.tags ? ticket.tags.join(', ') : ''),
        
        // Custom Fields (if any) - truncated to prevent Excel errors
        'Custom Fields': this.truncateText(ticket.custom_fields ? JSON.stringify(ticket.custom_fields) : ''),
        
        // URLs
        'URL': ticket.url || '',
        'Raw Subject': this.truncateText(ticket.raw_subject || '')
      };
    });
  }

  async exportToExcel(filename = null) {
    try {
      // Fetch last 1000 tickets
      await this.fetchLastThousandTickets();
      await this.fetchSupportingData();
      
      if (this.allTickets.length === 0) {
        console.log('⚠️ No tickets found to export');
        return;
      }

      // Format the data
      const formattedData = this.formatTicketData();
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(formattedData);
      
      // Auto-size columns
      const range = XLSX.utils.decode_range(ws['!ref']);
      const colWidths = [];
      
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxWidth = 10;
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[cellAddress];
          if (cell && cell.v) {
            maxWidth = Math.max(maxWidth, String(cell.v).length);
          }
        }
        colWidths[C] = { wch: Math.min(maxWidth + 2, 50) }; // Cap at 50 characters
      }
      ws['!cols'] = colWidths;
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'All Tickets');
      
      // Generate filename if not provided
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        filename = `zendesk-tickets-${timestamp}.xlsx`;
      }
      
      // Ensure filename has .xlsx extension
      if (!filename.endsWith('.xlsx')) {
        filename += '.xlsx';
      }
      
      const filePath = path.join(__dirname, '..', 'data', filename);
      
      // Write the file
      XLSX.writeFile(wb, filePath);
      
      console.log(`✅ Excel file created successfully!`);
      console.log(`📁 File location: ${filePath}`);
      console.log(`📊 Total tickets exported: ${this.allTickets.length}`);
      
      if (this.allTickets.length >= 1000) {
        console.log(`ℹ️  Note: Limited to 1000 most recent tickets for performance.`);
        console.log(`   To get more tickets, you can modify the maxTickets value or use date filters.`);
      }
      
      return filePath;
      
    } catch (error) {
      console.error('❌ Error creating Excel file:', error.message);
      throw error;
    }
  }

  // Method to get a sample of ticket fields for reference
  async getTicketFieldsSample() {
    try {
      const tickets = await this.zendesk.getTickets({ per_page: 1 });
      if (tickets.tickets && tickets.tickets.length > 0) {
        const sampleTicket = tickets.tickets[0];
        console.log('📋 Sample ticket structure:');
        console.log(JSON.stringify(sampleTicket, null, 2));
        return sampleTicket;
      }
    } catch (error) {
      console.error('Error getting sample ticket:', error.message);
    }
  }
}

module.exports = TicketExporter;