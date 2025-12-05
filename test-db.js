const { Client } = require('pg');
require('dotenv').config({ path: './web/.env' });

async function testDatabase() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Test connection info
    const connInfo = await client.query('SELECT current_database(), current_user, version()');
    console.log('📊 Connection Info:');
    console.log('   Database:', connInfo.rows[0].current_database);
    console.log('   User:', connInfo.rows[0].current_user);
    console.log('   Version:', connInfo.rows[0].version.split(' ').slice(0, 2).join(' '));
    console.log('');

    // Test CREATE TABLE permission
    console.log('🧪 Testing CREATE TABLE permission...');
    await client.query('CREATE TABLE IF NOT EXISTS test_permissions (id SERIAL PRIMARY KEY, name VARCHAR(100))');
    console.log('✅ CREATE TABLE - Success\n');

    // Test INSERT permission
    console.log('🧪 Testing INSERT permission...');
    await client.query("INSERT INTO test_permissions (name) VALUES ('test_row')");
    console.log('✅ INSERT - Success\n');

    // Test SELECT permission
    console.log('🧪 Testing SELECT permission...');
    const selectResult = await client.query('SELECT * FROM test_permissions');
    console.log('✅ SELECT - Success (Found ' + selectResult.rows.length + ' rows)\n');

    // Test UPDATE permission
    console.log('🧪 Testing UPDATE permission...');
    await client.query("UPDATE test_permissions SET name = 'updated_row' WHERE name = 'test_row'");
    console.log('✅ UPDATE - Success\n');

    // Test DELETE permission
    console.log('🧪 Testing DELETE permission...');
    await client.query('DELETE FROM test_permissions');
    console.log('✅ DELETE - Success\n');

    // Test DROP TABLE permission
    console.log('🧪 Testing DROP TABLE permission...');
    await client.query('DROP TABLE test_permissions');
    console.log('✅ DROP TABLE - Success\n');

    console.log('🎉 All permissions verified! You have full CRUD access.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connection closed.');
  }
}

testDatabase();
