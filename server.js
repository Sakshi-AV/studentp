const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const { initializeDatabase } = require('./src/database/initDb');
const db = require('./src/config/db');

// Route Handlers
const authRoutes = require('./src/routes/authRoutes');
const projectRoutes = require('./src/routes/projectRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const commentRoutes = require('./src/routes/commentRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const mentorRoutes = require('./src/routes/mentorRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: db.getDbType(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mentor', mentorRoutes);

// Fallback SPA routing to index.html for non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// Start Server with Database Initialization
async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🎓 Student Project Management Portal is running!`);
      console.log(`🌐 Local URL: http://localhost:${PORT}`);
      console.log(`🗄️  Active Database Engine: ${db.getDbType().toUpperCase()}`);
      console.log(`======================================================\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
