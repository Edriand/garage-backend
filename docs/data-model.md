# Data Model

Single-table design in DynamoDB. Table name: `GarageTable`.

## Indexes

### Base table

| Pattern                           | PK              | SK                               |
| --------------------------------- | --------------- | -------------------------------- |
| Get all cars for user             | `USER#{userId}` | `CAR#` (begins_with)             |
| Get car detail                    | `USER#{userId}` | `CAR#{carId}`                    |
| Get events for car (newest first) | `CAR#{carId}`   | `EVENT#{isoTimestamp}` (desc)    |
| Get event detail                  | `CAR#{carId}`   | `EVENT#{isoTimestamp}#{eventId}` |
| Get likes for a car               | `CAR#{carId}`   | `LIKE#` (begins_with)            |

### GSI: `carId-index` (PK: `carId`, SK: `SK`)

Used to look up a Car item by its UUID without knowing the owner's userId.

| Pattern               | carId     | SK                    |
| --------------------- | --------- | --------------------- |
| Get car item by carId | `{carId}` | `CAR#{carId}` (exact) |

## Item schemas

### Car item

```text
PK: USER#{userId}
SK: CAR#{carId}
─────────────────────────────
brand:            string
model:            string
year:             number
registrationYear: number
totalKm:          number
totalInvested:    number
photoKey:         string (S3 key)
isPublic:         boolean (default false)
likeCount:        number  (default 0, maintained atomically)
createdAt:        ISO timestamp
updatedAt:        ISO timestamp
```

### Garage settings item

```text
PK: USER#{userId}
SK: GARAGE_SETTINGS
─────────────────────────────
isPublic:  boolean   (default false)
updatedAt: ISO timestamp
```

### Event item

```text
PK: CAR#{carId}
SK: EVENT#{isoTimestamp}#{eventId}   ← timestamp first for date-ordered queries
─────────────────────────────────────
eventId:     string (ULID)
date:        ISO timestamp
type:        mechanic | fuel | insurance | wash | modification | purchase | other
description: string
amount:      number
km:          number (optional — mileage at the time of the event)
photoKeys:   string[]  (S3 keys)
docKeys:     string[]  (S3 keys)
createdAt:   ISO timestamp
updatedAt:   ISO timestamp
```

**Note on `purchase` type:** A car may have at most one event of type `purchase`. Attempting to create a second one returns `409 Conflict`.

### Like item

```text
PK: CAR#{carId}
SK: LIKE#{userId}
─────────────────────────────
userId:    string
createdAt: ISO timestamp
```

## Pagination

Events are queried with `ScanIndexForward: false` (newest first) and `Limit: 300`.
The `LastEvaluatedKey` is base64-encoded and returned as `nextToken` to the client.

## S3 key structure

```text
users/{userId}/cars/{carId}/photos/{filename}
users/{userId}/cars/{carId}/documents/{filename}
users/{userId}/cars/{carId}/events/{eventId}/photos/{filename}
users/{userId}/cars/{carId}/events/{eventId}/documents/{filename}
```
