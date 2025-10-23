#!/usr/bin/env node

/**
 * Azure Server Diagnostic Script
 * Run this script on your Azure server to diagnose the 404 error
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('🔍 Azure Server Diagnostic Script');
console.log('================================\n');

// Check 1: Required files exist
console.log('📁 Checking required files...');
const requiredFiles = [
  'server.js',
  'package.json',
  '.env',
  'src/ZendeskClient.js',
  'src/services/TicketAnalyticsService.js',
  'src/services/TicketCacheService.js',
  'src/services/CallAnalyticsService.js',
  'src/services/ZendeskReportingService.js',
  'src/services/gptResponder.js'
];

const missingFiles = [];
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    missingFiles.push(file);
  }
});

if (missingFiles.length > 0) {
  console.log(`\n⚠️  MISSING FILES: ${missingFiles.length}`);
  console.log('These files need to be uploaded to your Azure server.');
}

// Check 2: Environment variables
console.log('\n🔐 Checking environment variables...');
require('dotenv').config();

const requiredEnvVars = [
  'ZENDESK_SUBDOMAIN',
  'ZENDESK_EMAIL', 
  'ZENDESK_API_TOKEN'
];

const missingEnvVars = [];
requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar} = ${process.env[envVar].substring(0, 10)}...`);
  } else {
    console.log(`❌ ${envVar} - MISSING`);
    missingEnvVars.push(envVar);
  }
});

if (missingEnvVars.length > 0) {
  console.log(`\n⚠️  MISSING ENV VARS: ${missingEnvVars.length}`);
  console.log('Create a .env file with these variables.');
}

// Check 3: Node modules
console.log('\n📦 Checking dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const dependencies = Object.keys(packageJson.dependencies || {});
  
  dependencies.forEach(dep => {
    try {
      require.resolve(dep);
      console.log(`✅ ${dep}`);
    } catch (e) {
      console.log(`❌ ${dep} - NOT INSTALLED`);
    }
  });
} catch (e) {
  console.log('❌ Error reading package.json');
}

// Check 4: Test service imports
console.log('\n🧪 Testing service imports...');
try {
  const TicketAnalyticsService = require('./src/services/TicketAnalyticsService');
  console.log('✅ TicketAnalyticsService imported successfully');
  
  const CallAnalyticsService = require('./src/services/CallAnalyticsService');
  console.log('✅ CallAnalyticsService imported successfully');
  
  const ZendeskClient = require('./src/ZendeskClient');
  console.log('✅ ZendeskClient imported successfully');
  
} catch (error) {
  console.log(`❌ Import error: ${error.message}`);
}

// Check 5: Test if server is running
console.log('\n🌐 Testing if server is running...');

function testEndpoint(path, name) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      timeout: 5000
    }, (res) => {
      console.log(`${res.statusCode === 200 ? '✅' : '❌'} ${name}: HTTP ${res.statusCode}`);
      resolve(res.statusCode);
    });
    
    req.on('error', (error) => {
      console.log(`❌ ${name}: ${error.message}`);
      resolve(0);
    });
    
    req.on('timeout', () => {
      console.log(`❌ ${name}: Timeout`);
      req.destroy();
      resolve(0);
    });
    
    req.end();
  });
}

async function testEndpoints() {
  await testEndpoint('/health', 'Health Check');
  await testEndpoint('/api/ticket-analytics/5-day', 'Ticket Analytics');
  await testEndpoint('/api/call-analytics/5-day', 'Call Analytics');
  await testEndpoint('/web/tickets.html', 'Tickets Page');
}

// Run tests with delay to allow any server startup
setTimeout(async () => {
  await testEndpoints();
  
  console.log('\n📋 DIAGNOSTIC SUMMARY');
  console.log('===================');
  
  if (missingFiles.length > 0) {
    console.log(`❌ Missing ${missingFiles.length} required files`);
  }
  
  if (missingEnvVars.length > 0) {
    console.log(`❌ Missing ${missingEnvVars.length} environment variables`);
  }
  
  if (missingFiles.length === 0 && missingEnvVars.length === 0) {
    console.log('✅ All required files and environment variables are present');
    console.log('If you\'re still getting 404 errors, check:');
    console.log('   1. Server is running (node server.js)');
    console.log('   2. No port conflicts');
    console.log('   3. Check server logs for errors');
  }
  
  console.log('\n🔧 Next steps:');
  console.log('1. Fix any missing files/environment variables');
  console.log('2. Run: npm install');
  console.log('3. Run: node server.js');
  console.log('4. Test: curl http://localhost:3000/api/ticket-analytics/5-day');
  
}, 1000);