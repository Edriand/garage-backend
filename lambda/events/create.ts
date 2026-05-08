/**
 * POST /cars/{carId}/events
 * Creates a new maintenance/fuel/insurance event for a car.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, created, badRequest, notFound, serverError, conflict,
  carKey, eventKey, newId, assertCarOwnership,
} from '../shared/utils';

type EventType = 'mechanic' | 'fuel' | 'insurance' | 'wash' | 'modification' | 'purchase' | 'other';

interface CreateEventBody {
  date:        string;
  type:        EventType;
  description: string;
  amount:      number;
  km:          number;
  photoKeys?:  string[];
  docKeys?:    string[];
}

const VALID_TYPES: EventType[] = ['mechanic', 'fuel', 'insurance', 'wash', 'modification', 'purchase', 'other'];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const carId  = event.pathParameters?.carId;
    if (!carId) return notFound('carId path parameter is required');

    if (!await assertCarOwnership(userId, carId)) return notFound('Car not found');

    if (!event.body) return badRequest('Request body is required');

    let body: CreateEventBody;
    try {
      body = JSON.parse(event.body);
    } catch {
      return badRequest('Invalid JSON body');
    }

    const { date, type, description, amount, km, photoKeys = [], docKeys = [] } = body;

    if (!date || !type || !description || amount === undefined || km === undefined) {
      return badRequest('Missing required fields: date, type, description, amount, km');
    }
    if (!VALID_TYPES.includes(type)) {
      return badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`);
    }
    if (!Number.isInteger(km) || km < 0) {
      return badRequest('km must be a non-negative integer');
    }

    // Validate monotonic km increase across all existing events
    let maxKm = 0;
    let lastKey: Record<string, unknown> | undefined;
    do {
      const kmQuery = await ddb.send(new QueryCommand({
        TableName:              TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': carKey(carId), ':skPrefix': 'EVENT#' },
        ProjectionExpression:   'km',
        ExclusiveStartKey:      lastKey,
      }));
      for (const item of kmQuery.Items ?? []) {
        if (typeof item.km === 'number' && item.km > maxKm) maxKm = item.km;
      }
      lastKey = kmQuery.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastKey);

    if (km <= maxKm) {
      return badRequest(`km must be greater than the current maximum (${maxKm} km)`);
    }

    // Check if this is a purchase event and enforce one purchase per car
    if (type === 'purchase') {
      const existing = await ddb.send(new QueryCommand({
        TableName:              TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression:       '#type = :purchase',
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: {
          ':pk':       carKey(carId),
          ':skPrefix': 'EVENT#',
          ':purchase': 'purchase',
        },
        Select: 'COUNT',
      }));
      if ((existing.Count ?? 0) > 0) {
        return conflict('This car already has a purchase event');
      }
    }

    const eventId  = newId();
    const isoDate  = new Date(date).toISOString();
    const now      = new Date().toISOString();

    const item: Record<string, unknown> = {
      PK:          carKey(carId),
      SK:          eventKey(isoDate, eventId),
      eventId,
      carId,
      date:        isoDate,
      type,
      description,
      amount,
      km,
      photoKeys,
      docKeys,
      createdAt:   now,
      updatedAt:   now,
    };

    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

    return created({
      eventId,
      carId,
      date:        isoDate,
      type,
      description,
      amount,
      km,
      photos:    photoKeys,
      documents: docKeys,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    return serverError(err);
  }
};
