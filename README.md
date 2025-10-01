# Zendesk API Client

A Node.js JavaScript client for interacting with the Zendesk API.

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy the `.env` file and update with your Zendesk credentials:
   - `ZENDESK_SUBDOMAIN`: Your Zendesk subdomain (e.g., 'mycompany' for mycompany.zendesk.com)
   - `ZENDESK_EMAIL`: Your Zendesk email address
   - `ZENDESK_API_TOKEN`: Your Zendesk API token

   To get your API token:
   1. Go to Admin Center > Apps and integrations > APIs > Zendesk API
   2. Click the Settings tab
   3. Enable token access and add a new API token

## Usage

### Basic Usage

```javascript
const ZendeskClient = require('./src/ZendeskClient');

const zendesk = new ZendeskClient();

// Get all tickets
const tickets = await zendesk.getTickets();

// Get a specific ticket
const ticket = await zendesk.getTicket(123);

// Create a new ticket
const newTicket = await zendesk.createTicket({
  subject: 'Help with API',
  comment: { body: 'I need help with the API' },
  priority: 'normal'
});

// Update a ticket
await zendesk.updateTicket(123, {
  status: 'solved',
  comment: { body: 'Issue resolved' }
});
```

### Running the Examples

```bash
# Run the main example
npm start

# Run in development mode (with auto-reload)
npm run dev
```

## Available Scripts

- `npm start` - Run the main application
- `npm run dev` - Run in development mode with nodemon
- `npm test` - Run tests (when implemented)
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## API Methods

### Tickets
- `getTickets(options)` - Get all tickets with optional filters
- `getTicket(ticketId)` - Get a specific ticket
- `createTicket(ticketData)` - Create a new ticket
- `updateTicket(ticketId, ticketData)` - Update a ticket
- `deleteTicket(ticketId)` - Delete a ticket

### Users
- `getUsers(options)` - Get all users
- `getUser(userId)` - Get a specific user
- `createUser(userData)` - Create a new user
- `updateUser(userId, userData)` - Update a user

### Organizations
- `getOrganizations(options)` - Get all organizations
- `getOrganization(orgId)` - Get a specific organization

### Other
- `search(query, options)` - Search across Zendesk
- `getGroups()` - Get all groups
- `getTicketFields()` - Get ticket fields
- `getMacros()` - Get macros
- `getViews()` - Get views

## Examples

Check `src/examples.js` for more detailed examples of common operations.

## Error Handling

The client includes comprehensive error handling for common HTTP status codes:
- 401: Authentication failed
- 403: Access forbidden
- 404: Resource not found

## Rate Limiting

Zendesk API has rate limits. The client will throw errors if you hit these limits. Consider implementing retry logic with exponential backoff for production use.

## Security

- Never commit your `.env` file with real credentials
- Use environment variables in production
- Rotate API tokens regularly# zendesk
