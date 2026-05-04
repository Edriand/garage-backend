/**
 * DELETE /cars/{carId}/events/{eventId}
 * Deletes an event. Queries first to resolve the full SK.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, noContent, notFound, serverError, carKey,
} from '../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const carId   = event.pathParameters?.carId;
    const eventId = event.pathParameters?.eventId;

    if (!carId)   return notFound('carId path parameter is required');
    if (!eventId) return notFound('eventId path parameter is required');

    // Resolve the full SK
    const found = await ddb.send(new QueryCommand({
      TableName:              TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression:       'eventId = :eventId',
      ExpressionAttributeValues: {
        ':pk':       carKey(carId),
        ':skPrefix': 'EVENT#',
        ':eventId':  eventId,
      },
      Limit: 1,
    }));

    const existing = found.Items?.[0];
    if (!existing) return notFound('Event not found');

    await ddb.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: existing.PK, SK: existing.SK },
    }));

    return noContent();
  } catch (err) {
    return serverError(err);
  }
};
