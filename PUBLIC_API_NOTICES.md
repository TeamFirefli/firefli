# Public API - Notices/Timeoff Endpoints

## Authentication

All endpoints require an API key in the Authorization header:
```
Authorization: Bearer YOUR_API_KEY
```

## Base URL
```
/api/public/v1/workspace/{workspaceId}/notices
```

---

## Endpoints

### 1. List Notices
**GET** `/api/public/v1/workspace/{workspaceId}/notices`

Retrieve a list of all notices/timeoff requests.

**Query Parameters:**
- `status` (optional): Filter by status
  - `pending` - Not yet reviewed
  - `approved` - Approved and reviewed
  - `rejected` - Rejected and reviewed
  - `active` - Currently active (not ended, not revoked)
- `userId` (optional): Filter by specific user ID
- `from` (optional): Filter by start date (ISO 8601 format)
- `to` (optional): Filter by start date (ISO 8601 format)
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.com/api/public/v1/workspace/123/notices?status=active&limit=10"
```

**Example Response:**
```json
{
  "success": true,
  "notices": [
    {
      "id": "uuid",
      "userId": 12345,
      "user": {
        "userId": 12345,
        "username": "john_doe",
        "displayname": "John Doe",
        "thumbnail": "https://..."
      },
      "startTime": "2024-01-15T00:00:00.000Z",
      "endTime": "2024-01-20T00:00:00.000Z",
      "reason": "Vacation",
      "approved": true,
      "reviewed": true,
      "revoked": false,
      "reviewComment": "Approved"
    }
  ],
  "total": 25,
  "limit": 10,
  "offset": 0
}
```

---

### 2. Create Notice
**POST** `/api/public/v1/workspace/{workspaceId}/notices`

Create a new notice/timeoff request.

**Request Body:**
```json
{
  "userId": 12345,
  "startTime": "2024-01-15T00:00:00.000Z",
  "endTime": "2024-01-20T00:00:00.000Z",
  "reason": "Vacation"
}
```

**Required Fields:**
- `userId` - User ID (number)
- `startTime` - Start date/time (ISO 8601)
- `reason` - Reason for timeoff (string)

**Optional Fields:**
- `endTime` - End date/time (ISO 8601, null for indefinite)

**Example Request:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 12345,
    "startTime": "2024-01-15T00:00:00.000Z",
    "endTime": "2024-01-20T00:00:00.000Z",
    "reason": "Vacation"
  }' \
  "https://your-domain.com/api/public/v1/workspace/123/notices"
```

**Example Response:**
```json
{
  "success": true,
  "notice": {
    "id": "uuid",
    "userId": 12345,
    "user": {
      "userId": 12345,
      "username": "john_doe",
      "displayname": "John Doe",
      "thumbnail": "https://..."
    },
    "startTime": "2024-01-15T00:00:00.000Z",
    "endTime": "2024-01-20T00:00:00.000Z",
    "reason": "Vacation",
    "approved": false,
    "reviewed": false,
    "revoked": false
  }
}
```

---

### 3. Get Specific Notice
**GET** `/api/public/v1/workspace/{workspaceId}/notices/{noticeId}`

Retrieve details of a specific notice.

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.com/api/public/v1/workspace/123/notices/uuid-here"
```

**Example Response:**
```json
{
  "success": true,
  "notice": {
    "id": "uuid",
    "userId": 12345,
    "user": {
      "userId": 12345,
      "username": "john_doe",
      "displayname": "John Doe",
      "thumbnail": "https://..."
    },
    "startTime": "2024-01-15T00:00:00.000Z",
    "endTime": "2024-01-20T00:00:00.000Z",
    "reason": "Vacation",
    "approved": true,
    "reviewed": true,
    "revoked": false,
    "reviewComment": "Approved"
  }
}
```

---

### 4. Update Notice Status
**PATCH** `/api/public/v1/workspace/{workspaceId}/notices/{noticeId}`

Update the status of a notice (approve/reject/modify).

**Request Body (all fields optional):**
```json
{
  "approved": true,
  "reviewComment": "Approved for vacation",
  "endTime": "2024-01-25T00:00:00.000Z",
  "revoked": false
}
```

**Fields:**
- `approved` (boolean): Approve or reject (sets reviewed to true)
- `reviewComment` (string): Comment from reviewer
- `endTime` (string|null): Update end date
- `revoked` (boolean): Revoke the notice

**Example Request (Approve):**
```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "reviewComment": "Approved"
  }' \
  "https://your-domain.com/api/public/v1/workspace/123/notices/uuid-here"
```

**Example Request (Reject):**
```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": false,
    "reviewComment": "Insufficient coverage during this period"
  }' \
  "https://your-domain.com/api/public/v1/workspace/123/notices/uuid-here"
```

---

### 5. Stop Active Notice
**DELETE** `/api/public/v1/workspace/{workspaceId}/notices/{noticeId}`

Stop an active notice immediately (sets endTime to now and marks as revoked).

**Example Request:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.com/api/public/v1/workspace/123/notices/uuid-here"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Notice stopped successfully",
  "notice": {
    "id": "uuid",
    "userId": 12345,
    "endTime": "2024-01-18T14:30:00.000Z"
  }
}
```

---

### 6. Get User's Notices
**GET** `/api/public/v1/workspace/{workspaceId}/notices/user/{userId}`

Retrieve all notices for a specific user.

**Query Parameters:**
- `status` (optional): Filter by status (same as List Notices)
- `from` (optional): Filter by start date
- `to` (optional): Filter by start date

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.com/api/public/v1/workspace/123/notices/user/12345?status=active"
```

**Example Response:**
```json
{
  "success": true,
  "user": {
    "userId": 12345,
    "username": "john_doe",
    "displayname": "John Doe",
    "thumbnail": "https://..."
  },
  "notices": [
    {
      "id": "uuid",
      "startTime": "2024-01-15T00:00:00.000Z",
      "endTime": "2024-01-20T00:00:00.000Z",
      "reason": "Vacation",
      "approved": true,
      "reviewed": true,
      "revoked": false,
      "reviewComment": "Approved"
    }
  ],
  "total": 5
}
```

---

### 7. Get Summary Statistics
**GET** `/api/public/v1/workspace/{workspaceId}/notices/summary`

Retrieve summary statistics for all notices.

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.com/api/public/v1/workspace/123/notices/summary"
```

**Example Response:**
```json
{
  "success": true,
  "summary": {
    "total": 150,
    "pending": 5,
    "approved": 120,
    "rejected": 25,
    "active": 8
  }
}
```

---

## Error Responses

All endpoints return error responses in the following format:

```json
{
  "success": false,
  "error": "Error message"
}
```

**Common Error Codes:**
- `401` - Invalid or missing API key
- `400` - Bad request (missing required fields)
- `404` - Resource not found
- `405` - Method not allowed
- `500` - Internal server error

---

## Rate Limiting

API keys may be subject to rate limiting. Contact your administrator for details.

---

## Use Cases

### Approve a pending notice
```bash
# 1. Get pending notices
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.com/api/public/v1/workspace/123/notices?status=pending"

# 2. Approve specific notice
curl -X PATCH \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"approved": true, "reviewComment": "Approved"}' \
  "https://your-domain.com/api/public/v1/workspace/123/notices/{noticeId}"
```

### Check if user is currently on timeoff
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-domain.com/api/public/v1/workspace/123/notices/user/12345?status=active"
```

### Create and immediately approve a notice
```bash
# 1. Create notice
NOTICE_ID=$(curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": 12345, "startTime": "2024-01-15T00:00:00.000Z", "endTime": "2024-01-20T00:00:00.000Z", "reason": "Vacation"}' \
  "https://your-domain.com/api/public/v1/workspace/123/notices" | jq -r '.notice.id')

# 2. Approve it
curl -X PATCH \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"approved": true}' \
  "https://your-domain.com/api/public/v1/workspace/123/notices/$NOTICE_ID"
```
