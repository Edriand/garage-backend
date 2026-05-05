/**
 * GET /garage
 * Returns the authenticated user's garage settings.
 * Returns { isPublic: false } if no settings item exists yet.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, serverError,
  userKey, GARAGE_SETTINGS_SK,
} from '../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);

    const result = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: userKey(userId),
        SK: GARAGE_SETTINGS_SK,
      },
    }));

    if (!result.Item) {
      return ok({ isPublic: false });
    }

    return ok({
      isPublic:  result.Item.isPublic ?? false,
      updatedAt: result.Item.updatedAt,
    });
  } catch (err) {
    return serverError(err);
  }
};
