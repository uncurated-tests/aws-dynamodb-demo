import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { batchWriteItems } from './db';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

async function readMovieTitlesFromCSV(): Promise<string[]> {
  const movieTitles = new Set<string>();
  const csvFilePath = path.resolve(__dirname, 'movies.csv');

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        const title = row.title?.trim();
        if (title) {
          movieTitles.add(title);
        }
      })
      .on('end', () => {
        const uniqueMovieTitles = Array.from(movieTitles);
        console.log(
          `Parsed ${uniqueMovieTitles.length} unique movies from CSV.`,
        );
        resolve(uniqueMovieTitles);
      })
      .on('error', (error) => {
        console.error('Error reading CSV file:', error);
        reject(error);
      });
  });
}

async function main() {
  const movieTitles = await readMovieTitlesFromCSV();
  const defaultDate = new Date('2024-12-07');
  const batchSize = 25;

  for (let i = 0; i < movieTitles.length; i += batchSize) {
    try {
      const batch = movieTitles.slice(i, i + batchSize).map((title, index) => {
        const movieId = (i + index + 1).toString();
        return {
          PK: `MOVIE#${movieId}`,
          SK: `MOVIE#${movieId}`,
          entityType: 'movie',
          id: movieId,
          title,
          score: 0,
          lastVoteTime: defaultDate.toISOString(),
        };
      });
      
      await batchWriteItems(batch);

      console.log(`Inserted ${Math.min(i + batchSize, movieTitles.length)} / ${movieTitles.length} movies`);
    } catch (error) {
      console.error('Batch insert error:', error);
      throw error;
    }
  }

  console.log(`Seeded ${movieTitles.length} movies`);
  process.exit();
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
