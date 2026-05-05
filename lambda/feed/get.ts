/**
 * GET /feed
 * Returns a paginated list of public cars sorted by latest or most liked.
 * No authentication required.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, ok, badRequest, serverError,
  PUBLIC_CARS_INDEX, GSI1PK,
} from '../shared/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const params = event.queryStringParameters ?? {};
    const sort = params.sort === 'likes' ? 'likes' : 'latest';
    const limit = Math.min(parseInt(params.limit ?? '20') || 20, 50);
    const nextToken = params.nextToken;

    let exclusiveStartKey: Record<string, any> | undefined;
    if (nextToken) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString('utf-8'));
      } catch {
        return badRequest('Invalid nextToken');
      }
    }

    const queryParams: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: PUBLIC_CARS_INDEX,
      KeyConditionExpression: '#gsi1pk = :pk',
      ExpressionAttributeNames: { '#gsi1pk': GSI1PK },
      ExpressionAttributeValues: { ':pk': 'PUBLIC' },
      ScanIndexForward: false,
      Limit: limit,
    };

    if (exclusiveStartKey) {
      queryParams.ExclusiveStartKey = exclusiveStartKey;
    }

    const result = await ddb.send(new QueryCommand(queryParams));

    const cars = (result.Items ?? []).map((item) => ({
      carId: item.carId,
      userId: item.userId,
      brand: item.brand,
      model: item.model,
      year: item.year,
      likeCount: item.likeCount ?? 0,
      photoUrl: item.photoKey ?? null,
      createdAt: item.createdAt,
    }));

    let nextTokenOutput: string | undefined;
    if (result.LastEvaluatedKey) {
      nextTokenOutput = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    return ok({
      cars,
      nextToken: nextTokenOutput,
    });
  } catch (err) {
    return serverError(err);
  }
};