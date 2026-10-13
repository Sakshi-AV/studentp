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
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runRoleScopingTests() {
  console.log('🧪 Testing Role-Based Project & Task Scoping...\n');
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
    const timestamp = Date.now();

    // 1. Register a BRAND NEW Student
    const newStudentEmail = `student_${timestamp}@campus.edu`;
    const regRes = await apiRequest('POST', '/auth/register', {
      name: 'New Student Test',
      email: newStudentEmail,
      password: 'Password123!',
      role: 'student',
      department: 'Computer Science',
    });
    assert(regRes.status === 201 && regRes.data.data.token, 'New student registers successfully');
    const newStudentToken = regRes.data.data.token;
    const newStudentId = regRes.data.data.user.id;

    // 2. Newly registered student must see ZERO demo projects
    const studentProjectsRes = await apiRequest('GET', '/projects', null, newStudentToken);
    assert(
      studentProjectsRes.status === 200 && studentProjectsRes.data.data.length === 0,
      `New student sees 0 projects on dashboard (No demo projects shown! Expected: 0, Received: ${studentProjectsRes.data.data.length})`
    );

    // 3. Newly registered student must see ZERO demo tasks in metrics
    const studentTasksRes = await apiRequest('GET', '/tasks', null, newStudentToken);
    assert(
      studentTasksRes.status === 200 && studentTasksRes.data.data.length === 0,
      `New student sees 0 tasks in metrics (No demo tasks shown! Expected: 0, Received: ${studentTasksRes.data.data.length})`
    );

    // 4. Student creates their own project and assigns Mentor Dr. Marcus Chen (id: 3)
    const createRes = await apiRequest('POST', '/projects', {
      title: 'Neural Prosthetics Interface',
      description: 'BCI signal decoding on embedded FPGA.',
      category: 'Artificial Intelligence',
      status: 'planning',
      mentor_id: 3,
    }, newStudentToken);
    assert(createRes.status === 201 && createRes.data.data.id, 'New student creates their own capstone project');

    // 5. Student now sees ONLY their own newly created project
    const updatedStudentProjects = await apiRequest('GET', '/projects', null, newStudentToken);
    assert(
      updatedStudentProjects.data.data.length === 1 && updatedStudentProjects.data.data[0].title === 'Neural Prosthetics Interface',
      'Student dashboard now displays ONLY their own project (1 project)'
    );

    // 6. Mentor Dr. Marcus Chen (id: 3) logs in
    const mentorLogin = await apiRequest('POST', '/auth/login', {
      email: 'dr.chen@campus.edu',
      password: 'Password123!',
    });
    const mentorToken = mentorLogin.data.data.token;

    // Dr. Chen should ONLY see projects where mentor_id = 3 (Projects 1, 3, and the new Neural Prosthetics project)
    const mentorProjects = await apiRequest('GET', '/projects', null, mentorToken);
    const nonChenProjects = mentorProjects.data.data.filter((p) => p.mentor_id !== 3 && p.created_by !== 3);
    assert(
      nonChenProjects.length === 0,
      `Mentor Dr. Chen sees ONLY projects assigned to him for mentorship (0 unrelated projects, total mentored: ${mentorProjects.data.data.length})`
    );

    // 7. Register a BRAND NEW Mentor with NO assigned projects yet
    const newMentorEmail = `mentor_${timestamp}@campus.edu`;
    const newMentorReg = await apiRequest('POST', '/auth/register', {
      name: 'Dr. Sarah Connor',
      email: newMentorEmail,
      password: 'Password123!',
      role: 'mentor',
      department: 'Robotics',
    });
    const newMentorToken = newMentorReg.data.data.token;

    const newMentorProjects = await apiRequest('GET', '/projects', null, newMentorToken);
    assert(
      newMentorProjects.data.data.length === 0,
      `Newly registered mentor sees 0 student projects until assigned (Expected: 0, Received: ${newMentorProjects.data.data.length})`
    );

    // 8. Admin Sarah Jenkins logs in
    const adminLogin = await apiRequest('POST', '/auth/login', {
      email: 'admin@campus.edu',
      password: 'Password123!',
    });
    const adminToken = adminLogin.data.data.token;
    const adminProjects = await apiRequest('GET', '/projects', null, adminToken);
    assert(
      adminProjects.data.data.length >= 5,
      `Administrator retains platform oversight and sees all campus projects (Count: ${adminProjects.data.data.length})`
    );

    console.log(`\n======================================================`);
    console.log(`📊 ROLE-BASED SCOPING TESTS: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
    console.log(`======================================================\n`);
  } catch (e) {
    console.error('Test error:', e);
  }
}

runRoleScopingTests();
