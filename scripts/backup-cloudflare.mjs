import {
  spawn,
} from 'node:child_process';
import {
  createHash,
} from 'node:crypto';
import {
  createWriteStream,
} from 'node:fs';
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {
  loadEnvFile,
} from 'node:process';
import {
  pipeline,
} from 'node:stream/promises';
import {
  Transform,
} from 'node:stream';
import {
  GetObjectCommand,
  S3Client,
  paginateListObjectsV2,
} from '@aws-sdk/client-s3';

const DATABASE_NAME =
  'our-love-story';
const DEFAULT_BUCKET =
  'our-love-story-media';

try {
  loadEnvFile('.dev.vars');
} catch {
  // Operator shells and CI can provide the required variables directly.
}

const timestamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, '-');
const outputRoot = path.resolve(
  readOption('--output')
    ?? path.join(
      '..',
      'our-love-story-backups',
      timestamp,
    ),
);
const databaseDirectory =
  path.join(outputRoot, 'database');
const objectDirectory =
  path.join(outputRoot, 'objects');
const databaseFile = path.join(
  databaseDirectory,
  `${DATABASE_NAME}.sql`,
);

const accountId =
  requiredEnvironment(
    'R2_ACCOUNT_ID',
  );
const accessKeyId =
  requiredEnvironment(
    'R2_ACCESS_KEY_ID',
  );
const secretAccessKey =
  requiredEnvironment(
    'R2_SECRET_ACCESS_KEY',
  );
const bucket =
  process.env.R2_BUCKET_NAME
  || DEFAULT_BUCKET;

await mkdir(databaseDirectory, {
  recursive: true,
});
await mkdir(objectDirectory, {
  recursive: true,
});

console.log(
  `Backing up D1 and R2 to ${outputRoot}`,
);
await exportDatabase(databaseFile);

const client = new S3Client({
  region: 'auto',
  endpoint:
    `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});
const objects = [];
let totalBytes = 0;
const pages = paginateListObjectsV2(
  { client },
  { Bucket: bucket },
);

for await (const page of pages) {
  for (
    const listed
    of page.Contents ?? []
  ) {
    if (!listed.Key) continue;

    const key = listed.Key;
    const filename =
      `${createHash('sha256')
        .update(key)
        .digest('hex')}.bin`;
    const relativeFile =
      path.posix.join(
        'objects',
        filename,
      );
    const destination =
      path.join(
        objectDirectory,
        filename,
      );
    const response =
      await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );

    if (
      !response.Body
      || typeof response.Body.pipe
        !== 'function'
    ) {
      throw new Error(
        `R2 object ${key} did not return a readable stream.`,
      );
    }

    const contentHash =
      createHash('sha256');
    const hashingStream =
      new Transform({
        transform(
          chunk,
          _encoding,
          callback,
        ) {
          contentHash.update(chunk);
          callback(null, chunk);
        },
      });

    await pipeline(
      response.Body,
      hashingStream,
      createWriteStream(
        destination,
        { flags: 'wx' },
      ),
    );

    const size =
      Number(
        response.ContentLength
        ?? listed.Size
        ?? 0,
      );
    totalBytes += size;
    objects.push({
      key,
      file: relativeFile,
      size,
      sha256:
        contentHash.digest('hex'),
      etag:
        response.ETag
        ?? listed.ETag
        ?? null,
      lastModified:
        (
          response.LastModified
          ?? listed.LastModified
        )?.toISOString()
        ?? null,
      contentType:
        response.ContentType
        ?? null,
      cacheControl:
        response.CacheControl
        ?? null,
      metadata:
        response.Metadata
        ?? {},
    });
    console.log(
      `Saved ${objects.length} R2 object(s)`,
    );
  }
}

const manifest = {
  formatVersion: 1,
  createdAt:
    new Date().toISOString(),
  database: {
    name: DATABASE_NAME,
    file:
      path.posix.join(
        'database',
        `${DATABASE_NAME}.sql`,
      ),
  },
  r2: {
    bucket,
    objectCount:
      objects.length,
    totalBytes,
    objects,
  },
};
await writeFile(
  path.join(
    outputRoot,
    'manifest.json',
  ),
  `${JSON.stringify(
    manifest,
    null,
    2,
  )}\n`,
  {
    encoding: 'utf8',
    flag: 'wx',
  },
);

console.log(
  `Backup complete: ${objects.length} object(s), ${totalBytes} byte(s).`,
);

function readOption(
  option,
) {
  const index =
    process.argv.indexOf(option);
  if (index === -1) return null;
  const value =
    process.argv[index + 1];
  if (!value) {
    throw new Error(
      `${option} requires a path.`,
    );
  }
  return value;
}

function requiredEnvironment(
  name,
) {
  const value =
    process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Set it in the shell or .dev.vars.`,
    );
  }
  return value;
}

async function exportDatabase(
  outputFile,
) {
  const executable =
    process.platform === 'win32'
      ? 'npx.cmd'
      : 'npx';
  const child = spawn(
    executable,
    [
      'wrangler',
      'd1',
      'export',
      DATABASE_NAME,
      '--remote',
      '--skip-confirmation',
      '--output',
      outputFile,
    ],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  const exitCode =
    await new Promise(
      (resolve, reject) => {
        child.once('error', reject);
        child.once(
          'exit',
          (code) =>
            resolve(code),
        );
      },
    );
  if (exitCode !== 0) {
    throw new Error(
      `D1 export failed with exit code ${exitCode}.`,
    );
  }
}
