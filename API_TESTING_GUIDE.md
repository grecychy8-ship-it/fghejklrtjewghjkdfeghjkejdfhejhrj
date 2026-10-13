# 🧪 API TESTING GUIDE - Assignment Dai

**Server**: Running on http://localhost:5000  
**Database**: Supabase PostgreSQL  
**Date**: October 13, 2026

---

## 🚀 QUICK START - TEST IN 5 MINUTES

### 1. Health Check
```bash
curl http://localhost:5000/api/health
```

**Response**:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-10-13T..."
}
```

---

### 2. Login (Get Token)
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@demo.com",
    "password": "Password123!"
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Login successful!",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "student@demo.com",
    "full_name": "Gareema Sharma",
    "role": "client"
  }
}
```

**Save the token!** Use it for all authenticated requests:
```bash
export TOKEN="<your-token-here>"
```

---

### 3. Dashboard Stats
```bash
curl http://localhost:5000/api/dashboard/stats \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
{
  "success": true,
  "stats": {
    "total_projects": 3,
    "active_projects": 2,
    "pending_payment_count": 1,
    "completed_projects": 1,
    "revision_requests": 0,
    "unread_notifications": 2
  }
}
```

✅ **If you see this, everything is working!**

---

## 📚 COMPLETE API TESTING

### AUTHENTICATION ENDPOINTS

#### Register New User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePassword123!",
    "institution": "Harvard University",
    "country": "USA"
  }'
```

#### Get Current User Profile
```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

#### Update Profile
```bash
curl -X PUT http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Gareema Sharma",
    "phone": "+977-1234567890",
    "institution": "Tribhuvan University",
    "country": "Nepal"
  }'
```

#### Change Password
```bash
curl -X PUT http://localhost:5000/api/auth/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "Password123!",
    "new_password": "NewPassword456!"
  }'
```

#### Forgot Password
```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@demo.com"
  }'
```

#### Logout
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

---

### PROJECTS ENDPOINTS

#### List Projects (with Pagination)
```bash
curl "http://localhost:5000/api/projects?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `status` - Filter by status (Submitted, In Progress, Completed, etc.)
- `search` - Search title, ID, or subject
- `sort` - Sort by: newest (default), oldest, deadline_asc

#### Create Project
```bash
curl -X POST http://localhost:5000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Database Design Project",
    "category": "Computer Science",
    "subject": "Database Systems",
    "deadline": "2026-11-30",
    "word_count": 5000,
    "description": "Design a relational database for an e-commerce platform",
    "requirements": "Must include ER diagram and SQL schema",
    "priority": "High",
    "academic_level": "Postgraduate"
  }'
```

#### Get Project Details
```bash
curl http://localhost:5000/api/projects/PRJ-1234 \
  -H "Authorization: Bearer $TOKEN"
```

**Includes**:
- Project details
- Timeline of events
- Quote
- Payment info
- Attachments
- Revisions
- Reviews

#### Update Project Status
```bash
curl -X PUT http://localhost:5000/api/projects/PRJ-1234 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "In Progress",
    "progress_percent": 50
  }'
```

**Valid Statuses**:
- Submitted
- Expert Assigned
- In Progress
- Submitted for Review
- Revision Requested
- Completed
- Cancelled

---

### EXPERTS ENDPOINTS

#### List All Experts
```bash
curl http://localhost:5000/api/experts
```

#### Get Expert Profile with Reviews
```bash
curl http://localhost:5000/api/experts/1
```

---

### REVIEWS ENDPOINTS

#### Submit Review
```bash
curl -X POST http://localhost:5000/api/projects/PRJ-1234/review \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "star_rating": 5,
    "written_review": "Excellent work! The expert delivered exactly what I needed.",
    "communication_rating": 5,
    "quality_rating": 5,
    "timeliness_rating": 4
  }'
```

#### Get Review
```bash
curl http://localhost:5000/api/reviews/PRJ-1234
```

---

### REVISIONS ENDPOINTS

#### Request Revision
```bash
curl -X POST http://localhost:5000/api/projects/PRJ-1234/revisions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "revision_reason": "Minor formatting issues",
    "detailed_instructions": "Please adjust margins and font size. Also fix the figures in section 3.",
    "requested_deadline": "2026-11-25"
  }'
```

#### Get Revisions List
```bash
curl http://localhost:5000/api/projects/PRJ-1234/revisions \
  -H "Authorization: Bearer $TOKEN"
```

---

### SUPPORT TICKETS ENDPOINTS

#### Create Support Ticket
```bash
curl -X POST http://localhost:5000/api/support/tickets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Question about project deadline",
    "category": "General Support",
    "priority": "Medium",
    "description": "Can I extend the deadline by 2 days?"
  }'
```

#### List Support Tickets
```bash
curl "http://localhost:5000/api/support/tickets?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Query Parameters**:
- `status` - Open, In Progress, Resolved, Closed
- `page` - Page number
- `limit` - Items per page

#### Get Ticket with Messages
```bash
curl http://localhost:5000/api/support/tickets/TCK-123456 \
  -H "Authorization: Bearer $TOKEN"
```

#### Add Message to Ticket
```bash
curl -X POST http://localhost:5000/api/support/tickets/TCK-123456/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Thanks for your response. That helps!"
  }'
```

---

### NOTIFICATIONS ENDPOINTS

#### Get Notifications
```bash
curl "http://localhost:5000/api/notifications?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Query Parameters**:
- `is_read` - true or false to filter
- `page` - Page number
- `limit` - Items per page

#### Mark Single Notification as Read
```bash
curl -X PUT http://localhost:5000/api/notifications/123/read \
  -H "Authorization: Bearer $TOKEN"
```

#### Mark All Notifications as Read
```bash
curl -X PUT http://localhost:5000/api/notifications/mark-all-read \
  -H "Authorization: Bearer $TOKEN"
```

#### Delete Notification
```bash
curl -X DELETE http://localhost:5000/api/notifications/123 \
  -H "Authorization: Bearer $TOKEN"
```

---

### PAYMENTS ENDPOINTS

#### Get Payments List
```bash
curl "http://localhost:5000/api/payments?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### Process Payment
```bash
curl -X POST http://localhost:5000/api/payments/pay \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "PRJ-1234",
    "payment_method": "Credit Card"
  }'
```

---

### ADMIN ENDPOINTS

#### List All Users (Admin Only)
```bash
curl "http://localhost:5000/api/admin/users?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### List All Projects (Admin Only)
```bash
curl "http://localhost:5000/api/admin/projects?page=1&limit=10&status=Submitted" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Approve Project & Assign Expert (Admin Only)
```bash
curl -X PUT http://localhost:5000/api/admin/projects/PRJ-1234/approve \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assigned_expert_id": 1
  }'
```

---

## 🔧 POSTMAN COLLECTION

Import this Postman collection for easier testing:

### Authentication
- Login
- Register
- Get Profile
- Update Profile
- Change Password
- Forgot Password
- Logout

### Projects
- List Projects
- Create Project
- Get Project
- Update Project Status

### Experts
- List Experts
- Get Expert

### Reviews
- Submit Review
- Get Review

### Revisions
- Request Revision
- List Revisions

### Support
- Create Ticket
- List Tickets
- Get Ticket
- Add Message

### Notifications
- Get Notifications
- Mark as Read
- Mark All Read
- Delete

### Payments
- Get Payments
- Process Payment

### Admin
- List Users
- List Projects
- Approve Project

---

## 📊 ERROR RESPONSES

### 400 - Bad Request
```json
{
  "success": false,
  "message": "Email and password required."
}
```

### 401 - Unauthorized
```json
{
  "success": false,
  "message": "Invalid credentials."
}
```

### 403 - Forbidden
```json
{
  "success": false,
  "message": "Admin access required."
}
```

### 404 - Not Found
```json
{
  "success": false,
  "message": "Project not found."
}
```

### 500 - Server Error
```json
{
  "success": false,
  "message": "Error fetching profile."
}
```

---

## ✅ TESTING CHECKLIST

### Authentication
- [ ] Register new user
- [ ] Login
- [ ] Get profile
- [ ] Update profile
- [ ] Change password
- [ ] Logout

### Projects
- [ ] Create project
- [ ] List projects
- [ ] Get project details
- [ ] Update project status

### Support
- [ ] Create support ticket
- [ ] List tickets
- [ ] Get ticket
- [ ] Add message

### Reviews & Ratings
- [ ] Submit review
- [ ] Get review

### Revisions
- [ ] Request revision
- [ ] List revisions

### Notifications
- [ ] Get notifications
- [ ] Mark as read
- [ ] Delete notification

### Payments
- [ ] List payments
- [ ] Process payment

### Admin
- [ ] List users (as admin)
- [ ] List projects (as admin)
- [ ] Approve project

---

## 💡 TIPS

1. **Always include Authorization header for authenticated routes**:
   ```bash
   -H "Authorization: Bearer TOKEN"
   ```

2. **Save token in environment variable**:
   ```bash
   TOKEN=$(curl -s ... | jq -r '.token')
   ```

3. **Use `jq` for pretty JSON output**:
   ```bash
   curl ... | jq .
   ```

4. **Test file uploads**:
   ```bash
   curl -X POST http://localhost:5000/api/projects \
     -H "Authorization: Bearer $TOKEN" \
     -F "title=Project" \
     -F "category=CS" \
     -F "subject=Database" \
     -F "deadline=2026-11-30" \
     -F "files=@document.pdf"
   ```

5. **Use Postman for easier testing** with pre-built requests

---

## 🎯 TEST SCENARIOS

### Scenario 1: Complete Project Workflow
1. Create project
2. List projects
3. Get project details
4. Update project status to "In Progress"
5. Request revision
6. Submit review

### Scenario 2: Support
1. Create support ticket
2. List tickets
3. Add message to ticket
4. Get ticket with messages

### Scenario 3: Payment
1. List projects
2. Process payment
3. Check payment status
4. Get invoice

### Scenario 4: Admin
1. Login as admin
2. List all users
3. List all projects
4. Approve project

---

**Server**: http://localhost:5000  
**Status**: ✅ Running  
**Ready to test!**
