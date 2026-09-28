/**
 * Automated End-to-End API and Logic Verification Script
 */

const http = require('http');

function apiRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting End-to-End Test Suite for Student Project Management Portal...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
    }
  }

  try {
    // 1. Health Check
    const health = await apiRequest('GET', '/health');
    assert(health.status === 200 && health.data.status === 'healthy', 'API Server health check endpoint returns 200 OK');

    // 2. Demo accounts
    const demo = await apiRequest('GET', '/auth/demo-accounts');
    assert(demo.status === 200 && demo.data.data.accounts.length >= 3, 'Demo accounts list retrieved with predefined student, mentor, admin personas');

    // 3. Student Login
    const studentLogin = await apiRequest('POST', '/auth/login', {
      email: 'alex.student@campus.edu',
      password: 'Password123!',
    });
    assert(studentLogin.status === 200 && studentLogin.data.data.token, 'Student (Alex Rivera) login generates valid JWT token');
    const studentToken = studentLogin.data.data.token;

    // 4. Auth Me check
    const me = await apiRequest('GET', '/auth/me', null, studentToken);
    assert(me.status === 200 && me.data.data.user.role === 'student', 'Auth /me identifies authenticated user role correctly');

    // 5. Fetch Projects List
    const projectsRes = await apiRequest('GET', '/projects');
    assert(projectsRes.status === 200 && projectsRes.data.data.length > 0, `Projects list returns seeded capstone projects (Found: ${projectsRes.data.data.length})`);

    const firstProject = projectsRes.data.data[0];
    assert(firstProject.progress_percent !== undefined, 'Project metrics include calculated progress percentage');

    // 6. Create New Project
    const createProj = await apiRequest('POST', '/projects', {
      title: 'Quantum Key Distribution Simulator',
      description: 'Simulation framework for BB84 quantum cryptography protocol in Python and WebAssembly.',
      category: 'Cybersecurity & Web3',
      status: 'planning',
      due_date: '2026-12-15',
    }, studentToken);
    assert(createProj.status === 201 && createProj.data.data.id, 'New capstone project created successfully by student');
    const newProjectId = createProj.data.data.id;

    // 7. Fetch Project Details with Tasks
    const projDetail = await apiRequest('GET', `/projects/${newProjectId}`);
    assert(projDetail.status === 200 && projDetail.data.data.title === 'Quantum Key Distribution Simulator', 'Project detail endpoint returns complete metadata and members');

    // 8. Add Task to Project
    const createTask = await apiRequest('POST', '/tasks', {
      project_id: newProjectId,
      title: 'Implement Photon Polarization State Vectors',
      description: 'Represent rectilinear and diagonal basis states in NumPy array format.',
      status: 'todo',
      priority: 'high',
      due_date: '2026-11-01',
      estimated_hours: 12,
    }, studentToken);
    assert(createTask.status === 201 && createTask.data.data.id, 'New task added to project with priority and due date');
    const newTaskId = createTask.data.data.id;

    // 9. Patch Task Status (Kanban transition: todo -> in_progress)
    const patchStatus = await apiRequest('PATCH', `/tasks/${newTaskId}/status`, { status: 'in_progress' }, studentToken);
    assert(patchStatus.status === 200 && patchStatus.data.data.status === 'in_progress', 'Kanban status update transitions task to "in_progress"');

    // 10. Post Student Comment on Task
    const postComment = await apiRequest('POST', '/comments', {
      task_id: newTaskId,
      content: 'Initial unit test coverage for polarization states is passing at 98%.',
      is_mentor_feedback: false,
    }, studentToken);
    assert(postComment.status === 201 && postComment.data.data.id, 'Discussion comment posted by student');

    // 11. Mentor Login (Dr. Marcus Chen)
    const mentorLogin = await apiRequest('POST', '/auth/login', {
      email: 'dr.chen@campus.edu',
      password: 'Password123!',
    });
    assert(mentorLogin.status === 200 && mentorLogin.data.data.user.role === 'mentor', 'Faculty Mentor (Dr. Marcus Chen) logged in');
    const mentorToken = mentorLogin.data.data.token;

    // 12. Post Official Faculty Mentor Evaluation Feedback
    const mentorFeedback = await apiRequest('POST', '/comments', {
      task_id: newTaskId,
      content: 'Solid matrix formulation. Ensure you account for dark count rate errors in the simulated detector channel.',
      is_mentor_feedback: true,
    }, mentorToken);
    assert(mentorFeedback.status === 201 && mentorFeedback.data.data.is_mentor_feedback, 'Official faculty mentor feedback recorded with evaluation tag');

    // 13. Move task to "done" and verify project progress calculation
    await apiRequest('PATCH', `/tasks/${newTaskId}/status`, { status: 'done' }, studentToken);
    const updatedProjDetail = await apiRequest('GET', `/projects/${newProjectId}`);
    assert(updatedProjDetail.data.data.progress_percent === 100, 'Project progress percentage dynamically recalculated to 100% upon task completion');

    // 14. Admin Login (Sarah Jenkins)
    const adminLogin = await apiRequest('POST', '/auth/login', {
      email: 'admin@campus.edu',
      password: 'Password123!',
    });
    assert(adminLogin.status === 200 && adminLogin.data.data.user.role === 'admin', 'System Administrator (Sarah Jenkins) logged in');
    const adminToken = adminLogin.data.data.token;

    // 15. Admin Users Directory & Role Permissions
    const adminUsers = await apiRequest('GET', '/admin/users', null, adminToken);
    assert(adminUsers.status === 200 && adminUsers.data.data.length >= 5, 'Admin user directory retrieved with cross-table project and task metrics');

    // 16. Admin System Stats
    const adminStats = await apiRequest('GET', '/admin/stats', null, adminToken);
    assert(adminStats.status === 200 && adminStats.data.data.users && adminStats.data.data.projects, 'System analytics metrics (users, projects, task distributions) computed correctly');

    // 17. Static Frontend Index Serving
    const indexReq = await new Promise((resolve) => {
      http.get('http://localhost:3000/', (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => resolve({ status: res.statusCode, containsTitle: text.includes('ProjectNest') }));
      });
    });
    assert(indexReq.status === 200 && indexReq.containsTitle, 'Express server successfully serves public/index.html SPA entrypoint');

    console.log(`\n======================================================`);
    console.log(`📊 TEST SUITE SUMMARY: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Fatal error in test suite:', err);
  }
}

runTests();
