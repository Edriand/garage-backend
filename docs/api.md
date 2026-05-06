# API Reference

All endpoints require `Authorization: Bearer {jwt}` header.

## Cars

| Method | Path | Description |
|---|---|---|
| GET | `/cars` | List all cars for the authenticated user |
| POST | `/cars` | Create a new car |
| GET | `/cars/{carId}` | Get car detail |
| PUT | `/cars/{carId}` | Update car |
| DELETE | `/cars/{carId}` | Delete car |

### Car object

```json
{
  "carId": "string",
  "userId": "string",
  "brand": "string",
  "model": "string",
  "year": 2020,
  "registrationYear": 2020,
  "totalKm": 45000,
  "totalInvested": 3200.50,
  "photoUrl": "string (presigned URL)",
  "isPublic": false
}
```

## Garage

| Method | Path | Description |
|---|---|---|
| GET | `/garage` | Get the authenticated user's garage settings |
| PUT | `/garage` | Update garage settings |

### Garage settings object

```json
{
  "isPublic": false,
  "updatedAt": "2024-03-15T10:30:00Z"
}
```

> `GET /garage` returns `{ "isPublic": false }` for users who have never configured their garage (no `updatedAt` field in that case).

### PUT /garage

Request body (all fields required):

```json
{
  "isPublic": true
}
```

Returns `400 Bad Request` if `isPublic` is missing.

## Car Summary

| Method | Path                    | Description                        |
|--------|-------------------------|------------------------------------|
| GET    | `/cars/{carId}/summary` | Get aggregate statistics for a car |

### GET /cars/{carId}/summary

Returns statistics computed from all events for the car. Pagination is handled internally — the response always contains the complete aggregate regardless of event count.

**Response:**

```json
{
  "totalKm":       52000,
  "totalCost":     4800.50,
  "eventCount":    42,
  "byType": {
    "mechanic":    3200.00,
    "fuel":        1100.50,
    "wash":         120.00,
    "insurance":    380.00,
    "other":          0.00
  },
  "lastKmReading": 52000
}
```

| Field            | Description                                                                          |
|------------------|--------------------------------------------------------------------------------------|
| `totalKm`        | From the car item (`car.totalKm`, user-maintained)                                   |
| `totalCost`      | Sum of `amount` across all events                                                    |
| `byType`         | Sum of `amount` grouped by event type; all five keys always present (`0.00` if none) |
| `lastKmReading`  | `km` from the most recent event that has one; `null` if no event has `km`            |
| `eventCount`     | Total number of events for the car                                                   |

Returns `404 Not Found` if the car does not exist or does not belong to the authenticated user.

## Events

| Method | Path | Description |
|---|---|---|
| GET | `/cars/{carId}/events` | List events (newest first, paginated) |
| POST | `/cars/{carId}/events` | Create event |
| GET | `/cars/{carId}/events/{eventId}` | Get event detail |
| PUT | `/cars/{carId}/events/{eventId}` | Update event |
| DELETE | `/cars/{carId}/events/{eventId}` | Delete event |

### Pagination

```
GET /cars/{carId}/events?limit=300&nextToken={token}
```

- Default and max page size: **300**
- Results ordered by date **descending** (newest first)
- `nextToken` is the base64-encoded `LastEvaluatedKey` from DynamoDB

### Event object

```json
{
  "eventId": "string",
  "carId": "string",
  "date": "2024-03-15T10:30:00Z",
  "type": "mechanic | fuel | insurance | wash | other",
  "description": "string",
  "amount": 350.00,
  "km": 52000,
  "photos": ["presigned-url-1", "presigned-url-2"],
  "documents": ["presigned-url-invoice.pdf"]
}
```

> `km` is optional. When not provided on creation, it is returned as `null`.
> `wash` has been added to the `type` enum to track car wash events.

## File uploads

| Method | Path | Description |
|---|---|---|
| POST | `/upload/presigned-url` | Get presigned PUT URL to upload a file directly to S3 |
| GET | `/download/presigned-url` | Get presigned GET URL to download a file from S3 |

### Upload flow

1. Client calls `POST /upload/presigned-url` with the body below
2. API returns `{ uploadUrl, fileKey, expiresIn: 300 }`
3. Client PUTs the file directly to S3 using `uploadUrl` (URL expires in **5 minutes**)
4. Client saves `fileKey` in `photoKey` / `photoKeys` / `docKeys` when creating or updating a car or event

### POST /upload/presigned-url

Request body:

```json
{
  "carId":       "string",
  "eventId":     "string (optional — omit for car-level files)",
  "filename":    "string",
  "contentType": "image/jpeg | image/png | image/webp | application/pdf",
  "category":    "photo | document"
}
```

Response:

```json
{
  "uploadUrl": "https://s3.amazonaws.com/...",
  "fileKey":   "users/{userId}/cars/{carId}/...",
  "expiresIn": 300
}
```

Validation errors (`400 Bad Request`):
- `filename` contains `..` or `/` (path traversal)
- `contentType` is not one of the allowed values
- Any required field is missing

### GET /download/presigned-url

Query parameters:

| Param | Required | Description |
|---|---|---|
| `fileKey` | yes | The S3 key returned by the upload endpoint |

Response:

```json
{
  "downloadUrl": "https://s3.amazonaws.com/...",
  "expiresIn":   3600
}
```

Returns `403 Forbidden` if `fileKey` does not start with `users/{userId}/` (cross-user access attempt).
The presigned URL expires in **1 hour**.

### S3 key convention

```
users/{userId}/cars/{carId}/photos/{filename}
users/{userId}/cars/{carId}/documents/{filename}
users/{userId}/cars/{carId}/events/{eventId}/photos/{filename}
users/{userId}/cars/{carId}/events/{eventId}/documents/{filename}
```
