/**
 * PUT /cars/{carId}/events/{eventId}
 * Updates a maintenance event.
 *
 * Because the SK encodes the timestamp, we first query to find the full SK,
 * then run UpdateItem.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, badRequest, notFound, serverError, carKey, assertCarOwnership,
} from '../shared/utils';

type EventType = 'mechanic' | 'fuel' | 'insurance' | 'wash' | 'other';
const VALID_TYPES: EventType[] = ['mechanic', 'fuel', 'insurance', 'wash', 'other'];

interface UpdateEventBody {
  date?:        string;
  type?:        EventType;
  description?: string;
  amount?:      number;
  km?:          number;
  photoKeys?:   string[];
  docKeys?:     string[];
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId  = getUserId(event);
    const carId   = event.pathParameters?.carId;
    const eventId = event.pathParameters?.eventId;

    if (!carId)   return notFound('carId path parameter is required');
    if (!eventId) return notFound('eventId path parameter is required');
    if (!event.body) return badRequest('Request body is required');

    if (!await assertCarOwnership(userId, carId)) return notFound('Car not found');

    let body: UpdateEventBody;
    try {
      body = JSON.parse(event.body);
    } catch {
      return badRequest('Invalid JSON body');
    }

    if (body.date !== undefined) {
      return badRequest('date cannot be updated; delete and recreate the event to change its date');
    }
    if (body.type && !VALID_TYPES.includes(body.type)) {
      return badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`);
    }

    // Find the existing item to get its full SK
    const found = await ddb.send(new QueryCommand({
      TableName:              TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression:       'eventId = :eventId',
      ExpressionAttributeValues: {
        ':pk':       carKey(carId),
        ':skPrefix': 'EVENT#',
        ':eventId':  eventId,
      },
    }));

    const existing = found.Items?.[0];
    if (!existing) return notFound('Event not found');

    const allowedFields = ['type', 'description', 'amount', 'km', 'photoKeys', 'docKeys'] as const;
    const updates = allowedFields.filter(f => body[f] !== undefined);
    if (updates.length === 0) return badRequest('No valid fields to update');

    const now = new Date().toISOString();
    const setExpressions = [...updates.map((f, i) => `#f${i} = :v${i}`), '#updatedAt = :updatedAt'];
    const exprNames:  Record<string, string> = { '#updatedAt': 'updatedAt' };
    const exprValues: Record<string, unknown>  = { ':updatedAt': now };

    updates.forEach((field, i) => {
      exprNames[`#f${i}`]  = field;
      exprValues[`:v${i}`] = body[field];
    });

    const result = await ddb.send(new UpdateCommand({
      TableName:                 TABLE_NAME,
      Key:                       { PK: existing.PK, SK: existing.SK },
      UpdateExpression:          `SET ${setExpressions.join(', ')}`,
      ExpressionAttributeNames:  exprNames,
      ExpressionAttributeValues: exprValues,
      ReturnValues:              'ALL_NEW',
    }));

    const item = result.Attributes!;
    return ok({
      eventId:     item.eventId,
      carId:       item.carId,
      date:        item.date,
      type:        item.type,
      description: item.description,
      amount:      item.amount,
      km:          item.km ?? null,
      photos:      item.photoKeys ?? [],
      documents:   item.docKeys   ?? [],
      createdAt:   item.createdAt,
      updatedAt:   item.updatedAt,
    });
  } catch (err) {
    return serverError(err);
  }
};
