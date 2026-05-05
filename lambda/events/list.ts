/**
 * GET /cars/{carId}/events
 * Returns events for a car, newest first, paginated.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, notFound, serverError, carKey, assertCarOwnership,
} from '../shared/utils';

const PAGE_SIZE = 300;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const carId  = event.pathParameters?.carId;
    if (!carId) return notFound('carId path parameter is required');

    if (!await assertCarOwnership(userId, carId)) return notFound('Car not found');

    // Decode optional pagination token
    const nextTokenEncoded = event.queryStringParameters?.nextToken;
    let exclusiveStartKey: Record<string, unknown> | undefined;
    if (nextTokenEncoded) {
      try {
        exclusiveStartKey = JSON.parse(
          Buffer.from(nextTokenEncoded, 'base64').toString('utf8'),
        );
      } catch {
        // Ignore invalid token — start from the beginning
      }
    }

    const result = await ddb.send(new QueryCommand({
      TableName:              TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk':       carKey(carId),
        ':skPrefix': 'EVENT#',
      },
      ScanIndexForward:   false,   // newest first
      Limit:              PAGE_SIZE,
      ExclusiveStartKey:  exclusiveStartKey as Record<string, import('@aws-sdk/client-dynamodb').AttributeValue>,
    }));

    const events = (result.Items ?? []).map(item => ({
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
    }));

    const nextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return ok({ events, ...(nextToken ? { nextToken } : {}) });
  } catch (err) {
    return serverError(err);
  }
};
