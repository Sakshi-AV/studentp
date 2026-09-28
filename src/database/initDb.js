const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  console.log('🚀 Initializing Database Schema...');
  const isPostgres = db.getDbType() === 'postgres';

  const pkType = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const timestampType = isPostgres ? 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP';
  const boolType = isPostgres ? 'BOOLEAN DEFAULT FALSE' : 'INTEGER DEFAULT 0';

  try {
    // 1. Users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id ${pkType},
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'mentor', 'admin')),
        department VARCHAR(100) DEFAULT 'Computer Science',
        avatar_url VARCHAR(255) DEFAULT '',
        created_at ${timestampType}
      );
    `);

    // 2. Projects table
    await db.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id ${pkType},
        title VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'General',
        status VARCHAR(20) NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'review', 'completed', 'on_hold')),
        mentor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        due_date DATE,
        created_at ${timestampType},
        updated_at ${timestampType}
      );
    `);

    // 3. Project Members
    await db.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        id ${pkType},
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_in_project VARCHAR(30) DEFAULT 'contributor',
        joined_at ${timestampType},
        UNIQUE(project_id, user_id)
      );
    `);

    // 4. Tasks table
    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id ${pkType},
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
        priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        due_date DATE,
        estimated_hours NUMERIC(5,2) DEFAULT 0,
        actual_hours NUMERIC(5,2) DEFAULT 0,
        position INTEGER DEFAULT 0,
        created_at ${timestampType},
        updated_at ${timestampType}
      );
    `);

    // 5. Comments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id ${pkType},
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_mentor_feedback ${boolType},
        created_at ${timestampType}
      );
    `);

    // 6. Activity Logs
    await db.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id ${pkType},
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        created_at ${timestampType}
      );
    `);

    // Check if demo users already exist
    const { rows: existingUsers } = await db.query('SELECT count(*) as count FROM users');
    const userCount = parseInt(existingUsers[0]?.count || 0, 10);

    if (userCount === 0) {
      console.log('🌱 Seeding initial demo accounts, capstone projects, and tasks...');
      const passwordHash = await bcrypt.hash('Password123!', 10);

      // Seed Users
      const usersToInsert = [
        ['Alex Rivera', 'alex.student@campus.edu', passwordHash, 'student', 'Computer Science', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'],
        ['Priya Patel', 'priya.student@campus.edu', passwordHash, 'student', 'Software Engineering', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150'],
        ['Dr. Marcus Chen', 'dr.chen@campus.edu', passwordHash, 'mentor', 'Artificial Intelligence & Robotics', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'],
        ['Prof. Elena Rostova', 'elena.mentor@campus.edu', passwordHash, 'mentor', 'Data Science & Systems', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'],
        ['Sarah Jenkins', 'admin@campus.edu', passwordHash, 'admin', 'Academic Computing Services', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150'],
      ];

      for (const u of usersToInsert) {
        await db.query(
          `INSERT INTO users (name, email, password_hash, role, department, avatar_url) VALUES ($1, $2, $3, $4, $5, $6)`,
          u
        );
      }

      // Seed Projects
      const projectsToInsert = [
        ['Autonomous Drone Navigation with Edge AI', 'Lightweight computer vision pipeline deployed on Raspberry Pi 5 to guide indoor navigation and obstacle avoidance without GPS.', 'Artificial Intelligence', 'in_progress', 3, 1, '2026-11-15'],
        ['Smart Campus IoT Energy Optimizer', 'Distributed IoT sensor network collecting temperature, occupancy, and power metrics to optimize HVAC and lighting scheduling across campus halls.', 'IoT & Embedded Systems', 'review', 4, 2, '2026-10-30'],
        ['HealthTrack: Real-Time Patient Vitals Web App', 'HIPAA-compliant full-stack dashboard for clinics to visualize live telemetry from wearable cardiac sensors with predictive anomaly alerts.', 'Web Development', 'in_progress', 3, 1, '2026-12-01'],
        ['Blockchain Academic Credential Verification', 'Decentralized smart contracts on Ethereum testnet ensuring tamper-proof diploma and transcript verification for university graduates.', 'Cybersecurity & Web3', 'planning', 4, 2, '2026-12-20'],
      ];

      for (const p of projectsToInsert) {
        await db.query(
          `INSERT INTO projects (title, description, category, status, mentor_id, created_by, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          p
        );
      }

      // Seed Project Members
      const membersToInsert = [
        [1, 1, 'lead'],
        [1, 2, 'contributor'],
        [2, 2, 'lead'],
        [2, 1, 'contributor'],
        [3, 1, 'lead'],
        [4, 2, 'lead'],
      ];

      for (const m of membersToInsert) {
        await db.query(
          `INSERT INTO project_members (project_id, user_id, role_in_project) VALUES ($1, $2, $3)`,
          m
        );
      }

      // Seed Tasks
      const tasksToInsert = [
        // Project 1
        [1, 'Benchmark YOLOv8-nano on Edge Device', 'Quantize model weights to INT8 and measure inference latency on Raspberry Pi 5 under thermal load.', 'done', 'high', 1, 1, '2026-10-05', 12.0, 10.5, 0],
        [1, 'Design Optical Flow Sensor Mounting Bracket', '3D model vibration-dampening camera mount in Fusion360 and test SLA resin print tolerance.', 'done', 'medium', 2, 1, '2026-10-10', 8.0, 7.5, 1],
        [1, 'Implement Kalman Filter for Sensor Fusion', 'Combine IMU accelerometer data with optical flow vector calculations to correct drift in real-time.', 'in_progress', 'urgent', 1, 1, '2026-10-25', 18.0, 11.0, 0],
        [1, 'Calibrate Stereo Camera Baseline', 'Run OpenCV chessboard calibration routine to compute camera intrinsic and extrinsic matrix parameters.', 'in_progress', 'high', 2, 1, '2026-10-28', 10.0, 4.0, 1],
        [1, 'Autonomous Waypoint Following Flight Test', 'Perform tethered flight trials in the robotics lab testing PID position controller response.', 'review', 'urgent', 1, 1, '2026-11-05', 15.0, 0.0, 0],
        [1, 'Draft Mid-Term Technical Capstone Report', 'Compile hardware architecture diagrams, latency benchmarks, and obstacle avoidance error margins.', 'todo', 'medium', 1, 1, '2026-11-12', 20.0, 0.0, 0],

        // Project 2
        [2, 'Deploy ESP32 Firmware with MQTT Client', 'Flash custom C++ firmware on 12 sensor nodes configured for TLS MQTT over campus WiFi.', 'done', 'high', 2, 2, '2026-09-30', 14.0, 13.0, 0],
        [2, 'InfluxDB Time-Series Pipeline Setup', 'Setup high-throughput time-series database with retention policies for telemetry data.', 'done', 'medium', 1, 2, '2026-10-08', 9.0, 8.5, 1],
        [2, 'Occupancy Prediction Neural Net Model', 'Train LSTM network on historical power consumption and WiFi probe counts to forecast room occupancy.', 'review', 'high', 2, 2, '2026-10-20', 16.0, 15.0, 0],
        [2, 'Energy Savings Evaluation Audit', 'Review HVAC automated cutoff effectiveness against baseline energy utility bills with Dr. Elena.', 'review', 'urgent', 2, 2, '2026-10-29', 10.0, 6.0, 1],

        // Project 3
        [3, 'Design Glassmorphic UI Dashboard Layout', 'Mockup clinical overview screens with dark/light mode and telemetry widgets.', 'done', 'medium', 1, 1, '2026-10-15', 10.0, 9.0, 0],
        [3, 'WebSocket Vital Signs Stream Ingestion', 'Implement bi-directional WebSocket handler for real-time ECG waveform streaming.', 'in_progress', 'urgent', 1, 1, '2026-11-02', 15.0, 8.0, 0],
        [3, 'HIPAA Security & Audit Log Compliance Check', 'Ensure all patient identifiable metrics are hashed at rest and logged according to standards.', 'todo', 'high', 2, 1, '2026-11-18', 12.0, 0.0, 0],
      ];

      for (const t of tasksToInsert) {
        await db.query(
          `INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, created_by, due_date, estimated_hours, actual_hours, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          t
        );
      }

      // Seed Comments & Mentor feedback
      const commentsToInsert = [
        [1, 1, 3, 'Excellent benchmark results on INT8 quantization. Noticeable drop in thermal throttling. Proceed with the Kalman filter integration next.', 1],
        [3, 1, 1, 'Currently observing a 12ms latency spike when the optical flow matrix drops below 30 feature points. Adding adaptive feature thresholding.', 0],
        [5, 1, 3, 'Please ensure lab safety protocols are signed off before the tethered test. I will be present during the Friday flight trials to observe.', 1],
        [9, 2, 4, 'The LSTM model accuracy on 24h occupancy lookahead is impressive (93.4%). Make sure to document validation splits in your final presentation.', 1],
        [12, 3, 1, 'Completed initial WebSocket buffer benchmarks. Handles 500 simultaneous packet streams at < 40ms jitter.', 0],
      ];

      for (const c of commentsToInsert) {
        await db.query(
          `INSERT INTO comments (task_id, project_id, user_id, content, is_mentor_feedback) VALUES ($1, $2, $3, $4, $5)`,
          c
        );
      }

      // Seed Activity Logs
      const activitiesToInsert = [
        [1, 1, 'task_completed', 'Alex Rivera completed task "Benchmark YOLOv8-nano on Edge Device"'],
        [1, 3, 'mentor_feedback', 'Dr. Marcus Chen added mentor feedback on task "Benchmark YOLOv8-nano on Edge Device"'],
        [2, 2, 'task_review', 'Priya Patel moved "Occupancy Prediction Neural Net Model" to Under Review'],
        [3, 1, 'project_created', 'Alex Rivera created project "HealthTrack: Real-Time Patient Vitals Web App"'],
      ];

      for (const a of activitiesToInsert) {
        await db.query(
          `INSERT INTO activity_logs (project_id, user_id, action_type, description) VALUES ($1, $2, $3, $4)`,
          a
        );
      }

      console.log('✅ Database seeded successfully with demo users, projects, tasks, and feedback.');
    } else {
      console.log(`ℹ️ Database already initialized with ${userCount} users.`);
    }
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

module.exports = { initializeDatabase };

if (require.main === module) {
  initializeDatabase().then(() => {
    console.log('Database initialization script completed.');
    process.exit(0);
  }).catch((err) => {
    console.error('Initialization failed:', err);
    process.exit(1);
  });
}
