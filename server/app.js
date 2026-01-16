require('dotenv').config();
const scheduler = require('./cron/scheduler');

// Start the placement drive scheduler
scheduler.init();

console.log('🚀 Placement Drive Backend Server Started');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Scheduler Status: Active`);

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n📴 Gracefully shutting down placement drive backend...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n📴 Gracefully shutting down placement drive backend...');
  process.exit(0);
});
