/**
 * Automated Verification Script for Faculty Mentor Dashboard Workflows
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

async function runMentorTests() {
  console.log('🧪 Starting Faculty Mentor Dashboard Workflows Test Suite...\n');
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
    // 1. Mentor Login (Dr. Marcus Chen)
    const mentorLogin = await apiRequest('POST', '/auth/login', {
      email: 'dr.chen@campus.edu',
      password: 'Password123!',
    });
    assert(mentorLogin.status === 200 && mentorLogin.data.data.token, 'Faculty Mentor (Dr. Marcus Chen) signs in successfully');
    const mentorToken = mentorLogin.data.data.token;
    const mentorUser = mentorLogin.data.data.user;

    // 2. Student Login (Alex Rivera)
    const studentLogin = await apiRequest('POST', '/auth/login', {
      email: 'alex.student@campus.edu',
      password: 'Password123!',
    });
    assert(studentLogin.status === 200 && studentLogin.data.data.token, 'Student (Alex Rivera) signs in successfully');
    const studentToken = studentLogin.data.data.token;

    // 3. Security: Student blocked from mentor overview
    const studentForbidden = await apiRequest('GET', '/mentor/overview', null, studentToken);
    assert(studentForbidden.status === 403, 'Security: Student role is strictly forbidden from mentor overview API (403)');

    // 4. Mentor Overview Endpoint
    const overviewRes = await apiRequest('GET', '/mentor/overview', null, mentorToken);
    assert(
      overviewRes.status === 200 &&
      overviewRes.data.success &&
      overviewRes.data.data.stats &&
      overviewRes.data.data.stats.mentored_projects_count > 0,
      `Mentor overview loaded with KPI stats (${overviewRes.data.data.stats.mentored_projects_count} projects)`
    );

    const { projects, students, review_queue, stats } = overviewRes.data.data;

    // 5. View Assigned Students
    assert(
      Array.isArray(students) && students.length > 0,
      `Mentor can view assigned students (${students.length} students indexed)`
    );

    const firstStudent = students[0];
    assert(
      firstStudent.name && firstStudent.email && firstStudent.department && firstStudent.projects,
      `Assigned student record includes full details (Name: ${firstStudent.name}, Dept: ${firstStudent.department})`
    );

    // 6. View Mentored Projects
    assert(
      Array.isArray(projects) && projects.length > 0,
      `Mentor can view assigned projects (${projects.length} capstones supervised)`
    );
    const targetProject = projects[0];

    // 7. Mentor Assigns Task to Student
    const assignRes = await apiRequest('POST', '/mentor/assign-task', {
      project_id: targetProject.id,
      title: 'Prototype Verification & Power Budget Benchmarks',
      description: 'Measure current draw under active RF transmission and log thermal throttling metrics.',
      assigned_to: firstStudent.id,
      priority: 'high',
      due_date: '2026-11-20',
      estimated_hours: 14,
    }, mentorToken);

    assert(
      assignRes.status === 201 && assignRes.data.data.id,
      `Mentor assigns task to student "${firstStudent.name}" with technical requirements`
    );
    const assignedTaskId = assignRes.data.data.id;

    // 8. Monitor Task Progress across mentored projects
    const tasksRes = await apiRequest('GET', '/mentor/tasks', null, mentorToken);
    assert(
      tasksRes.status === 200 && tasksRes.data.data.length > 0,
      `Mentor monitors task progress table across projects (${tasksRes.data.data.length} total tasks)`
    );

    const foundAssignedTask = tasksRes.data.data.find((t) => t.id === assignedTaskId);
    assert(
      foundAssignedTask && foundAssignedTask.priority === 'high' && foundAssignedTask.assignee_name === firstStudent.name,
      'Newly assigned task is tracked with student assignee and priority'
    );

    // 9. Student updates task to "review" status (submits deliverable)
    await apiRequest('PATCH', `/tasks/${assignedTaskId}/status`, { status: 'review' }, studentToken);
    
    // Add student submission comment
    await apiRequest('POST', '/comments', {
      task_id: assignedTaskId,
      content: 'Benchmarking report attached. Idle current 120mA, peak 850mA. Ready for faculty evaluation.',
    }, studentToken);

    // 10. Check that Review Queue reflects pending deliverable
    const updatedOverview = await apiRequest('GET', '/mentor/overview', null, mentorToken);
    const inQueue = updatedOverview.data.data.review_queue.find((t) => t.id === assignedTaskId);
    assert(
      inQueue !== undefined,
      'Student deliverable in "review" status appears in mentor review queue'
    );

    // 11. Mentor Reviews Deliverable & Requests Revision
    const revisionRes = await apiRequest('POST', '/mentor/review-task', {
      task_id: assignedTaskId,
      action: 'request_revision',
      feedback: 'Please include oscilloscope traces for voltage sag during transmission bursts.',
    }, mentorToken);
    assert(
      revisionRes.status === 200 && revisionRes.data.data.task.status === 'in_progress',
      'Mentor requests revisions: task transitions back to "in_progress" with mentor feedback'
    );

    // 12. Student resubmits deliverable to "review"
    await apiRequest('PATCH', `/tasks/${assignedTaskId}/status`, { status: 'review' }, studentToken);

    // 13. Mentor Evaluates & Approves Deliverable (Done) with Rubric Score
    const approveRes = await apiRequest('POST', '/mentor/review-task', {
      task_id: assignedTaskId,
      action: 'approve',
      feedback: 'Excellent oscilloscope data. Power rails remain within ±3% tolerance. Milestone approved!',
      rubric_score: 'Grade: A+ (100% Meets All Engineering Criteria)',
    }, mentorToken);

    assert(
      approveRes.status === 200 && approveRes.data.data.task.status === 'done',
      'Mentor evaluates & approves deliverable: task transitions to "done" with official academic commendation'
    );

    // 14. Mentor Communicates with Student Team (Broadcast Guidance)
    const commRes = await apiRequest('POST', '/mentor/communicate', {
      project_id: targetProject.id,
      recipient_id: firstStudent.id,
      subject: 'Midterm Design Review Preparation',
      message: 'Team, please prepare a 10-minute slide deck focusing on edge AI latency results for Thursday office hours.',
    }, mentorToken);

    assert(
      commRes.status === 201 && commRes.data.data.id,
      'Mentor broadcasts guidance announcement to student team'
    );

    // 15. Student views comments/feedback on the project and sees official mentor note
    const commentsRes = await apiRequest('GET', `/comments/project/${targetProject.id}`, null, studentToken);
    const officialNotes = commentsRes.data.data.filter((c) => c.is_mentor_feedback === true || c.is_mentor_feedback == 1);
    assert(
      officialNotes.length > 0 && officialNotes.some((c) => c.content.includes('Midterm Design Review Preparation')),
      'Student portal receives official mentor communication tagged with faculty feedback'
    );

    console.log(`\n======================================================`);
    console.log(`📊 MENTOR DASHBOARD WORKFLOWS: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Test error:', err);
  }
}

runMentorTests();
