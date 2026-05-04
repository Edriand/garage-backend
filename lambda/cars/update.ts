/**
 * PUT /cars/{carId}
 * Updates a car owned by the authenticated user.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, badRequest, notFound, serverError,
  userKey, carKey,
} from '../shared/utils';

type UpdateableCarFields = {
  brand?:            string;
  model?:            string;
  year?:             number;
  registrationYear?: number;
  totalKm?:          number;
  totalInvested?:    number;
  photoKey?:         string;
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const carId  = event.pathParameters?.carId;

    if (!carId) return notFound('carId path parameter is required');
    if (!event.body) return badRequest('Request body is required');

    let body: UpdateableCarFields;
    try {
      body = JSON.parse(event.body);
    } catch {
      return badRequest('Invalid JSON body');
    }

    const allowedFields: (keyof UpdateableCarFields)[] = [
      'brand', 'model', 'year', 'registrationYear', 'totalKm', 'totalInvested', 'photoKey',
    ];

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
      Key:                       { PK: userKey(userId), SK: carKey(carId) },
      UpdateExpression:          `SET ${setExpressions.join(', ')}`,
      ExpressionAttributeNames:  exprNames,
      ExpressionAttributeValues: exprValues,
      ConditionExpression:       'attribute_exists(PK)',
      ReturnValues:              'ALL_NEW',
    }));

    const item = result.Attributes!;
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
      createdAt:        item.createdAt,
      updatedAt:        item.updatedAt,
    });
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      return notFound('Car not found');
    }
    return serverError(err);
  }
};
