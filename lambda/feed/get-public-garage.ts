/**
 * GET /users/{userId}/garage
 * Returns the public profile of another user's garage.
 * Returns 404 if the garage is private.
 * No authentication required.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, ok, notFound, serverError,
  userKey, GARAGE_SETTINGS_SK, carKey, PUBLIC_CARS_INDEX, GSI1PK,
} from '../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.pathParameters?.userId;
    if (!userId) return notFound('userId path parameter is required');

    const garageResult = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: userKey(userId), SK: GARAGE_SETTINGS_SK },
    }));

    if (!garageResult.Item || !garageResult.Item.isPublic) {
      return notFound('Garage not found or is private');
    }

    const carsResult = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: PUBLIC_CARS_INDEX,
      KeyConditionExpression: '#gsi1pk = :pk',
      FilterExpression: 'userId = :userId',
      ExpressionAttributeNames: { '#gsi1pk': GSI1PK },
      ExpressionAttributeValues: { ':pk': 'PUBLIC', ':userId': userId },
      ScanIndexForward: false,
      Limit: 50,
    }));

    const cars = (carsResult.Items ?? []).map((item) => ({
      carId: item.carId,
      brand: item.brand,
      model: item.model,
      year: item.year,
      likeCount: item.likeCount ?? 0,
      photoUrl: item.photoKey ?? null,
      createdAt: item.createdAt,
    }));

    return ok({
      userId,
      isPublic: true,
      updatedAt: garageResult.Item.updatedAt,
      cars,
    });
  } catch (err) {
    return serverError(err);
  }
};