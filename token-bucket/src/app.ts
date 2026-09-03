import express, { type Express, type Request, type Response } from 'express';

import { rateLimitMiddleware } from './rateLimitMiddleware.js';

const app: Express = express();
app.use(express.json());

app.use(rateLimitMiddleware);

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log(`app is running on port ${3000}`);
});


