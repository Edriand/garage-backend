/**
 * GET /cars/{carId}
 * Returns a single car by ID for the authenticated user.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, notFound, serverError,
  userKey, carKey,
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
    return ok({
      carId:            item.carId,
      userId:           item.userId,
      brand:            item.brand,
      model:            item.model,
      year:             item.year,
      registrationYear: item.registrationYear,
      photoUrl:         item.photoKey ?? null,
      isPublic:         item.isPublic ?? false,
      likeCount:        item.likeCount ?? 0,
      createdAt:        item.createdAt,
      updatedAt:        item.updatedAt,
    });
  } catch (err) {
    return serverError(err);
  }
};
