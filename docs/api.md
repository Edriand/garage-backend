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
  "type": "mechanic | fuel | insurance | other",
  "description": "string",
  "amount": 350.00,
  "photos": ["presigned-url-1", "presigned-url-2"],
  "documents": ["presigned-url-invoice.pdf"]
}
```

## File uploads

| Method | Path | Description |
|---|---|---|
| POST | `/upload/presigned-url` | Get presigned URL to upload a file |
| GET | `/download/presigned-url` | Get presigned URL to download a file |

### Upload flow

1. Client calls `POST /upload/presigned-url` with `{ carId, eventId, filename, contentType }`
2. API returns `{ uploadUrl, fileKey }`
3. Client PUTs the file directly to S3 using `uploadUrl`
4. Client saves `fileKey` when creating/updating the event
