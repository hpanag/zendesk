const fs = require('fs');
const path = require('path');
const TicketDataService = require('./TicketDataService');
const ZendeskReportingService = require('./ZendeskReportingService');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
  minimumFractionDigits: 0
});

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '--';
  }
  return numberFormatter.format(Number(value));
}

function formatPercent(numerator, denominator) {
  if (!denominator || denominator === 0 || numerator === null || numerator === undefined) {
    return '--';
  }
  return percentFormatter.format(numerator / denominator);
}

function resolveLatestFile(prefix) {
  try {
    const entries = fs
      .readdirSync(DATA_DIR)
      .filter((file) => file.startsWith(prefix))
      .map((name) => ({
        name,
        fullPath: path.join(DATA_DIR, name),
        stats: fs.statSync(path.join(DATA_DIR, name))
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    return entries.length ? entries[0].fullPath : null;
  } catch (error) {
    console.error(`Failed to resolve latest file for prefix "${prefix}":`, error.message);
    return null;
  }
}

function safeLoadJson(filePath) {
  if (!filePath) {
    return null;
  }

  try {
    const payload = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(payload);
  } catch (error) {
    console.error(`Failed to load JSON file at ${filePath}:`, error.message);
    return null;
  }
}

function getExecView() {
  return safeLoadJson(path.join(DATA_DIR, 'execView.json'));
}

function getZendeskKpis() {
  return safeLoadJson(resolveLatestFile('zendesk-kpis'));
}

function summarizeVoiceVolume() {
  const execView = getExecView();
  if (!execView?.dailyKPIs) {
    return null;
  }

  const snapshots = Object.values(execView.dailyKPIs)
    .map((entry) => ({
      date: entry.date,
      voice: entry.voice || {}
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!snapshots.length) {
    return null;
  }

  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];

  const totalInbound = latest.voice.totalInboundCalls?.value ?? null;
  const notAnswered = latest.voice.notAnsweredCalls?.value ?? null;
  const outbound = latest.voice.outboundCalls?.value ?? null;

  const changeInbound = previous
    ? totalInbound - (previous.voice.totalInboundCalls?.value ?? 0)
    : null;
  const changeMissed = previous
    ? notAnswered - (previous.voice.notAnsweredCalls?.value ?? 0)
    : null;

  const recentTrend = execView.trends?.voice?.totalInboundCalls || [];
  const trailingDays = recentTrend.slice(-7);
  const avgTrail =
    trailingDays.length > 0
      ? trailingDays.reduce((sum, point) => sum + (point.value || 0), 0) / trailingDays.length
      : null;

  return {
    latestDate: latest.date,
    totalInbound,
    notAnswered,
    outbound,
    changeInbound,
    changeMissed,
    avgTrailingInbound: avgTrail,
    trendSample: trailingDays
  };
}

function summarizeTicketBacklog() {
  const kpis = getZendeskKpis();
  if (!kpis?.statusBreakdown) {
    return null;
  }

  const totalOpen = (kpis.statusBreakdown.open || 0) + (kpis.statusBreakdown.pending || 0) + (kpis.statusBreakdown.hold || 0);
  const closedOrSolved = (kpis.statusBreakdown.closed || 0) + (kpis.statusBreakdown.solved || 0);

  return {
    totalTickets: kpis.summary?.totalTickets || null,
    open: kpis.statusBreakdown.open || 0,
    pending: kpis.statusBreakdown.pending || 0,
    hold: kpis.statusBreakdown.hold || 0,
    closed: kpis.statusBreakdown.closed || 0,
    solved: kpis.statusBreakdown.solved || 0,
    closedOrSolved,
    backlog: totalOpen,
    snapshotDate: kpis.summary?.analysisDate || null
  };
}

function summarizeCsat() {
  const kpis = getZendeskKpis();
  if (!kpis?.satisfactionBreakdown) {
    return null;
  }

  const satisfied = kpis.satisfactionBreakdown.good || 0;
  const dissatisfied = kpis.satisfactionBreakdown.bad || 0;
  const offered = kpis.satisfactionBreakdown.offered || 0;

  return {
    satisfied,
    dissatisfied,
    offered,
    satisfactionRate: offered > 0 ? satisfied / offered : null,
    snapshotDate: kpis.summary?.analysisDate || null
  };
}

function humanDate(dateString) {
  if (!dateString) {
    return 'the latest available day';
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function buildVoiceNarrative(summary) {
  if (!summary) {
    return 'I was unable to locate recent voice call volume in the cached data.';
  }

  const parts = [];
  parts.push(
    `On ${humanDate(summary.latestDate)} we logged ${formatNumber(summary.totalInbound)} inbound calls with ${formatNumber(summary.notAnswered)} missed and ${formatNumber(summary.outbound)} outbound.`
  );

  if (summary.changeInbound !== null) {
    const direction = summary.changeInbound === 0 ? 'flat versus' : summary.changeInbound > 0 ? `up ${formatNumber(Math.abs(summary.changeInbound))} from` : `down ${formatNumber(Math.abs(summary.changeInbound))} from`;
    parts.push(`That is ${direction} the previous day.`);
  }

  if (summary.avgTrailingInbound !== null) {
    parts.push(`The trailing 7-day average sits at ${formatNumber(Math.round(summary.avgTrailingInbound))} inbound calls per day.`);
  }

  const missedRate = formatPercent(summary.notAnswered, summary.totalInbound);
  if (missedRate !== '--') {
    parts.push(`Missed-call rate is ${missedRate}.`);
  }

  return parts.join(' ');
}

function buildBacklogNarrative(summary) {
  if (!summary) {
    return 'Ticket backlog metrics are unavailable in the local cache.';
  }

  const parts = [];
  parts.push(
    `Ticket snapshot from ${humanDate(summary.snapshotDate)} shows ${formatNumber(summary.backlog)} active tickets (open ${formatNumber(summary.open)}, pending ${formatNumber(summary.pending)}, hold ${formatNumber(summary.hold)}).`
  );

  parts.push(
    `${formatNumber(summary.closedOrSolved)} tickets are closed or solved out of ${formatNumber(summary.totalTickets)} observed in this export.`
  );

  return parts.join(' ');
}

function buildCsatNarrative(summary) {
  if (!summary) {
    return 'CSAT survey detail is not present in the current cache.';
  }

  const parts = [];
  parts.push(
    `Customer satisfaction snapshot from ${humanDate(summary.snapshotDate)} recorded ${formatNumber(summary.satisfied)} positive and ${formatNumber(summary.dissatisfied)} negative ratings out of ${formatNumber(summary.offered)} surveys offered.`
  );

  if (summary.satisfactionRate !== null) {
    parts.push(`That works out to a satisfaction rate of ${percentFormatter.format(summary.satisfactionRate)}.`);
  }

  return parts.join(' ');
}

async function getLiveTicketData() {
  try {
    const ticketService = new TicketDataService();
    const summary = await ticketService.getComprehensiveTicketSummary();
    return ticketService.formatSummaryForGPT(summary);
  } catch (error) {
    console.error('Error fetching live ticket data:', error);
    return null;
  }
}

async function getLiveReportingData(reportType = 'all', options = {}) {
  try {
    const reportingService = new ZendeskReportingService();
    let data = null;
    
    switch (reportType.toLowerCase()) {
      case 'voice':
      case 'talk':
        data = await reportingService.getVoiceMetrics(options);
        if (!data) {
          return 'Voice/call data is not currently available. This may be due to:' +
                 '\n- Zendesk Talk/Voice API not being configured' +
                 '\n- Insufficient API permissions' +
                 '\n- No voice channel enabled in your Zendesk instance' +
                 '\n\nPlease check your Zendesk Talk configuration and API credentials.';
        }
        return reportingService.formatMetricsForGPT(data, 'voice');
        
      case 'chat':
        data = await reportingService.getChatMetrics(options);
        if (!data) {
          return 'Chat data is not currently available. This may be due to:' +
                 '\n- Zendesk Chat API not being configured' +
                 '\n- Insufficient API permissions' +
                 '\n- No chat channel enabled in your Zendesk instance' +
                 '\n\nPlease check your Zendesk Chat configuration and API credentials.';
        }
        return reportingService.formatMetricsForGPT(data, 'chat');
        
      case 'tickets':
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        data = await reportingService.getTicketAnalytics(weekAgo, today);
        return reportingService.formatMetricsForGPT(data, 'tickets');
        
      case 'satisfaction':
      case 'csat':
        data = await reportingService.getSatisfactionRatings(options);
        return reportingService.formatMetricsForGPT(data, 'satisfaction');
        
      case 'agents':
      case 'performance':
        // Use voice agent activity data since it's working
        const agentVoiceData = await reportingService.getVoiceMetrics(options);
        if (agentVoiceData && agentVoiceData.agentActivity) {
          return reportingService.formatMetricsForGPT(agentVoiceData, 'voice');
        }
        
        // Fallback to general agent performance if voice data not available
        data = await reportingService.getAgentPerformance(options);
        if (!data) {
          return 'Agent performance data is not currently available. This may be due to:' +
                 '\n- Zendesk API permissions' +
                 '\n- No agents configured in your Zendesk instance' +
                 '\n\nPlease check your Zendesk configuration and API credentials.';
        }
        return reportingService.formatMetricsForGPT(data, 'agents');
        
      case 'sla':
        data = await reportingService.getSLACompliance();
        return reportingService.formatMetricsForGPT(data, 'sla');
        
      case 'organizations':
      case 'orgs':
        data = await reportingService.getOrganizationInsights();
        return reportingService.formatMetricsForGPT(data, 'organizations');
        
      case 'system':
      case 'config':
      case 'configuration':
        data = await reportingService.getSystemConfiguration();
        if (!data) {
          return 'System configuration data is not currently available. This may be due to:' +
                 '\n- Insufficient API permissions for admin endpoints' +
                 '\n- Account restrictions' +
                 '\n\nPlease check your Zendesk admin permissions and API credentials.';
        }
        return reportingService.formatMetricsForGPT(data, 'system_config');
        
      case 'help_center':
      case 'knowledge':
      case 'articles':
        data = await reportingService.getHelpCenterMetrics();
        if (!data) {
          return 'Help Center data is not currently available. This may be due to:' +
                 '\n- Help Center not enabled in your Zendesk instance' +
                 '\n- Insufficient API permissions' +
                 '\n\nPlease check your Help Center configuration and API credentials.';
        }
        return reportingService.formatMetricsForGPT(data, 'help_center');
        
      case 'business_rules':
      case 'automation':
      case 'triggers':
      case 'macros':
        data = await reportingService.getBusinessRulesMetrics();
        if (!data) {
          return 'Business rules and automation data is not currently available. This may be due to:' +
                 '\n- Insufficient API permissions for admin endpoints' +
                 '\n- Account restrictions' +
                 '\n\nPlease check your Zendesk admin permissions and API credentials.';
        }
        return reportingService.formatMetricsForGPT(data, 'business_rules');
        
      case 'ticket_quality':
      case 'quality':
      case 'suspended':
      case 'problems':
        const currentDate = new Date().toISOString().split('T')[0];
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        data = await reportingService.getTicketQualityMetrics(monthAgo, currentDate);
        if (!data) {
          return 'Ticket quality metrics are not currently available. This may be due to:' +
                 '\n- Insufficient API permissions' +
                 '\n- No problem/incident tickets in the system' +
                 '\n\nPlease check your Zendesk configuration and API credentials.';
        }
        return reportingService.formatMetricsForGPT(data, 'ticket_quality');
        
      case 'all':
      default:
        // Get comprehensive data for general questions
        const [ticketData, voiceData, satisfactionData] = await Promise.allSettled([
          reportingService.getTicketAnalytics(
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            new Date().toISOString().split('T')[0]
          ),
          reportingService.getVoiceMetrics(),
          reportingService.getSatisfactionRatings()
        ]);
        
        const sections = [];
        if (ticketData.status === 'fulfilled' && ticketData.value) {
          sections.push(reportingService.formatMetricsForGPT(ticketData.value, 'tickets'));
        }
        if (voiceData.status === 'fulfilled' && voiceData.value) {
          sections.push(reportingService.formatMetricsForGPT(voiceData.value, 'voice'));
        }
        if (satisfactionData.status === 'fulfilled' && satisfactionData.value) {
          sections.push(reportingService.formatMetricsForGPT(satisfactionData.value, 'satisfaction'));
        }
        
        return sections.join('\n\n---\n\n');
    }
    
  } catch (error) {
    console.error(`Error fetching ${reportType} reporting data:`, error);
    return null;
  }
}

async function getSpecificReport(reportName, parameters = {}) {
  try {
    const reportingService = new ZendeskReportingService();
    let data = null;
    
    switch (reportName.toLowerCase()) {
      case 'current_queue':
        data = await reportingService.getCurrentQueueActivity();
        break;
        
      case 'agent_activity':
        data = await reportingService.getAgentsActivity(parameters);
        break;
        
      case 'call_legs':
        data = await reportingService.getCallLegs(parameters);
        break;
        
      case 'call_records':
      case 'detailed_calls':
        data = await reportingService.getCallRecords(parameters);
        break;
        
      case 'call_history':
      case 'historical_calls':
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        data = await reportingService.getHistoricalCalls(
          parameters.start_date || weekAgo, 
          parameters.end_date || today, 
          parameters
        );
        break;
        
      case 'call_overview':
        data = await reportingService.getCallOverview(parameters.timeframe || 'today', parameters);
        break;
        
      case 'call_analytics':
        data = await reportingService.getCallAnalytics(parameters.report_type || 'summary', parameters);
        break;
        
      case 'call_recordings':
        data = await reportingService.getCallRecordings(parameters);
        break;
        
      case 'incremental_tickets':
        const startTime = parameters.start_time || Math.floor(Date.now() / 1000) - 86400; // 24h ago
        data = await reportingService.getIncrementalTickets(startTime, parameters);
        break;
        
      case 'activity_stream':
        data = await reportingService.getActivityStream(parameters);
        break;
        
      case 'triggers':
        data = await reportingService.getTriggers();
        break;
        
      case 'automations':
        data = await reportingService.getAutomations();
        break;
        
      case 'tags':
        data = await reportingService.getTags();
        break;
        
      case 'user_segments':
        data = await reportingService.getUserSegments();
        break;
        
      case 'webhooks':
        data = await reportingService.getWebhooks();
        break;
        
      case 'targets':
      case 'notification_targets':
        data = await reportingService.getTargets();
        break;
        
      case 'ticket_forms':
        data = await reportingService.getTicketForms();
        break;
        
      case 'ticket_fields':
        data = await reportingService.getTicketFields();
        break;
        
      case 'user_fields':
        data = await reportingService.getUserFields();
        break;
        
      case 'organization_fields':
        data = await reportingService.getOrganizationFields();
        break;
        
      case 'brands':
        data = await reportingService.getBrands();
        break;
        
      case 'locales':
        data = await reportingService.getLocales();
        break;
        
      case 'schedules':
      case 'business_hours':
        data = await reportingService.getSchedules();
        break;
        
      case 'custom_roles':
        data = await reportingService.getCustomRoles();
        break;
        
      case 'macros':
        data = await reportingService.getMacros();
        break;
        
      case 'views':
        data = await reportingService.getViews();
        break;
        
      case 'suspended_tickets':
        data = await reportingService.getSuspendedTickets(parameters);
        break;
        
      case 'deleted_tickets':
        data = await reportingService.getDeletedTickets(parameters);
        break;
        
      case 'problem_tickets':
        data = await reportingService.getProblemTickets(parameters);
        break;
        
      case 'incident_tickets':
        data = await reportingService.getIncidentTickets(parameters);
        break;
        
      case 'help_center_articles':
        data = await reportingService.getHelpCenterArticles(parameters);
        break;
        
      case 'help_center_sections':
        data = await reportingService.getHelpCenterSections(parameters);
        break;
        
      case 'help_center_categories':
        data = await reportingService.getHelpCenterCategories(parameters);
        break;
        
      case 'time_tracking':
        data = await reportingService.getTimeTracking(parameters);
        break;
        
      case 'agent_productivity':
        const startDate = parameters.start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = parameters.end_date || new Date().toISOString().split('T')[0];
        data = await reportingService.getAgentProductivity(startDate, endDate, parameters);
        break;
        
      case 'sharing_agreements':
        data = await reportingService.getSharingAgreements();
        break;
        
      case 'dynamic_content':
        data = await reportingService.getDynamicContent();
        break;
        
      case 'organization_memberships':
        data = await reportingService.getOrganizationMemberships(parameters);
        break;
        
      case 'historical_voice':
      case 'historical_calls':
        const histStartDate = parameters.start_date || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const histEndDate = parameters.end_date || new Date().toISOString().split('T')[0];
        data = await reportingService.getHistoricalVoiceData(histStartDate, histEndDate);
        break;
        
      case 'group_memberships':
        data = await reportingService.getGroupMemberships(parameters);
        break;
        
      default:
        throw new Error(`Unknown report type: ${reportName}`);
    }
    
    return reportingService.formatMetricsForGPT(data, reportName);
    
  } catch (error) {
    console.error(`Error fetching ${reportName} report:`, error);
    return null;
  }
}

function buildFallbackAnswer(userQuestion) {
  const voiceSummary = summarizeVoiceVolume();
  const backlogSummary = summarizeTicketBacklog();
  const csatSummary = summarizeCsat();

  const lower = (userQuestion || '').toLowerCase();
  const sections = [];

  const wantsVoice = /call|volume|voice|inbound|miss(ed)?|wait|queue/.test(lower);
  const wantsBacklog = /ticket|backlog|open|pending|sla|response/.test(lower);
  const wantsCsat = /csat|satisfaction|survey|nps|feedback/.test(lower);

  if (wantsVoice) {
    sections.push(`Voice volume: ${buildVoiceNarrative(voiceSummary)}`);
  }

  if (wantsBacklog) {
    sections.push(`Ticket backlog: ${buildBacklogNarrative(backlogSummary)}`);
  }

  if (wantsCsat) {
    sections.push(`Customer satisfaction: ${buildCsatNarrative(csatSummary)}`);
  }

  if (!sections.length) {
    sections.push(buildVoiceNarrative(voiceSummary));
    sections.push(buildBacklogNarrative(backlogSummary));
    sections.push(buildCsatNarrative(csatSummary));
  }

  sections.push(
    'Note: This answer was generated without contacting GPT-5 because the API credentials are not configured on this server. Configure OPENAI_API_KEY to enable live GPT-5 responses.'
  );

  return sections.filter(Boolean).join('\n\n');
}

module.exports = {
  summarizeVoiceVolume,
  summarizeTicketBacklog,
  summarizeCsat,
  buildFallbackAnswer,
  getLiveTicketData,
  getLiveReportingData,
  getSpecificReport
};
