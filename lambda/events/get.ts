/**
 * GET /cars/{carId}/events/{eventId}
 * Returns a single event by ID.
 *
 * Note: The DynamoDB SK is EVENT#{isoDate}#{eventId}. Since we don't know
 * the timestamp at query time, we use a Query with a filter instead of GetItem.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, notFound, serverError, carKey, assertCarOwnership,
} from '../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId  = getUserId(event);
    const carId   = event.pathParameters?.carId;
    const eventId = event.pathParameters?.eventId;

    if (!carId)   return notFound('carId path parameter is required');
    if (!eventId) return notFound('eventId path parameter is required');

    if (!await assertCarOwnership(userId, carId)) return notFound('Car not found');

    const result = await ddb.send(new QueryCommand({
      TableName:              TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression:       'eventId = :eventId',
      ExpressionAttributeValues: {
        ':pk':       carKey(carId),
        ':skPrefix': 'EVENT#',
        ':eventId':  eventId,
      },
    }));

    const item = result.Items?.[0];
    if (!item) return notFound('Event not found');

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
