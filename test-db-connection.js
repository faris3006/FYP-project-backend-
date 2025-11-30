const mongoose = require('mongoose');

const dbUri = 'mongodb+srv://Faris:nskV2FZtvzeeoYUu@cluster0.hijww1t.mongodb.net/booking_db?retryWrites=true&w=majority';

console.log('Testing connection to:', dbUri.replace(/:[^@]*@/, ':****@')); // Hide password in logs

mongoose.connect(dbUri, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
})
  .then(() => {
    console.log('✅ SUCCESS: Database connected!');
    process.exit(0);
  })
  .catch((error) => {
    console.log('❌ FAILED: Database connection error');
    console.log('Error:', error.message);
    process.exit(1);
  });
