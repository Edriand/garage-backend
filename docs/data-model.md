# Data Model

Single-table design in DynamoDB. Table name: `GarageTable`.

## Access patterns

| Pattern | PK | SK |
|---|---|---|
| Get all cars for user | `USER#{userId}` | `CAR#` (begins_with) |
| Get car detail | `USER#{userId}` | `CAR#{carId}` |
| Get events for car (newest first) | `CAR#{carId}` | `EVENT#{isoTimestamp}` (desc) |
| Get event detail | `CAR#{carId}` | `EVENT#{isoTimestamp}#{eventId}` |

## Item schemas

### Car item

```
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
createdAt:        ISO timestamp
updatedAt:        ISO timestamp
```

### Event item

```
PK: CAR#{carId}
SK: EVENT#{isoTimestamp}#{eventId}   ← timestamp first for date-ordered queries
─────────────────────────────────────
eventId:     string (ULID)
date:        ISO timestamp
type:        mechanic | fuel | insurance | wash | other
description: string
amount:      number
km:          number (optional — mileage at the time of the event)
photoKeys:   string[]  (S3 keys)
docKeys:     string[]  (S3 keys)
createdAt:   ISO timestamp
updatedAt:   ISO timestamp
```

## Pagination

Events are queried with `ScanIndexForward: false` (newest first) and `Limit: 300`.
The `LastEvaluatedKey` is base64-encoded and returned as `nextToken` to the client.

## S3 key structure

```
users/{userId}/cars/{carId}/photos/{filename}
users/{userId}/cars/{carId}/documents/{filename}
users/{userId}/cars/{carId}/events/{eventId}/photos/{filename}
users/{userId}/cars/{carId}/events/{eventId}/documents/{filename}
```
