/**
 * Script to create admin account
 * Run this once to create the admin account: node backend/scripts/create-admin.js
 * 
 * You will be prompted for a password, or you can set ADMIN_PASSWORD environment variable
 */

require('dotenv').config();
const readline = require('readline');
const { createUser, getUserByEmail } = require('../database/db');
const { hashPassword } = require('../utils/password');
const logger = require('../utils/logger');

const ADMIN_EMAIL = 'admin@heartofacheron.com';

async function createAdminAccount() {
  try {
    // Check if admin already exists
    const existingAdmin = getUserByEmail(ADMIN_EMAIL);
    if (existingAdmin) {
      console.log('Admin account already exists!');
      console.log(`Email: ${ADMIN_EMAIL}`);
      console.log(`User ID: ${existingAdmin.user_id}`);
      console.log(`Is Admin: ${existingAdmin.is_admin === 1 ? 'Yes' : 'No'}`);
      
      // Update to ensure is_admin is set
      const { db } = require('../database/db');
      db.prepare('UPDATE users SET is_admin = 1 WHERE email = ?').run(ADMIN_EMAIL);
      console.log('Admin privileges ensured.');
      return;
    }

    // Get password
    let password = process.env.ADMIN_PASSWORD;
    
    if (!password) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      password = await new Promise((resolve) => {
        rl.question('Enter password for admin account: ', (answer) => {
          rl.close();
          resolve(answer);
        });
      });

      if (!password || password.length < 8) {
        console.error('Password must be at least 8 characters long');
        process.exit(1);
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create admin user
    const userId = createUser({
      email: ADMIN_EMAIL,
      password_hash: passwordHash,
      character_name: 'Admin',
      is_admin: 1
    });

    console.log('Admin account created successfully!');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`User ID: ${userId}`);
    console.log('You can now log in with this account.');

  } catch (error) {
    logger.error('Error creating admin account:', error);
    console.error('Failed to create admin account:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createAdminAccount().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = { createAdminAccount };
