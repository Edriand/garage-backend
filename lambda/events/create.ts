/**
 * POST /cars/{carId}/events
 * Creates a new maintenance/fuel/insurance event for a car.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, created, badRequest, notFound, serverError,
  carKey, eventKey, newId, assertCarOwnership,
} from '../shared/utils';

type EventType = 'mechanic' | 'fuel' | 'insurance' | 'other';

interface CreateEventBody {
  date:        string;
  type:        EventType;
  description: string;
  amount:      number;
  photoKeys?:  string[];
  docKeys?:    string[];
}

const VALID_TYPES: EventType[] = ['mechanic', 'fuel', 'insurance', 'other'];

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

    const { date, type, description, amount, photoKeys = [], docKeys = [] } = body;

    if (!date || !type || !description || amount === undefined) {
      return badRequest('Missing required fields: date, type, description, amount');
    }
    if (!VALID_TYPES.includes(type)) {
      return badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`);
    }

    const eventId  = newId();
    const isoDate  = new Date(date).toISOString();
    const now      = new Date().toISOString();

    const item = {
      PK:          carKey(carId),
      SK:          eventKey(isoDate, eventId),
      eventId,
      carId,
      date:        isoDate,
      type,
      description,
      amount,
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
      photos:    photoKeys,
      documents: docKeys,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    return serverError(err);
  }
};
