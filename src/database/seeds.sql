-- Student Project Management Portal
-- Seed Data for Users, Projects, Tasks, and Comments

-- Insert Default Demo Users (Password: Password123!)
-- Hash: $2b$10$yxjLOuDX/0riE8mf7BEFA.pLSeBf.vkklS5YpVf5MKB7lQxLHqXD6
INSERT INTO users (id, name, email, password_hash, role, department, avatar_url) VALUES
(1, 'Alex Rivera', 'alex.student@campus.edu', '$2b$10$yxjLOuDX/0riE8mf7BEFA.pLSeBf.vkklS5YpVf5MKB7lQxLHqXD6', 'student', 'Computer Science', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'),
(2, 'Priya Patel', 'priya.student@campus.edu', '$2b$10$yxjLOuDX/0riE8mf7BEFA.pLSeBf.vkklS5YpVf5MKB7lQxLHqXD6', 'student', 'Software Engineering', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150'),
(3, 'Dr. Marcus Chen', 'dr.chen@campus.edu', '$2b$10$yxjLOuDX/0riE8mf7BEFA.pLSeBf.vkklS5YpVf5MKB7lQxLHqXD6', 'mentor', 'Artificial Intelligence & Robotics', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'),
(4, 'Prof. Elena Rostova', 'elena.mentor@campus.edu', '$2b$10$yxjLOuDX/0riE8mf7BEFA.pLSeBf.vkklS5YpVf5MKB7lQxLHqXD6', 'mentor', 'Data Science & Systems', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'),
(5, 'Sarah Jenkins', 'admin@campus.edu', '$2b$10$yxjLOuDX/0riE8mf7BEFA.pLSeBf.vkklS5YpVf5MKB7lQxLHqXD6', 'admin', 'Academic Computing Services', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150');

-- Reset user sequence for postgres
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- Insert Sample Projects
INSERT INTO projects (id, title, description, category, status, mentor_id, created_by, due_date) VALUES
(1, 'Autonomous Drone Navigation with Edge AI', 'Developing a lightweight computer vision pipeline deployed on Raspberry Pi 5 to guide indoor navigation and obstacle avoidance without GPS.', 'Artificial Intelligence', 'in_progress', 3, 1, '2026-11-15'),
(2, 'Smart Campus IoT Energy Optimizer', 'Distributed IoT sensor network collecting temperature, occupancy, and power metrics to optimize HVAC and lighting scheduling across campus halls.', 'IoT & Embedded Systems', 'review', 4, 2, '2026-10-30'),
(3, 'HealthTrack: Real-Time Patient Vitals Web App', 'HIPAA-compliant full-stack dashboard for clinics to visualize live telemetry from wearable cardiac sensors with predictive anomaly alerts.', 'Web Development', 'in_progress', 3, 1, '2026-12-01'),
(4, 'Blockchain Academic Credential Verification', 'Decentralized smart contracts on Ethereum testnet ensuring tamper-proof diploma and transcript verification for university graduates.', 'Cybersecurity & Web3', 'planning', 4, 2, '2026-12-20');

SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));

-- Insert Project Members
INSERT INTO project_members (project_id, user_id, role_in_project) VALUES
(1, 1, 'lead'),
(1, 2, 'contributor'),
(2, 2, 'lead'),
(2, 1, 'contributor'),
(3, 1, 'lead'),
(4, 2, 'lead');

-- Insert Sample Tasks for Project 1 (Autonomous Drone)
INSERT INTO tasks (id, project_id, title, description, status, priority, assigned_to, created_by, due_date, estimated_hours, actual_hours, position) VALUES
(1, 1, 'Benchmark YOLOv8-nano on Edge Device', 'Quantize model weights to INT8 and measure inference latency on Raspberry Pi 5 under thermal load.', 'done', 'high', 1, 1, '2026-10-05', 12.0, 10.5, 0),
(2, 1, 'Design Optical Flow Sensor Mounting Bracket', '3D model vibration-dampening camera mount in Fusion360 and test SLA resin print tolerance.', 'done', 'medium', 2, 1, '2026-10-10', 8.0, 7.5, 1),
(3, 1, 'Implement Kalman Filter for Sensor Fusion', 'Combine IMU accelerometer data with optical flow vector calculations to correct drift in real-time.', 'in_progress', 'urgent', 1, 1, '2026-10-25', 18.0, 11.0, 0),
(4, 1, 'Calibrate Stereo Camera Baseline', 'Run OpenCV chessboard calibration routine to compute camera intrinsic and extrinsic matrix parameters.', 'in_progress', 'high', 2, 1, '2026-10-28', 10.0, 4.0, 1),
(5, 1, 'Autonomous Waypoint Following Flight Test', 'Perform tethered flight trials in the robotics lab testing PID position controller response.', 'review', 'urgent', 1, 1, '2026-11-05', 15.0, 0.0, 0),
(6, 1, 'Draft Mid-Term Technical Capstone Report', 'Compile hardware architecture diagrams, latency benchmarks, and obstacle avoidance error margins.', 'todo', 'medium', 1, 1, '2026-11-12', 20.0, 0.0, 0);

-- Insert Sample Tasks for Project 2 (Smart Campus IoT)
INSERT INTO tasks (id, project_id, title, description, status, priority, assigned_to, created_by, due_date, estimated_hours, actual_hours, position) VALUES
(7, 2, 'Deploy ESP32 Firmware with MQTT Client', 'Flash custom C++ firmware on 12 sensor nodes configured for TLS MQTT over campus WiFi.', 'done', 'high', 2, 2, '2026-09-30', 14.0, 13.0, 0),
(8, 2, 'InfluxDB Time-Series Pipeline Setup', 'Setup high-throughput time-series database with retention policies for telemetry data.', 'done', 'medium', 1, 2, '2026-10-08', 9.0, 8.5, 1),
(9, 2, 'Occupancy Prediction Neural Net Model', 'Train LSTM network on historical power consumption and WiFi probe counts to forecast room occupancy.', 'review', 'high', 2, 2, '2026-10-20', 16.0, 15.0, 0),
(10, 2, 'Energy Savings Evaluation Audit', 'Review HVAC automated cutoff effectiveness against baseline energy utility bills with Dr. Elena.', 'review', 'urgent', 2, 2, '2026-10-29', 10.0, 6.0, 1);

-- Insert Sample Tasks for Project 3 (HealthTrack)
INSERT INTO tasks (id, project_id, title, description, status, priority, assigned_to, created_by, due_date, estimated_hours, actual_hours, position) VALUES
(11, 3, 'Design Glassmorphic UI Dashboard Layout', 'Mockup clinical overview screens with dark/light mode and telemetry widgets.', 'done', 'medium', 1, 1, '2026-10-15', 10.0, 9.0, 0),
(12, 3, 'WebSocket Vital Signs Stream Ingestion', 'Implement bi-directional WebSocket handler for real-time ECG waveform streaming.', 'in_progress', 'urgent', 1, 1, '2026-11-02', 15.0, 8.0, 0),
(13, 3, 'HIPAA Security & Audit Log Compliance Check', 'Ensure all patient identifiable metrics are hashed at rest and logged according to standards.', 'todo', 'high', 2, 1, '2026-11-18', 12.0, 0.0, 0);

SELECT setval('tasks_id_seq', (SELECT MAX(id) FROM tasks));

-- Insert Sample Comments & Mentor Feedback
INSERT INTO comments (id, task_id, project_id, user_id, content, is_mentor_feedback) VALUES
(1, 1, 1, 3, 'Excellent benchmark results on INT8 quantization. Noticeable drop in thermal throttling. Proceed with the Kalman filter integration next.', TRUE),
(2, 3, 1, 1, 'Currently observing a 12ms latency spike when the optical flow matrix drops below 30 feature points. Adding adaptive feature thresholding.', FALSE),
(3, 5, 1, 3, 'Please ensure lab safety protocols are signed off before the tethered test. I will be present during the Friday flight trials to observe.', TRUE),
(4, 9, 2, 4, 'The LSTM model accuracy on 24h occupancy lookahead is impressive (93.4%). Make sure to document validation splits in your final presentation.', TRUE),
(5, 12, 3, 1, 'Completed initial WebSocket buffer benchmarks. Handles 500 simultaneous packet streams at < 40ms jitter.', FALSE);

SELECT setval('comments_id_seq', (SELECT MAX(id) FROM comments));

-- Insert Activity Logs
INSERT INTO activity_logs (project_id, user_id, action_type, description) VALUES
(1, 1, 'task_completed', 'Alex Rivera completed task "Benchmark YOLOv8-nano on Edge Device"'),
(1, 3, 'mentor_feedback', 'Dr. Marcus Chen added mentor feedback on task "Benchmark YOLOv8-nano on Edge Device"'),
(2, 2, 'task_review', 'Priya Patel moved "Occupancy Prediction Neural Net Model" to Under Review'),
(3, 1, 'project_created', 'Alex Rivera created project "HealthTrack: Real-Time Patient Vitals Web App"');
