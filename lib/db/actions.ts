'use server';

import { Movie } from '@/lib/db/queries';
import { getClient } from './db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

export async function voteAction(
  movie: Movie,
  score: number,
  lastVoteTime: Date,
) {
  const client = await getClient();
  const cookieStore = await cookies();
  const tableName = process.env.DB_TABLE_NAME;
  
  if (!tableName) {
    throw new Error('DB_TABLE_NAME environment variable is required');
  }

  let sessionId = cookieStore.get('sessionId')?.value;
  if (!sessionId) {
    sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    // Create session
    const sessionParams = {
      TableName: tableName,
      Item: {
        PK: `SESSION#${sessionId}`,
        SK: `SESSION#${sessionId}`,
        entityType: 'session',
        id: sessionId,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        GSI1PK: `SESSION#${sessionId}`,
        GSI1SK: `SESSION#${sessionId}`,
      },
    };
    
    await client.send(new PutCommand(sessionParams));
    
    cookieStore.set('sessionId', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });
  }

  // Check if vote already exists
  const voteKey = {
    TableName: tableName,
    Key: {
      PK: `VOTE#${sessionId}#${movie.id}`,
      SK: `VOTE#${sessionId}#${movie.id}`,
    },
  };
  
  const existingVote = await client.send(new GetCommand(voteKey));
  if (existingVote.Item) {
    return movie;
  }

  // Create vote record
  const voteParams = {
    TableName: tableName,
    Item: {
      PK: `VOTE#${sessionId}#${movie.id}`,
      SK: `VOTE#${sessionId}#${movie.id}`,
      entityType: 'vote',
      sessionId,
      movieId: movie.id,
      createdAt: new Date().toISOString(),
      GSI1PK: `SESSION#${sessionId}`,
      GSI1SK: `MOVIE#${movie.id}`,
    },
  };
  
  await client.send(new PutCommand(voteParams));

  // Update movie score
  const updateParams = {
    TableName: tableName,
    Key: {
      PK: `MOVIE#${movie.id}`,
      SK: `MOVIE#${movie.id}`,
    },
    UpdateExpression: 'SET score = :score, lastVoteTime = :lastVoteTime',
    ExpressionAttributeValues: {
      ':score': score,
      ':lastVoteTime': lastVoteTime.toISOString(),
    },
  };
  
  await client.send(new UpdateCommand(updateParams));

  revalidatePath('/');
}
