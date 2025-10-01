const ZendeskClient = require('./src/ZendeskClient');

class QueueDebugAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async debugCallQueue() {
    console.log('🔍 DEBUGGING CALL QUEUE DETECTION');
    console.log('='.repeat(50));
    
    try {
      // Method 1: Check for new voice tickets (current method)
      console.log('\n📋 Method 1: New Voice Tickets');
      const newVoiceTickets = await this.zendesk.search('type:ticket channel:voice status:new', {
        per_page: 100
      });
      console.log(`Found ${newVoiceTickets.results?.length || 0} new voice tickets`);
      
      // Method 2: Check for open voice tickets
      console.log('\n📋 Method 2: Open Voice Tickets');
      const openVoiceTickets = await this.zendesk.search('type:ticket channel:voice status:open', {
        per_page: 100
      });
      console.log(`Found ${openVoiceTickets.results?.length || 0} open voice tickets`);
      
      // Method 3: Check for pending voice tickets
      console.log('\n📋 Method 3: Pending Voice Tickets');
      const pendingVoiceTickets = await this.zendesk.search('type:ticket channel:voice status:pending', {
        per_page: 100
      });
      console.log(`Found ${pendingVoiceTickets.results?.length || 0} pending voice tickets`);
      
      // Method 4: All voice tickets created today
      console.log('\n📋 Method 4: All Voice Tickets Today');
      const today = new Date().toISOString().split('T')[0];
      const todayVoiceTickets = await this.zendesk.search(`type:ticket channel:voice created:${today}`, {
        per_page: 100
      });
      console.log(`Found ${todayVoiceTickets.results?.length || 0} voice tickets created today`);
      
      // Method 5: Check unassigned voice tickets
      console.log('\n📋 Method 5: Unassigned Voice Tickets');
      const unassignedVoiceTickets = await this.zendesk.search('type:ticket channel:voice assignee:none', {
        per_page: 100
      });
      console.log(`Found ${unassignedVoiceTickets.results?.length || 0} unassigned voice tickets`);
      
      // Method 6: Recent voice tickets (last hour)
      console.log('\n📋 Method 6: Recent Voice Tickets (Last Hour)');
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      const recentVoiceTickets = await this.zendesk.search(`type:ticket channel:voice created>${oneHourAgo.toISOString()}`, {
        per_page: 100
      });
      console.log(`Found ${recentVoiceTickets.results?.length || 0} voice tickets in last hour`);
      
      // Method 7: Check via source for voice calls
      console.log('\n📋 Method 7: All Recent Tickets (Check Via Channel)');
      const recentTickets = await this.zendesk.getTickets({
        per_page: 50,
        sort_by: 'created_at',
        sort_order: 'desc'
      });
      
      const voiceTicketsViaChannel = recentTickets.tickets?.filter(ticket => {
        return ticket.via?.channel === 'voice';
      }) || [];
      
      console.log(`Found ${voiceTicketsViaChannel.length} tickets with via.channel = 'voice' in recent tickets`);
      
      // Show sample ticket structures
      console.log('\n📝 SAMPLE TICKET ANALYSIS:');
      if (voiceTicketsViaChannel.length > 0) {
        const sampleTicket = voiceTicketsViaChannel[0];
        console.log('Sample Voice Ticket Structure:');
        console.log(`- ID: ${sampleTicket.id}`);
        console.log(`- Status: ${sampleTicket.status}`);
        console.log(`- Via Channel: ${sampleTicket.via?.channel}`);
        console.log(`- Via Source: ${JSON.stringify(sampleTicket.via?.source)}`);
        console.log(`- Created: ${sampleTicket.created_at}`);
        console.log(`- Assignee: ${sampleTicket.assignee_id || 'Unassigned'}`);
      }
      
      // Method 8: Try to access Talk/Voice API directly
      console.log('\n📋 Method 8: Try Voice/Talk API');
      try {
        const voiceStats = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
        console.log('Voice API Response:', JSON.stringify(voiceStats, null, 2));
      } catch (error) {
        console.log('Voice API not accessible:', error.message);
      }
      
      // Method 9: Check for tickets with specific subjects that might indicate calls
      console.log('\n📋 Method 9: Tickets with Call-Related Subjects');
      try {
        const callSubjectTickets = await this.zendesk.search('type:ticket (subject:call OR subject:phone OR subject:voice)', {
          per_page: 20
        });
        console.log(`Found ${callSubjectTickets.results?.length || 0} tickets with call-related subjects`);
      } catch (error) {
        console.log('Error searching call subjects:', error.message);
      }
      
      // Summary
      console.log('\n' + '='.repeat(50));
      console.log('📊 QUEUE DETECTION SUMMARY:');
      console.log(`New Voice: ${newVoiceTickets.results?.length || 0}`);
      console.log(`Open Voice: ${openVoiceTickets.results?.length || 0}`);
      console.log(`Pending Voice: ${pendingVoiceTickets.results?.length || 0}`);
      console.log(`Unassigned Voice: ${unassignedVoiceTickets.results?.length || 0}`);
      console.log(`Recent Voice (1hr): ${recentVoiceTickets.results?.length || 0}`);
      console.log(`Via Channel Voice: ${voiceTicketsViaChannel.length}`);
      
      // Suggested queue count
      const suggestedQueueCount = Math.max(
        newVoiceTickets.results?.length || 0,
        unassignedVoiceTickets.results?.length || 0
      );
      
      console.log('\n🎯 SUGGESTED QUEUE COUNT:', suggestedQueueCount);
      
      return {
        newVoice: newVoiceTickets.results?.length || 0,
        openVoice: openVoiceTickets.results?.length || 0,
        pendingVoice: pendingVoiceTickets.results?.length || 0,
        unassignedVoice: unassignedVoiceTickets.results?.length || 0,
        recentVoice: recentVoiceTickets.results?.length || 0,
        viaChannelVoice: voiceTicketsViaChannel.length,
        suggestedQueueCount,
        sampleTicket: voiceTicketsViaChannel[0] || null
      };
      
    } catch (error) {
      console.error('❌ Error in queue debugging:', error.message);
      throw error;
    }
  }

  async debugAgentStatus() {
    console.log('\n🔍 DEBUGGING AGENT STATUS DETECTION');
    console.log('='.repeat(50));
    
    try {
      // Method 1: Get all agents (current method)
      console.log('\n👥 Method 1: All Agent Users');
      const allAgents = await this.zendesk.getUsers({ role: 'agent' });
      console.log(`Found ${allAgents.users?.length || 0} total agent users`);
      
      // Method 2: Get admins too (they can take calls)
      console.log('\n👥 Method 2: Admin Users');
      const adminUsers = await this.zendesk.getUsers({ role: 'admin' });
      console.log(`Found ${adminUsers.users?.length || 0} admin users`);
      
      // Method 3: Check for agents active in last 30 minutes
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000));
      
      let onlineAgents = 0;
      const allUsers = [...(allAgents.users || []), ...(adminUsers.users || [])];
      
      console.log('\n👥 Method 3: Recently Active Agents');
      allUsers.forEach(user => {
        if (user.last_login_at) {
          const lastLogin = new Date(user.last_login_at);
          if (lastLogin >= thirtyMinutesAgo) {
            onlineAgents++;
          }
        }
      });
      
      console.log(`Found ${onlineAgents} agents active in last 30 minutes`);
      
      // Method 4: Try to get current session info
      console.log('\n👥 Method 4: Try Session/Presence API');
      try {
        const sessions = await this.zendesk.makeRequest('GET', '/users/me/sessions.json');
        console.log('Current user sessions:', JSON.stringify(sessions, null, 2));
      } catch (error) {
        console.log('Session API not accessible:', error.message);
      }
      
      // Method 5: Check agents who worked on tickets today
      console.log('\n👥 Method 5: Agents Active Today');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayTickets = await this.zendesk.getTickets({
        per_page: 100,
        sort_by: 'updated_at',
        sort_order: 'desc'
      });
      
      const activeAgentIds = new Set();
      todayTickets.tickets?.forEach(ticket => {
        const updatedAt = new Date(ticket.updated_at);
        if (updatedAt >= today && ticket.assignee_id) {
          activeAgentIds.add(ticket.assignee_id);
        }
      });
      
      console.log(`Found ${activeAgentIds.size} agents who worked on tickets today`);
      
      return {
        totalAgents: allUsers.length,
        recentlyActiveAgents: onlineAgents,
        todayActiveAgents: activeAgentIds.size
      };
      
    } catch (error) {
      console.error('❌ Error debugging agent status:', error.message);
      throw error;
    }
  }
}

async function debugQueueAndAgents() {
  console.log('🔍 ZENDESK QUEUE & AGENT DEBUG ANALYSIS');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  console.log(`🕐 Analysis Time: ${new Date().toLocaleString()}\n`);
  
  try {
    const analyzer = new QueueDebugAnalyzer();
    
    // Debug queue detection
    const queueResults = await analyzer.debugCallQueue();
    
    // Debug agent detection  
    const agentResults = await analyzer.debugAgentStatus();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 RECOMMENDED FIXES:');
    console.log('='.repeat(60));
    
    console.log('\n📞 QUEUE DETECTION:');
    if (queueResults.suggestedQueueCount > 0) {
      console.log(`✅ Use combination of new + unassigned voice tickets: ${queueResults.suggestedQueueCount}`);
    } else {
      console.log('⚠️  No queued calls detected - this might be correct if no calls are waiting');
    }
    
    console.log('\n👥 AGENT DETECTION:');
    if (agentResults.recentlyActiveAgents > 0) {
      console.log(`✅ Use recently active agents: ${agentResults.recentlyActiveAgents}`);
    } else if (agentResults.todayActiveAgents > 0) {
      console.log(`⚠️  Use today's active agents as fallback: ${agentResults.todayActiveAgents}`);
    } else {
      console.log('⚠️  No active agents detected - check if this matches reality');
    }
    
    console.log('\n💡 NEXT STEPS:');
    console.log('1. Compare these numbers with your Zendesk dashboard');
    console.log('2. Check if your Zendesk has Talk/Voice enabled');
    console.log('3. Verify API permissions for voice channel access');
    
  } catch (error) {
    console.error('❌ Debug analysis failed:', error.message);
  }
}

// Run the debug analysis
debugQueueAndAgents();