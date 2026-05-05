/**
 * GET /cars
 * Returns all cars belonging to the authenticated user.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, getUserId, ok, serverError, userKey, carKey } from '../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);

    const result = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk':       userKey(userId),
        ':skPrefix': carKey(''),
      },
    }));

    const cars = (result.Items ?? []).map(item => ({
      carId:            item.carId,
      userId:           item.userId,
      brand:            item.brand,
      model:            item.model,
      year:             item.year,
      registrationYear: item.registrationYear,
      totalKm:          item.totalKm,
      totalInvested:    item.totalInvested,
      photoUrl:         item.photoKey ?? null,
      isPublic:         item.isPublic ?? false,
      likeCount:        item.likeCount ?? 0,
      createdAt:        item.createdAt,
      updatedAt:        item.updatedAt,
    }));

    return ok({ cars });
  } catch (err) {
    return serverError(err);
  }
};
