const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');

const testConnection = async () => {
  try {
    console.log('🔄 Testing MongoDB Atlas connection...');
    console.log(`📍 URI: ${process.env.MONGO_URI}`);
    
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log('✅ MongoDB Connected Successfully!');
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    console.log(`   Collections: ${Object.keys(conn.connection.collections).join(', ') || 'None yet'}`);
    
    // Test creating a simple document
    const testDoc = await conn.connection.collection('test').insertOne({ 
      test: true, 
      timestamp: new Date(),
      message: 'Connection successful!' 
    });
    
    console.log('✅ Test document created:', testDoc.insertedId);
    
    // Clean up test document
    await conn.connection.collection('test').deleteOne({ _id: testDoc.insertedId });
    console.log('✅ Test document deleted');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection Failed:');
    console.error(`   Error: ${error.message}`);
    process.exit(1);
  }
};

testConnection();
