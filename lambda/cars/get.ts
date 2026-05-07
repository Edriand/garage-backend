/**
 * GET /cars/{carId}
 * Returns a single car by ID for the authenticated user.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, notFound, serverError,
  userKey, carKey, likeKey,
} from '../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const carId  = event.pathParameters?.carId;

    if (!carId) return notFound('carId path parameter is required');

    const result = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: userKey(userId),
        SK: carKey(carId),
      },
    }));

    if (!result.Item) return notFound('Car not found');

    const item = result.Item;

    // Check if the authenticated user has already liked this car
    const likeResult = await ddb.send(new GetCommand({
      TableName:            TABLE_NAME,
      Key:                  { PK: carKey(carId), SK: likeKey(userId) },
      ProjectionExpression: 'userId',
    }));
    const isLiked = likeResult.Item != null;

    return ok({
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
      isLiked,
      createdAt:        item.createdAt,
      updatedAt:        item.updatedAt,
    });
  } catch (err) {
    return serverError(err);
  }
};
