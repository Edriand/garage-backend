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

type EventType = 'mechanic' | 'fuel' | 'wash' | 'insurance' | 'other';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const carId  = event.pathParameters?.carId;
    if (!carId) return notFound('carId path parameter is required');

    // Single read — ownership check + totalKm in one call
    const carResult = await ddb.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: userKey(userId), SK: carKey(carId) },
    }));
    if (!carResult.Item) return notFound('Car not found');

    const totalKm: number = carResult.Item.totalKm ?? 0;

    // Aggregate all events with internal pagination (caller never sees tokens)
    let totalCost = 0;
    let eventCount = 0;
    let lastKmReading: number | null = null;
    const byType: Record<EventType, number> = {
      mechanic: 0, fuel: 0, wash: 0, insurance: 0, other: 0,
    };

    // Descending order so the first event with km is already the most recent
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    do {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk':       carKey(carId),
          ':skPrefix': 'EVENT#',
        },
        ScanIndexForward:  false,
        ExclusiveStartKey: lastEvaluatedKey as Record<string, import('@aws-sdk/client-dynamodb').AttributeValue>,
      }));

      for (const item of result.Items ?? []) {
        eventCount++;
        const amount: number = item.amount ?? 0;
        totalCost += amount;

        const t = item.type as EventType;
        if (t in byType) {
          byType[t] += amount;
        } else {
          byType.other += amount;
        }

        if (item.km != null && lastKmReading === null) {
          lastKmReading = item.km as number;
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);

    return ok({
      totalKm,
      totalCost:    round2(totalCost),
      eventCount,
      byType: {
        mechanic:  round2(byType.mechanic),
        fuel:      round2(byType.fuel),
        wash:      round2(byType.wash),
        insurance: round2(byType.insurance),
        other:     round2(byType.other),
      },
      lastKmReading,
    });
  } catch (err) {
    return serverError(err);
  }
};
