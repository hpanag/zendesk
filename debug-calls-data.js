const ZendeskClient = require('./src/ZendeskClient');

class CallsDataAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async analyzeCallsData() {
    console.log('🔍 ANALYZING CALLS DATA FOR MISSING METRICS');
    console.log('='.repeat(60));
    
    try {
      // Get all calls data
      const allCallsResponse = await this.zendesk.makeRequest('GET', '/channels/voice/calls.json?per_page=100');
      const allCalls = allCallsResponse.calls || [];
      
      console.log(`📞 Total calls found: ${allCalls.length}`);
      
      // Filter for today's calls
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaysCalls = allCalls.filter(call => {
        if (!call.pick_up_time) return false;
        const callDate = new Date(call.pick_up_time);
        return callDate >= today;
      });
      
      console.log(`📅 Today's calls: ${todaysCalls.length}`);
      
      if (todaysCalls.length === 0) {
        console.log('⚠️  No calls found for today');
        return;
      }

      // Analyze outbound calls
      await this.analyzeOutboundCalls(todaysCalls);
      
      // Analyze callback calls
      await this.analyzeCallbackCalls(todaysCalls);
      
      // Analyze time to answer
      await this.analyzeTimeToAnswer(todaysCalls);
      
      // Analyze callback wait times
      await this.analyzeCallbackWaitTimes(todaysCalls);

      // Show sample call structures
      await this.showSampleCallStructures(todaysCalls);
      
    } catch (error) {
      console.error('❌ Error analyzing calls data:', error.message);
    }
  }

  async analyzeOutboundCalls(calls) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 ANALYZING: Outbound Calls');
    console.log('='.repeat(50));

    const outboundCalls = calls.filter(call => call.direction === 'outbound');
    console.log(`📊 Outbound calls found: ${outboundCalls.length}`);
    
    if (outboundCalls.length > 0) {
      console.log(`📋 Sample outbound calls:`);
      outboundCalls.slice(0, 3).forEach((call, index) => {
        console.log(`   ${index + 1}. Call ID: ${call.id} | Direction: ${call.direction} | Agent: ${call.agent?.name || 'Unknown'}`);
        console.log(`      Customer: ${call.customer?.name || 'Unknown'} | Pickup: ${call.pick_up_time}`);
      });
    } else {
      console.log('   📊 All calls appear to be inbound - this explains why outbound count is 0');
    }

    // Check for any other direction indicators
    const directions = new Set(calls.map(call => call.direction));
    console.log(`📋 All call directions found: ${Array.from(directions).join(', ')}`);
  }

  async analyzeCallbackCalls(calls) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 ANALYZING: Callback Calls');
    console.log('='.repeat(50));

    // Look for callback indicators in the call data
    let callbackIndicators = [];
    
    calls.forEach(call => {
      // Check if this might be a callback call
      let isCallback = false;
      let reasons = [];

      // Method 1: Check for callback type field
      if (call.type && call.type.toLowerCase().includes('callback')) {
        isCallback = true;
        reasons.push('type field');
      }

      // Method 2: Check call metadata/tags
      if (call.tags && call.tags.some(tag => tag.toLowerCase().includes('callback'))) {
        isCallback = true;
        reasons.push('tags');
      }

      // Method 3: Check if customer info suggests callback
      if (call.customer && call.customer.name) {
        const customerName = call.customer.name.toLowerCase();
        if (customerName.includes('callback') || customerName.includes('scheduled')) {
          isCallback = true;
          reasons.push('customer name');
        }
      }

      // Method 4: Look for callback in any additional fields
      const callStr = JSON.stringify(call).toLowerCase();
      if (callStr.includes('callback') || callStr.includes('scheduled call')) {
        // Don't double count if already found
        if (!isCallback) {
          isCallback = true;
          reasons.push('call data contains callback');
        }
      }

      if (isCallback) {
        callbackIndicators.push({
          callId: call.id,
          reasons: reasons,
          customer: call.customer?.name || 'Unknown',
          agent: call.agent?.name || 'Unknown'
        });
      }
    });

    console.log(`📊 Potential callback calls found: ${callbackIndicators.length}`);
    
    if (callbackIndicators.length > 0) {
      console.log(`📋 Callback indicators:`);
      callbackIndicators.slice(0, 3).forEach(indicator => {
        console.log(`   Call ${indicator.callId}: ${indicator.reasons.join(', ')}`);
        console.log(`      Customer: ${indicator.customer} | Agent: ${indicator.agent}`);
      });
    } else {
      console.log('   📊 No callback calls found - this explains why callback count is 0');
      console.log('   💡 Callbacks might be handled separately or not used today');
    }
  }

  async analyzeTimeToAnswer(calls) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 ANALYZING: Time to Answer');
    console.log('='.repeat(50));

    let answerTimes = [];
    let answerTimeDetails = [];

    calls.forEach(call => {
      // Look for timing fields that might indicate answer time
      const timingFields = [
        'pick_up_time', 'start_time', 'created_at', 'answered_at', 
        'connect_time', 'ring_time', 'answer_delay'
      ];

      let hasAnswerTime = false;
      
      timingFields.forEach(field => {
        if (call[field] && !hasAnswerTime) {
          console.log(`   Call ${call.id} has ${field}: ${call[field]}`);
          
          // If we have both creation and pickup time, calculate answer time
          if (call.created_at && call.pick_up_time) {
            const createdAt = new Date(call.created_at);
            const pickedUpAt = new Date(call.pick_up_time);
            const answerTimeSeconds = (pickedUpAt - createdAt) / 1000;
            
            if (answerTimeSeconds > 0 && answerTimeSeconds < 300) { // Reasonable answer time
              answerTimes.push(answerTimeSeconds);
              answerTimeDetails.push({
                callId: call.id,
                answerTime: answerTimeSeconds,
                createdAt: call.created_at,
                pickupAt: call.pick_up_time
              });
              hasAnswerTime = true;
            }
          }
        }
      });

      // Look for answer time in other possible fields
      Object.keys(call).forEach(key => {
        if (key.toLowerCase().includes('answer') || 
            key.toLowerCase().includes('pickup') || 
            key.toLowerCase().includes('ring')) {
          console.log(`   Call ${call.id} has timing field ${key}: ${call[key]}`);
        }
      });
    });

    console.log(`📊 Answer times calculated: ${answerTimes.length}`);
    
    if (answerTimes.length > 0) {
      const avgAnswerTime = answerTimes.reduce((a, b) => a + b, 0) / answerTimes.length;
      console.log(`   Average time to answer: ${Math.round(avgAnswerTime)} seconds`);
      
      console.log(`📋 Sample answer times:`);
      answerTimeDetails.slice(0, 3).forEach(detail => {
        console.log(`   Call ${detail.callId}: ${Math.round(detail.answerTime)}s`);
      });
    } else {
      console.log('   ⚠️  Cannot calculate answer times from available call data');
      console.log('   💡 Answer time tracking might require different API endpoint or CDR data');
    }
  }

  async analyzeCallbackWaitTimes(calls) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 ANALYZING: Callback Wait Times');
    console.log('='.repeat(50));

    // First, identify callback calls (from previous analysis)
    const potentialCallbacks = calls.filter(call => {
      const callStr = JSON.stringify(call).toLowerCase();
      return callStr.includes('callback') || 
             callStr.includes('scheduled') ||
             (call.type && call.type.toLowerCase().includes('callback'));
    });

    console.log(`📞 Potential callback calls: ${potentialCallbacks.length}`);

    if (potentialCallbacks.length === 0) {
      console.log('   📊 No callback calls found - callback wait time will be 0');
      return;
    }

    // For each callback call, try to determine wait time
    let waitTimes = [];
    
    potentialCallbacks.forEach(call => {
      // Look for fields that might indicate scheduling/wait time
      const waitFields = [
        'scheduled_at', 'callback_time', 'wait_time', 'delay_time',
        'requested_at', 'created_at', 'pick_up_time'
      ];

      waitFields.forEach(field => {
        if (call[field]) {
          console.log(`   Callback call ${call.id} has ${field}: ${call[field]}`);
        }
      });

      // If we have scheduling info, calculate wait time
      if (call.scheduled_at && call.pick_up_time) {
        const scheduledAt = new Date(call.scheduled_at);
        const pickedUpAt = new Date(call.pick_up_time);
        const waitTimeSeconds = (pickedUpAt - scheduledAt) / 1000;
        
        if (waitTimeSeconds > 0) {
          waitTimes.push(waitTimeSeconds);
        }
      }
    });

    if (waitTimes.length > 0) {
      const avgWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
      console.log(`📊 Average callback wait time: ${Math.round(avgWaitTime / 60)} minutes`);
    } else {
      console.log('   ⚠️  Cannot calculate callback wait times from available data');
      console.log('   💡 Callback scheduling might be tracked in a separate system');
    }
  }

  async showSampleCallStructures(calls) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 SAMPLE CALL STRUCTURES');
    console.log('='.repeat(50));

    if (calls.length > 0) {
      console.log(`📋 Complete structure of first call:`);
      console.log(JSON.stringify(calls[0], null, 2));
      
      console.log(`\n📋 All available fields across all calls:`);
      const allFields = new Set();
      calls.forEach(call => {
        Object.keys(call).forEach(key => allFields.add(key));
      });
      console.log(Array.from(allFields).sort().join(', '));
    }
  }
}

async function analyzeCallsData() {
  console.log('🔍 CALLS DATA ANALYZER');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  console.log(`🎯 Goal: Find data sources for missing metrics in calls API\n`);
  
  const analyzer = new CallsDataAnalyzer();
  await analyzer.analyzeCallsData();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Calls data analysis complete');
  console.log('📊 Use findings above to implement missing metrics');
}

analyzeCallsData();