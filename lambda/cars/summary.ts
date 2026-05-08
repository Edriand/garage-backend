/**
 * GET /cars/{carId}/summary
 * Returns aggregate statistics for a car computed from all its events.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  ddb, TABLE_NAME, getUserId, ok, notFound, serverError,
  userKey, carKey,
} from '../shared/utils';

type EventType = 'mechanic' | 'fuel' | 'wash' | 'insurance' | 'modification' | 'other';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const carId  = event.pathParameters?.carId;
    if (!carId) return notFound('carId path parameter is required');

    const carResult = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: userKey(userId), SK: carKey(carId) },
    }));
    if (!carResult.Item) return notFound('Car not found');

    let purchaseCost     = 0;
    let totalRunningCost = 0;
    let eventCount       = 0;
    let currentKm: number | null = null;
    let latestDate: string | null = null;

    const byType: Record<EventType, number> = {
      mechanic: 0, fuel: 0, wash: 0, insurance: 0, modification: 0, other: 0,
    };

    let lastEvaluatedKey: Record<string, unknown> | undefined;
    do {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk':       carKey(carId),
          ':skPrefix': 'EVENT#',
        },
        ProjectionExpression:     '#t, amount, km, #d',
        ExpressionAttributeNames: { '#t': 'type', '#d': 'date' },
        ExclusiveStartKey: lastEvaluatedKey as Record<string, import('@aws-sdk/client-dynamodb').AttributeValue>,
      }));

      for (const item of result.Items ?? []) {
        eventCount++;
        const amount: number = item.amount ?? 0;
        const itemDate: string | undefined = item.date;

        if (item.type === 'purchase') {
          purchaseCost += amount;
        } else {
          totalRunningCost += amount;
          const t = item.type as EventType;
          if (t in byType) {
            byType[t] += amount;
          } else {
            byType.other += amount;
          }
        }

        if (item.km != null && itemDate != null) {
          if (latestDate === null || itemDate > latestDate) {
            latestDate = itemDate;
            currentKm  = item.km as number;
          }
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);

    return ok({
      currentKm,
      purchaseCost:     round2(purchaseCost),
      totalRunningCost: round2(totalRunningCost),
      totalCost:        round2(purchaseCost + totalRunningCost),
      byType: {
        mechanic:     round2(byType.mechanic),
        fuel:         round2(byType.fuel),
        wash:         round2(byType.wash),
        insurance:    round2(byType.insurance),
        modification: round2(byType.modification),
        other:        round2(byType.other),
      },
      eventCount,
    });
  } catch (err) {
    return serverError(err);
  }
};
