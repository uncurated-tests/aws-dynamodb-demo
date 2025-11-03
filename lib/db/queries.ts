import { getClient } from './db';
import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { performance } from 'perf_hooks';

export interface Movie {
  id: string;
  title: string;
  score: number;
  lastVoteTime: string;
  hasVoted: boolean;
}

export interface MoviesResult {
  movies: Movie[];
  totalRecords: number;
  queryTimeMs: string;
}

export async function getMovies(sessionId?: string, filter?: string): Promise<MoviesResult> {
  const client = await getClient();
  const startTime = performance.now();
  const tableName = process.env.DB_TABLE_NAME;
  
  if (!tableName) {
    throw new Error('DB_TABLE_NAME environment variable is required');
  }

  try {
    // Get movies
    const movieParams: any = {
      TableName: tableName,
      FilterExpression: 'entityType = :entityType',
      ExpressionAttributeValues: {
        ':entityType': 'movie',
      },
    };

    if (filter) {
      movieParams.FilterExpression += ' AND contains(title, :filter)';
      movieParams.ExpressionAttributeValues[':filter'] = filter;
    }

    const movieCommand = new ScanCommand(movieParams);
    const movieResult = await client.send(movieCommand);
    
    let movies = movieResult.Items || [];
    
    // Check votes for session if provided
    if (sessionId) {
      const voteParams = {
        TableName: tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :sessionId',
        ExpressionAttributeValues: {
          ':sessionId': `SESSION#${sessionId}`,
        },
      };
      
      const voteCommand = new QueryCommand(voteParams);
      const voteResult = await client.send(voteCommand);
      const votedMovieIds = new Set((voteResult.Items || []).map(vote => vote.movieId));
      
      movies = movies.map(movie => ({
        ...movie,
        hasVoted: votedMovieIds.has(movie.id),
      }));
    } else {
      movies = movies.map(movie => ({ ...movie, hasVoted: false }));
    }

    const endTime = performance.now();
    const queryTimeMs = (endTime - startTime).toFixed(2);

    return {
      movies: movies as Movie[],
      totalRecords: movies.length,
      queryTimeMs,
    };
  } catch (error) {
    console.error('Error fetching movies:', error);
    throw error;
  }
}
