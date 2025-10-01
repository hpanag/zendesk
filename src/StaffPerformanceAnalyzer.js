const ZendeskClient = require('./ZendeskClient');

class StaffPerformanceAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
    this.staffData = {};
    this.users = {};
    this.todayStart = new Date();
    this.todayStart.setHours(0, 0, 0, 0);
    this.now = new Date();
  }

  async fetchAllUsers() {
    console.log('👥 Fetching all users...');
    try {
      let allUsers = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.zendesk.getUsers({ page, per_page: 100 });
        if (response.users && response.users.length > 0) {
          allUsers.push(...response.users);
          hasMore = response.next_page !== null;
          page++;
          await new Promise(resolve => setTimeout(resolve, 200));
        } else {
          hasMore = false;
        }
      }

      // Create user lookup
      allUsers.forEach(user => {
        this.users[user.id] = user;
      });

      console.log(`✅ Loaded ${allUsers.length} users`);
      return allUsers;
    } catch (error) {
      console.error('Error fetching users:', error.message);
      return [];
    }
  }

  async fetchTodaysTicketActivity() {
    console.log('🎫 Fetching today\'s ticket activity...');
    
    try {
      let allTickets = [];
      let page = 1;
      let hasMore = true;
      const maxTickets = 1000;

      while (hasMore && allTickets.length < maxTickets) {
        console.log(`Fetching page ${page} of tickets...`);
        
        const response = await this.zendesk.getTickets({
          page: page,
          per_page: 100,
          sort_by: 'updated_at',
          sort_order: 'desc'
        });

        if (response.tickets && response.tickets.length > 0) {
          // Filter tickets updated today
          const todaysTickets = response.tickets.filter(ticket => {
            const updatedAt = new Date(ticket.updated_at);
            return updatedAt >= this.todayStart;
          });

          allTickets.push(...todaysTickets);
          console.log(`Found ${todaysTickets.length} tickets updated today (Total: ${allTickets.length})`);

          // If no tickets in this batch are from today, we're done
          if (todaysTickets.length === 0) {
            hasMore = false;
          } else {
            hasMore = response.next_page !== null;
            page++;
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ Found ${allTickets.length} tickets updated today`);
      return allTickets;
    } catch (error) {
      console.error('Error fetching today\'s tickets:', error.message);
      return [];
    }
  }

  async fetchTicketAuditsForToday(ticketId) {
    try {
      const response = await this.zendesk.makeRequest('GET', `/tickets/${ticketId}/audits.json`);
      const audits = response.audits || [];
      
      // Filter audits for today only
      return audits.filter(audit => {
        const auditDate = new Date(audit.created_at);
        return auditDate >= this.todayStart && auditDate <= this.now;
      });
    } catch (error) {
      console.error(`Error fetching audits for ticket ${ticketId}:`, error.message);
      return [];
    }
  }

  async fetchTicketComments(ticketId) {
    try {
      const response = await this.zendesk.makeRequest('GET', `/tickets/${ticketId}/comments.json`);
      const comments = response.comments || [];
      
      // Filter comments for today only
      return comments.filter(comment => {
        const commentDate = new Date(comment.created_at);
        return commentDate >= this.todayStart && commentDate <= this.now;
      });
    } catch (error) {
      console.error(`Error fetching comments for ticket ${ticketId}:`, error.message);
      return [];
    }
  }

  async fetchSatisfactionRatings() {
    console.log('⭐ Fetching satisfaction ratings for today...');
    try {
      // Get satisfaction ratings from today
      const response = await this.zendesk.makeRequest('GET', '/satisfaction_ratings.json', {
        start_time: Math.floor(this.todayStart.getTime() / 1000),
        end_time: Math.floor(this.now.getTime() / 1000)
      });
      
      return response.satisfaction_ratings || [];
    } catch (error) {
      console.error('Error fetching satisfaction ratings:', error.message);
      return [];
    }
  }

  initializeStaffMember(userId) {
    if (!this.staffData[userId]) {
      const user = this.users[userId] || {};
      this.staffData[userId] = {
        userId: userId,
        name: user.name || 'Unknown User',
        email: user.email || '',
        role: user.role || '',
        
        // Ticket metrics
        ticketsWorkedOn: new Set(),
        ticketsCreated: 0,
        ticketsUpdated: 0,
        ticketsAssigned: 0,
        
        // Status changes they made
        statusChanges: {},
        statusChangesDetails: [],
        
        // Activity breakdown
        ticketTypes: {},
        channels: {},
        priorities: {},
        
        // Comments and interactions
        commentsAdded: 0,
        publicComments: 0,
        privateComments: 0,
        
        // Time tracking
        firstActivity: null,
        lastActivity: null,
        totalActivities: 0,
        
        // Satisfaction feedback
        satisfactionRatings: [],
        avgSatisfactionScore: 0,
        
        // Detailed activities
        activities: []
      };
    }
  }

  analyzeTicketAudit(audit, ticket) {
    const authorId = audit.author_id;
    if (!authorId) return;

    this.initializeStaffMember(authorId);
    const staff = this.staffData[authorId];
    
    staff.ticketsWorkedOn.add(ticket.id);
    staff.totalActivities++;
    
    // Track first and last activity
    const auditTime = new Date(audit.created_at);
    if (!staff.firstActivity || auditTime < staff.firstActivity) {
      staff.firstActivity = auditTime;
    }
    if (!staff.lastActivity || auditTime > staff.lastActivity) {
      staff.lastActivity = auditTime;
    }

    // Analyze audit events
    if (audit.events) {
      audit.events.forEach(event => {
        // Track status changes
        if (event.field_name === 'status' && event.type === 'Change') {
          const transition = `${event.previous_value} → ${event.value}`;
          staff.statusChanges[transition] = (staff.statusChanges[transition] || 0) + 1;
          
          staff.statusChangesDetails.push({
            ticketId: ticket.id,
            from: event.previous_value,
            to: event.value,
            when: audit.created_at
          });
        }
        
        // Track assignments
        if (event.field_name === 'assignee_id' && event.type === 'Change' && event.value == authorId) {
          staff.ticketsAssigned++;
        }
        
        // Track priority changes
        if (event.field_name === 'priority' && event.type === 'Change') {
          staff.priorities[event.value] = (staff.priorities[event.value] || 0) + 1;
        }
      });
    }

    // Record activity details
    staff.activities.push({
      type: 'audit',
      ticketId: ticket.id,
      ticketSubject: ticket.subject,
      when: audit.created_at,
      auditId: audit.id,
      events: audit.events ? audit.events.length : 0
    });

    // Track ticket metadata for this staff member
    staff.ticketTypes[ticket.type || 'unknown'] = (staff.ticketTypes[ticket.type || 'unknown'] || 0) + 1;
    staff.channels[ticket.via?.channel || 'unknown'] = (staff.channels[ticket.via?.channel || 'unknown'] || 0) + 1;
    staff.priorities[ticket.priority || 'normal'] = (staff.priorities[ticket.priority || 'normal'] || 0) + 1;
  }

  analyzeTicketComment(comment, ticket) {
    const authorId = comment.author_id;
    if (!authorId) return;

    this.initializeStaffMember(authorId);
    const staff = this.staffData[authorId];
    
    staff.ticketsWorkedOn.add(ticket.id);
    staff.commentsAdded++;
    
    if (comment.public) {
      staff.publicComments++;
    } else {
      staff.privateComments++;
    }

    // Track activity timing
    const commentTime = new Date(comment.created_at);
    if (!staff.firstActivity || commentTime < staff.firstActivity) {
      staff.firstActivity = commentTime;
    }
    if (!staff.lastActivity || commentTime > staff.lastActivity) {
      staff.lastActivity = commentTime;
    }

    // Record comment activity
    staff.activities.push({
      type: 'comment',
      ticketId: ticket.id,
      ticketSubject: ticket.subject,
      when: comment.created_at,
      commentId: comment.id,
      isPublic: comment.public,
      bodyLength: comment.body ? comment.body.length : 0
    });
  }

  async analyzeStaffPerformance() {
    try {
      console.log('📊 Starting staff performance analysis for today...');
      console.log(`📅 Analyzing period: ${this.todayStart.toLocaleString()} to ${this.now.toLocaleString()}`);
      
      // Fetch all required data
      await this.fetchAllUsers();
      const todaysTickets = await this.fetchTodaysTicketActivity();
      const satisfactionRatings = await this.fetchSatisfactionRatings();
      
      if (todaysTickets.length === 0) {
        console.log('⚠️ No tickets found for today');
        return {};
      }

      console.log('🔍 Analyzing ticket audits and comments...');
      
      // Process tickets in batches to manage API calls
      const batchSize = 5;
      let processedCount = 0;

      for (let i = 0; i < todaysTickets.length; i += batchSize) {
        const batch = todaysTickets.slice(i, i + batchSize);
        
        console.log(`Processing tickets ${i + 1}-${Math.min(i + batchSize, todaysTickets.length)} of ${todaysTickets.length}...`);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (ticket) => {
          const [audits, comments] = await Promise.all([
            this.fetchTicketAuditsForToday(ticket.id),
            this.fetchTicketComments(ticket.id)
          ]);
          
          // Analyze audits
          audits.forEach(audit => this.analyzeTicketAudit(audit, ticket));
          
          // Analyze comments
          comments.forEach(comment => this.analyzeTicketComment(comment, ticket));
        });
        
        await Promise.all(batchPromises);
        processedCount += batch.length;
        
        // Add delay between batches
        if (i + batchSize < todaysTickets.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Process satisfaction ratings
      console.log('⭐ Processing satisfaction ratings...');
      satisfactionRatings.forEach(rating => {
        if (rating.assignee_id) {
          this.initializeStaffMember(rating.assignee_id);
          this.staffData[rating.assignee_id].satisfactionRatings.push({
            score: rating.score,
            comment: rating.comment,
            ticketId: rating.ticket_id,
            createdAt: rating.created_at
          });
        }
      });

      // Calculate final metrics
      this.calculateFinalMetrics();
      
      console.log(`✅ Analysis complete! Processed ${processedCount} tickets`);
      console.log(`👥 Found activity for ${Object.keys(this.staffData).length} staff members`);
      
      return this.staffData;
      
    } catch (error) {
      console.error('❌ Error in staff performance analysis:', error.message);
      throw error;
    }
  }

  calculateFinalMetrics() {
    Object.keys(this.staffData).forEach(userId => {
      const staff = this.staffData[userId];
      
      // Convert Set to count
      staff.ticketsWorkedOnCount = staff.ticketsWorkedOn.size;
      
      // Calculate average satisfaction score
      if (staff.satisfactionRatings.length > 0) {
        const totalScore = staff.satisfactionRatings.reduce((sum, rating) => {
          const scoreMap = { 'good': 100, 'bad': 0, 'unoffered': 50 };
          return sum + (scoreMap[rating.score] || 0);
        }, 0);
        staff.avgSatisfactionScore = totalScore / staff.satisfactionRatings.length;
      }
      
      // Calculate working hours
      if (staff.firstActivity && staff.lastActivity) {
        const workingHours = (staff.lastActivity - staff.firstActivity) / (1000 * 60 * 60);
        staff.workingHours = workingHours.toFixed(2);
      }
      
      // Sort activities by time
      staff.activities.sort((a, b) => new Date(b.when) - new Date(a.when));
      
      // Remove the Set object for JSON serialization
      delete staff.ticketsWorkedOn;
    });
  }

  printStaffReport() {
    const staffList = Object.values(this.staffData)
      .filter(staff => staff.totalActivities > 0)
      .sort((a, b) => b.ticketsWorkedOnCount - a.ticketsWorkedOnCount);

    if (staffList.length === 0) {
      console.log('⚠️ No staff activity found for today.');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('👥 STAFF PERFORMANCE REPORT - TODAY');
    console.log('='.repeat(80));
    console.log(`📅 Period: ${this.todayStart.toLocaleString()} to ${this.now.toLocaleString()}`);
    console.log(`👥 Active Staff: ${staffList.length}`);

    staffList.forEach((staff, index) => {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`👤 ${index + 1}. ${staff.name} (${staff.email})`);
      console.log(`   Role: ${staff.role}`);
      console.log(`${'─'.repeat(60)}`);
      
      // Ticket metrics
      console.log(`📊 TICKET ACTIVITY:`);
      console.log(`   Tickets Worked On: ${staff.ticketsWorkedOnCount}`);
      console.log(`   Total Activities: ${staff.totalActivities}`);
      console.log(`   Comments Added: ${staff.commentsAdded} (Public: ${staff.publicComments}, Private: ${staff.privateComments})`);
      console.log(`   Working Hours: ${staff.workingHours || 'N/A'}`);
      
      // Status changes
      if (Object.keys(staff.statusChanges).length > 0) {
        console.log(`\n🔄 STATUS CHANGES MADE:`);
        Object.entries(staff.statusChanges)
          .sort(([,a], [,b]) => b - a)
          .forEach(([transition, count]) => {
            console.log(`   ${transition}: ${count}`);
          });
      }
      
      // Ticket types
      if (Object.keys(staff.ticketTypes).length > 0) {
        console.log(`\n🎫 TICKET TYPES WORKED ON:`);
        Object.entries(staff.ticketTypes)
          .sort(([,a], [,b]) => b - a)
          .forEach(([type, count]) => {
            console.log(`   ${type}: ${count}`);
          });
      }
      
      // Channels
      if (Object.keys(staff.channels).length > 0) {
        console.log(`\n📡 CHANNELS HANDLED:`);
        Object.entries(staff.channels)
          .sort(([,a], [,b]) => b - a)
          .forEach(([channel, count]) => {
            console.log(`   ${channel}: ${count}`);
          });
      }
      
      // Satisfaction ratings
      if (staff.satisfactionRatings.length > 0) {
        console.log(`\n⭐ SATISFACTION FEEDBACK:`);
        console.log(`   Total Ratings: ${staff.satisfactionRatings.length}`);
        console.log(`   Average Score: ${staff.avgSatisfactionScore.toFixed(1)}%`);
        
        const ratingBreakdown = {};
        staff.satisfactionRatings.forEach(rating => {
          ratingBreakdown[rating.score] = (ratingBreakdown[rating.score] || 0) + 1;
        });
        
        Object.entries(ratingBreakdown).forEach(([score, count]) => {
          console.log(`   ${score}: ${count}`);
        });
      }
      
      // Recent activities
      console.log(`\n📋 RECENT ACTIVITIES (Last 5):`);
      staff.activities.slice(0, 5).forEach((activity, i) => {
        const when = new Date(activity.when).toLocaleTimeString();
        console.log(`   ${i + 1}. ${activity.type.toUpperCase()} on Ticket #${activity.ticketId} at ${when}`);
      });
    });
    
    console.log('\n' + '='.repeat(80));
  }

  async exportStaffDataToJSON(filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      filename = `staff-performance-${timestamp}.json`;
    }

    const fs = require('fs');
    const path = require('path');
    
    const filePath = path.join(__dirname, '..', 'data', filename);
    
    try {
      const exportData = {
        analysisDate: new Date().toISOString(),
        period: {
          start: this.todayStart.toISOString(),
          end: this.now.toISOString()
        },
        staffCount: Object.keys(this.staffData).length,
        staffData: this.staffData
      };
      
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
      console.log(`✅ Staff performance data exported to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('❌ Error exporting staff data:', error.message);
      throw error;
    }
  }
}

module.exports = StaffPerformanceAnalyzer;