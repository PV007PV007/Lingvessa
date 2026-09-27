import { loadP1Config, safeStartupRecord } from '../../../infra/config/runtime.js';
import { postgresProbe } from '../../../infra/health/probe.js';
import { createApi } from './app.js';
import { createFoundationPool } from '../../../infra/persistence/database.js';
import { IdentityRepository } from '../../../infra/persistence/identity.js';
import { ContentRepository } from '../../../infra/persistence/content.js';
import { LessonRepository } from '../../../infra/persistence/lessons.js';

import {MasteryRepository} from '../../../infra/persistence/mastery.js';
import {ReviewRepository} from '../../../infra/persistence/review.js';
import {CollectionRepository} from '../../../infra/persistence/collections.js';
import {ResetRepository} from '../../../infra/persistence/resets.js';

import {MediaRepository} from '../../../infra/persistence/media.js';
import {mediaStore} from '../../../infra/config/media.js';

async function main() {
  const config = loadP1Config({ ...process.env, SERVICE_NAME: 'api' });
  const probe = postgresProbe(config);
  const pool = createFoundationPool(config.DATABASE_URL!);
  const assets=mediaStore(process.env);
  const app = await createApi(probe, { identity: new IdentityRepository(pool), content: new ContentRepository(pool,assets),media:new MediaRepository(pool,assets), lessons: new LessonRepository(pool), p4:{mastery:new MasteryRepository(pool),review:new ReviewRepository(pool),collections:new CollectionRepository(pool),resets:new ResetRepository(pool)} });
  let stopping = false;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
    if (stopping) return;
    stopping = true;
    void app.close().then(() => Promise.all([probe.close(), pool.end()]));
  });
  await app.listen(config.PORT, config.HOST);
  console.log(JSON.stringify({ event: 'started', ...safeStartupRecord(config) }));
}
main().catch(() => {
  console.error('API startup failed; configuration and connection details redacted.');
  process.exitCode = 1;
});
